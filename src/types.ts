export type Phase = "clarifying" | "planned" | "approved" | "implementing" | "pull_request" | "failed";

export interface Question {
  id: string;
  text: string;
  required: boolean;
}

export interface PlanStep {
  title: string;
  description: string;
  files: string[];
  verification: string;
}

export interface DeliveryPlan {
  summary: string;
  assumptions: string[];
  acceptanceCriteria: string[];
  risks: string[];
  steps: PlanStep[];
  testStrategy: string[];
  documentation: string[];
}

export interface HarnessState {
  version: 1;
  issueNumber: number;
  phase: Phase;
  questions?: Question[];
  answers?: string;
  plan?: DeliveryPlan;
  planId?: string;
  approvedBy?: string;
  branch?: string;
  pullRequestUrl?: string;
  updatedAt: string;
  error?: string;
}

export interface IssueContext {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  defaultBranch: string;
  actor: string;
  issueAuthor: string;
  comments: Array<{ author: string; body: string }>;
}

export interface PluginContext {
  issue: IssueContext;
  state: HarnessState;
  workspace: string;
}

export interface HarnessPlugin {
  name: string;
  planningContext?(context: PluginContext): Promise<string>;
  beforeImplementation?(context: PluginContext): Promise<void>;
  afterImplementation?(context: PluginContext): Promise<void>;
  beforePullRequest?(context: PluginContext): Promise<void>;
}
