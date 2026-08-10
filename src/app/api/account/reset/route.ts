import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listCalls,
  listCampaigns,
  listContacts,
  deleteCall,
  deleteCampaign,
  deleteContact,
} from "@/lib/db";

// Clear the workspace's activity data — calls, campaigns and contacts — so the
// dashboard shows only real data going forward. Agents, phone numbers and
// knowledge bases (the customer's configuration) are left untouched. Used to
// wipe any leftover sample data before a real launch. Requires confirm:true.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const scopes: string[] = Array.isArray(body?.scopes) && body.scopes.length
    ? body.scopes
    : ["calls", "campaigns", "contacts"];

  const counts: Record<string, number> = {};

  if (scopes.includes("calls")) {
    const calls = await listCalls(session.userId);
    await Promise.all(calls.map((c) => deleteCall(c.id)));
    counts.calls = calls.length;
  }
  if (scopes.includes("campaigns")) {
    const campaigns = await listCampaigns(session.userId);
    await Promise.all(campaigns.map((c) => deleteCampaign(c.id)));
    counts.campaigns = campaigns.length;
  }
  if (scopes.includes("contacts")) {
    const contacts = await listContacts(session.userId);
    await Promise.all(contacts.map((c) => deleteContact(c.id)));
    counts.contacts = contacts.length;
  }

  return NextResponse.json({ ok: true, counts });
}
