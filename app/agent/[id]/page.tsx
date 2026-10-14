import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getRecoverableIngestionJob, getResolvedIngestion } from "@/apps/api/src/services/ingestionAccess";
import { AgentResultsClient } from "@/components/AgentResultsClient";
import { NavBar } from "@/components/NavBar";

export default async function AgentPage({
  params
}: {
  params: { id: string };
}) {
  const job = await getRecoverableIngestionJob(params.id);

  if (!job) {
    notFound();
  }

  if (!["completed", "partial_success"].includes(job.status)) {
    redirect(`/scan?job=${encodeURIComponent(params.id)}&url=${encodeURIComponent(job.submitted_url)}`);
  }

  const resolved = await getResolvedIngestion(params.id);
  if (!resolved) {
    notFound();
  }

  return (
    <div className="page-shell">
      <NavBar rightSlot={<Link href="/">New scan</Link>} />
      <AgentResultsClient jobId={params.id} initialWorkspace={resolved.workspace} />
    </div>
  );
}
