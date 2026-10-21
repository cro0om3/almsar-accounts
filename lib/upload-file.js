import { createFileSlotAction } from "../app/actions";

const MAX_BYTES = 20 * 1024 * 1024;

export function fileExt(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("heic")) return "heic";
  if (type.includes("heif")) return "heif";
  if (type.includes("wordprocessingml")) return "docx";
  const name = String(file?.name || "").toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/);
  if (match && ["jpg", "jpeg", "png", "webp", "pdf", "heic", "heif", "docx"].includes(match[1])) {
    return match[1] === "jpeg" ? "jpg" : match[1];
  }
  return "jpg";
}

export async function uploadOriginalFile(folder, file) {
  if (!file || typeof file === "string" || !file.size) return "";
  if (file.size > MAX_BYTES) throw new Error("fileTooLarge");
  const slot = await createFileSlotAction(folder, fileExt(file), file.type || "");
  if (slot?.error) throw new Error(slot.error);
  const response = await fetch(slot.uploadUrl, {
    method: "POST",
    headers: {
      apikey: slot.token,
      Authorization: `Bearer ${slot.token}`,
      "Content-Type": slot.contentType || file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!response.ok) throw new Error("saveFailed");
  return slot.name;
}
