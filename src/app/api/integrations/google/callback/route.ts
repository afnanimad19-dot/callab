import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateUser } from "@/lib/db";
import { exchangeCode } from "@/lib/gcal";

// Google OAuth redirect target. Exchanges the code for a refresh token and
// stores it on the signed-in workspace owner, then returns to Integrations.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const back = new URL("/dashboard/integrations", url.origin);

  const session = await getSession();
  if (!session || !code || state !== session.userId) {
    back.searchParams.set("google", "error");
    return NextResponse.redirect(back);
  }

  const redirectUri = `${url.origin}/api/integrations/google/callback`;
  const result = await exchangeCode(code, redirectUri);
  if (!result?.refreshToken) {
    back.searchParams.set("google", "error");
    return NextResponse.redirect(back);
  }

  await updateUser(session.userId, {
    googleRefreshToken: result.refreshToken,
    googleEmail: result.email,
  });
  back.searchParams.set("google", "connected");
  return NextResponse.redirect(back);
}
