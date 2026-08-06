import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAgent, listAgents, newId } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ agents: listAgents(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Agent name is required." }, { status: 400 });
  }

  const agent = createAgent({
    id: newId("agt"),
    userId: session.userId,
    name,
    role: String(body?.role ?? "").trim() || "General assistant",
    voice: String(body?.voice ?? "Nova (female, warm)"),
    language: String(body?.language ?? "English (US)"),
    greeting:
      String(body?.greeting ?? "").trim() ||
      "Thanks for calling — how can I help you today?",
    systemPrompt: String(body?.systemPrompt ?? "").trim(),
    phoneNumber: String(body?.phoneNumber ?? "").trim() || "Not assigned",
    status: "draft",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ agent }, { status: 201 });
}
