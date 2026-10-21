import { readObject, serveObject } from "../../../../lib/object-store";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { name } = await params;
  const file = await readObject("receipt-files", name);
  if (!file) return new Response("Not found", { status: 404 });
  return serveObject(request, file, name);
}
