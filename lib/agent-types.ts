import type { AgentType } from "@/lib/types";

type AgentConfig = {
  industries: string[];
  focus: string;
  suggestions: string[];
};

export const AGENT_TYPES: Record<AgentType, AgentConfig> = {
  support: {
    industries: ["default"],
    focus:
      "Answer common questions about the business, services, pricing, hours, and location. Be warm, helpful, and concise. If you do not know something, say so and suggest they contact the business directly.",
    suggestions: [
      "What services do you offer?",
      "Where are you located?",
      "How can I get in touch?"
    ]
  },
  lead: {
    industries: ["trade", "construction", "cleaning", "landscaping", "pest control", "home services"],
    focus:
      "Capture leads naturally by collecting the visitor's name, phone, email, and what they need. Ask qualifying questions conversationally and confirm the details back.",
    suggestions: [
      "Can you help with a quote?",
      "What areas do you service?",
      "How soon could someone contact me?"
    ]
  },
  booking: {
    industries: ["salon", "hairdresser", "beauty", "spa", "clinic", "medical", "dental", "physio", "chiro", "massage", "fitness", "consulting", "coaching"],
    focus:
      "Help visitors book appointments by asking what service they need, their preferred date or time, and their contact details. Let them know someone will confirm shortly.",
    suggestions: [
      "Can I book an appointment?",
      "What times are available?",
      "Do you offer consultations?"
    ]
  },
  menu: {
    industries: ["cafe", "restaurant", "bakery", "bar", "pub", "takeaway", "food", "catering", "pizza"],
    focus:
      "Help visitors browse the menu, answer dietary questions, suggest popular items, and share the venue's hours or location.",
    suggestions: [
      "What are your most popular items?",
      "Do you have vegetarian options?",
      "What time are you open until?"
    ]
  },
  quote: {
    industries: ["plumbing", "electrical", "building", "roofing", "painting", "fencing", "flooring", "renovation", "solar", "air conditioning", "hvac"],
    focus:
      "Gather the details needed for an accurate quote, such as the job scope, location, timing, and contact details. Be conversational rather than sounding like a form.",
    suggestions: [
      "Can you give me a quote?",
      "What jobs do you handle?",
      "How quickly can someone come out?"
    ]
  },
  product: {
    industries: ["retail", "ecommerce", "shop", "store", "fashion", "clothing", "homewares", "furniture", "electronics", "pet"],
    focus:
      "Help visitors find products that fit their needs, budget, and preferences. Share returns, shipping, and store information when relevant.",
    suggestions: [
      "Can you help me choose?",
      "Do you ship Australia-wide?",
      "What is your returns policy?"
    ]
  },
  faq: {
    industries: ["gym", "school", "property management", "insurance", "membership", "club", "association", "strata"],
    focus:
      "Answer policy, membership, and process questions clearly and specifically. Suggest contacting the business directly for complex cases.",
    suggestions: [
      "How does it work?",
      "What are your membership options?",
      "Who should I contact for a specific issue?"
    ]
  },
  onboarding: {
    industries: ["accounting", "accountant", "lawyer", "legal", "financial", "mortgage", "broker", "advisor", "migration", "tax"],
    focus:
      "Guide new clients through the process, explain consultations and documents, and collect contact details plus a summary of their needs.",
    suggestions: [
      "What do I need to get started?",
      "How does your process work?",
      "Can someone contact me about my situation?"
    ]
  },
  realestate: {
    industries: ["real estate", "property", "rental", "letting"],
    focus:
      "Help with listings, inspections, and enquiry capture. Gather renter or buyer details and route serious enquiries to the right agent.",
    suggestions: [
      "Do you have anything available?",
      "When is the next inspection?",
      "Can an agent contact me?"
    ]
  },
  event: {
    industries: ["venue", "event", "function", "wedding", "conference", "hotel", "accommodation"],
    focus:
      "Answer questions about capacity, packages, catering, and availability. Collect event details including date, guest count, budget, and contact info.",
    suggestions: [
      "Are you available for an event?",
      "What packages do you offer?",
      "Can I get a quote for my date?"
    ]
  }
};

export function detectAgentType(input: {
  industry?: string | null;
  services?: string[] | null;
  description?: string | null;
  keyInfo?: string | null;
}): AgentType {
  const text = `${input.industry ?? ""} ${(input.services ?? []).join(" ")} ${input.description ?? ""} ${input.keyInfo ?? ""}`.toLowerCase();

  let best: AgentType = "support";
  let bestScore = 0;

  for (const [id, agent] of Object.entries(AGENT_TYPES) as Array<[AgentType, AgentConfig]>) {
    if (id === "support") continue;
    let score = 0;
    for (const keyword of agent.industries) {
      if (text.includes(keyword)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best;
}

export function getSuggestions(agentType: AgentType) {
  return AGENT_TYPES[agentType]?.suggestions ?? AGENT_TYPES.support.suggestions;
}

