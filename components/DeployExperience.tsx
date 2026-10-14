"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PLATFORMS } from "@/lib/brand";
import type { BusinessRecord, PlatformId } from "@/lib/types";
import { PlatformList } from "@/components/PlatformList";

const PROGRESS_MESSAGES = [
  "Connecting to your website...",
  "Installing chat widget...",
  "Configuring AI agent...",
  "Running final checks...",
  "Almost there...",
  "Going live!"
];

type DeployExperienceProps = {
  business: BusinessRecord;
};

export function DeployExperience({ business }: DeployExperienceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"ready" | "deploying" | "live">("ready");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number] | null>(null);
  const [progress, setProgress] = useState(0);
  const [widgetUrl, setWidgetUrl] = useState<string>("");
  const [embedCode, setEmbedCode] = useState<string>("");
  const [instructions, setInstructions] = useState<string[]>([]);

  async function handleSelect(platformId: PlatformId) {
    const nextPlatform = PLATFORMS.find((item) => item.id === platformId) ?? null;
    setPlatform(nextPlatform);
    setStep("deploying");
    setProgress(0);

    const progressSteps = [15, 35, 60, 80, 95, 100];
    progressSteps.forEach((value, index) => {
      window.setTimeout(() => setProgress(value), 650 + index * 700);
    });

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessId: business.id,
          platform: platformId
        })
      });

      const payload = (await response.json()) as {
        widgetUrl?: string;
        embedCode?: string;
        instructions?: string[];
        checkoutUrl?: string;
        loginUrl?: string;
      };

      if (response.status === 401 && payload.loginUrl) {
        router.push(payload.loginUrl);
        return;
      }

      if ((response.status === 402 || payload.checkoutUrl) && payload.checkoutUrl) {
        router.push(payload.checkoutUrl);
        return;
      }

      window.setTimeout(() => {
        setWidgetUrl(payload.widgetUrl ?? "");
        setEmbedCode(payload.embedCode ?? "");
        setInstructions(payload.instructions ?? []);
        setStep("live");
      }, 4700);
    } catch {
      window.setTimeout(() => setStep("live"), 4700);
    }
  }

  const messageIndex = Math.min(Math.floor(progress / 18), PROGRESS_MESSAGES.length - 1);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-3xl flex-col px-6 py-8">
      {searchParams.get("checkout") === "success" ? (
        <div className="mb-4 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3 text-sm text-brand">
          Payment confirmed. Finish deployment below.
        </div>
      ) : null}

      {step === "ready" ? (
        <div className="flex flex-1 flex-col justify-center text-center animate-fade-up">
          <h1 className="text-[28px] font-bold tracking-[-0.03em]">Your agent is ready!</h1>
          <p className="mb-8 mt-1 text-sm text-black/40">
            Deploy it to your website in seconds.
          </p>
          <PlatformList onSelect={handleSelect} />
          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-black/35">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg key={index} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            Trusted by Australian businesses
          </div>
        </div>
      ) : null}

      {step === "deploying" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-up">
          <div className="mb-6 h-12 w-12 rounded-full border-[3px] border-black/6 border-t-brand animate-spin-soft" />
          <h2 className="text-xl font-bold">Deploying to {platform?.name}</h2>
          <p className="mb-6 mt-2 text-sm text-black/40">{PROGRESS_MESSAGES[messageIndex]}</p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/6">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {step === "live" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 animate-pop-in">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a6b4a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-[28px] font-bold tracking-[-0.03em]">Your agent is live!</h2>
          <p className="mt-2 text-sm text-black/45">
            Deployed to <strong>{business.domain}</strong>
          </p>
          <p className="mb-6 mt-1 max-w-md text-sm leading-6 text-black/35">
            Customers can now chat with your AI agent on your website.
          </p>

          <div className="mb-6 w-full max-w-[280px] overflow-hidden rounded-[12px] border border-black/6 bg-white shadow-card">
            <div className="flex items-center gap-1 bg-[#222] px-3 py-2">
              {["#ff5f56", "#ffbd2e", "#27ca40"].map((colour) => (
                <span
                  key={colour}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colour }}
                />
              ))}
              <div className="ml-2 flex-1 rounded bg-white/10 px-2 py-0.5 text-left text-[8px] text-white/45">
                {business.domain}
              </div>
            </div>
            <div className="relative px-4 py-4">
              <div className="mb-2 h-1.5 w-14 rounded bg-black/8" />
              <div className="mb-1.5 h-1 w-3/4 rounded bg-black/6" />
              <div className="h-1 w-1/2 rounded bg-black/6" />
              <div
                className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                style={{ backgroundColor: business.accentColor }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {widgetUrl ? (
            <div className="mb-6 w-full max-w-lg rounded-2xl border border-black/6 bg-white px-4 py-3 text-left shadow-card">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-black/35">
                Widget script
              </div>
              <code className="block overflow-x-auto text-xs leading-5 text-black/65">
                {embedCode || `<script src="${widgetUrl}" async></script>`}
              </code>
            </div>
          ) : null}

          {instructions.length ? (
            <div className="mb-6 w-full max-w-lg rounded-2xl border border-black/6 bg-white px-4 py-4 text-left shadow-card">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-black/35">
                Install steps
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-black/60">
                {instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
            </div>
          ) : null}

          <Link
            href={`/agent/${business.id}`}
            className="rounded-xl bg-brand px-8 py-3 text-sm font-bold text-white"
          >
            Done
          </Link>
        </div>
      ) : null}
    </div>
  );
}
