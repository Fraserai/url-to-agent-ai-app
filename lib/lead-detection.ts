import type { ChatMessage, LeadSnapshot } from "@/lib/types";

export const AU_PHONE_REGEX =
  /(?:13\d[\s-]?\d{3})|(?:1300[\s-]?\d{3}[\s-]?\d{3})|(?:04\d{2}[\s-]?\d{3}[\s-]?\d{3})|(?:0[2-9][\s-]?\d{4}[\s-]?\d{4})/;
export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const NAME_PATTERNS = [
  /\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /\bi'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /\bname:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /\bit's\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
];

export function detectLead(messages: ChatMessage[]): LeadSnapshot | null {
  const transcript = messages.map((message) => message.content).join("\n");

  const phone = transcript.match(AU_PHONE_REGEX)?.[0] ?? null;
  const email = transcript.match(EMAIL_REGEX)?.[0] ?? null;
  const name =
    NAME_PATTERNS.map((pattern) => transcript.match(pattern)?.[1] ?? null).find(Boolean) ?? null;

  if (!name && !phone && !email) {
    return null;
  }

  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .slice(-4);

  return {
    name,
    phone,
    email,
    details: userMessages.join(" ").trim() || null
  };
}
