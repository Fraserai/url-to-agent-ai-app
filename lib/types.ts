export type AgentType =
  | "support"
  | "lead"
  | "booking"
  | "menu"
  | "quote"
  | "product"
  | "faq"
  | "onboarding"
  | "realestate"
  | "event";

export type PlanId = "starter" | "growth" | "premium";
export type BillingInterval = "monthly" | "annual";
export type BusinessStatus = "draft" | "active" | "live" | "suspended";
export type ScanMethod = "browser" | "html";

export type PlatformId =
  | "wordpress"
  | "shopify"
  | "squarespace"
  | "wix"
  | "other";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp?: string;
}

export interface BusinessCore {
  domain: string;
  businessName: string;
  industry: string;
  services: string[];
  sourceUrls: string[];
  knowledgeText: string;
  scanMethod: ScanMethod;
  scanWarnings: string[];
  assistantInstructions: string;
  serviceArea: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  description: string;
  keyInfo: string;
  agentType: AgentType;
  systemPrompt: string;
  accentColor: string;
  status: BusinessStatus;
  isDeployed: boolean;
  platform: PlatformId | null;
  plan: PlanId | null;
  billingInterval: BillingInterval | null;
  userId: string | null;
  draftTokenHash: string | null;
  draftExpiresAt: string | null;
  claimedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
}

export interface BusinessRecord extends BusinessCore {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type BusinessDraft = Omit<
  BusinessCore,
  | "agentType"
  | "systemPrompt"
  | "status"
  | "isDeployed"
  | "platform"
  | "plan"
  | "billingInterval"
  | "draftTokenHash"
  | "draftExpiresAt"
  | "claimedAt"
  | "subscriptionStatus"
> & {
  agentType?: AgentType;
  systemPrompt?: string;
  status?: BusinessStatus;
  isDeployed?: boolean;
  platform?: PlatformId | null;
  plan?: PlanId | null;
  billingInterval?: BillingInterval | null;
  draftTokenHash?: string | null;
  draftExpiresAt?: string | null;
  claimedAt?: string | null;
  subscriptionStatus?: string | null;
};

export interface ConversationRecord {
  id: string;
  businessId: string;
  visitorId: string;
  messages: ChatMessage[];
  leadCaptured: boolean;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  leadDetails: string | null;
  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSnapshot {
  name: string | null;
  phone: string | null;
  email: string | null;
  details: string | null;
}

export interface ScanResult {
  business: BusinessRecord;
}

export interface LeadNotificationRecord {
  id: string;
  businessId: string;
  conversationId: string;
  sentAt: string;
  to: string;
  subject: string;
  preview: string;
}

export interface AppUser {
  id: string;
  email: string | null;
  provider: "supabase" | "local";
}
