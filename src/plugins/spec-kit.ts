import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessPlugin, PluginContext } from "../types.js";

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded";
}

export class SpecKitPlugin implements HarnessPlugin {
  readonly name = "spec-kit";

  async planningContext(): Promise<string> {
    return "Use spec-driven development: keep requirements technology-neutral, make acceptance criteria testable, and separate plan from implementation tasks.";
  }

  async beforeImplementation({ issue, state, workspace }: PluginContext): Promise<void> {
    if (!state.plan) return;
    const directory = path.join(workspace, ".dsh", "specs", `issue-${issue.number}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "spec.md"), `# ${issue.title}\n\n${issue.body}\n\n## Acceptance criteria\n\n${list(state.plan.acceptanceCriteria)}\n`, "utf8");
    await writeFile(path.join(directory, "plan.md"), `# Plan ${state.planId}\n\n${state.plan.summary}\n\n## Assumptions\n\n${list(state.plan.assumptions)}\n\n## Risks\n\n${list(state.plan.risks)}\n`, "utf8");
    await writeFile(path.join(directory, "tasks.md"), `# Tasks\n\n${state.plan.steps.map((step, index) => `- [ ] ${index + 1}. **${step.title}** — ${step.description}\n  - Verify: ${step.verification}`).join("\n")}\n`, "utf8");
  }
}
