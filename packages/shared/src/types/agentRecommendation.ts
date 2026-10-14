export type AgentType =
  | "lead_capture"
  | "booking_assistant"
  | "faq_support"
  | "quote_assistant"
  | "ecommerce_guide"
  | "local_business_receptionist"
  | "product_recommender";

export type AgentRecommendation = {
  recommended_agent_type: AgentType;
  confidence: number;
  reasoning: string[];
  secondary_agent_types: AgentType[];
  required_tools: string[];
  starter_goals: string[];
};
