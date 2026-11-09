import { readFile } from "node:fs/promises";
import type { Config } from "./config.js";
import { parseCommand } from "./commands.js";
import { DeepSeekClient } from "./deepseek.js";
import { GitHubService } from "./github.js";
import { ImplementationAgent } from "./agent.js";
import { branchName, commitAndPush, prepareBranch } from "./git.js";
import { generatePlan, generateQuestions, renderPlan, renderQuestions } from "./planning.js";
import { loadPlugins } from "./plugins/index.js";
import { planId } from "./state.js";
import type { HarnessState, IssueContext, PluginContext } from "./types.js";

interface EventPayload {
  action?: string;
  issue?: { number: number; title?: string; body?: string | null; pull_request?: unknown; user?: { login?: string } };
  comment?: { body?: string; user?: { login?: string } };
  sender?: { login?: string };
}

export class Orchestrator {
  private readonly github: GitHubService;
  private readonly deepseek: DeepSeekClient;
  private readonly plugins;

  constructor(private readonly config: Config) {
    this.github = new GitHubService(config);
    this.deepseek = new DeepSeekClient(config);
    this.plugins = loadPlugins(config.plugins);
  }

  async run(): Promise<void> {
    const payload = JSON.parse(await readFile(this.config.GITHUB_EVENT_PATH, "utf8")) as EventPayload;
    const issueNumber = payload.issue?.number;
    if (!issueNumber || payload.issue?.pull_request) return;
    const actor = payload.comment?.user?.login ?? payload.sender?.login ?? payload.issue?.user?.login ?? "unknown";
    const issue = await this.github.context(issueNumber, actor);

    if (!payload.comment && ["opened", "reopened", "labeled"].includes(payload.action ?? "")) {
      if (await this.github.state(issueNumber)) return;
      if (this.config.DSH_TRUSTED_ISSUES_ONLY && !(await this.github.isTrusted(actor))) {
        console.info(`Ignoring issue #${issueNumber} from untrusted actor ${actor}`);
        return;
      }
      await this.intake(issue);
      return;
    }

    if (payload.comment && payload.action === "created") {
      await this.handleCommand(issue, payload.comment.body ?? "");
    }
  }

  private async intake(issue: IssueContext): Promise<void> {
    const questions = await generateQuestions(this.deepseek, issue);
    if (!questions.length) {
      await this.createPlan(issue, "No clarifications were required.");
      return;
    }
    const state: HarnessState = { version: 1, issueNumber: issue.number, phase: "clarifying", questions, updatedAt: new Date().toISOString() };
    await this.github.comment(issue.number, renderQuestions(questions), state);
    await this.github.setLabels(issue.number, ["dsh:clarifying"]);
  }

  private async handleCommand(issue: IssueContext, body: string): Promise<void> {
    const command = parseCommand(body);
    if (command.type === "unknown") return;
    const state = await this.github.state(issue.number);
    if (!state) {
      await this.github.comment(issue.number, "DSH has no active state for this issue. A trusted maintainer can reopen the issue or add the `dsh` label to start intake.");
      return;
    }
    if (command.type === "status") {
      await this.github.comment(issue.number, `DSH status: **${state.phase}**${state.planId ? ` — plan \`${state.planId}\`` : ""}${state.pullRequestUrl ? ` — ${state.pullRequestUrl}` : ""}`);
      return;
    }
    if (command.type === "answer") {
      if (state.phase !== "clarifying") throw new Error("Clarification answers are only accepted in the clarifying phase");
      if (issue.actor !== issue.issueAuthor && !(await this.github.isTrusted(issue.actor))) {
        throw new Error("Only the issue author or a trusted maintainer can answer clarification questions");
      }
      await this.createPlan(issue, command.value);
      return;
    }
    if (command.type === "plan") {
      if (!(await this.github.isTrusted(issue.actor))) throw new Error("Only trusted maintainers can request plan regeneration");
      await this.createPlan(issue, state.answers ?? "No additional answers.");
      return;
    }
    if (command.type === "approve") {
      if (!(await this.github.isTrusted(issue.actor))) throw new Error("Only trusted maintainers can approve plans");
      if (state.phase !== "planned" || state.planId !== command.planId || !state.plan) throw new Error("Approval does not match the current pending plan");
      await this.implement(issue, { ...state, phase: "approved", approvedBy: issue.actor, updatedAt: new Date().toISOString() });
      return;
    }
    if (command.type === "retry") {
      if (!(await this.github.isTrusted(issue.actor))) throw new Error("Only trusted maintainers can retry failed work");
      if (state.phase !== "failed" || !state.plan || !state.planId || !state.approvedBy) throw new Error("There is no approved failed implementation to retry");
      await this.implement(issue, { ...state, phase: "approved", updatedAt: new Date().toISOString(), error: undefined });
    }
  }

  private async createPlan(issue: IssueContext, answers: string): Promise<void> {
    const draft: HarnessState = { version: 1, issueNumber: issue.number, phase: "clarifying", answers, updatedAt: new Date().toISOString() };
    const context: PluginContext = { issue, state: draft, workspace: this.config.GITHUB_WORKSPACE };
    const pluginContext = (await Promise.all(this.plugins.map(async (plugin) => plugin.planningContext?.(context) ?? ""))).filter(Boolean).join("\n\n");
    const plan = await generatePlan(this.deepseek, issue, answers, pluginContext);
    const id = planId(plan);
    const state: HarnessState = { ...draft, phase: "planned", plan, planId: id, updatedAt: new Date().toISOString() };
    await this.github.comment(issue.number, renderPlan(plan, id), state);
    await this.github.setLabels(issue.number, ["dsh:awaiting-approval"]);
  }

  private async implement(issue: IssueContext, approved: HarnessState): Promise<void> {
    const branch = branchName(issue.number, issue.title);
    let state: HarnessState = { ...approved, phase: "implementing", branch, updatedAt: new Date().toISOString() };
    await this.github.comment(issue.number, `Plan \`${state.planId}\` approved by @${state.approvedBy}. Implementation has started on \`${branch}\`.`, state);
    await this.github.setLabels(issue.number, ["dsh:implementing"]);
    try {
      await prepareBranch(this.config.GITHUB_WORKSPACE, branch, issue.defaultBranch);
      const context: PluginContext = { issue, state, workspace: this.config.GITHUB_WORKSPACE };
      for (const plugin of this.plugins) await plugin.beforeImplementation?.(context);
      const agent = new ImplementationAgent(this.config, this.deepseek);
      const summary = await agent.implement(issue, state.plan!);
      const evidence = await agent.verify();
      for (const plugin of this.plugins) await plugin.afterImplementation?.(context);
      for (const plugin of this.plugins) await plugin.beforePullRequest?.(context);
      const commit = await commitAndPush(this.config.GITHUB_WORKSPACE, branch, issue.number);
      const pullRequestUrl = await this.github.createPullRequest({
        title: `Implement #${issue.number}: ${issue.title}`,
        head: branch,
        base: issue.defaultBranch,
        body: [`Closes #${issue.number}`, "", `Approved DSH plan: \`${state.planId}\``, "", "## Implementation", summary, "", "## Sandbox verification", ...evidence.map((item) => `- ${item.split("\n")[0]}`), "", `Commit: \`${commit}\``].join("\n")
      });
      state = { ...state, phase: "pull_request", pullRequestUrl, updatedAt: new Date().toISOString() };
      await this.github.comment(issue.number, `Implementation and sandbox verification passed. Pull request: ${pullRequestUrl}`, state);
      await this.github.setLabels(issue.number, ["dsh:pull-request"]);
    } catch (error) {
      const message = safeError(error);
      state = { ...state, phase: "failed", error: message, updatedAt: new Date().toISOString() };
      await this.github.comment(issue.number, `Implementation stopped safely. No PR was opened.\n\n\`\`\`text\n${message}\n\`\`\`\n\nA trusted maintainer can fix the cause and run \`/dsh retry\`.`, state);
      await this.github.setLabels(issue.number, ["dsh:failed"]);
      throw error;
    }
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(token|key|secret|authorization)[=: ]+\S+/gi, "$1=[REDACTED]").slice(0, 4000);
}
