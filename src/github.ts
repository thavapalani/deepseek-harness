import { Octokit } from "@octokit/rest";
import type { Config } from "./config.js";
import type { HarnessState, IssueContext } from "./types.js";
import { encodeState, latestState } from "./state.js";

export class GitHubService {
  private readonly octokit: Octokit;

  constructor(private readonly config: Config) {
    this.octokit = new Octokit({ auth: config.GITHUB_TOKEN });
  }

  async context(issueNumber: number, actor: string): Promise<IssueContext> {
    const { owner, repo } = this.config;
    const [{ data: issue }, { data: repository }, comments] = await Promise.all([
      this.octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }),
      this.octokit.rest.repos.get({ owner, repo }),
      this.allComments(issueNumber)
    ]);
    return {
      owner,
      repo,
      number: issueNumber,
      title: issue.title,
      body: issue.body ?? "",
      defaultBranch: repository.default_branch,
      actor,
      issueAuthor: issue.user?.login ?? "unknown",
      comments: comments.map((comment) => ({ author: comment.user?.login ?? "unknown", body: comment.body ?? "" }))
    };
  }

  async allComments(issueNumber: number) {
    return this.octokit.paginate(this.octokit.rest.issues.listComments, {
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      per_page: 100
    });
  }

  async state(issueNumber: number): Promise<HarnessState | undefined> {
    const comments = await this.allComments(issueNumber);
    return latestState(comments.filter((comment) => comment.user?.login === this.config.DSH_STATE_AUTHOR));
  }

  async comment(issueNumber: number, body: string, state?: HarnessState): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      body: state ? `${body}\n\n${encodeState(state)}` : body
    });
  }

  async setLabels(issueNumber: number, labels: string[]): Promise<void> {
    for (const label of labels) {
      try {
        await this.octokit.rest.issues.createLabel({
          owner: this.config.owner,
          repo: this.config.repo,
          name: label,
          color: label === "dsh:failed" ? "b60205" : label === "dsh:awaiting-approval" ? "fbca04" : "1d76db",
          description: "Managed by DeepSeek Harness"
        });
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 422) throw error;
      }
    }
    const current = await this.octokit.rest.issues.get({
      owner: this.config.owner, repo: this.config.repo, issue_number: issueNumber
    });
    const names = current.data.labels.map((label) => typeof label === "string" ? label : label.name).filter(Boolean) as string[];
    const withoutDshPhase = names.filter((name) => !name.startsWith("dsh:"));
    await this.octokit.rest.issues.setLabels({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      labels: [...new Set([...withoutDshPhase, ...labels])]
    });
  }

  async isTrusted(login: string): Promise<boolean> {
    try {
      const { data } = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner: this.config.owner, repo: this.config.repo, username: login
      });
      return ["admin", "maintain", "write"].includes(data.permission);
    } catch {
      return false;
    }
  }

  async createPullRequest(input: { title: string; body: string; head: string; base: string }): Promise<string> {
    const { data } = await this.octokit.rest.pulls.create({
      owner: this.config.owner,
      repo: this.config.repo,
      ...input
    });
    return data.html_url;
  }
}
