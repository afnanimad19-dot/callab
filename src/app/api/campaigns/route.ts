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
import { createVapiCampaign, startOutboundCall, vapiConfigured } from "@/lib/vapi";

// Contacts uploaded via CSV in the wizard: [{ number, name, ...vars }].
interface CsvContact { number: string; name?: string; [k: string]: string | undefined }
function sanitizeCsvContacts(input: unknown): CsvContact[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const src = c as Record<string, unknown>;
      const out: CsvContact = { number: String(src.number ?? "").replace(/[^+0-9]/g, "").slice(0, 20) };
      if (src.name) out.name = String(src.name).slice(0, 120);
      for (const [k, v] of Object.entries(src).slice(0, 20)) {
        if (k !== "number" && k !== "name" && v != null) out[k.slice(0, 40)] = String(v).slice(0, 200);
      }
      return out;
    })
    .filter((c) => /^\+?\d{7,15}$/.test(c.number))
    .slice(0, 2000);
}

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

  const csvContacts = sanitizeCsvContacts(body?.csvContacts);

  // Build the outbound call list from CSV upload + selected contacts (by tag,
  // or all). CSV takes precedence when provided.
  let contactsTotal = 0;
  let targets: { number: string; name?: string; variableValues?: Record<string, string> }[] = [];
  if (direction === "outbound") {
    if (csvContacts.length) {
      targets = csvContacts.map((c) => {
        const { number, name, ...vars } = c;
        return { number, name, variableValues: vars as Record<string, string> };
      });
    } else {
      const contacts = await listContacts(session.userId);
      // Apply any of the three filters (source / tag / category); no filter = all.
      const anyFilter = filters.sources.length || filters.tags.length || filters.categories.length;
      const selected = anyFilter
        ? contacts.filter(
            (c) =>
              (!filters.tags.length || filters.tags.includes(c.tag)) &&
              (!filters.sources.length || filters.sources.includes(c.source ?? "")) &&
              (!filters.categories.length || filters.categories.includes(c.category ?? ""))
          )
        : contacts;
      targets = selected
        .filter((c) => /^\+?[0-9 ()-]{7,}$/.test(c.phone ?? ""))
        .map((c) => ({ number: c.phone.replace(/[^+0-9]/g, ""), name: c.name }));
    }
    contactsTotal = targets.length;
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
  // Send Now overrides the date — calls begin immediately. Otherwise a future
  // start date = scheduled.
  const sendNow = body?.sendNow !== false;
  const startsLater = !sendNow && schedule.startDate > now.slice(0, 10);
  // Compute the exact ISO start for a scheduled campaign (date + from-time).
  const earliestAt =
    startsLater && schedule.startDate
      ? new Date(`${schedule.startDate}T${schedule.from || "09:00"}:00`).toISOString()
      : undefined;

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

  // Launch: create a NATIVE Vapi campaign for the whole list — Vapi runs the
  // dialing queue, concurrency, retries and (if scheduled) the start time.
  // Requires the agent synced + a Vapi-linked phone number. Falls back to
  // firing individual calls if the campaign API isn't available.
  let launched = 0;
  let launchError: string | undefined;
  if (direction === "outbound" && vapiConfigured() && agent.vapiAssistantId) {
    if (targets.length === 0) {
      launchError = "No callable contacts — upload a CSV or pick a contact tag with valid phone numbers.";
    } else {
      const numbers = await listPhoneNumbers(session.userId);
      const fromNumber =
        numbers.find((n) => n.number === campaign.phoneNumber && n.vapiPhoneNumberId) ??
        numbers.find((n) => n.vapiPhoneNumberId);
      if (!fromNumber?.vapiPhoneNumberId) {
        launchError = "No Vapi-linked phone number to call from — connect a number in Phone Numbers first.";
      } else {
        try {
          const camp = await createVapiCampaign({
            name: campaign.name,
            assistantId: agent.vapiAssistantId,
            phoneNumberId: fromNumber.vapiPhoneNumberId,
            customers: targets,
            earliestAt,
          });
          launched = targets.length;
          await updateCampaign(session.userId, campaign.id, {
            contactsCalled: earliestAt ? 0 : launched,
            vapiCampaignId: (camp as { id?: string })?.id,
          } as Partial<Campaign>);
        } catch (e) {
          // Fallback: fire the first batch as individual calls (older Vapi accounts).
          console.error("Vapi campaign API failed, firing individual calls:", e);
          const results = await Promise.allSettled(
            targets.slice(0, 20).map((c) =>
              startOutboundCall({
                assistantId: agent.vapiAssistantId!,
                phoneNumberId: fromNumber.vapiPhoneNumberId!,
                customerNumber: c.number,
                variableValues: c.variableValues,
              })
            )
          );
          launched = results.filter((r) => r.status === "fulfilled").length;
          if (launched === 0) launchError = `Could not start the campaign: ${(e as Error).message.slice(0, 160)}`;
          else await updateCampaign(session.userId, campaign.id, { contactsCalled: launched });
        }
      }
    }
  }

  return NextResponse.json({ campaign, launched, launchError }, { status: 201 });
}
