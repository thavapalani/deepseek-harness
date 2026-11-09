import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessPlugin, PluginContext } from "../types.js";

export class DocumentationPlugin implements HarnessPlugin {
  readonly name = "documentation";

  async planningContext(): Promise<string> {
    return "Include user-facing, operator-facing, API, configuration, and migration documentation when affected. Documentation changes must be reviewed like code.";
  }

  async beforePullRequest({ issue, state, workspace }: PluginContext): Promise<void> {
    if (!state.plan) return;
    const directory = path.join(workspace, ".dsh", "reports");
    await mkdir(directory, { recursive: true });
    const body = [
      `# Issue ${issue.number} implementation`,
      "",
      state.plan.summary,
      "",
      "## Acceptance criteria",
      "",
      ...state.plan.acceptanceCriteria.map((item) => `- ${item}`),
      "",
      "## Planned documentation",
      "",
      ...state.plan.documentation.map((item) => `- ${item}`),
      ""
    ].join("\n");
    await writeFile(path.join(directory, `issue-${issue.number}.md`), body, "utf8");
  }
}
