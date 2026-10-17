import fs from "fs";
import path from "path";
import { getSettings } from "../../../../lib/accounts";
import { objectResponse, readObject } from "../../../../lib/object-store";

export const dynamic = "force-dynamic";

const SLOTS = { logo: "logoPath", seal: "sealPath", signature: "signaturePath" };
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_request, { params }) {
  const { slot } = await params;
  const column = SLOTS[slot];
  if (!column) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const name = settings[column];
  if (name) {
    const stored = await readObject("branding", name);
    if (stored) return objectResponse(stored);
  }
  const fallback = path.join(process.cwd(), "public", "branding", `${slot}.png`);
  if (!fs.existsSync(fallback)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(fallback), {
    headers: { "Content-Type": TYPES[".png"], "Cache-Control": "private, max-age=60" },
  });
}
