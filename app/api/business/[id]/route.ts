import { detectAgentType } from "@/lib/agent-types";
import { getBusinessAccessContext, buildLoginRequiredPayload } from "@/lib/business-access";
import { generateSystemPrompt } from "@/lib/business";
import { json } from "@/lib/http";
import { getBusiness, updateBusiness } from "@/lib/repository";

const EDITABLE_FIELDS = new Set([
  "businessName",
  "industry",
  "services",
  "serviceArea",
  "phone",
  "email",
  "hours",
  "description",
  "keyInfo",
  "accentColor",
  "assistantInstructions",
  "plan",
  "billingInterval"
]);

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await getBusinessAccessContext(params.id);

  if (!access.business) {
    return json({ error: "Business not found." }, { status: 404 });
  }

  if (!access.isOwner && !access.hasDraftToken) {
    return json(
      buildLoginRequiredPayload({
        businessId: params.id,
        next: `/agent/${params.id}`,
        intent: "dashboard"
      }),
      { status: 401 }
    );
  }

  return json({ business: access.business });
}

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const access = await getBusinessAccessContext(params.id);

  if (!access.business) {
    return json({ error: "Business not found." }, { status: 404 });
  }

  if (!access.isOwner) {
    return json(
      buildLoginRequiredPayload({
        businessId: params.id,
        next: `/agent/${params.id}`,
        intent: "save"
      }),
      { status: 401 }
    );
  }

  try {
    const body = (await _request.json()) as Record<string, unknown>;
    const patch = Object.fromEntries(
      Object.entries(body).filter(([key]) => EDITABLE_FIELDS.has(key))
    ) as Partial<typeof access.business>;

    const nextBusiness = {
      ...access.business,
      ...patch
    };

    const nextAgentType = detectAgentType(nextBusiness);
    const systemPrompt = await generateSystemPrompt({
      ...nextBusiness,
      agentType: nextAgentType
    });

    const updated = await updateBusiness(params.id, {
      ...patch,
      agentType: nextAgentType,
      systemPrompt
    });

    return json({ business: updated });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to update the business." },
      { status: 500 }
    );
  }
}
