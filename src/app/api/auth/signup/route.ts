import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, newId } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const company = String(body?.company ?? "").trim();
  const name = String(body?.name ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!company || !name) {
    return NextResponse.json(
      { error: "Company and your name are required." },
      { status: 400 }
    );
  }

  let user;
  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Create the account first. If this fails, no account exists and we
    // return the underlying reason so the cause is visible, not a blank 500.
    user = await createUser({
      id: newId("usr"),
      email,
      passwordHash: await bcrypt.hash(password, 10),
      company,
      name,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Signup failed:", e);
    return NextResponse.json(
      { error: `Could not create account: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // New accounts start completely empty — every stat on the dashboard reflects
  // this customer's real calls, contacts and campaigns from day one. No sample
  // or placeholder records are created.

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
