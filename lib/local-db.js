import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const sourcePath = path.join(
  process.env.APPDATA || "",
  "imanage",
  "data",
  "imanage.db"
);
const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "accounts.sqlite");
const markerPath = path.join(dataDir, "snapshot-v2");

let database;

function quoteName(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
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
  if (!fs.existsSync(markerPath) || !fs.existsSync(dbPath)) {
    snapshotFromSource();
  }
}

export function getDb() {
  if (!database) {
    ensureCopy();
    database = new DatabaseSync(dbPath);
    database.exec("PRAGMA foreign_keys = ON");
  }
  return database;
}

function plain(row) {
  return row ? { ...row } : row;
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params).map(plain);
}

export function get(sql, params = []) {
  return plain(getDb().prepare(sql).get(...params));
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

export function nextNumber(table, prefix) {
  if (table !== "quotes" && table !== "invoices" && table !== "purchase_orders") {
    throw new Error("Unsupported number table");
  }
  const rows = all(`select number from ${table}`);
  let max = 0;
  for (const row of rows) {
    const value = Number(String(row.number || "").split("-").pop());
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `${prefix}-${max + 1}`;
}
