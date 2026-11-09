import { describe, expect, it } from "vitest";
import { decodeState, encodeState, latestState, planId } from "../src/state.js";
import type { DeliveryPlan, HarnessState } from "../src/types.js";

const state: HarnessState = {
  version: 1,
  issueNumber: 7,
  phase: "clarifying",
  updatedAt: "2026-11-09T00:00:00.000Z"
};

describe("state comments", () => {
  it("round trips state through an HTML marker", () => {
    expect(decodeState(`visible\n${encodeState(state)}`)).toEqual(state);
  });

  it("ignores malformed state and selects the latest valid marker", () => {
    const newer = { ...state, phase: "planned" as const };
    expect(latestState([{ body: encodeState(state) }, { body: "<!-- dsh-state:nope -->" }, { body: encodeState(newer) }])).toEqual(newer);
  });

  it("produces stable, content-addressed plan IDs", () => {
    const plan: DeliveryPlan = { summary: "A sufficiently detailed plan", assumptions: [], acceptanceCriteria: ["works"], risks: [], steps: [{ title: "Do", description: "Do it", files: [], verification: "test" }], testStrategy: ["test"], documentation: [] };
    expect(planId(plan)).toMatch(/^[a-f0-9]{12}$/);
    expect(planId(plan)).toBe(planId(structuredClone(plan)));
    expect(planId({ ...plan, summary: "A different sufficiently detailed plan" })).not.toBe(planId(plan));
  });
});
