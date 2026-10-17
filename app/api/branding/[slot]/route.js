import fs from "fs";
import path from "path";
import { getSettings } from "../../../../lib/accounts";

export const dynamic = "force-dynamic";

const SLOTS = { logo: "logoPath", seal: "sealPath", signature: "signaturePath" };
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function imageResponse(file) {
  const type = TYPES[path.extname(file).toLowerCase()] || "image/png";
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" },
  });
}

export async function GET(_request, { params }) {
  const { slot } = await params;
  const column = SLOTS[slot];
  if (!column) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const name = settings[column];
  if (name && /^[\w.-]+$/.test(name)) {
    const stored = path.join(process.cwd(), "data", "branding", name);
    if (fs.existsSync(stored)) return imageResponse(stored);
  }
  const fallback = path.join(process.cwd(), "public", "branding", `${slot}.png`);
  if (!fs.existsSync(fallback)) return new Response("Not found", { status: 404 });
  return imageResponse(fallback);
}
