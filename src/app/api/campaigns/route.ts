import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  Campaign,
  CampaignSchedule,
  createCampaign,
  findAgent,
  listContacts,
  listPhoneNumbers,
  updateCampaign,
  newId,
} from "@/lib/db";
import { startOutboundCall, vapiConfigured } from "@/lib/vapi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sanitizeSchedule(input: unknown): CampaignSchedule {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    startDate: String(src.startDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    endDate: String(src.endDate ?? "").slice(0, 10),
    from: String(src.from ?? "09:00").slice(0, 5),
    to: String(src.to ?? "17:00").slice(0, 5),
    days: Array.isArray(src.days)
      ? src.days.map(String).filter((d) => DAYS.includes(d))
      : ["Mon", "Tue", "Wed", "Thu", "Fri"],
    timezone: String(src.timezone ?? "UTC").slice(0, 40),
    retryAttempts: Boolean(src.retryAttempts),
  };
}

function sanitizeStrings(input: unknown, max = 20): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, max);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  }
  const agent = await findAgent(session.userId, String(body?.agentId ?? ""));
  if (!agent) {
    return NextResponse.json({ error: "Pick a valid AI agent." }, { status: 400 });
  }

  const direction = body?.direction === "inbound" ? "inbound" : "outbound";
  const filters = {
    sources: sanitizeStrings(body?.filters?.sources),
    tags: sanitizeStrings(body?.filters?.tags),
    categories: sanitizeStrings(body?.filters?.categories),
  };

  // Count matching contacts for outbound campaigns.
  let contactsTotal = 0;
  if (direction === "outbound") {
    const contacts = await listContacts(session.userId);
    contactsTotal = filters.tags.length
      ? contacts.filter((c) => filters.tags.includes(c.tag)).length
      : contacts.length;
  }

  const mappingSrc =
    body?.variableMapping && typeof body.variableMapping === "object"
      ? (body.variableMapping as Record<string, unknown>)
      : {};
  const variableMapping: Record<string, string> = {};
  for (const [k, v] of Object.entries(mappingSrc).slice(0, 30)) {
    variableMapping[String(k).slice(0, 60)] = String(v).slice(0, 60);
  }

  const schedule = sanitizeSchedule(body?.schedule);
  const now = new Date().toISOString();
  // Launching a campaign that starts later = scheduled; today = running.
  const startsLater = schedule.startDate > now.slice(0, 10);

  const campaign = await createCampaign({
    id: newId("cmp"),
    userId: session.userId,
    name,
    agentId: agent.id,
    agentName: agent.name,
    goal: String(body?.description ?? body?.goal ?? "").trim(),
    status: direction === "inbound" ? "scheduled" : startsLater ? "scheduled" : "running",
    contactsTotal,
    contactsCalled: 0,
    createdAt: now,
    updatedAt: now,
    direction,
    phoneNumber: String(body?.phoneNumber ?? "").slice(0, 30),
    schedule,
    filters,
    variableMapping,
    webhookId: String(body?.webhookId ?? ""),
    syncWithContact: Boolean(body?.syncWithContact),
  } as Campaign);

  // Launch: a running outbound campaign fans out real Vapi calls when the
  // agent is synced and a Vapi-linked phone number is available. Best-effort —
  // a failed dial never fails the campaign creation.
  let launched = 0;
  if (
    campaign.status === "running" &&
    direction === "outbound" &&
    vapiConfigured() &&
    agent.vapiAssistantId
  ) {
    const numbers = await listPhoneNumbers(session.userId);
    const fromNumber =
      numbers.find((n) => n.number === campaign.phoneNumber && n.vapiPhoneNumberId) ??
      numbers.find((n) => n.vapiPhoneNumberId);
    if (fromNumber?.vapiPhoneNumberId) {
      const contacts = await listContacts(session.userId);
      const targets = (
        filters.tags.length ? contacts.filter((c) => filters.tags.includes(c.tag)) : contacts
      )
        .filter((c) => /^\+?[0-9 ()-]{7,}$/.test(c.phone ?? ""))
        .slice(0, 10); // first batch; the rest dial as the campaign progresses
      const results = await Promise.allSettled(
        targets.map((c) =>
          startOutboundCall({
            assistantId: agent.vapiAssistantId!,
            phoneNumberId: fromNumber.vapiPhoneNumberId!,
            customerNumber: c.phone.replace(/[^+0-9]/g, ""),
          })
        )
      );
      launched = results.filter((r) => r.status === "fulfilled").length;
      results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .forEach((r) => console.error("Outbound dial failed:", r.reason));
      if (launched > 0) {
        await updateCampaign(session.userId, campaign.id, { contactsCalled: launched });
      }
    }
  }

  return NextResponse.json({ campaign, launched }, { status: 201 });
}
