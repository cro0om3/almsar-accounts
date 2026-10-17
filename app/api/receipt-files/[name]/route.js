import { objectResponse, readObject } from "../../../../lib/object-store";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { name } = await params;
  const file = await readObject("receipt-files", name);
  if (!file) return new Response("Not found", { status: 404 });
  return objectResponse(file);
}
