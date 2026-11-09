import { z } from "zod";

const envBool = (fallback: boolean) =>
  z.string().optional().transform((value) => value === undefined ? fallback : value.toLowerCase() === "true");

const schema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/),
  GITHUB_EVENT_PATH: z.string().min(1),
  GITHUB_WORKSPACE: z.string().default(process.cwd()),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-flash"),
  DSH_PLUGINS: z.string().default("spec-kit,graphify,documentation"),
  DSH_TRUSTED_ISSUES_ONLY: envBool(true),
  DSH_TEST_COMMANDS: z.string().default("npm test,npm run check,npm run build"),
  DSH_MAX_AGENT_STEPS: z.coerce.number().int().min(1).max(100).default(24),
  DSH_MAX_FILE_BYTES: z.coerce.number().int().min(1024).default(200_000),
  DSH_STATE_AUTHOR: z.string().default("github-actions[bot]")
});

export type Config = z.infer<typeof schema> & {
  plugins: string[];
  testCommands: string[];
  owner: string;
  repo: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  const [owner, repo] = parsed.GITHUB_REPOSITORY.split("/");
  return {
    ...parsed,
    owner,
    repo,
    plugins: parsed.DSH_PLUGINS.split(",").map((item) => item.trim()).filter(Boolean),
    testCommands: parsed.DSH_TEST_COMMANDS.split(",").map((item) => item.trim()).filter(Boolean)
  };
}
