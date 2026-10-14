import type { BusinessRecord, LeadSnapshot } from "@/lib/types";

export function buildLeadEmailHtml(input: {
  business: BusinessRecord;
  lead: LeadSnapshot;
  conversationSummary: string;
  conversationUrl?: string;
}) {
  const accent = input.business.accentColor || "#1a6b4a";
  const contactRows = [
    ["Name", input.lead.name],
    ["Phone", input.lead.phone],
    ["Email", input.lead.email]
  ].filter(([, value]) => value);

  return `
    <div style="background:#f5f4f0;padding:32px 16px;font-family:DM Sans,Arial,sans-serif;color:#1a1a1a">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(0,0,0,0.06)">
        <div style="padding:20px 24px;background:${accent};color:#ffffff">
          <div style="font-size:12px;opacity:0.75;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">AgentDrop lead alert</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.15">New enquiry via ${input.business.businessName}</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6">Your AI agent has captured a new enquiry. Here are the details shared so far.</p>
          <div style="border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:18px 18px 10px;margin-bottom:18px;background:#fafaf8">
            ${contactRows
              .map(
                ([label, value]) =>
                  `<div style="display:flex;justify-content:space-between;gap:12px;padding:0 0 10px"><strong style="font-size:13px">${label}</strong><span style="font-size:13px;color:rgba(0,0,0,0.7)">${value}</span></div>`
              )
              .join("")}
          </div>
          <div style="margin-bottom:18px">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,0,0,0.35);margin-bottom:8px">Enquiry summary</div>
            <div style="background:#f7f6f3;border-radius:16px;padding:16px;font-size:14px;line-height:1.6;color:rgba(0,0,0,0.72)">${input.conversationSummary}</div>
          </div>
          ${
            input.conversationUrl
              ? `<a href="${input.conversationUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:12px">View full conversation</a>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

export async function sendLeadEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    return {
      delivered: false,
      provider: "preview"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "notifications@agentdrop.com.au",
      to: [input.to],
      subject: input.subject,
      html: input.html
    })
  });

  if (!response.ok) {
    throw new Error(`Resend request failed: ${response.status}`);
  }

  return {
    delivered: true,
    provider: "resend"
  };
}

