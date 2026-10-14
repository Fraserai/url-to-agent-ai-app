import { extractLead, getAssistantReply, summariseConversationForLead } from "@/lib/business";
import { json, options } from "@/lib/http";
import { notifyBusinessOfLead } from "@/lib/lead-notifications";
import {
  getBusiness,
  getConversationByVisitor,
  upsertConversation
} from "@/lib/repository";
import type { ChatMessage } from "@/lib/types";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      visitorId?: string;
      messages?: ChatMessage[];
    };

    if (!body.businessId || !body.visitorId || !body.messages?.length) {
      return json({ error: "businessId, visitorId, and messages are required." }, { status: 400 });
    }

    const business = await getBusiness(body.businessId);

    if (!business) {
      return json({ error: "Business not found." }, { status: 404 });
    }

    if (business.status === "suspended") {
      return json(
        {
          error: "This agent is currently unavailable."
        },
        { status: 403 }
      );
    }

    const reply = await getAssistantReply(business, body.messages);
    const fullConversation: ChatMessage[] = [
      ...body.messages,
      {
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString()
      }
    ];

    const lead = extractLead(fullConversation);
    const existingConversation = await getConversationByVisitor(body.businessId, body.visitorId);
    const conversation = await upsertConversation({
      businessId: body.businessId,
      visitorId: body.visitorId,
      messages: fullConversation,
      lead: lead
        ? {
            ...lead,
            details: lead.details || summariseConversationForLead(fullConversation)
          }
        : null,
      notificationSent: existingConversation?.notificationSent ?? false
    });

    if (lead && !conversation.notificationSent) {
      await notifyBusinessOfLead({
        business,
        conversation,
        lead: {
          ...lead,
          details: lead.details || summariseConversationForLead(fullConversation)
        },
        appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
      });

      await upsertConversation({
        businessId: body.businessId,
        visitorId: body.visitorId,
        messages: fullConversation,
        lead,
        notificationSent: true
      });
    }

    return json({ reply });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to process the chat." },
      { status: 500 }
    );
  }
}
