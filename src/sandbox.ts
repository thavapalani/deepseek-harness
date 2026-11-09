import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { Config } from "./config.js";
import { runProcess, type ProcessResult } from "./process.js";

const BLOCKED_PATHS = [".git", ".env", ".npmrc", ".pypirc", "node_modules", "dist", "graphify-out"];

export class WorkspaceSandbox {
  constructor(private readonly config: Config) {}

  private resolve(relativePath: string): string {
    if (path.isAbsolute(relativePath)) throw new Error("Absolute paths are not allowed");
    const normalized = relativePath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (segments.includes("..") || segments.some((segment) => BLOCKED_PATHS.includes(segment))) throw new Error(`Blocked path: ${relativePath}`);
    const resolved = path.resolve(this.config.GITHUB_WORKSPACE, normalized);
    const root = path.resolve(this.config.GITHUB_WORKSPACE) + path.sep;
    if (!(`${resolved}${path.sep}`.startsWith(root) || resolved.startsWith(root))) throw new Error("Path escaped workspace");
    return resolved;
  }

  async list(pattern = "**/*"): Promise<string[]> {
    return fg(pattern, {
      cwd: this.config.GITHUB_WORKSPACE,
      onlyFiles: true,
      dot: true,
      ignore: BLOCKED_PATHS.map((item) => `${item}/**`)
    }).then((files) => files.slice(0, 2000));
  }

  async read(relativePath: string): Promise<string> {
    const target = this.resolve(relativePath);
    const info = await stat(target);
    if (info.size > this.config.DSH_MAX_FILE_BYTES) throw new Error(`File exceeds ${this.config.DSH_MAX_FILE_BYTES} bytes`);
    return readFile(target, "utf8");
  }

  async write(relativePath: string, content: string): Promise<void> {
    const target = this.resolve(relativePath);
    if (Buffer.byteLength(content) > this.config.DSH_MAX_FILE_BYTES) throw new Error("Generated file is too large");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async test(command: string): Promise<ProcessResult> {
    if (!this.config.testCommands.includes(command)) throw new Error(`Command is not allowlisted: ${command}`);
    const [executable, ...args] = splitCommand(command);
    const allowed = ["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "CI", "NODE_OPTIONS"];
    const sanitizedEnv = Object.fromEntries(allowed.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) as NodeJS.ProcessEnv;
    sanitizedEnv.CI = "true";
    return runProcess(executable, args, this.config.GITHUB_WORKSPACE, 10 * 60_000, sanitizedEnv);
  }
}

export function splitCommand(command: string): string[] {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts.map((part) => part.replace(/^(["'])|(["'])$/g, ""));
}
