import { describe, expect, it } from "vitest";
import { splitCommand } from "../src/sandbox.js";

describe("sandbox command parsing", () => {
  it("keeps quoted arguments together without invoking a shell", () => {
    expect(splitCommand("npm run test -- --name 'safe test'")).toEqual(["npm", "run", "test", "--", "--name", "safe test"]);
  });
});
