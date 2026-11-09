import { createHash } from "node:crypto";
import { z } from "zod";
import type { DeliveryPlan, HarnessState } from "./types.js";

export const STATE_PREFIX = "<!-- dsh-state:";
export const STATE_SUFFIX = " -->";

const stateSchema = z.object({
  version: z.literal(1),
  issueNumber: z.number().int().positive(),
  phase: z.enum(["clarifying", "planned", "approved", "implementing", "pull_request", "failed"]),
  questions: z.array(z.object({ id: z.string(), text: z.string(), required: z.boolean() })).optional(),
  answers: z.string().optional(),
  plan: z.unknown().optional(),
  planId: z.string().optional(),
  approvedBy: z.string().optional(),
  branch: z.string().optional(),
  pullRequestUrl: z.string().optional(),
  updatedAt: z.string(),
  error: z.string().optional()
});

export function encodeState(state: HarnessState): string {
  const encoded = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${STATE_PREFIX}${encoded}${STATE_SUFFIX}`;
}

export function decodeState(body: string): HarnessState | undefined {
  const start = body.lastIndexOf(STATE_PREFIX);
  if (start < 0) return undefined;
  const end = body.indexOf(STATE_SUFFIX, start);
  if (end < 0) return undefined;
  try {
    const encoded = body.slice(start + STATE_PREFIX.length, end);
    return stateSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))) as HarnessState;
  } catch {
    return undefined;
  }
}

export function latestState(comments: Array<{ body?: string | null }>): HarnessState | undefined {
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const state = decodeState(comments[index].body ?? "");
    if (state) return state;
  }
  return undefined;
}

export function planId(plan: DeliveryPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 12);
}
