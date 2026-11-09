export type HarnessCommand =
  | { type: "answer"; value: string }
  | { type: "plan" }
  | { type: "approve"; planId: string }
  | { type: "retry" }
  | { type: "status" }
  | { type: "unknown" };

export function parseCommand(body: string): HarnessCommand {
  const text = body.trim();
  const match = /^\/dsh\s+(\S+)(?:\s+([\s\S]*))?$/i.exec(text);
  if (!match) return { type: "unknown" };
  const verb = match[1].toLowerCase();
  const value = (match[2] ?? "").trim();
  if (verb === "answer" && value) return { type: "answer", value };
  if (verb === "plan") return { type: "plan" };
  if (verb === "approve" && /^[a-f0-9]{12}$/.test(value)) return { type: "approve", planId: value };
  if (verb === "retry") return { type: "retry" };
  if (verb === "status") return { type: "status" };
  return { type: "unknown" };
}
