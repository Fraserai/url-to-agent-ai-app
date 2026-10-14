import type { AgentType } from "@/packages/shared/src/types/agentRecommendation";

const SUGGESTIONS: Record<AgentType, string[]> = {
  lead_capture: [
    "What services do you offer?",
    "How can I get in touch?",
    "Can you help me with a quote?"
  ],
  booking_assistant: [
    "Can I book an appointment?",
    "What happens next if I want to book?",
    "How can I contact the team?"
  ],
  faq_support: [
    "What should I know before I contact you?",
    "Do you have answers to common questions?",
    "What is the best next step?"
  ],
  quote_assistant: [
    "Can you help with a quote?",
    "What details would you need from me?",
    "What services do you cover?"
  ],
  ecommerce_guide: [
    "What products do you offer?",
    "How do I choose the right option?",
    "What should I know before I buy?"
  ],
  local_business_receptionist: [
    "Where are you located?",
    "What are your hours?",
    "How can I contact you?"
  ],
  product_recommender: [
    "What products should I look at first?",
    "Can you help me choose?",
    "What’s the best next step?"
  ]
};

export function getAgentSuggestions(agentType: AgentType) {
  return SUGGESTIONS[agentType] ?? SUGGESTIONS.lead_capture;
}

export function formatAgentTypeLabel(agentType: AgentType) {
  return agentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
