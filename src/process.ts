import { spawn } from "node:child_process";

export interface ProcessResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60_000,
  env: NodeJS.ProcessEnv = process.env
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${executable} ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk).slice(0, 100_000); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 100_000); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ command: [executable, ...args].join(" "), exitCode: code ?? 1, stdout, stderr });
    });
  });
}
