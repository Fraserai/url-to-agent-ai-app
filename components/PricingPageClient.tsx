"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { COMPARISONS, FAQS, PLANS } from "@/lib/brand";

export function PricingPageClient({
  businessId,
  nextPath
}: {
  businessId?: string;
  nextPath?: string;
}) {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout(planId: string) {
    if (!businessId) {
      router.push("/");
      return;
    }

    setLoadingPlan(planId);
    setError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessId,
          plan: planId,
          billingInterval: billing,
          next: nextPath
        })
      });

      const payload = (await response.json()) as {
        checkoutUrl?: string;
        loginUrl?: string;
        error?: string;
      };

      if (response.status === 401 && payload.loginUrl) {
        router.push(payload.loginUrl);
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      setError(payload.error ?? "Unable to start checkout right now.");
    } catch {
      setError("Unable to start checkout right now.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mx-auto max-w-2xl px-2 pb-10 pt-14 text-center">
          <div className="mb-5 inline-flex rounded-full bg-brand/7 px-3 py-1 text-[11.5px] font-semibold text-brand">
            Simple, transparent pricing
          </div>
          <h1 className="text-[clamp(30px,7vw,46px)] font-bold leading-[1.08] tracking-[-0.05em]">
            Less than a day&apos;s wages.
            <br />
            <span className="font-[var(--font-fraunces)] italic text-brand">
              Works around the clock.
            </span>
          </h1>
          <p className="mx-auto mb-8 mt-4 max-w-md text-[15px] leading-7 text-black/45">
            Most businesses pay $8,000+ to get a custom AI agent built. With AgentDrop, you can
            be live in minutes.
          </p>

          {businessId ? (
            <div className="mb-6 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3 text-sm text-brand">
              Choose a plan to activate deployment for your agent.
            </div>
          ) : null}

          <div className="inline-flex rounded-[10px] border border-black/6 bg-white p-1 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            {(["monthly", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBilling(value)}
                className={`relative rounded-[8px] px-5 py-2 text-sm font-semibold transition ${
                  billing === value ? "bg-brand text-white" : "text-black/45"
                }`}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
                {value === "annual" ? (
                  <span className="absolute -right-3 -top-2 rounded-md bg-warning px-1.5 py-0.5 text-[9px] font-bold text-white">
                    SAVE
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 pb-12 md:grid-cols-3">
          {PLANS.map((plan, index) => {
            const isHovered = hoveredPlan === plan.id;
            const monthlyPrice = billing === "monthly" ? plan.monthly : plan.annual;

            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`animate-fade-up ${plan.popular ? "rounded-[18px] bg-ink p-1" : ""}`}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {plan.popular ? (
                  <div className="pb-1 pt-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Most Popular
                  </div>
                ) : null}
                <div
                  className="h-full rounded-[18px] border border-black/6 bg-white px-6 py-7 transition duration-200"
                  style={{
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: isHovered ? "0 8px 30px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.03)"
                  }}
                >
                  <div className="mb-5">
                    <div className="text-lg font-bold">{plan.name}</div>
                    <div className="text-[12.5px] text-black/40">{plan.tagline}</div>
                  </div>

                  <div className="mb-4 rounded-[10px] border border-brand/8 bg-brand/4 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold text-black/40">One-time setup</span>
                      <span className="text-[22px] font-bold text-brand">${plan.setup.toLocaleString()}</span>
                    </div>
                    {billing === "annual" ? (
                      <div className="mt-1 text-right text-[11px] font-semibold text-brand">
                        Waived on annual plan
                      </div>
                    ) : null}
                  </div>

                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[38px] font-bold tracking-[-0.06em]">${monthlyPrice}</span>
                      <span className="text-sm font-medium text-black/35">/month</span>
                    </div>
                    {billing === "annual" ? (
                      <>
                        <div className="mt-1 text-xs text-black/35">
                          <span className="line-through">${plan.monthly}/mo</span>
                          <span className="ml-2 font-semibold text-brand">
                            Save ${(plan.monthly - plan.annual) * 12}/yr
                          </span>
                        </div>
                        <div className="mt-1 text-[11.5px] text-black/35">
                          Billed annually at ${(plan.annual * 12).toLocaleString()}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={loadingPlan !== null}
                    onClick={() => void handleCheckout(plan.id)}
                    className={`mb-6 block w-full rounded-[11px] px-5 py-3 text-center text-sm font-bold ${
                      plan.popular ? "bg-brand text-white" : "bg-black/6 text-ink"
                    } disabled:cursor-wait disabled:opacity-70`}
                  >
                    {loadingPlan === plan.id
                      ? "Starting checkout..."
                      : businessId
                        ? `Choose ${plan.name}`
                        : plan.cta}
                  </button>

                  <div className="flex flex-col gap-3">
                    {plan.features.map((feature) => {
                      const sectionLabel = feature.endsWith("plus:");
                      return (
                        <div key={feature} className="flex items-start gap-2.5">
                          {sectionLabel ? null : (
                            <span className="mt-0.5 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-brand/8">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#1a6b4a"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )}
                          <span
                            className={`text-[13px] leading-5 ${
                              sectionLabel
                                ? "font-semibold italic text-black/30"
                                : "font-medium text-black/60"
                            }`}
                          >
                            {feature}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section className="mx-auto max-w-3xl pb-12">
          <div className="mb-6 text-center">
            <h2 className="text-[clamp(22px,5vw,30px)] font-bold tracking-[-0.03em]">
              Compare the{" "}
              <span className="font-[var(--font-fraunces)] italic text-brand">alternatives</span>
            </h2>
            <p className="mt-1 text-sm text-black/38">What businesses are actually paying in 2026</p>
          </div>

          <div className="flex flex-col gap-2">
            {COMPARISONS.map((comparison, index) => (
              <div
                key={comparison.label}
                className={`grid grid-cols-[1.1fr_1fr_1fr_0.8fr] items-center gap-2 rounded-xl px-4 py-4 animate-fade-up ${
                  comparison.highlight
                    ? "border-2 border-brand bg-brand/4"
                    : "border border-black/5 bg-white"
                }`}
                style={{ animationDelay: `${0.2 + index * 0.06}s` }}
              >
                <div
                  className={`text-[13px] font-semibold ${
                    comparison.highlight ? "text-brand" : "text-ink"
                  }`}
                >
                  {comparison.label}
                </div>
                <div className="text-xs font-medium text-black/5">{comparison.cost}</div>
                <div className="text-xs font-medium text-black/5">{comparison.monthly}</div>
                <div
                  className={`text-right text-[11.5px] font-bold ${
                    comparison.highlight ? "text-brand" : "text-black/35"
                  }`}
                >
                  {comparison.time}
                </div>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-danger/15 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <section className="mx-auto max-w-xl pb-12">
          <div className="rounded-[18px] bg-ink px-7 py-8 text-center text-white animate-fade-up">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
              The maths
            </div>
            <div className="mb-6 grid grid-cols-3 gap-4">
              {[
                { value: "$300", label: "AgentDrop/mo", colour: "#4ade80" },
                { value: "1", label: "missed booking caught", colour: "#fbbf24" },
                { value: "$1,400", label: "revenue recovered", colour: "#4ade80" }
              ].map((item) => (
                <div key={item.label}>
                  <div
                    className="text-[28px] font-bold tracking-[-0.06em]"
                    style={{ color: item.colour }}
                  >
                    {item.value}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-white/45">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="text-sm leading-7 text-white/55">
              One captured enquiry pays for your entire month.
              <br />
              <span className="font-semibold text-white">The rest is upside.</span>
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-xl pb-14">
          <h3 className="mb-5 text-center text-xl font-bold tracking-[-0.02em]">
            Common questions
          </h3>
          {FAQS.map((faq, index) => (
            <details
              key={faq.question}
              className="mb-2 overflow-hidden rounded-xl border border-black/5 bg-white animate-fade-up"
              style={{ animationDelay: `${0.3 + index * 0.04}s` }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[13.5px] font-semibold">
                {faq.question}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(0,0,0,0.25)"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="px-5 pb-4 text-[13px] leading-6 text-black/5">{faq.answer}</div>
            </details>
          ))}
        </section>

        <section className="bg-gradient-to-t from-brand/4 to-transparent px-4 py-12 text-center">
          <h2 className="text-[clamp(24px,5vw,34px)] font-bold tracking-[-0.04em]">
            Ready to try it?
          </h2>
          <p className="mb-6 mt-2 text-sm text-black/40">
            Build your agent for free. Deploy when you&apos;re ready.
          </p>
          {businessId ? (
            <button
              type="button"
              onClick={() => void handleCheckout("growth")}
              disabled={loadingPlan !== null}
              className="inline-block rounded-xl bg-brand px-9 py-3.5 text-[15px] font-bold text-white shadow-glow disabled:opacity-70"
            >
              {loadingPlan === "growth" ? "Starting checkout..." : "Start With Growth"}
            </button>
          ) : (
            <Link
              href="/"
              className="inline-block rounded-xl bg-brand px-9 py-3.5 text-[15px] font-bold text-white shadow-glow"
            >
              Build Your Agent Free
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
