import { getDomain } from "@/lib/url";
import type { DeploymentPackage } from "@/packages/shared/src/types/deploymentPackage";
import type {
  AgentWorkspace,
  AgentWorkspaceOverrides
} from "@/packages/shared/src/types/agentWorkspace";
import type { BusinessProfileRecord } from "@/packages/shared/src/types/ingestion";

const DEFAULT_PRIMARY_COLOR = "#1f6b4d";
const DEFAULT_SECONDARY_COLOR = "#e7efe9";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const nextValue = cleanText(value);
  return nextValue || null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    const nextValue = cleanText(entry);
    const key = nextValue.toLowerCase();
    if (!nextValue || seen.has(key)) continue;
    seen.add(key);
    items.push(nextValue);
  }

  return items.slice(0, 16);
}

function deriveServiceArea(profile: BusinessProfileRecord) {
  const entries = profile.business_context.business.service_area.filter(Boolean);
  return entries.join(", ");
}

export function sanitizeWorkspaceOverrides(input: Record<string, unknown>): AgentWorkspaceOverrides {
  const overrides: AgentWorkspaceOverrides = {};

  if ("business_name" in input) {
    const value = cleanText(input.business_name);
    overrides.business_name = value || undefined;
  }

  if ("summary" in input) {
    const value = cleanText(input.summary);
    overrides.summary = value || undefined;
  }

  if ("services" in input) {
    overrides.services = normalizeStringArray(input.services);
  }

  if ("phone" in input) {
    overrides.phone = normalizeOptionalText(input.phone);
  }

  if ("email" in input) {
    overrides.email = normalizeOptionalText(input.email);
  }

  if ("hours" in input) {
    overrides.hours = normalizeOptionalText(input.hours);
  }

  if ("primary_color" in input) {
    const value = cleanText(input.primary_color);
    overrides.primary_color = value || undefined;
  }

  if ("welcome_message" in input) {
    const value = cleanText(input.welcome_message);
    overrides.welcome_message = value || undefined;
  }

  if ("agent_instructions" in input) {
    const value = cleanText(input.agent_instructions);
    overrides.agent_instructions = value || undefined;
  }

  return overrides;
}

export function mergeWorkspaceOverrides(
  current: AgentWorkspaceOverrides,
  patch: AgentWorkspaceOverrides
): AgentWorkspaceOverrides {
  return {
    ...current,
    ...patch
  };
}

function pickPrimaryContact(values: string[]) {
  return values.find(Boolean) ?? null;
}

function normalizePhoneDigits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function pickPrimaryPhone(values: string[]) {
  const cleaned = values.map(cleanText).filter(Boolean);
  if (!cleaned.length) return null;

  return cleaned.sort((left, right) => {
    const leftScore =
      (/\s|-|\(|\)/.test(left) ? 4 : 0) +
      (/^\+/.test(left) ? 1 : 0) +
      (left.length >= 10 ? 1 : 0);
    const rightScore =
      (/\s|-|\(|\)/.test(right) ? 4 : 0) +
      (/^\+/.test(right) ? 1 : 0) +
      (right.length >= 10 ? 1 : 0);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return normalizePhoneDigits(left).length - normalizePhoneDigits(right).length;
  })[0];
}

function pickPrimaryHours(values: string[]) {
  return values.find(Boolean) ?? null;
}

function pickPrimaryColor(deploymentPackage: DeploymentPackage, overrides: AgentWorkspaceOverrides) {
  return (
    cleanText(overrides.primary_color) ||
    cleanText(deploymentPackage.branding.primary_color) ||
    DEFAULT_PRIMARY_COLOR
  );
}

export function resolveAgentWorkspace(
  profile: BusinessProfileRecord,
  status: AgentWorkspace["status"]
): AgentWorkspace {
  const overrides = profile.workspace_overrides ?? {};
  const context = profile.business_context;
  const deploymentPackage = profile.deployment_package;

  return {
    job_id: profile.ingestion_job_id,
    status,
    submitted_url: context.site.submitted_url,
    domain: getDomain(context.site.final_homepage_url || context.site.normalized_url),
    business_name: cleanText(overrides.business_name) || context.business.name,
    industry: context.business.industry,
    subindustry: context.business.subindustry,
    business_type: context.business.business_type,
    summary: cleanText(overrides.summary) || context.business.summary,
    services:
      overrides.services && overrides.services.length
        ? overrides.services
        : context.offerings.services.slice(0, 12),
    service_area: deriveServiceArea(profile),
    phone:
      overrides.phone !== undefined
        ? overrides.phone
        : pickPrimaryPhone(context.business.contact.phones),
    email:
      overrides.email !== undefined
        ? overrides.email
        : pickPrimaryContact(context.business.contact.emails),
    hours:
      overrides.hours !== undefined ? overrides.hours : pickPrimaryHours(context.business.hours),
    logo_url: deploymentPackage.branding.logo_url || context.brand.logo_url,
    primary_color: pickPrimaryColor(deploymentPackage, overrides),
    secondary_color:
      cleanText(deploymentPackage.branding.secondary_color) || DEFAULT_SECONDARY_COLOR,
    font_family: cleanText(deploymentPackage.branding.font_family) || "system-ui",
    welcome_message:
      cleanText(overrides.welcome_message) || cleanText(deploymentPackage.welcome_message),
    agent_instructions: cleanText(overrides.agent_instructions),
    recommended_agent_type: profile.agent_recommendation.recommended_agent_type,
    recommendation_confidence: profile.agent_recommendation.confidence,
    recommendation_reasoning: profile.agent_recommendation.reasoning,
    starter_goals: profile.agent_recommendation.starter_goals,
    required_tools: profile.agent_recommendation.required_tools,
    cta_labels: context.conversion.cta_labels,
    value_props: context.business.value_props,
    faq: context.policies.faq,
    source_pages: context.evidence.source_pages,
    important_snippets: context.evidence.important_snippets,
    warnings: context.site.crawl_summary.warnings
  };
}
