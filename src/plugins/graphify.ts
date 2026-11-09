import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessPlugin, PluginContext } from "../types.js";
import { runProcess } from "../process.js";

export class GraphifyPlugin implements HarnessPlugin {
  readonly name = "graphify";

  async planningContext({ workspace }: PluginContext): Promise<string> {
    const report = path.join(workspace, "graphify-out", "GRAPH_REPORT.md");
    try {
      const content = await readFile(report, "utf8");
      return `Existing Graphify architecture report (possibly stale):\n${content.slice(0, 12_000)}`;
    } catch {
      return "No existing Graphify report was found. Infer architecture from repository files and keep coupling explicit.";
    }
  }

  async afterImplementation({ workspace }: PluginContext): Promise<void> {
    try {
      await access(path.join(workspace, "graphify-out", "graph.json"));
      const result = await runProcess("graphify", [".", "--update", "--no-viz"], workspace, 15 * 60_000);
      if (result.exitCode !== 0) console.warn(`Graphify refresh skipped: ${result.stderr.slice(0, 500)}`);
    } catch {
      console.info("Graphify is optional; no existing graph or executable was available.");
    }
  }
}
