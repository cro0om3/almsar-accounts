import fs from "fs";
import path from "path";
import { define, get, once, run } from "./local-db";

const FOLDERS = ["branding", "company-files", "employee-files", "ownership", "receipt-files", "receipts"];
const MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function bytesType() {
  return process.env.SUPABASE_DB_URL ? "bytea" : "blob";
}

function ensureStore() {
  return once("appFiles", () => define(`create table if not exists app_files (
    path text primary key,
    mime text,
    bytes ${bytesType()},
    updatedAt text
  )`));
}

function adoptDisk() {
  return once("appFilesAdopt", async () => {
    await ensureStore();
    for (const folder of FOLDERS) {
      const dir = path.join(process.cwd(), "data", folder);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!/^[\w.-]+$/.test(name)) continue;
        const key = `${folder}/${name}`;
        const existing = await get("select path from app_files where path = ?", [key]);
        if (existing) continue;
        const bytes = fs.readFileSync(path.join(dir, name));
        const mime = MIME[path.extname(name).slice(1).toLowerCase()] || "application/octet-stream";
        await run(
          "insert into app_files (path, mime, bytes, updatedAt) values (?, ?, ?, ?)",
          [key, mime, bytes, new Date().toISOString()]
        );
      }
    }
  });
}

export async function putObject(folder, name, bytes, mime) {
  await ensureStore();
  const key = `${folder}/${name}`;
  const now = new Date().toISOString();
  await run(
    `insert into app_files (path, mime, bytes, updatedAt) values (?, ?, ?, ?)
     on conflict (path) do update set mime = excluded.mime, bytes = excluded.bytes, updatedAt = excluded.updatedAt`,
    [key, mime || "application/octet-stream", bytes, now]
  );
}

export async function deleteObject(folder, name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  await ensureStore();
  await run("delete from app_files where path = ?", [`${folder}/${name}`]);
  const disk = path.join(process.cwd(), "data", folder, name);
  if (fs.existsSync(disk)) fs.rmSync(disk);
}

export async function readObject(folder, name) {
  if (!folder || !name || !/^[\w.-]+$/.test(name)) return null;
  await ensureStore();
  await adoptDisk();
  const row = await get("select mime, bytes from app_files where path = ?", [`${folder}/${name}`]);
  if (!row?.bytes) return null;
  const bytes = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
  return { mime: row.mime || "application/octet-stream", bytes };
}

export function objectResponse(file, cache = "private, max-age=60", downloadName = "") {
  const headers = {
    "Content-Type": file.mime,
    "Cache-Control": cache,
  };
  if (downloadName) {
    const safe = String(downloadName).replace(/[^\w.-]+/g, "_") || "file";
    headers["Content-Disposition"] = `attachment; filename="${safe}"`;
  }
  return new Response(new Uint8Array(file.bytes), { headers });
}

export function serveObject(request, file, name, cache = "private, max-age=60") {
  const download = new URL(request.url).searchParams.has("download");
  return objectResponse(file, cache, download ? name : "");
}
