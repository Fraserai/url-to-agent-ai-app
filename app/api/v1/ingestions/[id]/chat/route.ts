import { getResolvedIngestion } from "@/apps/api/src/services/ingestionAccess";
import { json, options } from "@/lib/http";
import { generateWorkspaceReply } from "@/lib/preview-chat";
import type { ChatMessage } from "@/lib/types";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      visitor_id?: string;
      messages?: ChatMessage[];
    };

    if (!body.visitor_id || !body.messages?.length) {
      return json(
        { error: "visitor_id and messages are required." },
        { status: 400 }
      );
    }

    const resolved = await getResolvedIngestion(context.params.id);
    if (!resolved) {
      return json(
        { error: "Ingestion result not found or not ready yet." },
        { status: 404 }
      );
    }

    const result = await generateWorkspaceReply({
      workspace: resolved.workspace,
      context: resolved.profile.business_context,
      messages: body.messages
    });

    return json(result);
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unable to answer from the workspace."
      },
      { status: 500 }
    );
  }
}
