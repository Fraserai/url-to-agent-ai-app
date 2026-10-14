const activeJobs = new Set<string>();

export function isJobActive(jobId: string) {
  return activeJobs.has(jobId);
}

export function dispatchIngestionJob(jobId: string) {
  if (activeJobs.has(jobId)) {
    return false;
  }

  activeJobs.add(jobId);

  queueMicrotask(async () => {
    try {
      const worker = await import("@/apps/worker/src/jobs/runIngestion");
      await worker.runIngestion(jobId);
    } finally {
      activeJobs.delete(jobId);
    }
  });

  return true;
}

