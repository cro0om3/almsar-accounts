import { NextResponse } from "next/server";
import { loginWithCode, signSession } from "../../../lib/access";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const staff = await loginWithCode(body.code);
  if (!staff) return NextResponse.json({ error: "invalid" }, { status: 401 });
  const response = NextResponse.json({ ok: true, name: staff.name });
  response.cookies.set("almsar_gate", signSession(staff), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
