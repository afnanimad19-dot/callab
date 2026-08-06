import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createWebhook, newId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  if (!/^https:\/\/.+/.test(url)) {
    return NextResponse.json({ error: "Enter a valid https:// URL." }, { status: 400 });
  }

  const webhook = await createWebhook({
    id: newId("wbh"),
    userId: session.userId,
    url,
    events: Array.isArray(body?.events) && body.events.length
      ? body.events.map(String)
      : ["call.started", "call.ended"],
    active: true,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ webhook }, { status: 201 });
}
