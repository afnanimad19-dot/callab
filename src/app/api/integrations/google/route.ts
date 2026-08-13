import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import { googleAuthUrl, googleConfigured, disconnectGoogle } from "@/lib/gcal";
import { googleSheetUrl } from "@/lib/gsheets";

// GET  -> connection status
// POST -> begin OAuth (returns the Google consent URL to redirect to)
// DELETE -> disconnect
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserById(session.userId);
  return NextResponse.json({
    configured: googleConfigured(),
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
    sheetUrl: googleSheetUrl(user?.googleSheetId),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables first." },
      { status: 400 }
    );
  }
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;
  // state carries the user id so the callback knows whose account to link.
  return NextResponse.json({ url: googleAuthUrl(redirectUri, session.userId) });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectGoogle(session.userId);
  return NextResponse.json({ ok: true });
}
