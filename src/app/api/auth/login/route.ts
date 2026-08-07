import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserById, updateUser } from "@/lib/db";
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
  if (user.status === "blocked") {
    return NextResponse.json(
      { error: "This account has been blocked by the workspace owner." },
      { status: 403 }
    );
  }

  // First login of an invited member activates the account.
  if (user.status === "invited") {
    await updateUser(user.id, { status: "active" });
  }

  // Members log into the OWNER's workspace: data is keyed by the owner id.
  const ownerId = user.ownerId ?? user.id;
  const owner = user.ownerId ? await findUserById(user.ownerId) : user;

  const token = await createSessionToken({
    userId: ownerId,
    email: user.email,
    company: owner?.company ?? user.company,
    name: user.name,
    memberId: user.id,
    role: user.role ?? "owner",
  });

  const response = NextResponse.json({
    ok: true,
    mustResetPassword: Boolean(user.mustResetPassword),
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
