import { createIngestion } from "@/apps/api/src/routes/ingestions";
import { json, options } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    url?: string;
    user_id?: string;
  };
  const result = await createIngestion(body);
  return json(result.body, { status: result.status });
}

