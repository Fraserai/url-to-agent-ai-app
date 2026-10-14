import type { AgentRecommendation } from "@/packages/shared/src/types/agentRecommendation";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";
import type { DeploymentPackage } from "@/packages/shared/src/types/deploymentPackage";

function buildWelcomeMessage(context: BusinessContextObject, recommendation: AgentRecommendation) {
  switch (recommendation.recommended_agent_type) {
    case "booking_assistant":
      return `Hi, welcome to ${context.business.name}. I can help you with bookings, common questions, and the best next step.`;
    case "quote_assistant":
      return `Hi, welcome to ${context.business.name}. I can help answer questions and gather the details needed for a quote.`;
    case "ecommerce_guide":
    case "product_recommender":
      return `Hi, welcome to ${context.business.name}. I can help you find the right product and answer common questions before you buy.`;
    case "local_business_receptionist":
      return `Hi, welcome to ${context.business.name}. I can help with location, hours, contact details, and general enquiries.`;
    default:
      return `Hi, welcome to ${context.business.name}. I can help with common questions and the best next step.`;
  }
}

function buildLeadFields(context: BusinessContextObject, recommendation: AgentRecommendation) {
  const fields: DeploymentPackage["lead_form_schema"]["fields"] = [
    { name: "full_name", type: "text", required: true },
    { name: "email", type: "email", required: true }
  ];

  if (recommendation.recommended_agent_type !== "ecommerce_guide") {
    fields.push({ name: "phone", type: "tel", required: false });
  }

  if (context.offerings.services.length) {
    fields.push({
      name: "service_needed",
      type: "select",
      required: recommendation.recommended_agent_type !== "faq_support",
      options: context.offerings.services.slice(0, 8)
    });
  }

  fields.push({
    name: "message",
    type: "textarea",
    required: false
  });

  return fields;
}

export function generateDeploymentPackage(
  context: BusinessContextObject,
  recommendation: AgentRecommendation
): DeploymentPackage {
  const bestCta =
    context.conversion.cta_labels[0] ||
    (recommendation.recommended_agent_type === "booking_assistant"
      ? "the booking link"
      : recommendation.recommended_agent_type === "quote_assistant"
        ? "the quote form"
        : "the contact form");
  const leadFields = buildLeadFields(context, recommendation);
  const primaryColor = context.brand.primary_colors[0] ?? "#1f6b4d";
  const secondaryColor = context.brand.secondary_colors[0] ?? "#e7efe9";
  const fontFamily = context.brand.font_families[0] ?? "system-ui";

  return {
    agent_name: `${context.business.name} Agent`,
    welcome_message: buildWelcomeMessage(context, recommendation),
    system_prompt: `You are the website agent for ${context.business.name}.

Your role is to help visitors understand ${context.business.name}'s services, answer common questions, and guide them toward the most relevant next step.

Business summary:
${context.business.summary}

Primary offerings:
${context.offerings.services.join(", ") || context.offerings.products.join(", ") || "General business information"}

Tone:
${context.business.tone.join(", ")}

Primary conversion goal:
${context.conversion.primary_conversion_type}

Rules:
- Be accurate and only use known business information.
- If pricing is unclear, say so.
- If the user is ready to proceed, guide them to ${bestCta}.
- If the user needs a quote or wants follow-up, collect ${leadFields.map((field) => field.name).join(", ")}.
- Do not invent policies, prices, or availability.`,
    faq_seed: context.policies.faq.slice(0, 6),
    lead_form_schema: {
      fields: leadFields
    },
    handoff_rules: [
      "If the visitor requests a human, offer the primary contact method immediately.",
      "If pricing or availability is not confirmed, say so clearly and capture the enquiry instead.",
      "If the visitor is ready to proceed, guide them to the strongest CTA or lead form."
    ],
    tool_config: {
      enabled_tools: Array.from(new Set(["knowledge_lookup", ...recommendation.required_tools]))
    },
    branding: {
      logo_url: context.brand.logo_url,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_family: fontFamily
    }
  };
}
