import { NextResponse } from "next/server";
import { can, firstAllowed, permissionForPath } from "./lib/permissions";

const SECRET = "almsar-local-gate-v1";

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToString(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function readToken(token) {
  if (!token || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (bytesToBase64Url(mac) !== sig) return null;
  try {
    const data = JSON.parse(base64UrlToString(payload));
    if (!data?.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  if (request.headers.has("next-action") || request.headers.has("Next-Action")) {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  const session = await readToken(request.cookies.get("almsar_gate")?.value || "");
  if (pathname === "/login" || pathname === "/api/login") {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL(firstAllowed(session), request.url));
    }
    return NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const key = permissionForPath(pathname);
  if (key && !can(session, key)) {
    const next = firstAllowed(session);
    if (next === pathname) return NextResponse.next();
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|logo.png|branding/).*)",
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
