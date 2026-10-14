import { NextResponse } from "next/server";

import { getBusiness } from "@/lib/repository";
import { buildWidgetSource } from "@/lib/widget";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const business = await getBusiness(params.id);

  if (!business) {
    return new NextResponse("console.error('AgentDrop: widget not found');", {
      status: 404,
      headers: {
        "Content-Type": "application/javascript"
      }
    });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const source = buildWidgetSource(business, origin);

  return new NextResponse(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

