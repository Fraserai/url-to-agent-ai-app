"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { getFriendlyProgressDetail, summarizeWarnings } from "@/lib/scan-copy";
import { getDomain, normalizeUrl } from "@/lib/url";

type ScanRunnerProps = {
  url: string;
  initialJobId: string;
};

type IngestionStatusPayload = {
  job_id: string;
  status: string;
  progress_percent?: number;
  current_step?: string;
  warnings?: string[];
  error_message?: string;
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Getting started",
  validating_url: "Researching your business",
  fetching_homepage: "Researching your business",
  discovering_pages: "Reading your website",
  fetching_pages: "Reading your website",
  rendering_pages: "Designing your agent",
  extracting_business_data: "Designing your agent",
  building_profile: "Shaping the experience",
  generating_agent: "Preparing your preview",
  completed: "Your agent is ready",
  partial_success: "Your agent is nearly ready",
  failed: "This one needs another pass"
};

const DISPLAY_STEPS = [
  "Researching your business",
  "Reading your website",
  "Designing your agent",
  "Preparing your preview"
];

async function createIngestion(url: string) {
  const response = await fetch("/api/v1/ingestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: normalizeUrl(url) })
  });

  const payload = (await response.json()) as {
    job_id?: string;
    error?: string;
  };

  if (!response.ok || !payload.job_id) {
    throw new Error(payload.error || "Unable to start the scan.");
  }

  return payload.job_id;
}

export function ScanRunner({ url, initialJobId }: ScanRunnerProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState(initialJobId);
  const [status, setStatus] = useState<string>(initialJobId ? "queued" : "creating_job");
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState(getFriendlyProgressDetail("queued"));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const redirectedRef = useRef(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  useEffect(() => {
    if (!normalizedUrl || jobId || creating) {
      return;
    }

    let cancelled = false;
    setCreating(true);
    setError("");
    setCurrentStep(getFriendlyProgressDetail("queued"));

    void createIngestion(normalizedUrl)
      .then((nextJobId) => {
        if (cancelled) return;
        setJobId(nextJobId);
        setStatus("queued");
        router.replace(
          `/scan?job=${encodeURIComponent(nextJobId)}&url=${encodeURIComponent(normalizedUrl)}`
        );
      })
      .catch((nextError) => {
        if (cancelled) return;
        setStatus("failed");
        setError(nextError instanceof Error ? nextError.message : "Unable to start the scan.");
      })
      .finally(() => {
        if (!cancelled) {
          setCreating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [creating, jobId, normalizedUrl, router]);

  useEffect(() => {
    if (!jobId || redirectedRef.current) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/ingestions/${jobId}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as IngestionStatusPayload & { error?: string };

        if (response.status === 404 && normalizedUrl) {
          const nextJobId = await createIngestion(normalizedUrl);
          if (cancelled) return;
          setJobId(nextJobId);
          setStatus("queued");
          setProgressPercent(0);
          setCurrentStep(getFriendlyProgressDetail("queued"));
          setWarnings([]);
          router.replace(
            `/scan?job=${encodeURIComponent(nextJobId)}&url=${encodeURIComponent(normalizedUrl)}`
          );
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load the scan status.");
        }

        if (cancelled) return;

        setStatus(payload.status);
        setProgressPercent(payload.progress_percent ?? 0);
        setCurrentStep(getFriendlyProgressDetail(payload.status));
        setWarnings(payload.warnings ?? []);
        setError(payload.status === "failed" ? payload.error_message || "The scan failed." : "");

        if (payload.status === "completed" || payload.status === "partial_success") {
          redirectedRef.current = true;
          router.replace(`/agent/${jobId}`);
          return;
        }

        if (payload.status === "failed") {
          return;
        }
      } catch (nextError) {
        if (cancelled) return;
        setStatus("failed");
        setError(nextError instanceof Error ? nextError.message : "Unable to load the scan status.");
        return;
      }

      timeoutId = window.setTimeout(poll, 1200);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [jobId, router]);

  async function rerunScan() {
    if (!normalizedUrl) {
      router.replace("/");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setWarnings([]);
      setProgressPercent(0);
      setCurrentStep(getFriendlyProgressDetail("queued"));
      const nextJobId = await createIngestion(normalizedUrl);
      redirectedRef.current = false;
      setJobId(nextJobId);
      setStatus("queued");
      router.replace(`/scan?job=${encodeURIComponent(nextJobId)}&url=${encodeURIComponent(normalizedUrl)}`);
    } catch (nextError) {
      setStatus("failed");
      setError(nextError instanceof Error ? nextError.message : "Unable to restart the scan.");
    } finally {
      setCreating(false);
    }
  }

  const visibleWarnings = useMemo(() => summarizeWarnings(warnings), [warnings]);

  if (!normalizedUrl) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 text-center animate-fade-up">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-2xl text-danger">
          !
        </div>
        <h1 className="mb-2 text-2xl font-bold">No website URL</h1>
        <p className="mb-6 text-sm leading-6 text-black/45">
          Paste a public business website URL to get started.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white"
        >
          Back home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 text-center animate-fade-up">
      <div className="mb-4 text-lg font-bold text-brand">
        Building <span className="font-[var(--font-fraunces)] italic">your agent</span>
      </div>
      <div className="mb-2 text-sm text-black/35">{getDomain(normalizedUrl)}</div>

      <div className="card px-5 py-5 text-left">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-ink">
              {STATUS_LABELS[status] || "Building your agent"}
            </div>
            <div className="mt-1 text-xs text-black/40">{currentStep}</div>
          </div>
          <div className="text-sm font-semibold text-brand">{Math.max(progressPercent, 3)}%</div>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/6">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${Math.max(progressPercent, 3)}%` }}
          />
        </div>

        <div className="space-y-2">
          {DISPLAY_STEPS.map((label, index) => {
              const activeLabel = STATUS_LABELS[status] || DISPLAY_STEPS[0];
              const activeIndex = DISPLAY_STEPS.indexOf(activeLabel);
              const complete = activeIndex > index || ["completed", "partial_success"].includes(status);
              const active =
                !["completed", "partial_success", "failed"].includes(status) && activeIndex === index;

              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 py-1.5 ${active || complete ? "opacity-100" : "opacity-30"}`}
                >
                  <div
                    className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${
                      complete ? "bg-brand/10" : active ? "bg-brand" : "bg-black/[0.04]"
                    }`}
                  >
                    {complete ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1a6b4a"
                        strokeWidth="3"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : active ? (
                      <span className="h-2 w-2 rounded-full border-2 border-white border-t-transparent animate-spin-soft" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
                    )}
                  </div>
                  <span className={`text-sm ${active ? "font-bold" : "font-medium"} text-ink`}>
                    {label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {visibleWarnings.length ? (
        <div className="mt-4 rounded-2xl border border-[#d97706]/15 bg-[#d97706]/6 px-4 py-3 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#925400]">
            A quick note
          </div>
          <div className="mt-2 space-y-2">
            {visibleWarnings.slice(0, 2).map((warning) => (
              <p key={warning} className="text-sm leading-6 text-[#7a4b00]">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="mt-5 rounded-2xl border border-danger/12 bg-danger/6 px-5 py-4 text-left">
          <div className="text-sm font-bold text-danger">The scan needs another pass</div>
          <p className="mt-2 text-sm leading-6 text-danger/80">
            {error || "We couldn't shape the agent properly from this pass. Try again and we’ll take another look."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void rerunScan()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"
            >
              Re-run scan
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="rounded-xl border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-black/60"
            >
              Start over
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
