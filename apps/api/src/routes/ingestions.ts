import { dispatchIngestionJob } from "@/apps/api/src/services/queue";
import {
  getRecoverableIngestionJob,
  isResolvedJobStatus,
  getResolvedIngestion
} from "@/apps/api/src/services/ingestionAccess";
import {
  createIngestionJob,
  getBusinessProfileByJob,
  updateBusinessProfileWorkspaceOverrides
} from "@/apps/api/src/services/storage";
import {
  mergeWorkspaceOverrides,
  resolveAgentWorkspace,
  sanitizeWorkspaceOverrides
} from "@/lib/agent-workspace";

type RouteResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function createIngestion(body: { url?: string; user_id?: string }): Promise<RouteResult> {
  if (!body.url?.trim()) {
    return {
      status: 400,
      body: {
        error: "A public business URL is required."
      }
    };
  }

  const job = await createIngestionJob({
    submittedUrl: body.url.trim(),
    userId: body.user_id
  });
  dispatchIngestionJob(job.id);

  return {
    status: 202,
    body: {
      job_id: job.id,
      status: job.status
    }
  };
}

export async function getIngestionStatus(jobId: string): Promise<RouteResult> {
  const job = await getRecoverableIngestionJob(jobId);

  if (!job) {
    return {
      status: 404,
      body: {
        error: "Ingestion job not found."
      }
    };
  }

  return {
    status: 200,
    body: {
      job_id: job.id,
      status: job.status,
      progress_percent: job.progress_percent,
      current_step: job.current_step,
      warnings: job.warnings,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at
    }
  };
}

export async function getIngestionResult(jobId: string): Promise<RouteResult> {
  const job = await getRecoverableIngestionJob(jobId);

  if (!job) {
    return {
      status: 404,
      body: {
        error: "Ingestion job not found."
      }
    };
  }

  if (!isResolvedJobStatus(job.status)) {
    return {
      status: 409,
      body: {
        job_id: job.id,
        status: job.status,
        progress_percent: job.progress_percent,
        current_step: job.current_step,
        warnings: job.warnings
      }
    };
  }

  const resolved = await getResolvedIngestion(jobId);
  if (!resolved) {
    return {
      status: 404,
      body: {
        error: "Ingestion completed but no result profile was found."
      }
    };
  }

  return {
    status: 200,
    body: {
      job_id: job.id,
      status: job.status,
      business_context: resolved.profile.business_context,
      agent_recommendation: resolved.profile.agent_recommendation,
      deployment_package: resolved.profile.deployment_package,
      workspace_overrides: resolved.profile.workspace_overrides,
      agent_workspace: resolved.workspace
    }
  };
}

export async function updateIngestionWorkspace(
  jobId: string,
  body: Record<string, unknown>
): Promise<RouteResult> {
  const job = await getRecoverableIngestionJob(jobId);

  if (!job) {
    return {
      status: 404,
      body: {
        error: "Ingestion job not found."
      }
    };
  }

  if (!isResolvedJobStatus(job.status)) {
    return {
      status: 409,
      body: {
        error: "The workspace can only be edited after ingestion finishes.",
        job_id: job.id,
        status: job.status
      }
    };
  }

  const profile = await getBusinessProfileByJob(jobId);
  if (!profile) {
    return {
      status: 404,
      body: {
        error: "No workspace profile was found for this ingestion."
      }
    };
  }

  const patch = sanitizeWorkspaceOverrides(body);
  const nextOverrides = mergeWorkspaceOverrides(profile.workspace_overrides ?? {}, patch);
  const updatedProfile = await updateBusinessProfileWorkspaceOverrides(jobId, nextOverrides);

  if (!updatedProfile) {
    return {
      status: 404,
      body: {
        error: "Unable to update the workspace."
      }
    };
  }

  return {
    status: 200,
    body: {
      job_id: job.id,
      status: job.status,
      workspace_overrides: updatedProfile.workspace_overrides,
      agent_workspace: resolveAgentWorkspace(updatedProfile, job.status)
    }
  };
}
