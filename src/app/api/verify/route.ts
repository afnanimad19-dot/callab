import { NextResponse } from "next/server";
import { findUserByVerifyToken, updateUser } from "@/lib/db";

// Email verification link target. Marks the account verified and sends the
// user to the login page with a status flag the page can show.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.redirect(new URL("/login?verified=invalid", url.origin));
  }

  const user = await findUserByVerifyToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?verified=invalid", url.origin));
  }

  await updateUser(user.id, { emailVerified: true, verifyToken: undefined });
  return NextResponse.redirect(new URL("/login?verified=1", url.origin));
}
