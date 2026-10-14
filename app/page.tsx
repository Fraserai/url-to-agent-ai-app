"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NavBar } from "@/components/NavBar";
import { INDUSTRY_TAGS } from "@/lib/brand";
import { normalizeUrl } from "@/lib/url";

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    setBuilding(true);
    setError("");

    try {
      const normalized = normalizeUrl(url.trim());
      const response = await fetch("/api/v1/ingestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: normalized })
      });

      const payload = (await response.json()) as {
        job_id?: string;
        error?: string;
      };

      if (!response.ok || !payload.job_id) {
        throw new Error(payload.error || "Unable to start the website scan.");
      }

      router.push(
        `/scan?job=${encodeURIComponent(payload.job_id)}&url=${encodeURIComponent(normalized)}`
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start the scan.");
      setBuilding(false);
    }
  }

  return (
    <div className="page-shell overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(26,107,74,0.14),_transparent_55%),radial-gradient(circle_at_20%_30%,_rgba(217,119,6,0.10),_transparent_35%)]" />

      <NavBar
        rightSlot={
          <Link href="/" className="text-sm font-semibold text-brand">
            New Agent
          </Link>
        }
      />

      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl flex-col justify-center px-5 py-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
        <section className="animate-fade-up text-center lg:text-left">
          <div className="mb-5 inline-flex rounded-full bg-brand/7 px-3 py-1 text-[11.5px] font-semibold text-brand">
            Build your agent in minutes
          </div>
          <h1 className="text-[clamp(34px,8vw,64px)] font-bold leading-[1.02] tracking-[-0.06em]">
            Turn your website
            <br />
            <span className="font-[var(--font-fraunces)] italic text-brand">into an agent</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-black/45 lg:mx-0">
            Paste your website URL and AgentDrop creates a custom website agent for your business
            in minutes, ready for you to shape, test, and put to work.
          </p>

          <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl lg:mx-0">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="yourbusiness.com.au"
                className="h-14 flex-1 rounded-xl border border-black/8 bg-white px-4 text-base shadow-[0_1px_8px_rgba(0,0,0,0.03)] outline-none transition focus:border-black/20"
              />
              <button
                type="submit"
                disabled={!url.trim() || building}
                className="h-14 rounded-xl bg-brand px-6 text-[15px] font-bold text-white disabled:cursor-default disabled:bg-black/8 disabled:text-black/25"
              >
                {building ? "Starting..." : "Build My Agent"}
              </button>
            </div>
          </form>

          {error ? <div className="mt-3 text-sm text-danger">{error}</div> : null}

          <div className="mt-3 text-sm text-black/30">Start with your main website URL</div>

          <div className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
            {INDUSTRY_TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/[0.04] bg-black/[0.03] px-3 py-1 text-xs font-medium text-black/35"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10 animate-fade-up lg:mt-0" style={{ animationDelay: "0.1s" }}>
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-[#0f5b40] to-[#174a37] px-6 py-6 text-white">
              <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                What you get
              </div>
              <div className="text-[28px] font-bold tracking-[-0.04em]">
                A custom agent for your business
              </div>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
                Built from your website, styled for your brand, and ready to answer questions like
                part of your team.
              </p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {[
                {
                  title: "1. Drop in your URL",
                  copy: "AgentDrop creates the first version of your agent automatically."
                },
                {
                  title: "2. Make it yours",
                  copy: "Adjust the details, tone, and brand so it feels right for your business."
                },
                {
                  title: "3. Test it",
                  copy: "Try real customer questions before you put it in front of visitors."
                }
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-black/6 bg-[#fbfaf7] p-4 animate-fade-up"
                  style={{ animationDelay: `${0.15 + index * 0.05}s` }}
                >
                  <div className="mb-2 text-sm font-bold">{item.title}</div>
                  <p className="text-[13px] leading-6 text-black/55">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
