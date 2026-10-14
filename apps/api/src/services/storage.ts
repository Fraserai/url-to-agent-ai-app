import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentRecommendation } from "@/packages/shared/src/types/agentRecommendation";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";
import type { DeploymentPackage } from "@/packages/shared/src/types/deploymentPackage";
import type { AgentWorkspaceOverrides } from "@/packages/shared/src/types/agentWorkspace";
import type {
  BusinessProfileRecord,
  CrawledPageRecord,
  IngestionJobRecord,
  IngestionJobStatus
} from "@/packages/shared/src/types/ingestion";

type IngestionDatabase = {
  jobs: IngestionJobRecord[];
  pages: CrawledPageRecord[];
  profiles: BusinessProfileRecord[];
};

const DATA_PATH = path.join(process.cwd(), ".data", "ingestion-engine.json");
const ARTIFACTS_DIR = path.join(process.cwd(), ".data", "ingestion-artifacts");
const EMPTY_DB: IngestionDatabase = {
  jobs: [],
  pages: [],
  profiles: []
};

let writeQueue = Promise.resolve();

async function ensureStorage() {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  try {
    await readFile(DATA_PATH, "utf8");
  } catch {
    await writeFile(DATA_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDatabase() {
  await ensureStorage();
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return {
      ...EMPTY_DB,
      ...(JSON.parse(raw) as IngestionDatabase)
    };
  } catch {
    return EMPTY_DB;
  }
}

async function writeDatabase(db: IngestionDatabase) {
  await ensureStorage();
  await writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function mutateDatabase<T>(updater: (db: IngestionDatabase) => Promise<T> | T): Promise<T> {
  let result!: T;

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const db = await readDatabase();
    result = await updater(db);
    await writeDatabase(db);
  });

  await writeQueue;
  return result;
}

export async function createIngestionJob(input: {
  submittedUrl: string;
  userId?: string;
}) {
  const now = new Date().toISOString();
  const job: IngestionJobRecord = {
    id: `ing_${crypto.randomUUID()}`,
    user_id: input.userId ?? "local-user",
    submitted_url: input.submittedUrl,
    normalized_url: "",
    canonical_key: "",
    status: "queued",
    progress_percent: 0,
    current_step: "Queued for ingestion",
    warnings: [],
    error_message: "",
    created_at: now,
    updated_at: now,
    completed_at: null
  };

  return mutateDatabase(async (db) => {
    db.jobs.unshift(job);
    return job;
  });
}

export async function getIngestionJob(jobId: string) {
  const db = await readDatabase();
  return db.jobs.find((job) => job.id === jobId) ?? null;
}

export async function updateIngestionJob(
  jobId: string,
  patch: Partial<Omit<IngestionJobRecord, "id" | "submitted_url" | "user_id" | "created_at">>
) {
  return mutateDatabase(async (db) => {
    const job = db.jobs.find((entry) => entry.id === jobId);
    if (!job) return null;

    Object.assign(job, patch, {
      updated_at: new Date().toISOString()
    });

    return job;
  });
}

export async function updateIngestionStatus(
  jobId: string,
  status: IngestionJobStatus,
  progressPercent: number,
  currentStep: string,
  extra?: {
    warnings?: string[];
    normalizedUrl?: string;
    canonicalKey?: string;
    errorMessage?: string;
    completed?: boolean;
  }
) {
  return updateIngestionJob(jobId, {
    status,
    progress_percent: progressPercent,
    current_step: currentStep,
    warnings: extra?.warnings,
    normalized_url: extra?.normalizedUrl,
    canonical_key: extra?.canonicalKey,
    error_message: extra?.errorMessage,
    completed_at: extra?.completed ? new Date().toISOString() : undefined
  });
}

export async function saveRawArtifact(jobId: string, pageId: string, html: string) {
  await mkdir(path.join(ARTIFACTS_DIR, jobId), { recursive: true });
  const artifactPath = path.join(ARTIFACTS_DIR, jobId, `${pageId}.html`);
  await writeFile(artifactPath, html, "utf8");
  return artifactPath;
}

export async function saveCrawledPage(
  page: Omit<CrawledPageRecord, "id" | "created_at"> & { id?: string; created_at?: string }
) {
  const record: CrawledPageRecord = {
    id: page.id ?? crypto.randomUUID(),
    created_at: page.created_at ?? new Date().toISOString(),
    ...page
  };

  return mutateDatabase(async (db) => {
    const existingIndex = db.pages.findIndex((entry) => entry.id === record.id);

    if (existingIndex >= 0) {
      db.pages[existingIndex] = record;
    } else {
      db.pages.push(record);
    }

    return record;
  });
}

export async function listCrawledPagesForJob(jobId: string) {
  const db = await readDatabase();
  return db.pages.filter((page) => page.ingestion_job_id === jobId);
}

export async function saveBusinessProfile(input: {
  userId: string;
  ingestionJobId: string;
  canonicalKey: string;
  businessContext: BusinessContextObject;
  agentRecommendation: AgentRecommendation;
  deploymentPackage: DeploymentPackage;
  workspaceOverrides?: AgentWorkspaceOverrides;
}) {
  const now = new Date().toISOString();
  const record: BusinessProfileRecord = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    ingestion_job_id: input.ingestionJobId,
    canonical_key: input.canonicalKey,
    business_context: input.businessContext,
    agent_recommendation: input.agentRecommendation,
    deployment_package: input.deploymentPackage,
    workspace_overrides: input.workspaceOverrides ?? {},
    created_at: now,
    updated_at: now
  };

  return mutateDatabase(async (db) => {
    const existingIndex = db.profiles.findIndex(
      (profile) => profile.ingestion_job_id === input.ingestionJobId
    );

    if (existingIndex >= 0) {
      db.profiles[existingIndex] = {
        ...record,
        id: db.profiles[existingIndex].id,
        created_at: db.profiles[existingIndex].created_at
      };
      return db.profiles[existingIndex];
    }

    db.profiles.unshift(record);
    return record;
  });
}

export async function getBusinessProfileByJob(jobId: string) {
  const db = await readDatabase();
  return db.profiles.find((profile) => profile.ingestion_job_id === jobId) ?? null;
}

export async function updateBusinessProfileWorkspaceOverrides(
  jobId: string,
  workspaceOverrides: AgentWorkspaceOverrides
) {
  return mutateDatabase(async (db) => {
    const profile = db.profiles.find((entry) => entry.ingestion_job_id === jobId);
    if (!profile) return null;

    profile.workspace_overrides = workspaceOverrides;
    profile.updated_at = new Date().toISOString();
    return profile;
  });
}
