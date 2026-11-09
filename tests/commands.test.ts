import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/commands.js";

describe("parseCommand", () => {
  it("parses multiline answers", () => {
    expect(parseCommand("/dsh answer 1. PostgreSQL\n2. No downtime")).toEqual({ type: "answer", value: "1. PostgreSQL\n2. No downtime" });
  });

  it("requires an exact plan id shape", () => {
    expect(parseCommand("/dsh approve aabbccddeeff")).toEqual({ type: "approve", planId: "aabbccddeeff" });
    expect(parseCommand("/dsh approve latest")).toEqual({ type: "unknown" });
  });

  it("ignores ordinary comments", () => {
    expect(parseCommand("looks good")).toEqual({ type: "unknown" });
  });
});
