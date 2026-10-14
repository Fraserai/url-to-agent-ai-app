"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ChatWidget } from "@/components/ChatWidget";
import { ColourPicker } from "@/components/ColourPicker";
import { EditBusinessModal } from "@/components/EditBusinessModal";
import { formatAgentTypeLabel } from "@/lib/agent-suggestions";
import { summarizeWarnings } from "@/lib/scan-copy";
import type { AgentWorkspace, AgentWorkspaceOverrides } from "@/packages/shared/src/types/agentWorkspace";

type AgentResultsClientProps = {
  jobId: string;
  initialWorkspace: AgentWorkspace;
};

function formatSourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : parsed.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

export function AgentResultsClient({ jobId, initialWorkspace }: AgentResultsClientProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState("");
  const visibleWarnings = summarizeWarnings(workspace.warnings);

  async function persistWorkspace(patch: AgentWorkspaceOverrides) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/ingestions/${jobId}/workspace`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      });

      const payload = (await response.json()) as {
        agent_workspace?: AgentWorkspace;
        error?: string;
      };

      if (!response.ok || !payload.agent_workspace) {
        throw new Error(payload.error || "Unable to update the workspace.");
      }

      setWorkspace(payload.agent_workspace);
      setEditing(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update the workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function rerunScan() {
    setRerunning(true);
    setError("");

    try {
      const response = await fetch("/api/v1/ingestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: workspace.submitted_url })
      });

      const payload = (await response.json()) as { job_id?: string; error?: string };
      if (!response.ok || !payload.job_id) {
        throw new Error(payload.error || "Unable to start a fresh scan.");
      }

      router.push(
        `/scan?job=${encodeURIComponent(payload.job_id)}&url=${encodeURIComponent(workspace.submitted_url)}`
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start a fresh scan.");
      setRerunning(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 animate-fade-up">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-brand/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              Your agent
            </div>
            <h1 className="text-[30px] font-bold tracking-[-0.04em]">{workspace.business_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-black/45">
              We built the first version of your agent from the website. Tweak the details, test
              real customer questions, and make it feel right for the business.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold text-black/45">
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">
              {workspace.domain}
            </span>
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">
              {formatAgentTypeLabel(workspace.recommended_agent_type)}
            </span>
            <span className="rounded-full border border-black/8 bg-white px-3 py-1.5">
              {workspace.source_pages.length} source page{workspace.source_pages.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-danger/12 bg-danger/6 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-5">
            <div className="card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xl font-bold">{workspace.business_name}</div>
                  <div className="mt-1 text-[13px] text-black/40">
                    {workspace.industry}
                    {workspace.subindustry ? ` · ${workspace.subindustry}` : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    disabled={saving}
                    className="rounded-xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-black/65"
                  >
                    Edit facts
                  </button>
                  <button
                    type="button"
                    onClick={() => void rerunScan()}
                    disabled={rerunning}
                    className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {rerunning ? "Re-running..." : "Re-run scan"}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-black/55">{workspace.summary}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {workspace.services.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-[12px] font-semibold text-brand"
                  >
                    {service}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <FactCard label="Service area" value={workspace.service_area || "Not confirmed yet"} />
                <FactCard label="Phone" value={workspace.phone || "Not confirmed yet"} />
                <FactCard label="Email" value={workspace.email || "Not confirmed yet"} />
                <FactCard label="Hours" value={workspace.hours || "Not confirmed yet"} />
              </div>
            </div>

            <div className="card p-6">
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="text-lg font-bold">Agent recommendation</div>
                  <p className="mt-2 text-sm leading-7 text-black/45">
                    This is the agent style that fits the website best right now.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-black/6 bg-[#fbfaf7] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                      Recommended type
                    </div>
                    <div className="mt-2 text-lg font-bold">
                      {formatAgentTypeLabel(workspace.recommended_agent_type)}
                    </div>
                    <div className="mt-1 text-sm text-black/45">
                      Confidence {Math.round(workspace.recommendation_confidence * 100)}%
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ListCard
                      label="Why this agent"
                      items={workspace.recommendation_reasoning}
                      empty="No reasoning was captured."
                    />
                    <ListCard
                      label="Starter goals"
                      items={workspace.starter_goals}
                      empty="No starter goals were captured."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="xl:max-w-[240px]">
                  <div className="text-lg font-bold">Brand and behavior</div>
                  <p className="mt-2 text-sm leading-7 text-black/45">
                    Keep this simple for now: set the accent color and adjust the short agent
                    instructions if you want a different tone.
                  </p>
                </div>

                <div className="flex-1 space-y-5">
                  <div className="rounded-2xl border border-black/6 bg-[#fbfaf7] p-4">
                    <ColourPicker
                      value={workspace.primary_color}
                      onChange={(colour) => void persistWorkspace({ primary_color: colour })}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FactCard label="Welcome message" value={workspace.welcome_message} />
                    <FactCard
                      label="Agent instructions"
                      value={workspace.agent_instructions || "No extra instructions yet"}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-lg font-bold">Scan sources and warnings</div>
                  <p className="mt-2 text-sm leading-7 text-black/45">
                    These are the live pages AgentDrop used to build this draft.
                  </p>
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-black/35">
                  {visibleWarnings.length ? "Review suggested" : "Ready"}
                </div>
              </div>

              {visibleWarnings.length ? (
                <div className="mt-4 rounded-2xl border border-[#d97706]/15 bg-[#d97706]/6 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#925400]">
                    Worth a quick review
                  </div>
                  <div className="mt-2 space-y-2">
                    {visibleWarnings.map((warning) => (
                      <p key={warning} className="text-sm leading-7 text-[#7a4b00]">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {workspace.source_pages.map((page) => (
                  <a
                    key={`${page.finalUrl}-${page.title}`}
                    href={page.finalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-black/6 bg-[#fbfaf7] px-4 py-3 transition hover:border-brand/15 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[12px] font-semibold text-brand">
                        {page.title || formatSourceLabel(page.finalUrl)}
                      </div>
                      <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35">
                        {page.pageType}
                      </span>
                    </div>
                    <div className="mt-1 break-all text-[12px] leading-6 text-black/40">
                      {page.finalUrl}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-black/55">{page.snippet}</p>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-lg font-bold">Test the agent</div>
                  <p className="mt-1 text-sm leading-7 text-black/45">
                    Ask real customer questions and see how the agent responds before you make any
                    final changes.
                  </p>
                </div>
                <Link href={`/agent/${jobId}/chat`} className="text-sm font-semibold text-brand">
                  Open standalone preview
                </Link>
              </div>
            </div>

            <div className="h-[720px] overflow-hidden rounded-[28px] border border-black/6 bg-chat shadow-card">
              <ChatWidget jobId={jobId} workspace={workspace} />
            </div>
          </section>
        </div>
      </main>

      {editing ? (
        <EditBusinessModal
          workspace={workspace}
          onClose={() => setEditing(false)}
          onSave={persistWorkspace}
        />
      ) : null}
    </>
  );
}

function FactCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-[#fbfaf7] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
        {label}
      </div>
      <div className="mt-2 text-sm leading-7 text-black/55">{value}</div>
    </div>
  );
}

function ListCard({
  label,
  items,
  empty
}: {
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-[#fbfaf7] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
        {label}
      </div>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="text-sm leading-6 text-black/55">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm leading-6 text-black/40">{empty}</p>
        )}
      </div>
    </div>
  );
}
