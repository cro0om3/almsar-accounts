import fs from "fs";
import path from "path";
import pg from "pg";

const sourcePath = path.join(process.env.APPDATA || "", "imanage", "data", "imanage.db");
const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "accounts.sqlite");
const markerPath = path.join(dataDir, "snapshot-v2");

pg.types.setTypeParser(20, (value) => Number(value));

let database;
let DatabaseSync;

function usingPostgres() {
  return Boolean(process.env.SUPABASE_DB_URL);
}

function quoteName(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function toPostgres(sql) {
  let index = 0;
  let param = 0;
  let out = "";
  while (index < sql.length) {
    const char = sql[index];
    if (char === "'") {
      const start = index;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
      out += sql.slice(start, index);
      continue;
    }
    if (char === '"') {
      const start = index;
      index += 1;
      while (index < sql.length && sql[index] !== '"') index += 1;
      index += 1;
      out += sql.slice(start, index);
      continue;
    }
    if (char === "?") {
      param += 1;
      out += `$${param}`;
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index])) index += 1;
      const word = sql.slice(start, index);
      out += /[a-z]/.test(word) && /[A-Z]/.test(word) ? `"${word}"` : word;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

async function sqliteDriver() {
  if (!DatabaseSync) {
    const mod = await import("node:sqlite");
    DatabaseSync = mod.DatabaseSync;
  }
  return DatabaseSync;
}

async function snapshotFromSource() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error("لم أجد قاعدة iManage على هذا الجهاز.");
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const Driver = await sqliteDriver();
  const source = new Driver(sourcePath, { readOnly: true });
  const tempPath = `${dbPath}.new`;
  if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
  const dest = new Driver(tempPath);
  dest.exec("PRAGMA foreign_keys = OFF");
  const tables = source
    .prepare("select name, sql from sqlite_master where type = 'table' and sql is not null and name not like 'sqlite_%'")
    .all();
  for (const table of tables) {
    dest.exec(table.sql);
    const columns = source
      .prepare(`pragma table_info(${quoteName(table.name)})`)
      .all()
      .map((column) => column.name);
    const rows = source.prepare(`select * from ${quoteName(table.name)}`).all();
    if (!rows.length || !columns.length) continue;
    const insert = dest.prepare(
      `insert into ${quoteName(table.name)} (${columns.map(quoteName).join(", ")}) values (${columns.map(() => "?").join(", ")})`
    );
    for (const row of rows) {
      insert.run(...columns.map((name) => row[name] ?? null));
    }
  }
  dest.close();
  source.close();
  if (database) {
    database.close();
    database = undefined;
  }
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  fs.renameSync(tempPath, dbPath);
  fs.writeFileSync(markerPath, new Date().toISOString());
}

async function ensureCopy() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(markerPath) || !fs.existsSync(dbPath)) await snapshotFromSource();
}

async function getSqlite() {
  if (!database) {
    const Driver = await sqliteDriver();
    await ensureCopy();
    database = new Driver(dbPath);
    database.exec("PRAGMA foreign_keys = ON");
  }
  return database;
}

function transactionPoolerUrl(value) {
  const url = new URL(value);
  // Port 5432 on the shared pooler is session mode, capped at pool_size (15).
  // Port 6543 is transaction mode, which shares those slots across many clients.
  if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "5432") {
    url.port = "6543";
  }
  url.searchParams.delete("sslmode");
  return url.toString();
}

function getPool() {
  const connectionString = transactionPoolerUrl(process.env.SUPABASE_DB_URL);
  const poolKey = `${connectionString}|pool5`;
  const current = globalThis.__almsarPgPool;
  if (current?.connectionString === poolKey) return current.pool;

  const nextPool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 20000,
    allowExitOnIdle: true,
    keepAlive: true,
  });
  nextPool.on("error", () => {});
  current?.pool.end().catch(() => {});
  globalThis.__almsarPgPool = { connectionString: poolKey, pool: nextPool };
  return nextPool;
}

const readCache = new Map();
const READ_MS = 15000;

function readKey(sql, params) {
  return `${sql}\n${JSON.stringify(params ?? [])}`;
}

function cachedRead(sql, params, load) {
  const key = readKey(sql, params);
  const hit = readCache.get(key);
  if (hit && hit.until > Date.now()) return hit.promise;
  const promise = load().catch((error) => {
    readCache.delete(key);
    throw error;
  });
  readCache.set(key, { until: Date.now() + READ_MS, promise });
  return promise;
}

function clearReadCache() {
  readCache.clear();
  globalThis.__almsarEpoch = (globalThis.__almsarEpoch || 0) + 1;
}

export function dataEpoch() {
  return globalThis.__almsarEpoch || 0;
}

export function once(key, task) {
  const bag = globalThis.__almsarSchema || (globalThis.__almsarSchema = {});
  if (bag[key] === true) return Promise.resolve();
  const pending = `${key}Promise`;
  if (!bag[pending]) {
    bag[pending] = Promise.resolve()
      .then(task)
      .then(() => {
        bag[key] = true;
      })
      .catch((error) => {
        delete bag[pending];
        throw error;
      });
  }
  return bag[pending];
}

function plain(row) {
  return row ? { ...row } : row;
}

function canRetry(error) {
  const message = String(error?.message || "");
  return /timeout exceeded when trying to connect|ECONNRESET|ECONNREFUSED|Connection terminated|EMAXCONNSESSION|too many clients/i.test(message);
}

async function query(sql, params) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getPool().query(toPostgres(sql), params);
    } catch (error) {
      last = error;
      if (!canRetry(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw last;
}

async function execute(sql, params = []) {
  if (!usingPostgres()) {
    const db = await getSqlite();
    return params.length ? db.prepare(sql).run(...params) : db.exec(sql);
  }
  return query(sql, params);
}

export async function all(sql, params = []) {
  return cachedRead(sql, params, async () => {
    if (!usingPostgres()) {
      const db = await getSqlite();
      return db.prepare(sql).all(...params).map(plain);
    }
    const result = await query(sql, params);
    return result.rows.map(plain);
  });
}

export async function get(sql, params = []) {
  return cachedRead(sql, params, async () => {
    if (!usingPostgres()) {
      const db = await getSqlite();
      return plain(db.prepare(sql).get(...params));
    }
    const result = await query(sql, params);
    return plain(result.rows[0]);
  });
}

export async function run(sql, params = []) {
  clearReadCache();
  return execute(sql, params);
}

export async function define(sql) {
  return execute(sql);
}

export async function nextNumber(table, prefix) {
  if (table !== "quotes" && table !== "invoices" && table !== "purchase_orders" && table !== "receipts") {
    throw new Error("Unsupported number table");
  }
  const rows = await all(`select number from ${table}`);
  let max = 0;
  for (const row of rows) {
    const value = Number(String(row.number || "").split("-").pop());
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `${prefix}-${max + 1}`;
}
