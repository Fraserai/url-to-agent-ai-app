import { callAnthropicText, hasAnthropicKey } from "@/lib/claude";
import type { ChatMessage } from "@/lib/types";
import type { AgentWorkspace } from "@/packages/shared/src/types/agentWorkspace";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";

export type ChatCitation = {
  url: string;
  title: string;
  label: string;
  snippet: string;
};

type EvidenceCandidate = {
  label: string;
  text: string;
  url: string;
  title: string;
  score: number;
};

type GroundingBundle = {
  facts: string[];
  evidence: EvidenceCandidate[];
  citations: ChatCitation[];
};

const STOPWORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "at",
  "can",
  "do",
  "for",
  "from",
  "get",
  "hello",
  "help",
  "hey",
  "hi",
  "how",
  "i",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
  "you",
  "your"
]);

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function tokenize(text: string) {
  const tokens = unique(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );

  const filtered = tokens.filter((token) => !STOPWORDS.has(token));
  return filtered.length ? filtered : tokens;
}

function countMatches(text: string, tokens: string[]) {
  const haystack = text.toLowerCase();
  return tokens.reduce((count, token) => (haystack.includes(token) ? count + 1 : count), 0);
}

function scoreCandidate(text: string, tokens: string[]) {
  if (!tokens.length) return 0;

  const matches = countMatches(text, tokens);
  if (!matches) return 0;

  let score = matches * 6;
  if (text.length <= 180) score += 2;
  if (/[0-9]/.test(text)) score += 1;
  if (/\?$/.test(text)) score += 1;
  return score;
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatNaturalList(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function looksLikeStreetAddress(value: string) {
  return /\d/.test(value) || /\bdrive|street|road|rd|st|avenue|ave|lane|ln|boulevard|blvd|court|ct\b/i.test(value);
}

function homepageCitation(workspace: AgentWorkspace, context: BusinessContextObject): ChatCitation {
  const homepage = workspace.source_pages[0];
  return {
    url: homepage?.finalUrl || context.site.final_homepage_url || context.site.normalized_url,
    title: homepage?.title || context.site.title || workspace.business_name,
    label: "Homepage",
    snippet: truncate(workspace.summary, 180)
  };
}

function buildFactLines(workspace: AgentWorkspace) {
  return [
    `Business name: ${workspace.business_name}`,
    `Industry: ${workspace.industry}`,
    `Summary: ${workspace.summary}`,
    `Services: ${workspace.services.join(", ") || "Not confirmed"}`,
    `Service area: ${workspace.service_area || "Not confirmed"}`,
    `Phone: ${workspace.phone || "Not confirmed"}`,
    `Email: ${workspace.email || "Not confirmed"}`,
    `Hours: ${workspace.hours || "Not confirmed"}`,
    `Recommended agent type: ${workspace.recommended_agent_type}`,
    `Welcome message: ${workspace.welcome_message}`,
    `Agent instructions: ${workspace.agent_instructions || "None provided"}`
  ];
}

function retrieveGrounding(
  workspace: AgentWorkspace,
  context: BusinessContextObject,
  query: string
): GroundingBundle {
  const tokens = tokenize(query);
  const defaultCitation = homepageCitation(workspace, context);

  const factCandidates: EvidenceCandidate[] = buildFactLines(workspace)
    .map((line) => ({
      label: "Fact",
      text: line,
      url: defaultCitation.url,
      title: defaultCitation.title,
      score: scoreCandidate(line, tokens)
    }))
    .filter((entry) => entry.score > 0);

  const snippetCandidates: EvidenceCandidate[] = [
    ...workspace.important_snippets.map((snippet) => ({
      label: snippet.label,
      text: snippet.text,
      url: snippet.url,
      title:
        workspace.source_pages.find((page) => page.finalUrl === snippet.url || page.url === snippet.url)
          ?.title || workspace.business_name,
      score: scoreCandidate(snippet.text, tokens) + 2
    })),
    ...workspace.source_pages.map((page) => ({
      label: page.pageType,
      text: `${page.title}. ${page.snippet}`,
      url: page.finalUrl,
      title: page.title,
      score: scoreCandidate(`${page.title} ${page.snippet}`, tokens)
    })),
    ...workspace.faq.map((item) => ({
      label: "FAQ",
      text: `${item.question} ${item.answer}`,
      url: defaultCitation.url,
      title: "FAQ",
      score: scoreCandidate(`${item.question} ${item.answer}`, tokens) + 1
    }))
  ].filter((entry) => entry.score > 0);

  const topEvidence = [...factCandidates, ...snippetCandidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const citations = unique(topEvidence.map((entry) => JSON.stringify({
    url: entry.url,
    title: entry.title,
    label: entry.label,
    snippet: truncate(entry.text, 220)
  }))).map((entry) => JSON.parse(entry) as ChatCitation).slice(0, 3);

  return {
    facts: buildFactLines(workspace),
    evidence: topEvidence,
    citations: citations.length ? citations : [defaultCitation]
  };
}

function applyAgentInstructions(reply: string, agentInstructions: string) {
  if (!agentInstructions.trim()) return reply;

  const instructions = agentInstructions.toLowerCase();
  let nextReply = reply;

  if (/(formal|professional)/.test(instructions)) {
    nextReply = nextReply.replace(/^Hey!/i, "Hello.");
    nextReply = nextReply.replace(/\bcan’t\b/gi, "cannot");
    nextReply = nextReply.replace(/\bI’m\b/gi, "I am");
  }

  if (/(brief|concise|short)/.test(instructions)) {
    nextReply = truncate(nextReply, 220);
  }

  if (/(friendly|warm|welcoming)/.test(instructions) && !/^(Hi|Hello|Hey)/i.test(nextReply)) {
    nextReply = `Of course. ${nextReply}`;
  }

  return nextReply;
}

function buildUnsupportedReply(workspace: AgentWorkspace) {
  return applyAgentInstructions(
    `I can’t confirm that from ${workspace.business_name}'s website yet. If you want, ask me about services, contact details, hours, or the next step shown on the site.`,
    workspace.agent_instructions
  );
}

function answerPolicyQuestion(
  workspace: AgentWorkspace,
  context: BusinessContextObject,
  query: string
) {
  const normalized = query.toLowerCase();
  const policyEntries = [
    {
      keywords: ["refund", "refunds", "money back"],
      text: context.policies.refunds,
      label: "refunds"
    },
    {
      keywords: ["return", "returns", "exchange"],
      text: context.policies.returns,
      label: "returns"
    },
    {
      keywords: ["shipping", "delivery", "ship"],
      text: context.policies.shipping,
      label: "shipping"
    },
    {
      keywords: ["cancel", "cancellation"],
      text: context.policies.cancellation,
      label: "cancellation"
    },
    {
      keywords: ["privacy"],
      text: context.policies.privacy,
      label: "privacy"
    },
    {
      keywords: ["terms", "conditions"],
      text: context.policies.terms,
      label: "terms"
    }
  ];

  const requestedPolicies = policyEntries.filter((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (!requestedPolicies.length) {
    return null;
  }

  const supportedPolicy = requestedPolicies.find((entry) => entry.text.trim());
  if (!supportedPolicy) {
    return {
      reply: buildUnsupportedReply(workspace),
      supported: false
    };
  }

  return {
    reply: applyAgentInstructions(
      `The website mentions this about ${supportedPolicy.label}: ${truncate(supportedPolicy.text.trim(), 240)}`,
      workspace.agent_instructions
    ),
    supported: true
  };
}

function answerFromFacts(
  workspace: AgentWorkspace,
  context: BusinessContextObject,
  query: string,
  grounding: GroundingBundle
) {
  const normalized = query.toLowerCase();

  const policyReply = answerPolicyQuestion(workspace, context, query);
  if (policyReply) {
    return policyReply;
  }

  if (/(hello|hi|hey)\b/.test(normalized)) {
    return {
      reply: workspace.welcome_message,
      supported: true
    };
  }

  if (/(phone|call|email|contact|reach|speak to)/.test(normalized)) {
    const parts = [workspace.phone, workspace.email].filter(Boolean);
    if (parts.length) {
      return {
        reply: applyAgentInstructions(
          `${workspace.business_name}'s website lists ${parts.join(" and ")} as the best way to get in touch.`,
          workspace.agent_instructions
        ),
        supported: true
      };
    }
  }

  if (/(hours|open|close|today|weekend)/.test(normalized) && workspace.hours) {
    return {
      reply: applyAgentInstructions(
        `${workspace.business_name}'s website currently lists these hours: ${workspace.hours}.`,
        workspace.agent_instructions
      ),
      supported: true
    };
  }

  if (/(where|located|location|service area|suburb|area)/.test(normalized) && workspace.service_area) {
    const locationCopy = looksLikeStreetAddress(workspace.service_area)
      ? `${workspace.business_name} appears to be located at ${workspace.service_area}.`
      : `${workspace.business_name} appears to service ${workspace.service_area}.`;

    return {
      reply: applyAgentInstructions(locationCopy, workspace.agent_instructions),
      supported: true
    };
  }

  if (/(service|offer|help with|do you do|what can)/.test(normalized) && workspace.services.length) {
    const requestedService = workspace.services.find((service) =>
      tokenize(service).some((token) => normalized.includes(token))
    );

    if (requestedService && /(do you do|can you|offer|provide|have)/.test(normalized)) {
      return {
        reply: applyAgentInstructions(
          `Yes, ${workspace.business_name} appears to offer ${requestedService}.`,
          workspace.agent_instructions
        ),
        supported: true
      };
    }

    return {
      reply: applyAgentInstructions(
        `${workspace.business_name} appears to offer ${formatNaturalList(workspace.services.slice(0, 6))}.`,
        workspace.agent_instructions
      ),
      supported: true
    };
  }

  const bestEvidence = grounding.evidence
    .filter((entry) => entry.label !== "Fact")
    .slice(0, 2)
    .map((entry) => truncate(entry.text, 220));

  if (bestEvidence.length) {
    return {
      reply: applyAgentInstructions(
        bestEvidence.length === 1
          ? `From the website: ${bestEvidence[0]}`
          : `From the website: ${bestEvidence.join(" ")}`,
        workspace.agent_instructions
      ),
      supported: true
    };
  }

  return {
    reply: buildUnsupportedReply(workspace),
    supported: false
  };
}

function buildModelSystemPrompt(workspace: AgentWorkspace, grounding: GroundingBundle) {
  return [
    `You are the customer-facing website agent for ${workspace.business_name}.`,
    "Answer only from the supplied facts and website evidence.",
    "If the answer is not supported by the facts or evidence, say you cannot confirm it from the website yet.",
    "Do not invent pricing, availability, policies, or services.",
    workspace.agent_instructions
      ? `Additional agent instructions: ${workspace.agent_instructions}`
      : "",
    "",
    "Verified facts:",
    grounding.facts.join("\n"),
    "",
    "Relevant website evidence:",
    grounding.evidence.map((entry, index) => `[${index + 1}] ${entry.label}: ${entry.text}`).join("\n")
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateWorkspaceReply(input: {
  workspace: AgentWorkspace;
  context: BusinessContextObject;
  messages: ChatMessage[];
}) {
  const lastUserMessage =
    [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const grounding = retrieveGrounding(input.workspace, input.context, lastUserMessage);
  const hasStrongEvidence = grounding.evidence.some((entry) => entry.score >= 6);
  const deterministic = answerFromFacts(
    input.workspace,
    input.context,
    lastUserMessage,
    grounding
  );

  if (!hasStrongEvidence && !deterministic.supported) {
    return {
      reply: deterministic.reply,
      citations: grounding.citations,
      grounded: false
    };
  }

  if (hasAnthropicKey()) {
    try {
      const reply = await callAnthropicText({
        system: buildModelSystemPrompt(input.workspace, grounding),
        messages: input.messages.slice(-8),
        maxTokens: 500
      });

      return {
        reply: applyAgentInstructions(reply, input.workspace.agent_instructions),
        citations: grounding.citations,
        grounded: true
      };
    } catch {
      // Fall through to deterministic grounded replies.
    }
  }

  return {
    reply: deterministic.reply,
    citations: grounding.citations,
    grounded: deterministic.supported
  };
}
