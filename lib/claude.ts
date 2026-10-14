import type { ChatMessage } from "@/lib/types";

type ClaudeRequest = {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  useWebSearch?: boolean;
};

export function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callAnthropicText({
  system,
  messages,
  maxTokens = 1000,
  useWebSearch = false
}: ClaudeRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      tools: useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const text = payload.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned an empty response.");
  }

  return text;
}

export function extractJsonObject(text: string) {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

