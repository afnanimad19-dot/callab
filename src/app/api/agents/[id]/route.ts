import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteAgent, findAgent, updateAgent } from "@/lib/db";
import { syncAgentToVapi } from "@/lib/vapi";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const agent = await findAgent(session.userId, id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const allowed = [
    "name",
    "role",
    "voice",
    "language",
    "greeting",
    "systemPrompt",
    "phoneNumber",
    "status",
  ] as const;
  const patch: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body?.[key] === "string") patch[key] = body[key];
  }
  if (patch.status && !["active", "paused", "draft"].includes(patch.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const agent = await updateAgent(session.userId, id, patch);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await syncAgentToVapi(agent);
  } catch (e) {
    console.error("Vapi sync failed:", e);
  }

  return NextResponse.json({ agent });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deleteAgent(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
