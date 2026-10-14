import type { AgentRecommendation } from "@/packages/shared/src/types/agentRecommendation";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";
import type { DeploymentPackage } from "@/packages/shared/src/types/deploymentPackage";
import type { AgentWorkspaceOverrides } from "@/packages/shared/src/types/agentWorkspace";

export type IngestionJobStatus =
  | "queued"
  | "validating_url"
  | "fetching_homepage"
  | "discovering_pages"
  | "fetching_pages"
  | "rendering_pages"
  | "extracting_business_data"
  | "building_profile"
  | "generating_agent"
  | "completed"
  | "failed"
  | "partial_success";

export type IngestionJobRecord = {
  id: string;
  user_id: string;
  submitted_url: string;
  normalized_url: string;
  canonical_key: string;
  status: IngestionJobStatus;
  progress_percent: number;
  current_step: string;
  warnings: string[];
  error_message: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CrawledPageRecord = {
  id: string;
  ingestion_job_id: string;
  url: string;
  final_url: string;
  status_code: number;
  fetch_mode: "static" | "rendered";
  was_rendered: boolean;
  title: string;
  meta_description: string;
  raw_html_path: string;
  text_content: string;
  extracted_json: Record<string, unknown>;
  created_at: string;
};

export type BusinessProfileRecord = {
  id: string;
  user_id: string;
  ingestion_job_id: string;
  canonical_key: string;
  business_context: BusinessContextObject;
  agent_recommendation: AgentRecommendation;
  deployment_package: DeploymentPackage;
  workspace_overrides: AgentWorkspaceOverrides;
  created_at: string;
  updated_at: string;
};

export type IngestionResultRecord = {
  job: IngestionJobRecord;
  business_context: BusinessContextObject;
  agent_recommendation: AgentRecommendation;
  deployment_package: DeploymentPackage;
};
