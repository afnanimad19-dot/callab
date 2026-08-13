import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exchangeCode, parseState, saveServiceConn } from "@/lib/google";

// Google OAuth redirect target. Exchanges the code for a refresh token and
// stores it on the signed-in workspace owner under the SPECIFIC service the
// consent was started for (state = "<userId>::<service>").
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const parsed = parseState(url.searchParams.get("state"));
  const back = new URL("/dashboard/integrations", url.origin);

  const session = await getSession();
  if (!session || !code || !parsed || parsed.userId !== session.userId) {
    back.searchParams.set("google", "error");
    return NextResponse.redirect(back);
  }

  const redirectUri = `${url.origin}/api/integrations/google/callback`;
  const result = await exchangeCode(code, redirectUri);
  if (!result?.refreshToken) {
    back.searchParams.set("google", "error");
    return NextResponse.redirect(back);
  }

  await saveServiceConn(session.userId, parsed.service, {
    refreshToken: result.refreshToken,
    email: result.email,
  });
  back.searchParams.set("google", parsed.service);
  return NextResponse.redirect(back);
}
