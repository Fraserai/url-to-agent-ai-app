import { getIngestionStatus } from "@/apps/api/src/routes/ingestions";
import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  const result = await getIngestionStatus(context.params.id);
  return json(result.body, { status: result.status });
}

