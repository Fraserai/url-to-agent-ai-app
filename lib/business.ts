import { AGENT_TYPES, detectAgentType } from "@/lib/agent-types";
import { callAnthropicText, extractJsonObject, hasAnthropicKey } from "@/lib/claude";
import { detectLead, EMAIL_REGEX, AU_PHONE_REGEX } from "@/lib/lead-detection";
import { scanWebsite } from "@/lib/site-scan";
import { domainToBusinessName, getDomain, normalizeUrl } from "@/lib/url";
import type { BusinessDraft, BusinessRecord, ChatMessage, LeadSnapshot } from "@/lib/types";

const INDUSTRY_LABELS = {
  support: "Local Business",
  lead: "Home Services",
  booking: "Appointments & Services",
  menu: "Hospitality",
  quote: "Trades & Projects",
  product: "Retail",
  faq: "Membership Services",
  onboarding: "Professional Services",
  realestate: "Real Estate",
  event: "Events & Venues"
} as const;

const SERVICE_KEYWORDS = [
  "parasailing",
  "takeaway",
  "booking",
  "consultation",
  "consulting",
  "quotes",
  "repairs",
  "installations",
  "weddings",
  "events",
  "appointments",
  "memberships",
  "property management",
  "rentals",
  "sales",
  "cleaning",
  "landscaping",
  "catering",
  "training",
  "dental",
  "physio",
  "legal",
  "tax",
  "mortgage",
  "retail",
  "menu",
  "products",
  "shipping",
  "returns",
  "delivery",
  "therapy",
  "massage",
  "plumbing",
  "electrical",
  "roofing",
  "painting",
  "renovation",
  "bookkeeping",
  "accounting",
  "coffee",
  "breakfast",
  "brunch",
  "lunch",
  "drinks",
  "cafe",
  "burgers",
  "sandwich",
  "sandwiches",
  "dessert",
  "cakes",
  "pastries",
  "catering",
  "dine"
];

const KNOWLEDGE_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "any",
  "are",
  "around",
  "been",
  "before",
  "being",
  "can",
  "could",
  "from",
  "have",
  "hello",
  "help",
  "here",
  "into",
  "just",
  "more",
  "need",
  "please",
  "that",
  "their",
  "them",
  "there",
  "they",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your"
]);

function unique(input: string[]) {
  return Array.from(new Set(input.filter(Boolean)));
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function hasUsefulBusinessSummary(text: string | null | undefined) {
  if (!text?.trim()) return false;
  const cleaned = text.trim();
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

  if (cleaned.length < 35 || cleaned.length > 420 || wordCount < 6) {
    return false;
  }

  if (/^whoops\b|404|not found/i.test(cleaned)) {
    return false;
  }

  if (cleaned.toUpperCase() === cleaned && /[A-Z]/.test(cleaned)) {
    return false;
  }

  return true;
}

function buildBusinessSummary(input: {
  businessName: string;
  services: string[];
  serviceArea: string;
}) {
  const services = input.services.slice(0, 3).join(", ");
  const area = input.serviceArea.trim();

  if (services && area) {
    return `${input.businessName} helps customers across ${area} with ${services}.`;
  }

  if (services) {
    return `${input.businessName} helps customers with ${services}.`;
  }

  if (area) {
    return `${input.businessName} serves customers across ${area}.`;
  }

  return `${input.businessName} serves customers through the information published on the business website.`;
}

function inferServices(text: string) {
  const matches = SERVICE_KEYWORDS.filter((keyword) => text.toLowerCase().includes(keyword)).map(
    (keyword) => keyword.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );

  if (matches.length) {
    return unique(matches).slice(0, 6);
  }

  const chunks = text
    .split(/[.!?]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.split(" ").length >= 2 && chunk.split(" ").length <= 5)
    .slice(0, 5);

  return unique(chunks).slice(0, 5);
}

function inferServiceArea(text: string) {
  const patterns = [
    /(?:serving|service area|areas we serve|located in|based in)\s+([A-Z][A-Za-z\s,]{3,60})/i,
    /\b(Australia|New Zealand|United States|United Kingdom|Canada|Singapore|Ireland)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1] ?? text.match(pattern)?.[0];
    if (match) return match.trim();
  }

  return "";
}

function isUsefulServiceArea(value: string | null | undefined) {
  if (!value?.trim()) return false;

  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();

  if (cleaned.length < 3) {
    return false;
  }

  if (/menu|service|services|pricing|products|shop|contact|about|delivery/i.test(cleaned)) {
    return false;
  }

  if (/\b(gym|fitness|club|cafe|coffee|training)\b/i.test(cleaned)) {
    return false;
  }

  if (SERVICE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }

  return true;
}

function inferIndustry(text: string) {
  const agentType = detectAgentType({
    description: text,
    industry: text,
    keyInfo: text,
    services: inferServices(text)
  });

  return {
    industry: INDUSTRY_LABELS[agentType],
    agentType
  };
}

function buildSystemPrompt(input: BusinessDraft, agentType = input.agentType ?? "support") {
  const focus = AGENT_TYPES[agentType].focus;
  const businessFacts = [
    `Business name: ${input.businessName}`,
    `Industry: ${input.industry}`,
    `Services: ${input.services.join(", ") || "General enquiries"}`,
    `Service area: ${input.serviceArea || "Not confirmed"}`,
    `Phone: ${input.phone ?? "Not listed"}`,
    `Email: ${input.email ?? "Not listed"}`,
    `Hours: ${input.hours ?? "Not listed"}`,
    `Description: ${input.description || "No description provided"}`,
    `Key info: ${input.keyInfo || "No additional notes"}`,
    `Scanned pages: ${input.sourceUrls.length || 0}`,
    `Scan method: ${input.scanMethod ?? "html"}`
  ].join("\n");

  return [
    `You are the customer-facing AI assistant for ${input.businessName}.`,
    focus,
    "Use a warm, natural Australian tone.",
    "Answer using only the verified business facts and website excerpts provided at runtime.",
    "Never invent services, pricing, availability, hours, locations, or policies.",
    "If the answer is not confirmed by the facts or website excerpts, say you cannot confirm it yet and offer to take an enquiry.",
    "Keep replies concise, usually within 2 to 4 sentences.",
    "If the visitor sounds ready to book, buy, or request a quote, politely collect their name, phone, email, and what they need.",
    input.assistantInstructions
      ? `Additional assistant instructions: ${input.assistantInstructions}`
      : "",
    "",
    businessFacts
  ].join("\n");
}

async function extractBusinessWithClaude(input: {
  url: string;
  combinedText: string;
  knowledgeText: string;
}) {
  const text = await callAnthropicText({
    messages: [
      {
        role: "user",
        content: `Extract structured business data from these real website excerpts.

WEBSITE URL:
${input.url}

WEBSITE EXCERPTS:
${truncate(input.knowledgeText || input.combinedText, 14000)}

Return only a JSON object with this exact shape:
{"businessName":"","industry":"","services":[],"serviceArea":"","phone":null,"email":null,"hours":null,"description":"","keyInfo":""}

Rules:
- Use only information supported by the excerpts.
- Do not invent phone, email, hours, pricing, or services.
- Keep services as short clean labels.
- Leave fields null or empty if not confirmed.`
      }
    ],
    maxTokens: 1400
  });

  return extractJsonObject(text);
}

function normaliseScannedBusiness(
  url: string,
  raw: Record<string, unknown> | null,
  websiteScan: Awaited<ReturnType<typeof scanWebsite>>
): BusinessDraft {
  const domain = websiteScan.domain || getDomain(url);
  const businessName = firstNonEmpty(
    typeof raw?.businessName === "string" ? raw.businessName : null,
    websiteScan.businessName,
    domainToBusinessName(domain)
  );
  const heuristicServices = inferServices(websiteScan.combinedText);
  const rawServices = Array.isArray(raw?.services)
    ? unique(raw.services.map((service) => String(service).trim())).slice(0, 8)
    : websiteScan.services.length
      ? websiteScan.services.slice(0, 8)
      : heuristicServices;
  const matchedRawServices = rawServices.filter((service) =>
    SERVICE_KEYWORDS.some((keyword) => service.toLowerCase().includes(keyword))
  );
  const services =
    matchedRawServices.length >= 2 || heuristicServices.length === 0
      ? rawServices
      : unique([...heuristicServices, ...matchedRawServices]).slice(0, 8);

  const inferredAgentType = detectAgentType({
    industry: typeof raw?.industry === "string" ? raw.industry : websiteScan.combinedText,
    services,
    description:
      typeof raw?.description === "string" ? raw.description : websiteScan.description,
    keyInfo: typeof raw?.keyInfo === "string" ? raw.keyInfo : websiteScan.keyInfo
  });
  const chosenServiceArea =
    typeof raw?.serviceArea === "string" && raw.serviceArea.trim()
      ? raw.serviceArea
      : firstNonEmpty(websiteScan.serviceArea, inferServiceArea(websiteScan.combinedText), "");
  const serviceArea = isUsefulServiceArea(chosenServiceArea) ? chosenServiceArea : "";
  const scannedDescription =
    typeof raw?.description === "string" && raw.description.trim()
      ? raw.description
      : websiteScan.description;
  const description = hasUsefulBusinessSummary(scannedDescription)
    ? scannedDescription.trim()
    : buildBusinessSummary({
        businessName,
        services: services.length ? services : ["General enquiries"],
        serviceArea
      });

  return {
    domain,
    businessName,
    industry:
      typeof raw?.industry === "string" && raw.industry.trim()
        ? raw.industry
        : INDUSTRY_LABELS[inferredAgentType],
    services: services.length ? services : ["General enquiries"],
    sourceUrls: websiteScan.sourceUrls,
    knowledgeText: websiteScan.knowledgeText,
    scanMethod: websiteScan.scanMethod,
    scanWarnings: websiteScan.scanWarnings,
    assistantInstructions: "",
    serviceArea,
    phone:
      typeof raw?.phone === "string" && raw.phone.trim()
        ? raw.phone
        : websiteScan.phone ?? null,
    email:
      typeof raw?.email === "string" && raw.email.trim()
        ? raw.email
        : websiteScan.email ?? null,
    hours:
      typeof raw?.hours === "string" && raw.hours.trim()
        ? raw.hours
        : websiteScan.hours ?? null,
    description,
    keyInfo:
      typeof raw?.keyInfo === "string" && raw.keyInfo.trim()
        ? raw.keyInfo
        : websiteScan.keyInfo,
    accentColor: "#1a6b4a",
    isDeployed: false,
    platform: null,
    plan: null,
    userId: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingInterval: null,
    subscriptionStatus: null,
    agentType: inferredAgentType
  };
}

export async function generateSystemPrompt(input: BusinessDraft) {
  const agentType = input.agentType ?? detectAgentType(input);
  return buildSystemPrompt(input, agentType);
}

async function scanWebsiteWithFallback(url: string) {
  const primaryUrl = normalizeUrl(url);

  try {
    return await scanWebsite(primaryUrl);
  } catch (primaryError) {
    if (primaryUrl.startsWith("https://")) {
      try {
        return await scanWebsite(primaryUrl.replace(/^https:\/\//i, "http://"));
      } catch {
        throw primaryError;
      }
    }

    throw primaryError;
  }
}

export async function scanBusinessWebsite(url: string) {
  const websiteScan = await scanWebsiteWithFallback(url);

  let scanned: Record<string, unknown> | null = {
    businessName: websiteScan.businessName,
    industry: inferIndustry(websiteScan.combinedText).industry,
    services: websiteScan.services,
    serviceArea: websiteScan.serviceArea,
    phone: websiteScan.phone,
    email: websiteScan.email,
    hours: websiteScan.hours,
    description: websiteScan.description,
    keyInfo: websiteScan.keyInfo
  };

  if (hasAnthropicKey()) {
    try {
      const refined = await extractBusinessWithClaude({
        url: websiteScan.finalUrl,
        combinedText: websiteScan.combinedText,
        knowledgeText: websiteScan.knowledgeText
      });

      if (refined) {
        scanned = {
          ...scanned,
          ...refined
        };
      }
    } catch {
      // Fall back to heuristic extraction from the real crawl.
    }
  }

  const business = normaliseScannedBusiness(websiteScan.finalUrl, scanned, websiteScan);
  business.agentType = business.agentType ?? detectAgentType(business);
  business.systemPrompt = await generateSystemPrompt(business);

  return business;
}

function tokenize(text: string) {
  return unique(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !KNOWLEDGE_STOPWORDS.has(token))
  );
}

function stripKnowledgeMetadata(section: string) {
  return section
    .split("\n")
    .flatMap((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("URL:")) {
        return [];
      }

      if (trimmed.startsWith("Page ")) {
        const title = trimmed.replace(/^Page\s+\d+:\s*/i, "").trim();
        return title ? [title] : [];
      }

      if (trimmed.startsWith("Headings:")) {
        return trimmed
          .replace(/^Headings:\s*/i, "")
          .split("|")
          .map((heading) => heading.trim())
          .filter(Boolean);
      }

      return [trimmed.replace(/^(Summary|Content):\s*/i, "").trim()];
    })
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .join("\n");
}

function tokensMatch(left: string, right: string) {
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function scoreTextForQuery(text: string, queryTokens: string[]) {
  const textTokens = tokenize(text);
  return queryTokens.reduce((score, token) => {
    const exactHits = textTokens.filter((textToken) => textToken === token).length;
    const partialHits = textTokens.filter((textToken) => tokensMatch(textToken, token)).length;
    return score + exactHits * 3 + Math.max(partialHits - exactHits, 0);
  }, 0);
}

function countMatchingTokens(text: string, queryTokens: string[]) {
  const textTokens = new Set(tokenize(text));
  return queryTokens.filter((token) =>
    [...textTokens].some((textToken) => tokensMatch(textToken, token))
  ).length;
}

function buildQueryPhrases(queryTokens: string[]) {
  const phrases: string[] = [];

  for (let index = 0; index < queryTokens.length - 1; index += 1) {
    phrases.push(`${queryTokens[index]} ${queryTokens[index + 1]}`);
  }

  return unique(phrases);
}

function scoreSnippetForQuery(snippet: string, queryTokens: string[]) {
  const normalizedSnippet = snippet.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const queryPhrases = buildQueryPhrases(queryTokens);
  let score = scoreTextForQuery(snippet, queryTokens) + countMatchingTokens(snippet, queryTokens) * 2;

  if (queryPhrases.some((phrase) => normalizedSnippet.includes(phrase))) {
    score += 7;
  }

  if (snippet.length <= 48) {
    score += 3;
  }

  if (snippet.length >= 150) {
    score -= 4;
  }

  if (/^[A-Z][A-Za-z0-9/&' -]{3,60}$/.test(snippet)) {
    score += 2;
  }

  return score;
}

function getRelevantKnowledgeSections(knowledgeText: string, query: string) {
  const sections = knowledgeText
    .split(/\n\n===\n\n/g)
    .map((section) => section.trim())
    .filter(Boolean);
  const queryTokens = tokenize(query);

  if (!sections.length || !queryTokens.length) {
    return [];
  }

  return sections
    .map((section) => ({
      section,
      score: scoreTextForQuery(section, queryTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.section);
}

function pickRelevantSentences(section: string, query: string) {
  const queryTokens = tokenize(query);
  const cleanSection = stripKnowledgeMetadata(section);
  const sentences = unique(
    cleanSection
      .split("\n")
      .flatMap((line) =>
        line
          .split(/(?<=[.!?])\s+/)
          .map((sentence) => sentence.trim())
          .filter(Boolean)
      )
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length >= 12 && sentence.length <= 220)
      .filter((sentence) => !/^([A-Z0-9\s&/-]{18,})$/.test(sentence))
      .filter((sentence) => !/^(Click here|Learn more|Read more|Order now|View all|Join now)$/i.test(sentence))
  );

  if (!sentences.length) {
    return [];
  }

  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: scoreSnippetForQuery(sentence, queryTokens)
    }))
    .sort((a, b) => b.score - a.score)
    .filter((entry, index) => entry.score > 0 || index === 0)
    .slice(0, 2)
    .map((entry) => entry.sentence);

  return unique(ranked);
}

function summariseKnowledgeAnswer(business: BusinessRecord, query: string) {
  const queryTokens = tokenize(query);
  const sections = getRelevantKnowledgeSections(business.knowledgeText ?? "", query);
  if (!sections.length) {
    return "";
  }

  const sentences = unique(sections.flatMap((section) => pickRelevantSentences(section, query)))
    .filter((sentence) => {
      const matchedTokens = countMatchingTokens(sentence, queryTokens);
      const minimumMatches = queryTokens.length >= 2 ? 2 : 1;
      return matchedTokens >= minimumMatches;
    })
    .slice(0, 2);

  if (!sentences.length) {
    return "";
  }

  if (sentences.length === 1 && sentences[0].length <= 48 && !/[.!?]$/.test(sentences[0])) {
    return truncate(`From ${business.businessName}'s website: ${sentences[0]}.`, 260);
  }

  const answer = sentences.join(" ");
  return truncate(`From ${business.businessName}'s website: ${answer}`, 260);
}

function findBestServiceMatch(services: string[], query: string) {
  const queryTokens = tokenize(query);

  if (!queryTokens.length) {
    return "";
  }

  const minimumMatches = queryTokens.length >= 2 ? 2 : 1;

  return (
    services
      .map((service) => ({
        service,
        score: scoreSnippetForQuery(service, queryTokens),
        matches: countMatchingTokens(service, queryTokens)
      }))
      .filter((entry) => entry.score > 0 && entry.matches >= minimumMatches)
      .sort((a, b) => b.score - a.score)[0]?.service ?? ""
  );
}

function buildGroundingContext(business: BusinessRecord, query: string) {
  const relevantSections = getRelevantKnowledgeSections(business.knowledgeText ?? "", query);

  const facts = [
    `Business name: ${business.businessName}`,
    `Industry: ${business.industry}`,
    `Services: ${business.services.join(", ") || "General enquiries"}`,
    `Service area: ${business.serviceArea || "Not confirmed"}`,
    `Phone: ${business.phone ?? "Not listed"}`,
    `Email: ${business.email ?? "Not listed"}`,
    `Hours: ${business.hours ?? "Not listed"}`,
    `Description: ${business.description || "No description provided"}`,
    `Key info: ${business.keyInfo || "No additional notes"}`,
    `Assistant instructions: ${business.assistantInstructions || "None provided"}`
  ].join("\n");

  return [
    "Verified business facts:",
    facts,
    relevantSections.length
      ? `Relevant website excerpts:\n${relevantSections.map((section) => stripKnowledgeMetadata(section)).join("\n\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function applyAssistantInstructions(reply: string, assistantInstructions: string) {
  if (!assistantInstructions.trim()) {
    return reply;
  }

  const instructions = assistantInstructions.toLowerCase();
  let nextReply = reply;

  if (/(formal|professional)/.test(instructions)) {
    nextReply = nextReply.replace(/^Hey!/i, "Hello.");
    nextReply = nextReply.replace(/\bAbsolutely\b/g, "Certainly");
    nextReply = nextReply.replace(/\bI’ve\b/g, "I have");
  }

  if (/(friendly|warm|welcoming|casual)/.test(instructions) && !/^(Hey|Hi|Hello)/i.test(nextReply)) {
    nextReply = `Of course. ${nextReply}`;
  }

  if (/(brief|concise|short)/.test(instructions)) {
    nextReply = truncate(nextReply, 220);
  }

  return nextReply;
}

function fallbackChatReply(business: BusinessRecord, messages: ChatMessage[]) {
  const lastMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const query = lastMessage.toLowerCase();
  const lead = detectLead(messages);
  const groundedAnswer = summariseKnowledgeAnswer(business, lastMessage);
  const matchedService = findBestServiceMatch(business.services, lastMessage);

  if (lead?.phone || lead?.email) {
    return applyAssistantInstructions(
      `Thanks${lead.name ? `, ${lead.name}` : ""}. I’ve noted your details and the ${business.businessName} team can follow up shortly.`,
      business.assistantInstructions
    );
  }

  if (/(hours|open|close|today|weekend)/.test(query)) {
    if (business.hours) {
      return applyAssistantInstructions(
        `${business.businessName} is currently listed as ${business.hours}. If you need help outside those hours, I can still help you leave an enquiry.`,
        business.assistantInstructions
      );
    }

    return applyAssistantInstructions(
      groundedAnswer ||
        `I do not have exact opening hours confirmed yet, but I can help you leave a message for ${business.businessName}.`,
      business.assistantInstructions
    );
  }

  if (/(phone|call|email|contact|speak to)/.test(query)) {
    const contact = [business.phone, business.email].filter(Boolean).join(" or ");
    return applyAssistantInstructions(
      contact
        ? `You can contact ${business.businessName} via ${contact}. If you like, I can also take your details and pass on what you need.`
        : groundedAnswer ||
            `I can help take your details now and pass your enquiry on to ${business.businessName}.`,
      business.assistantInstructions
    );
  }

  if (/(where|located|service area|suburb|location)/.test(query)) {
    return applyAssistantInstructions(
      business.serviceArea
        ? `${business.businessName} services ${business.serviceArea}. If you want to check a specific area, let me know.`
        : groundedAnswer ||
            `I can help check that for you. If you tell me the suburb or area, I’ll do my best to help.`,
      business.assistantInstructions
    );
  }

  if (
    matchedService &&
    /(menu|drink|drinks|food|coffee|catering|vegetarian|vegan|gluten|dessert|breakfast|brunch|lunch|training|class|classes|membership|personal trainer|personal training)/.test(
      query
    )
  ) {
    return applyAssistantInstructions(
      `From ${business.businessName}'s website: ${matchedService}.`,
      business.assistantInstructions
    );
  }

  if (/(book|appointment|available|availability|schedule)/.test(query)) {
    if (groundedAnswer) {
      return applyAssistantInstructions(
        `${groundedAnswer} If you want to go ahead, tell me the service you need and the best contact details for a follow-up.`,
        business.assistantInstructions
      );
    }

    return applyAssistantInstructions(
      `Absolutely. Let me know the service you need, your preferred day or time, and the best phone number or email for a follow-up.`,
      business.assistantInstructions
    );
  }

  if (/(price|cost|quote|how much)/.test(query)) {
    if (groundedAnswer) {
      return applyAssistantInstructions(groundedAnswer, business.assistantInstructions);
    }

    return applyAssistantInstructions(
      business.agentType === "quote" || business.agentType === "lead"
        ? `Pricing can depend on the job details. If you share what you need and where the job is located, I can help capture the enquiry for the team.`
        : `Pricing can vary depending on what you need. Tell me a little about the service you are after and I’ll help point you in the right direction.`,
      business.assistantInstructions
    );
  }

  if (/(service|offer|help with|do you do|what can)/.test(query)) {
    const genericServiceQuestion =
      /(what services|services do you offer|what do you offer|what can you do|help with)/.test(
        query
      );

    if (!genericServiceQuestion && groundedAnswer) {
      return applyAssistantInstructions(groundedAnswer, business.assistantInstructions);
    }

    const serviceSummary = `${business.businessName} can help with ${business.services
      .slice(0, 5)
      .join(", ")}.`;

    return applyAssistantInstructions(
      groundedAnswer
        ? `${serviceSummary} ${groundedAnswer}`
        : `${serviceSummary} If you tell me what you need, I can guide you from there.`,
      business.assistantInstructions
    );
  }

  if (/(hello|hi|hey)/.test(query)) {
    return applyAssistantInstructions(
      `Hey! Welcome to ${business.businessName}. How can I help you today?`,
      business.assistantInstructions
    );
  }

  if (groundedAnswer) {
    return applyAssistantInstructions(
      `${groundedAnswer} If you'd like, I can also help you with the next step or pass an enquiry to the team.`,
      business.assistantInstructions
    );
  }

  return applyAssistantInstructions(
    `I couldn’t confirm that from ${business.businessName}'s website yet, but I can help take your details and pass on your enquiry.`,
    business.assistantInstructions
  );
}

export async function getAssistantReply(business: BusinessRecord, messages: ChatMessage[]) {
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  if (hasAnthropicKey()) {
    try {
      return await callAnthropicText({
        system: `${business.systemPrompt}\n\n${buildGroundingContext(business, lastUserMessage)}`,
        messages: messages.slice(-10),
        maxTokens: 700
      });
    } catch {
      return fallbackChatReply(business, messages);
    }
  }

  return fallbackChatReply(business, messages);
}

export function summariseConversationForLead(messages: ChatMessage[]) {
  const recentUserMessages = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean);

  return recentUserMessages.join(" ").trim() || "New enquiry captured via the AI agent.";
}

export function extractLead(messages: ChatMessage[]): LeadSnapshot | null {
  return detectLead(messages);
}
