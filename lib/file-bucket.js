import { define, get, once, run } from "./local-db";

export const FILE_BUCKET = "app-files";

const FOLDERS = new Set(["branding", "company-files", "employee-files", "ownership", "receipt-files", "receipts"]);

function envStorage() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !token) return null;
  return { url, token };
}

function storageCache(next) {
  if (next) globalThis.__almsarStorage = next;
  return globalThis.__almsarStorage || null;
}

export function storagePublic() {
  return envStorage() || storageCache();
}

export function storageObjectPath(folder, name) {
  if (!FOLDERS.has(folder) || !name || !/^[\w.-]+$/.test(name)) return "";
  return `${folder}/${name}`;
}

export function ensureStorageConfig() {
  return once("storageConfig", async () => {
    const fromEnv = envStorage();
    if (fromEnv) {
      storageCache(fromEnv);
      if (!process.env.SUPABASE_DB_URL) return;
      await define(`create table if not exists app_config (key text primary key, value text)`);
      try {
        await define("alter table app_config enable row level security");
      } catch {
        /* already protected */
      }
      await run(
        `insert into app_config (key, value) values ('supabase_url', ?)
         on conflict (key) do update set value = excluded.value`,
        [fromEnv.url]
      );
      await run(
        `insert into app_config (key, value) values ('supabase_anon', ?)
         on conflict (key) do update set value = excluded.value`,
        [fromEnv.token]
      );
      return;
    }
    if (!process.env.SUPABASE_DB_URL) return;
    await define(`create table if not exists app_config (key text primary key, value text)`);
    let url = await get("select value from app_config where key = ?", ["supabase_url"]);
    let token = await get("select value from app_config where key = ?", ["supabase_anon"]);
    if (!url?.value || !token?.value) {
      try {
        const viaFn = await get("select url, token from almsar_storage_config()");
        if (viaFn?.url && viaFn?.token) {
          url = { value: viaFn.url };
          token = { value: viaFn.token };
        }
      } catch {
        /* Older databases may not have the helper yet. */
      }
    }
    if (url?.value && token?.value) {
      storageCache({ url: String(url.value).replace(/\/$/, ""), token: token.value });
    }
  });
}

export function ensureFileBucket() {
  return once("fileBucket", async () => {
    await ensureStorageConfig();
    if (!process.env.SUPABASE_DB_URL) return;
    try {
      await run(
        `insert into storage.buckets (id, name, public, file_size_limit)
         values ('app-files', 'app-files', false, 20971520)
         on conflict (id) do nothing`
      );
      await ensurePolicy(
        `create policy almsar_app_files_insert on storage.objects
         for insert to anon, authenticated
         with check (bucket_id = 'app-files')`
      );
      await ensurePolicy(
        `create policy almsar_app_files_get on storage.objects
         for select to anon, authenticated
         using (
           bucket_id = 'app-files'
           and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
         )`
      );
    } catch (error) {
      if (!/permission denied|already exists|duplicate/i.test(String(error?.message || ""))) throw error;
    }
  });
}

async function ensurePolicy(sql) {
  try {
    await define(sql);
  } catch (error) {
    if (!/already exists/i.test(String(error?.message || ""))) throw error;
  }
}

function storageHeaders(token) {
  return {
    apikey: token,
    Authorization: `Bearer ${token}`,
  };
}

export async function putStorageObject(folder, name, bytes, mime) {
  await ensureStorageConfig();
  const cfg = storagePublic();
  const path = storageObjectPath(folder, name);
  if (!cfg || !path) return false;
  const response = await fetch(`${cfg.url}/storage/v1/object/${FILE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...storageHeaders(cfg.token),
      "Content-Type": mime || "application/octet-stream",
    },
    body: bytes,
  });
  if (!response.ok) throw new Error("saveFailed");
  return true;
}

export async function readStorageObject(folder, name) {
  await ensureStorageConfig();
  const cfg = storagePublic();
  const path = storageObjectPath(folder, name);
  if (!cfg || !path) return null;
  const response = await fetch(`${cfg.url}/storage/v1/object/authenticated/${FILE_BUCKET}/${path}`, {
    headers: storageHeaders(cfg.token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) return null;
  return { mime: response.headers.get("content-type") || "application/octet-stream", bytes };
}

export async function makeUploadSlot(folder, name, mime) {
  await ensureStorageConfig();
  const cfg = storagePublic();
  const path = storageObjectPath(folder, name);
  if (!cfg || !path) return null;
  return {
    name,
    uploadUrl: `${cfg.url}/storage/v1/object/${FILE_BUCKET}/${path}`,
    token: cfg.token,
    contentType: mime || "application/octet-stream",
  };
}
