import { isJobActive } from "@/apps/api/src/services/queue";
import {
  getBusinessProfileByJob,
  getIngestionJob,
  updateIngestionStatus
} from "@/apps/api/src/services/storage";
import { resolveAgentWorkspace } from "@/lib/agent-workspace";
import type { AgentWorkspace } from "@/packages/shared/src/types/agentWorkspace";
import type {
  BusinessProfileRecord,
  IngestionJobRecord,
  IngestionJobStatus
} from "@/packages/shared/src/types/ingestion";

const STALE_JOB_MS = 2 * 60 * 1000;
const ACTIVE_STATUSES = new Set<IngestionJobStatus>([
  "queued",
  "validating_url",
  "fetching_homepage",
  "discovering_pages",
  "fetching_pages",
  "rendering_pages",
  "extracting_business_data",
  "building_profile",
  "generating_agent"
]);

export async function getRecoverableIngestionJob(jobId: string) {
  const job = await getIngestionJob(jobId);

  if (!job || !ACTIVE_STATUSES.has(job.status)) {
    return job;
  }

  const ageMs = Date.now() - new Date(job.updated_at).getTime();
  if (isJobActive(job.id) || ageMs < STALE_JOB_MS) {
    return job;
  }

  return updateIngestionStatus(job.id, "failed", job.progress_percent, "Ingestion timed out", {
    warnings: [
      ...job.warnings,
      "This ingestion stopped updating and was marked as failed. Please try the scan again."
    ],
    errorMessage: "This ingestion stopped updating and needs to be re-run.",
    completed: true
  });
}

export function isResolvedJobStatus(status: IngestionJobStatus): status is AgentWorkspace["status"] {
  return status === "completed" || status === "partial_success";
}

export async function getResolvedIngestion(jobId: string): Promise<{
  job: IngestionJobRecord;
  profile: BusinessProfileRecord;
  workspace: AgentWorkspace;
} | null> {
  const job = await getRecoverableIngestionJob(jobId);
  if (!job || !isResolvedJobStatus(job.status)) {
    return null;
  }

  const profile = await getBusinessProfileByJob(jobId);
  if (!profile) {
    return null;
  }

  return {
    job,
    profile,
    workspace: resolveAgentWorkspace(profile, job.status)
  };
}
