import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("almsar_gate", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
