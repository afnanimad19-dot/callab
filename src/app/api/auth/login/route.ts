import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (e) {
    // Surface a real backend error (e.g. database unreachable) rather than
    // masking it as "invalid credentials".
    console.error("Login lookup failed:", e);
    return NextResponse.json(
      { error: `Sign-in is temporarily unavailable: ${(e as Error).message}` },
      { status: 503 }
    );
  }

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    company: user.company,
    name: user.name,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
