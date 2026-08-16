// JWT session management using httpOnly cookies.
//
// AUTH_SECRET should be set in production (.env). The dev fallback keeps
// local onboarding frictionless but must never ship to a real deployment.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-secret-change-me"
);

export const SESSION_COOKIE = "vl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string; // ACTIVE workspace data key (all data is scoped to this)
  email: string;
  company: string; // active workspace name (for display)
  name: string;
  memberId?: string; // the logged-in user's own record id
  ownerId?: string; // root account owner (billing/plan); defaults to userId
  role?: "owner" | "supervisor" | "viewer";
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      company: payload.company as string,
      name: payload.name as string,
      memberId: (payload.memberId as string) ?? (payload.userId as string),
      ownerId: (payload.ownerId as string) ?? (payload.userId as string),
      role: (payload.role as SessionPayload["role"]) ?? "owner",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
