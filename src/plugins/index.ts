import type { HarnessPlugin } from "../types.js";
import { DocumentationPlugin } from "./documentation.js";
import { GraphifyPlugin } from "./graphify.js";
import { SpecKitPlugin } from "./spec-kit.js";

const factories: Record<string, () => HarnessPlugin> = {
  "spec-kit": () => new SpecKitPlugin(),
  graphify: () => new GraphifyPlugin(),
  documentation: () => new DocumentationPlugin()
};

export function loadPlugins(names: string[]): HarnessPlugin[] {
  return names.map((name) => {
    const factory = factories[name];
    if (!factory) throw new Error(`Unknown DSH plugin: ${name}`);
    return factory();
  });
}
