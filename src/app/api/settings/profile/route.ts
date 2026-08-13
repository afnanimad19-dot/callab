import { NextResponse } from "next/server";
import { getSession, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { updateUser } from "@/lib/db";

// Update profile fields, then re-issue the session cookie so the sidebar
// and header reflect the new name/company immediately.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const company = String(body?.company ?? "").trim();
  if (!name || !company) {
    return NextResponse.json({ error: "Name and company are required." }, { status: 400 });
  }

  await updateUser(session.userId, {
    name,
    company,
    clinicAddress: String(body?.clinicAddress ?? "").slice(0, 300),
    clinicPhone: String(body?.clinicPhone ?? "").slice(0, 60),
    clinicMapUrl: String(body?.clinicMapUrl ?? "").slice(0, 500),
  });

  const token = await createSessionToken({
    userId: session.userId,
    email: session.email,
    name,
    company,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
