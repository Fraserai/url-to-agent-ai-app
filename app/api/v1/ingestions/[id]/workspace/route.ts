import { updateIngestionWorkspace } from "@/apps/api/src/routes/ingestions";
import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const body = (await request.json()) as Record<string, unknown>;
  const result = await updateIngestionWorkspace(context.params.id, body);
  return json(result.body, { status: result.status });
}
