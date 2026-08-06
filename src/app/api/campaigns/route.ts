import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createCampaign, findAgent, listContacts, newId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const agentId = String(body?.agentId ?? "");
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  }
  const agent = await findAgent(session.userId, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Pick a valid agent." }, { status: 400 });
  }

  const contacts = await listContacts(session.userId);
  const campaign = await createCampaign({
    id: newId("cmp"),
    userId: session.userId,
    name,
    agentId: agent.id,
    agentName: agent.name,
    goal: String(body?.goal ?? "").trim(),
    status: "draft",
    contactsTotal: contacts.length,
    contactsCalled: 0,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
