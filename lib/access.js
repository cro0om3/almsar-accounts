import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { all, define, get, once, run } from "./local-db";
import { ACCOUNTANT_PERMISSIONS, PERMISSIONS, can } from "./permissions";

const SECRET = "almsar-local-gate-v1";
const DAY = 1000 * 60 * 60 * 12;

export function signSession(staff) {
  const payload = Buffer.from(JSON.stringify({
    id: staff.id,
    name: staff.name,
    role: staff.role,
    permissions: staff.role === "admin" ? ["*"] : staff.permissions,
    exp: Date.now() + DAY,
  })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data?.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function assertPermission(token, key) {
  const session = readSessionToken(token || "");
  if (!can(session, key)) throw new Error("Not allowed");
  return session;
}

function parsePermissions(value) {
  try {
    const list = JSON.parse(value || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function view(row) {
  return {
    id: row.id,
    name: row.name || "",
    code: row.code || "",
    role: row.role || "custom",
    active: Number(row.active) !== 0,
    permissions: row.role === "admin" ? ["*"] : parsePermissions(row.permissions),
  };
}

export function ensureStaff() {
  return once("staff", async () => {
  await define(`create table if not exists staff (
    id text primary key,
    name text,
    code text,
    role text,
    permissions text,
    active integer,
    createdAt text,
    updatedAt text
  )`);
  const now = new Date().toISOString();
  const admin = await get("select id from staff where role = ?", ["admin"]);
  if (!admin) {
    await run(
      `insert into staff (id, name, code, role, permissions, active, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), "الإدارة", "4477", "admin", JSON.stringify(["*"]), 1, now, now]
    );
  } else {
    await run(
      `update staff set code = ?, role = ?, permissions = ?, active = 1 where role = ?`,
      ["4477", "admin", JSON.stringify(["*"]), "admin"]
    );
  }
  const accountant = await get("select id from staff where role = ?", ["accountant"]);
  if (!accountant) {
    await run(
      `insert into staff (id, name, code, role, permissions, active, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), "المحاسب", "2200", "accountant", JSON.stringify(ACCOUNTANT_PERMISSIONS), 1, now, now]
    );
  }
  });
}

export async function listStaff() {
  await ensureStaff();
  const rows = await all("select * from staff order by name");
  const rank = { admin: 0, accountant: 1 };
  return rows
    .map(view)
    .sort((a, b) => (rank[a.role] ?? 2) - (rank[b.role] ?? 2) || a.name.localeCompare(b.name));
}

export async function loginWithCode(code) {
  await ensureStaff();
  const value = String(code || "").trim();
  if (!value) return null;
  const row = await get("select * from staff where code = ?", [value]);
  if (!row || Number(row.active) === 0) return null;
  return view(row);
}

export async function saveStaff(input) {
  await ensureStaff();
  const name = String(input.name || "").trim();
  const code = String(input.code || "").trim();
  if (!name || !/^\d{4,8}$/.test(code)) throw new Error("invalid");
  const now = new Date().toISOString();
  const current = input.id ? await get("select * from staff where id = ?", [input.id]) : null;
  const taken = await get("select id, role from staff where code = ?", [code]);
  if (taken && taken.id !== current?.id) throw new Error("taken");
  if (current?.role === "admin") {
    await run(
      `update staff set name = ?, code = ?, role = ?, permissions = ?, active = 1, updatedAt = ? where id = ?`,
      [name, "4477", "admin", JSON.stringify(["*"]), now, current.id]
    );
    return current.id;
  }
  const permissions = [...new Set((input.permissions || []).filter((key) => PERMISSIONS.includes(key)))];
  if (!permissions.length) throw new Error("invalid");
  const active = input.active === false || input.active === 0 ? 0 : 1;
  if (current) {
    await run(
      `update staff set name = ?, code = ?, permissions = ?, active = ?, updatedAt = ? where id = ?`,
      [name, code, JSON.stringify(permissions), active, now, current.id]
    );
    return current.id;
  }
  if (code === "4477") throw new Error("taken");
  const id = randomUUID();
  await run(
    `insert into staff (id, name, code, role, permissions, active, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, code, "custom", JSON.stringify(permissions), active, now, now]
  );
  return id;
}

export async function deleteStaff(id) {
  await ensureStaff();
  const current = await get("select role from staff where id = ?", [id]);
  if (!current) return { ok: true };
  if (current.role === "admin") return { error: "admin" };
  await run("delete from staff where id = ?", [id]);
  return { ok: true };
}
