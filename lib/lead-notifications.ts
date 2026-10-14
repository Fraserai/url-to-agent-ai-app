import { buildLeadEmailHtml, sendLeadEmail } from "@/lib/email";
import { recordLeadNotification } from "@/lib/repository";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { BusinessRecord, ConversationRecord, LeadSnapshot } from "@/lib/types";

export async function notifyBusinessOfLead(input: {
  business: BusinessRecord;
  conversation: ConversationRecord;
  lead: LeadSnapshot;
  appOrigin: string;
}) {
  let recipient = input.business.email || process.env.AGENTDROP_DEMO_EMAIL || "";

  if (input.business.userId) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase.auth.admin.getUserById(input.business.userId);
      recipient = data.user?.email || recipient;
    }
  }

  if (!recipient) {
    return {
      sent: false,
      reason: "no-recipient"
    };
  }

  const subject = `New enquiry from ${input.lead.name ?? "a visitor"} via your AI agent`;
  const html = buildLeadEmailHtml({
    business: input.business,
    lead: input.lead,
    conversationSummary: input.lead.details || "A new enquiry was captured via your AI agent.",
    conversationUrl: `${input.appOrigin}/agent/${input.business.id}`
  });

  await sendLeadEmail({
    to: recipient,
    subject,
    html
  });

  await recordLeadNotification({
    businessId: input.business.id,
    conversationId: input.conversation.id,
    to: recipient,
    subject,
    preview: input.lead.details || "New enquiry captured."
  });

  return {
    sent: true
  };
}
