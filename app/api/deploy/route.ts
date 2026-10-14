import { buildLoginRequiredPayload, getBusinessAccessContext, hasActiveSubscription } from "@/lib/business-access";
import { json } from "@/lib/http";
import { updateBusiness } from "@/lib/repository";
import type { PlatformId } from "@/lib/types";

function buildEmbedInstructions(platform: PlatformId, widgetUrl: string) {
  const embedCode = `<script src="${widgetUrl}" async></script>`;

  const common = [
    "Copy the script tag below.",
    "Paste it just before the closing </body> tag on your site.",
    "Publish the site update and open the page to confirm the widget appears."
  ];

  const platformSpecific: Record<PlatformId, string[]> = {
    wordpress: [
      "Open your theme footer or a custom code plugin.",
      "Paste the script into the site-wide footer area."
    ],
    shopify: [
      "Open Online Store > Themes > Edit code.",
      "Add the script to theme.liquid before </body>."
    ],
    squarespace: [
      "Open Settings > Advanced > Code Injection.",
      "Paste the script into the footer injection field."
    ],
    wix: [
      "Open Settings > Custom Code.",
      "Add the script as a body-end snippet on all pages."
    ],
    other: ["Add the script to the global footer of your website template."]
  };

  return {
    embedCode,
    instructions: [...platformSpecific[platform], ...common]
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      platform?: PlatformId;
    };

    if (!body.businessId || !body.platform) {
      return json({ error: "businessId and platform are required." }, { status: 400 });
    }

    const access = await getBusinessAccessContext(body.businessId);
    if (!access.business) {
      return json({ error: "Business not found." }, { status: 404 });
    }

    if (!access.isOwner) {
      return json(
        buildLoginRequiredPayload({
          businessId: body.businessId,
          next: `/agent/${body.businessId}/deploy`,
          intent: "deploy"
        }),
        { status: 401 }
      );
    }

    if (!hasActiveSubscription(access.business)) {
      const checkoutUrl = `/pricing?businessId=${body.businessId}&next=${encodeURIComponent(
        `/agent/${body.businessId}/deploy`
      )}&platform=${body.platform}`;
      return json({ checkoutUrl }, { status: 402 });
    }

    const business = await updateBusiness(body.businessId, {
      isDeployed: true,
      platform: body.platform,
      status: "live"
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const widgetUrl = `${origin}/api/widget/${body.businessId}`;
    const { embedCode, instructions } = buildEmbedInstructions(body.platform, widgetUrl);

    return json({
      success: true,
      business,
      widgetUrl,
      embedCode,
      instructions
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to deploy the agent." },
      { status: 500 }
    );
  }
}
