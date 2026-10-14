import type { AgentRecommendation } from "@/packages/shared/src/types/agentRecommendation";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";

export type AgentWorkspaceOverrides = {
  business_name?: string;
  summary?: string;
  services?: string[];
  phone?: string | null;
  email?: string | null;
  hours?: string | null;
  primary_color?: string;
  welcome_message?: string;
  agent_instructions?: string;
};

export type AgentWorkspace = {
  job_id: string;
  status: "completed" | "partial_success";
  submitted_url: string;
  domain: string;
  business_name: string;
  industry: string;
  subindustry: string;
  business_type: string;
  summary: string;
  services: string[];
  service_area: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  welcome_message: string;
  agent_instructions: string;
  recommended_agent_type: AgentRecommendation["recommended_agent_type"];
  recommendation_confidence: number;
  recommendation_reasoning: string[];
  starter_goals: string[];
  required_tools: string[];
  cta_labels: string[];
  value_props: string[];
  faq: BusinessContextObject["policies"]["faq"];
  source_pages: BusinessContextObject["evidence"]["source_pages"];
  important_snippets: BusinessContextObject["evidence"]["important_snippets"];
  warnings: string[];
};
