import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByEmail,
  newId,
  createAgent,
  insertCalls,
} from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { seedDemoData } from "@/lib/demo-data";

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
  if (findUserByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const user = createUser({
    id: newId("usr"),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    company,
    name,
    createdAt: new Date().toISOString(),
  });

  // Seed demo agents + call history so the dashboard is alive on first login.
  const { agents, calls } = seedDemoData(user.id);
  agents.forEach(createAgent);
  insertCalls(calls);

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
