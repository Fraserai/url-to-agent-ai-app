import crypto from "node:crypto";

import { mutateLocalDatabase, readLocalDatabase } from "@/lib/data-store";
import { detectAgentType } from "@/lib/agent-types";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  BillingInterval,
  BusinessDraft,
  BusinessRecord,
  BusinessStatus,
  ConversationRecord,
  LeadNotificationRecord,
  LeadSnapshot,
  PlanId
} from "@/lib/types";

function buildBusinessRecord(input: BusinessDraft): BusinessRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    domain: input.domain,
    businessName: input.businessName,
    industry: input.industry,
    services: input.services,
    sourceUrls: input.sourceUrls ?? [],
    knowledgeText: input.knowledgeText ?? "",
    scanMethod: input.scanMethod ?? "html",
    scanWarnings: input.scanWarnings ?? [],
    assistantInstructions: input.assistantInstructions ?? "",
    serviceArea: input.serviceArea,
    phone: input.phone ?? null,
    email: input.email ?? null,
    hours: input.hours ?? null,
    description: input.description,
    keyInfo: input.keyInfo,
    agentType: input.agentType ?? detectAgentType(input),
    systemPrompt: input.systemPrompt ?? "",
    accentColor: input.accentColor ?? "#1a6b4a",
    status: input.status ?? (input.userId ? "active" : "draft"),
    isDeployed: input.isDeployed ?? false,
    platform: input.platform ?? null,
    plan: input.plan ?? null,
    billingInterval: input.billingInterval ?? null,
    userId: input.userId ?? null,
    draftTokenHash: input.draftTokenHash ?? null,
    draftExpiresAt: input.draftExpiresAt ?? null,
    claimedAt: input.claimedAt ?? (input.userId ? now : null),
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    subscriptionStatus: input.subscriptionStatus ?? null,
    createdAt: now,
    updatedAt: now
  };
}

function hydrateLocalBusiness(row: Partial<BusinessRecord>): BusinessRecord {
  const now = new Date().toISOString();

  return {
    id: String(row.id ?? crypto.randomUUID()),
    domain: String(row.domain ?? ""),
    businessName: String(row.businessName ?? ""),
    industry: String(row.industry ?? "Business"),
    services: Array.isArray(row.services) ? row.services.map((service) => String(service)) : [],
    sourceUrls: Array.isArray(row.sourceUrls) ? row.sourceUrls.map((url) => String(url)) : [],
    knowledgeText: typeof row.knowledgeText === "string" ? row.knowledgeText : "",
    scanMethod: (row.scanMethod ? String(row.scanMethod) : "html") as BusinessRecord["scanMethod"],
    scanWarnings: Array.isArray(row.scanWarnings)
      ? row.scanWarnings.map((warning) => String(warning))
      : [],
    assistantInstructions:
      typeof row.assistantInstructions === "string" ? row.assistantInstructions : "",
    serviceArea: String(row.serviceArea ?? ""),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    hours: row.hours ? String(row.hours) : null,
    description: String(row.description ?? ""),
    keyInfo: String(row.keyInfo ?? ""),
    agentType: String(row.agentType ?? "support") as BusinessRecord["agentType"],
    systemPrompt: String(row.systemPrompt ?? ""),
    accentColor: String(row.accentColor ?? "#1a6b4a"),
    status: String(row.status ?? "draft") as BusinessStatus,
    isDeployed: Boolean(row.isDeployed),
    platform: (row.platform ? String(row.platform) : null) as BusinessRecord["platform"],
    plan: (row.plan ? String(row.plan) : null) as PlanId | null,
    billingInterval: (row.billingInterval ? String(row.billingInterval) : null) as BillingInterval | null,
    userId: row.userId ? String(row.userId) : null,
    draftTokenHash: row.draftTokenHash ? String(row.draftTokenHash) : null,
    draftExpiresAt: row.draftExpiresAt ? String(row.draftExpiresAt) : null,
    claimedAt: row.claimedAt ? String(row.claimedAt) : null,
    stripeCustomerId: row.stripeCustomerId ? String(row.stripeCustomerId) : null,
    stripeSubscriptionId: row.stripeSubscriptionId ? String(row.stripeSubscriptionId) : null,
    subscriptionStatus: row.subscriptionStatus ? String(row.subscriptionStatus) : null,
    createdAt: String(row.createdAt ?? now),
    updatedAt: String(row.updatedAt ?? now)
  };
}

function mapBusinessRow(row: Record<string, unknown>): BusinessRecord {
  return {
    id: String(row.id),
    domain: String(row.domain ?? ""),
    businessName: String(row.business_name ?? ""),
    industry: String(row.industry ?? "Business"),
    services: Array.isArray(row.services) ? row.services.map((service) => String(service)) : [],
    sourceUrls: Array.isArray(row.source_urls) ? row.source_urls.map((url) => String(url)) : [],
    knowledgeText: String(row.knowledge_text ?? ""),
    scanMethod: String(row.scan_method ?? "html") as BusinessRecord["scanMethod"],
    scanWarnings: Array.isArray(row.scan_warnings)
      ? row.scan_warnings.map((warning) => String(warning))
      : [],
    assistantInstructions: String(row.assistant_instructions ?? ""),
    serviceArea: String(row.service_area ?? ""),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    hours: row.hours ? String(row.hours) : null,
    description: String(row.description ?? ""),
    keyInfo: String(row.key_info ?? ""),
    agentType: String(row.agent_type ?? "support") as BusinessRecord["agentType"],
    systemPrompt: String(row.system_prompt ?? ""),
    accentColor: String(row.accent_color ?? "#1a6b4a"),
    status: String(row.status ?? "draft") as BusinessStatus,
    isDeployed: Boolean(row.is_deployed),
    platform: (row.platform ? String(row.platform) : null) as BusinessRecord["platform"],
    plan: (row.plan ? String(row.plan) : null) as PlanId | null,
    billingInterval: (row.billing_interval ? String(row.billing_interval) : null) as BillingInterval | null,
    userId: row.user_id ? String(row.user_id) : null,
    draftTokenHash: row.draft_token_hash ? String(row.draft_token_hash) : null,
    draftExpiresAt: row.draft_expires_at ? String(row.draft_expires_at) : null,
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

function toBusinessRow(record: BusinessRecord) {
  return {
    id: record.id,
    user_id: record.userId,
    domain: record.domain,
    business_name: record.businessName,
    industry: record.industry,
    services: record.services,
    source_urls: record.sourceUrls,
    knowledge_text: record.knowledgeText,
    scan_method: record.scanMethod,
    scan_warnings: record.scanWarnings,
    assistant_instructions: record.assistantInstructions,
    service_area: record.serviceArea,
    phone: record.phone,
    email: record.email,
    hours: record.hours,
    description: record.description,
    key_info: record.keyInfo,
    agent_type: record.agentType,
    system_prompt: record.systemPrompt,
    accent_color: record.accentColor,
    status: record.status,
    is_deployed: record.isDeployed,
    platform: record.platform,
    plan: record.plan,
    billing_interval: record.billingInterval,
    draft_token_hash: record.draftTokenHash,
    draft_expires_at: record.draftExpiresAt,
    claimed_at: record.claimedAt,
    stripe_customer_id: record.stripeCustomerId,
    stripe_subscription_id: record.stripeSubscriptionId,
    subscription_status: record.subscriptionStatus,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function mapConversationRow(row: Record<string, unknown>): ConversationRecord {
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    visitorId: String(row.visitor_id),
    messages: Array.isArray(row.messages) ? (row.messages as ConversationRecord["messages"]) : [],
    leadCaptured: Boolean(row.lead_captured),
    leadName: row.lead_name ? String(row.lead_name) : null,
    leadPhone: row.lead_phone ? String(row.lead_phone) : null,
    leadEmail: row.lead_email ? String(row.lead_email) : null,
    leadDetails: row.lead_details ? String(row.lead_details) : null,
    notificationSent: Boolean(row.notification_sent),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

function toConversationRow(record: ConversationRecord) {
  return {
    id: record.id,
    business_id: record.businessId,
    visitor_id: record.visitorId,
    messages: record.messages,
    lead_captured: record.leadCaptured,
    lead_name: record.leadName,
    lead_phone: record.leadPhone,
    lead_email: record.leadEmail,
    lead_details: record.leadDetails,
    notification_sent: record.notificationSent,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

export async function createBusiness(input: BusinessDraft) {
  const record = buildBusinessRecord(input);
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .insert(toBusinessRow(record))
      .select("*")
      .single();

    if (!error && data) {
      return mapBusinessRow(data);
    }
  }

  return mutateLocalDatabase(async (db) => {
    db.businesses.unshift(record);
    return record;
  });
}

export async function getBusiness(id: string) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    if (!error && data) return mapBusinessRow(data);
  }

  const db = await readLocalDatabase();
  const business = db.businesses.find((record) => record.id === id);
  return business ? hydrateLocalBusiness(business) : null;
}

export async function listBusinessesForUser(userId: string) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((row) => mapBusinessRow(row));
    }
  }

  const db = await readLocalDatabase();
  return db.businesses
    .filter((business) => business.userId === userId)
    .map((business) => hydrateLocalBusiness(business))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateBusiness(
  id: string,
  patch: Partial<Omit<BusinessRecord, "id" | "createdAt">>
) {
  const existing = await getBusiness(id);
  if (!existing) return null;

  const updated: BusinessRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .update(toBusinessRow(updated))
      .eq("id", id)
      .select("*")
      .single();

    if (!error && data) {
      return mapBusinessRow(data);
    }
  }

  return mutateLocalDatabase(async (db) => {
    const index = db.businesses.findIndex((business) => business.id === id);
    if (index >= 0) db.businesses[index] = updated;
    return updated;
  });
}

export async function claimDraftBusiness(id: string, userId: string, ownerEmail?: string | null) {
  const business = await getBusiness(id);
  if (!business) return null;

  const claimedAt = new Date().toISOString();
  return updateBusiness(id, {
    userId,
    status: business.isDeployed ? "live" : business.plan ? "active" : "active",
    claimedAt,
    email: business.email ?? ownerEmail ?? null,
    draftTokenHash: null,
    draftExpiresAt: null
  });
}

export async function findBusinessByStripeSubscriptionId(subscriptionId: string) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (!error && data) {
      return mapBusinessRow(data);
    }
  }

  const db = await readLocalDatabase();
  return db.businesses.find((business) => business.stripeSubscriptionId === subscriptionId) ?? null;
}

export async function upsertConversation(input: {
  businessId: string;
  visitorId: string;
  messages: ConversationRecord["messages"];
  lead?: LeadSnapshot | null;
  notificationSent?: boolean;
}) {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("visitor_id", input.visitorId)
      .maybeSingle();

    const existingConversation = existing ? mapConversationRow(existing) : null;
    const conversation: ConversationRecord = existingConversation
      ? {
          ...existingConversation,
          messages: input.messages,
          leadCaptured: Boolean(input.lead) || existingConversation.leadCaptured,
          leadName: input.lead?.name ?? existingConversation.leadName,
          leadPhone: input.lead?.phone ?? existingConversation.leadPhone,
          leadEmail: input.lead?.email ?? existingConversation.leadEmail,
          leadDetails: input.lead?.details ?? existingConversation.leadDetails,
          notificationSent: input.notificationSent ?? existingConversation.notificationSent,
          updatedAt: now
        }
      : {
          id: crypto.randomUUID(),
          businessId: input.businessId,
          visitorId: input.visitorId,
          messages: input.messages,
          leadCaptured: Boolean(input.lead),
          leadName: input.lead?.name ?? null,
          leadPhone: input.lead?.phone ?? null,
          leadEmail: input.lead?.email ?? null,
          leadDetails: input.lead?.details ?? null,
          notificationSent: input.notificationSent ?? false,
          createdAt: now,
          updatedAt: now
        };

    const { data, error } = existingConversation
      ? await supabase
          .from("conversations")
          .update(toConversationRow(conversation))
          .eq("id", conversation.id)
          .select("*")
          .single()
      : await supabase
          .from("conversations")
          .insert(toConversationRow(conversation))
          .select("*")
          .single();

    if (!error && data) {
      return mapConversationRow(data);
    }
  }

  return mutateLocalDatabase(async (db) => {
    const existing = db.conversations.find(
      (conversation) =>
        conversation.businessId === input.businessId && conversation.visitorId === input.visitorId
    );

    if (existing) {
      existing.messages = input.messages;
      existing.leadCaptured = Boolean(input.lead) || existing.leadCaptured;
      existing.leadName = input.lead?.name ?? existing.leadName;
      existing.leadPhone = input.lead?.phone ?? existing.leadPhone;
      existing.leadEmail = input.lead?.email ?? existing.leadEmail;
      existing.leadDetails = input.lead?.details ?? existing.leadDetails;
      existing.notificationSent = input.notificationSent ?? existing.notificationSent;
      existing.updatedAt = now;
      return existing;
    }

    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      businessId: input.businessId,
      visitorId: input.visitorId,
      messages: input.messages,
      leadCaptured: Boolean(input.lead),
      leadName: input.lead?.name ?? null,
      leadPhone: input.lead?.phone ?? null,
      leadEmail: input.lead?.email ?? null,
      leadDetails: input.lead?.details ?? null,
      notificationSent: input.notificationSent ?? false,
      createdAt: now,
      updatedAt: now
    };

    db.conversations.unshift(conversation);
    return conversation;
  });
}

export async function getConversationByVisitor(businessId: string, visitorId: string) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", businessId)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (!error && data) return mapConversationRow(data);
  }

  const db = await readLocalDatabase();
  return (
    db.conversations.find(
      (conversation) =>
        conversation.businessId === businessId && conversation.visitorId === visitorId
    ) ?? null
  );
}

export async function listConversationsForBusiness(businessId: string) {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((row) => mapConversationRow(row));
    }
  }

  const db = await readLocalDatabase();
  return db.conversations
    .filter((conversation) => conversation.businessId === businessId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function recordLeadNotification(
  notification: Omit<LeadNotificationRecord, "id" | "sentAt">
) {
  const record: LeadNotificationRecord = {
    ...notification,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString()
  };

  return mutateLocalDatabase(async (db) => {
    db.notifications.unshift(record);
    return record;
  });
}
