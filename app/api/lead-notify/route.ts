import { json } from "@/lib/http";
import { notifyBusinessOfLead } from "@/lib/lead-notifications";
import { getBusiness, getConversationByVisitor } from "@/lib/repository";
import type { LeadSnapshot } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      visitorId?: string;
      lead?: LeadSnapshot;
    };

    if (!body.businessId || !body.visitorId || !body.lead) {
      return json({ error: "businessId, visitorId, and lead are required." }, { status: 400 });
    }

    const business = await getBusiness(body.businessId);
    const conversation = await getConversationByVisitor(body.businessId, body.visitorId);

    if (!business || !conversation) {
      return json({ error: "Conversation not found." }, { status: 404 });
    }

    const result = await notifyBusinessOfLead({
      business,
      conversation,
      lead: body.lead,
      appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    });

    return json(result);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to send lead notification." },
      { status: 500 }
    );
  }
}

