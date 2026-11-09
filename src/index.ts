#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { Orchestrator } from "./orchestrator.js";

try {
  await new Orchestrator(loadConfig()).run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
