import type { ProjectDashboard } from "./queries";

export type { ProjectDashboard };

export interface FeatureStatus {
  ai: boolean;
  aiProvider?: "openai" | "anthropic" | "local";
  xPosting: boolean;
  googleOAuth: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
}
