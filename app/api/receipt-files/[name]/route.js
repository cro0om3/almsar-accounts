import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(_request, { params }) {
  const { name } = await params;
  if (!/^[\w.-]+$/.test(name || "")) return new Response("Not found", { status: 404 });
  const file = path.join(process.cwd(), "data", "receipt-files", name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" },
  });
}
