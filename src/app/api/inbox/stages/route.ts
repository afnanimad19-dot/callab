import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelSettings, saveChannelSettings } from "@/lib/db";
import { resolveStages, sanitizeStages } from "@/lib/lifecycle";

// Read / update the workspace's custom lifecycle pipeline stages.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getChannelSettings(session.userId);
  return NextResponse.json({ stages: resolveStages(settings.lifecycleStages) });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const stages = sanitizeStages(body?.stages);
  await saveChannelSettings(session.userId, { lifecycleStages: stages });
  return NextResponse.json({ stages });
}
