import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/db";
import {
  googleAuthUrl,
  googleConfigured,
  disconnectService,
  getServiceConn,
  serviceConnected,
  GOOGLE_SERVICES,
  type GoogleService,
} from "@/lib/google";
import { sheetConfig } from "@/lib/gsheets";

function serviceParam(request: Request): GoogleService | null {
  const s = new URL(request.url).searchParams.get("service") as GoogleService | null;
  return s && GOOGLE_SERVICES.includes(s) ? s : null;
}

// GET  -> status of all three connections (+ sheet config)
// POST ?service=calendar|sheets|gmail -> begin OAuth for that service
// DELETE ?service=... -> disconnect that service
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserById(session.userId);
  return NextResponse.json({
    configured: googleConfigured(),
    calendar: { connected: serviceConnected(user, "calendar"), email: user ? getServiceConn(user, "calendar")?.email ?? null : null },
    gmail: { connected: serviceConnected(user, "gmail"), email: user ? getServiceConn(user, "gmail")?.email ?? null : null },
    sheets: {
      connected: serviceConnected(user, "sheets"),
      email: user ? getServiceConn(user, "sheets")?.email ?? null : null,
      ...sheetConfig(user),
    },
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
  const service = serviceParam(request);
  if (!service) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;
  return NextResponse.json({ url: googleAuthUrl(service, redirectUri, session.userId) });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = serviceParam(request);
  if (!service) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  await disconnectService(session.userId, service);
  return NextResponse.json({ ok: true });
}
