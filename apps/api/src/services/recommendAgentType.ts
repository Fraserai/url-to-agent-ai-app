import type { AgentRecommendation, AgentType } from "@/packages/shared/src/types/agentRecommendation";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";

type RecommendationCandidate = {
  type: AgentType;
  score: number;
  reasons: string[];
  tools: string[];
  goals: string[];
};

function buildCandidate(type: AgentType): RecommendationCandidate {
  return {
    type,
    score: 0,
    reasons: [],
    tools: [],
    goals: []
  };
}

function addReason(candidate: RecommendationCandidate, amount: number, reason: string) {
  candidate.score += amount;
  candidate.reasons.push(reason);
}

export function recommendAgentType(context: BusinessContextObject): AgentRecommendation {
  const candidates: RecommendationCandidate[] = [
    buildCandidate("lead_capture"),
    buildCandidate("booking_assistant"),
    buildCandidate("faq_support"),
    buildCandidate("quote_assistant"),
    buildCandidate("ecommerce_guide"),
    buildCandidate("local_business_receptionist"),
    buildCandidate("product_recommender")
  ];

  const ctaText = context.conversion.cta_labels.join(" ").toLowerCase();

  for (const candidate of candidates) {
    if (candidate.type === "lead_capture") {
      if (context.conversion.primary_conversion_type === "lead") {
        addReason(candidate, 4, "Primary conversion path is lead generation.");
      }
      if (context.offerings.quote_supported) {
        addReason(candidate, 2, "Quote-style CTAs suggest a lead flow.");
      }
      if (context.conversion.forms.some((form) => form.fields.length >= 2)) {
        addReason(candidate, 2, "Lead forms are present on the site.");
      }
      candidate.tools.push("lead_form", "email_handoff", "crm_webhook");
      candidate.goals.push("qualify leads", "capture enquiry details", "handoff to team");
    }

    if (candidate.type === "booking_assistant") {
      if (context.offerings.booking_supported) {
        addReason(candidate, 4, "Booking signals are present.");
      }
      if (context.conversion.booking_links.length) {
        addReason(candidate, 3, "Booking links were discovered.");
      }
      if (/appointment|schedule|reserve|consultation/.test(ctaText)) {
        addReason(candidate, 2, "Appointment language is prominent.");
      }
      candidate.tools.push("booking_link_router", "contact_capture");
      candidate.goals.push("book appointments", "answer booking questions");
    }

    if (candidate.type === "faq_support") {
      if (context.policies.faq.length >= 2) {
        addReason(candidate, 4, "The site exposes FAQ content.");
      }
      if (context.offerings.support_supported) {
        addReason(candidate, 3, "Support/help signals are present.");
      }
      candidate.tools.push("faq_lookup", "human_handoff");
      candidate.goals.push("answer common questions", "reduce repetitive support load");
    }

    if (candidate.type === "quote_assistant") {
      if (context.offerings.quote_supported) {
        addReason(candidate, 5, "Quote signals are present.");
      }
      if (/quote|estimate|get a quote/.test(ctaText)) {
        addReason(candidate, 3, "Quote CTAs are prominent.");
      }
      candidate.tools.push("lead_form", "quote_request_capture");
      candidate.goals.push("gather quote details", "qualify scope");
    }

    if (candidate.type === "ecommerce_guide") {
      if (context.offerings.ecommerce_supported) {
        addReason(candidate, 5, "Checkout/shop signals were discovered.");
      }
      if (context.conversion.checkout_links.length) {
        addReason(candidate, 3, "Checkout links are present.");
      }
      candidate.tools.push("product_lookup", "cart_redirect");
      candidate.goals.push("guide shoppers", "answer purchase questions");
    }

    if (candidate.type === "local_business_receptionist") {
      if (context.business.contact.phones.length || context.business.hours.length) {
        addReason(candidate, 4, "Phone and hours signals are present.");
      }
      if (context.business.locations.length || context.business.service_area.length) {
        addReason(candidate, 3, "Location/service-area signals are present.");
      }
      candidate.tools.push("contact_capture", "hours_lookup", "location_lookup");
      candidate.goals.push("answer location and hours questions", "route walk-in or phone enquiries");
    }

    if (candidate.type === "product_recommender") {
      if (context.offerings.products.length >= 3) {
        addReason(candidate, 4, "Multiple product signals were extracted.");
      }
      if (context.offerings.categories.length >= 3) {
        addReason(candidate, 2, "Product or category structure is visible.");
      }
      candidate.tools.push("product_lookup", "recommendation_logic");
      candidate.goals.push("recommend products", "handle pre-purchase guidance");
    }
  }

  candidates.forEach((candidate) => {
    candidate.tools = Array.from(new Set(candidate.tools));
    candidate.goals = Array.from(new Set(candidate.goals));
  });

  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const confidence = Number(Math.min(0.98, Math.max(0.35, 0.45 + best.score / 20)).toFixed(2));

  return {
    recommended_agent_type: best.type,
    confidence,
    reasoning: best.reasons.length ? best.reasons.slice(0, 4) : ["Defaulted to a general business agent pattern."],
    secondary_agent_types: ranked
      .slice(1, 3)
      .filter((candidate) => candidate.score > 0)
      .map((candidate) => candidate.type),
    required_tools: best.tools,
    starter_goals: best.goals
  };
}
