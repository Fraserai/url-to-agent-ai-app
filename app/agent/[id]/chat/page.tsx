import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getRecoverableIngestionJob, getResolvedIngestion } from "@/apps/api/src/services/ingestionAccess";
import { ChatWidget } from "@/components/ChatWidget";
import { NavBar } from "@/components/NavBar";

export default async function AgentChatPage({
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
      <div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-3xl flex-col px-4 py-5">
        <div className="mb-3 text-sm font-medium text-black/40">
          <Link href={`/agent/${params.id}`}>← Back to workspace</Link>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatWidget
            jobId={params.id}
            workspace={resolved.workspace}
            backHref={`/agent/${params.id}`}
          />
        </div>
      </div>
    </div>
  );
}
