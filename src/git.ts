import { runProcess } from "./process.js";

async function git(workspace: string, args: string[]) {
  const result = await runProcess("git", args, workspace);
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

export function branchName(issueNumber: number, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "change";
  return `dsh/issue-${issueNumber}-${slug}`;
}

export async function prepareBranch(workspace: string, branch: string, base: string): Promise<void> {
  await git(workspace, ["config", "user.name", "deepseek-harness[bot]"]);
  await git(workspace, ["config", "user.email", "deepseek-harness[bot]@users.noreply.github.com"]);
  await git(workspace, ["fetch", "origin", base]);
  await git(workspace, ["checkout", "-B", branch, `origin/${base}`]);
}

export async function commitAndPush(workspace: string, branch: string, issueNumber: number): Promise<string> {
  const changed = await git(workspace, ["status", "--porcelain"]);
  if (!changed) throw new Error("Implementation produced no repository changes");
  await git(workspace, ["add", "--all"]);
  await git(workspace, ["commit", "-m", `feat: implement issue #${issueNumber}`]);
  await git(workspace, ["push", "--force-with-lease", "--set-upstream", "origin", branch]);
  return git(workspace, ["rev-parse", "HEAD"]);
}
