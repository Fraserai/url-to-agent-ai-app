"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getAgentSuggestions } from "@/lib/agent-suggestions";
import type { ChatCitation } from "@/lib/preview-chat";
import type { ChatMessage } from "@/lib/types";
import type { AgentWorkspace } from "@/packages/shared/src/types/agentWorkspace";

type PreviewMessage = ChatMessage & {
  citations?: ChatCitation[];
  grounded?: boolean;
};

type ChatWidgetProps = {
  jobId: string;
  workspace: AgentWorkspace;
  embedded?: boolean;
  backHref?: string;
};

function buildGreeting(workspace: AgentWorkspace) {
  return workspace.welcome_message || `Hi, welcome to ${workspace.business_name}. How can I help?`;
}

export function ChatWidget({
  jobId,
  workspace,
  embedded = false,
  backHref
}: ChatWidgetProps) {
  const initialMessage = useMemo<PreviewMessage>(
    () => ({
      role: "assistant",
      content: buildGreeting(workspace),
      grounded: true
    }),
    [workspace]
  );
  const [messages, setMessages] = useState<PreviewMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestions = getAgentSuggestions(workspace.recommended_agent_type);
  const visitorStorageKey = `agentdrop:${jobId}:preview-visitor`;
  const transcriptStorageKey = `agentdrop:${jobId}:preview-messages`;

  useEffect(() => {
    const storedVisitorId = window.localStorage.getItem(visitorStorageKey);
    const nextVisitorId = storedVisitorId || crypto.randomUUID();
    if (!storedVisitorId) {
      window.localStorage.setItem(visitorStorageKey, nextVisitorId);
    }
    setVisitorId(nextVisitorId);

    const storedMessages = window.localStorage.getItem(transcriptStorageKey);
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages) as PreviewMessage[];
        if (Array.isArray(parsed) && parsed.length) {
          setMessages(parsed);
        } else {
          setMessages([initialMessage]);
        }
      } catch {
        setMessages([initialMessage]);
      }
    } else {
      setMessages([initialMessage]);
    }

    setHydrated(true);
  }, [initialMessage, transcriptStorageKey, visitorStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(transcriptStorageKey, JSON.stringify(messages));
  }, [hydrated, messages, transcriptStorageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(timer);
  }, []);

  async function sendMessage(manualMessage?: string) {
    const nextContent = (manualMessage ?? input).trim();
    if (!nextContent || loading || !visitorId) return;

    const nextMessages: PreviewMessage[] = [
      ...messages,
      { role: "user", content: nextContent } satisfies PreviewMessage
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/ingestions/${jobId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitor_id: visitorId,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });

      const payload = (await response.json()) as {
        reply?: string;
        citations?: ChatCitation[];
        grounded?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to answer from the website right now.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            payload.reply ??
            "I couldn't answer that from the website just now. Please try again.",
          citations: payload.citations,
          grounded: payload.grounded
        }
      ]);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Unable to answer from the website right now.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "I’m having trouble answering from the website right now. Please try again in a moment.",
          grounded: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    const nextVisitorId = crypto.randomUUID();
    const nextMessages = [{ ...initialMessage }];
    window.localStorage.setItem(visitorStorageKey, nextVisitorId);
    window.localStorage.removeItem(transcriptStorageKey);
    setVisitorId(nextVisitorId);
    setMessages(nextMessages);
    setInput("");
    setLoading(false);
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-chat ${
        embedded ? "" : "rounded-2xl shadow-card"
      }`}
    >
      <div
        className="flex flex-none items-center justify-between gap-3 px-4 py-3 text-white"
        style={{ backgroundColor: workspace.primary_color }}
      >
        <div className="flex items-center gap-2.5">
          {backHref ? (
            <Link href={backHref} className="pr-1 text-lg leading-none text-white/70">
              ‹
            </Link>
          ) : null}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            {workspace.business_name.charAt(0)}
          </div>
          <div>
            <div className="text-[13.5px] font-bold">{workspace.business_name}</div>
            <div className="text-[10.5px] text-white/70">
              <span className="mr-1 inline-block h-[5px] w-[5px] rounded-full bg-[#4ade80] align-middle" />
              Website agent preview
            </div>
          </div>
        </div>

        {!embedded ? (
          <button
            type="button"
            onClick={resetConversation}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="border-b border-black/5 bg-white px-4 py-3 text-[12px] leading-6 text-black/45">
        This preview stays close to the website. If something is not clearly confirmed there, the
        agent should say so.
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`}>
              <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-[13px] py-[9px] text-[13.5px] leading-6 ${
                    message.role === "user"
                      ? "rounded-[14px_14px_3px_14px] text-white"
                      : "rounded-[14px_14px_14px_3px] bg-white text-ink shadow-bubble"
                  }`}
                  style={
                    message.role === "user" ? { backgroundColor: workspace.primary_color } : undefined
                  }
                >
                  {message.content}
                </div>
              </div>

              {message.role === "assistant" && message.citations?.length ? (
                <div className="mt-2 flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-white/80 px-3 py-2 text-[11.5px] leading-5 text-black/45">
                    <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-black/30">
                      Based on
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {message.citations.map((citation) => (
                        <a
                          key={`${citation.url}-${citation.label}`}
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-black/8 bg-[#fbfaf7] px-2.5 py-1 transition hover:border-brand/15 hover:bg-white"
                          title={citation.snippet}
                        >
                          {citation.title || citation.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {!loading && messages.length < 4 ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-[12.5px] font-medium text-black/55 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-[14px_14px_14px_3px] bg-white px-[13px] py-[9px] shadow-bubble">
                <div className="flex gap-1">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="h-[7px] w-[7px] rounded-full bg-[#c7c7c7] animate-bounce-dot"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex-none border-t border-black/5 bg-white px-2.5 py-2">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask a customer question..."
            className="flex-1 rounded-full border border-black/15 px-4 py-2.5 text-sm outline-none transition focus:border-black/25"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-white transition disabled:cursor-default disabled:bg-[#dddddd]"
            style={{
              backgroundColor: input.trim() && !loading ? workspace.primary_color : "#dddddd"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
