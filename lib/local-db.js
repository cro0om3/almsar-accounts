import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const sourcePath = path.join(process.env.APPDATA || "", "imanage", "data", "imanage.db");
const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "accounts.sqlite");
const markerPath = path.join(dataDir, "snapshot-v2");

pg.types.setTypeParser(20, (value) => Number(value));

let database;
let pool;

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

function snapshotFromSource() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error("لم أجد قاعدة iManage على هذا الجهاز.");
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const tempPath = `${dbPath}.new`;
  if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
  const dest = new DatabaseSync(tempPath);
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

function ensureCopy() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(markerPath) || !fs.existsSync(dbPath)) snapshotFromSource();
}

function getSqlite() {
  if (!database) {
    ensureCopy();
    database = new DatabaseSync(dbPath);
    database.exec("PRAGMA foreign_keys = ON");
  }
  return database;
}

function getPool() {
  if (!pool) {
    const url = new URL(process.env.SUPABASE_DB_URL);
    url.searchParams.delete("sslmode");
    pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

function plain(row) {
  return row ? { ...row } : row;
}

export async function all(sql, params = []) {
  if (!usingPostgres()) return getSqlite().prepare(sql).all(...params).map(plain);
  const result = await getPool().query(toPostgres(sql), params);
  return result.rows.map(plain);
}

export async function get(sql, params = []) {
  if (!usingPostgres()) return plain(getSqlite().prepare(sql).get(...params));
  const result = await getPool().query(toPostgres(sql), params);
  return plain(result.rows[0]);
}

export async function run(sql, params = []) {
  if (!usingPostgres()) return getSqlite().prepare(sql).run(...params);
  return getPool().query(toPostgres(sql), params);
}

export async function nextNumber(table, prefix) {
  if (table !== "quotes" && table !== "invoices" && table !== "purchase_orders") {
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
