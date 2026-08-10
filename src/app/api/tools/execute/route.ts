import { NextResponse } from "next/server";
import {
  findAgentAnyUser,
  listContacts,
  createContact,
  updateContact,
  listCalls,
  newId,
  Contact,
  Agent,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  bookAppointment,
  cancelAppointment,
  findUpcomingAppointment,
  rescheduleAppointment,
} from "@/lib/appointments";
import { buildKnowledgeText } from "@/lib/knowledge";

// Answer a knowledge-base query: pull the agent's knowledge text and return the
// passages most relevant to what the caller asked. Simple keyword scoring keeps
// the reply short so the model quotes the right facts instead of the whole doc.
async function searchKnowledge(agent: Agent, query: string): Promise<string> {
  const text = await buildKnowledgeText(agent.userId, agent.knowledgeBaseIds);
  if (!text || !text.trim()) {
    return "The knowledge base is empty for this agent. Answer from your general instructions or offer to take a message.";
  }
  const q = query.toLowerCase();
  const terms = [...new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
  // Split into paragraphs, score each by how many query terms it contains.
  const paras = text.split(/\n{2,}|\r?\n(?=[A-Z0-9#*-])/).map((p) => p.trim()).filter(Boolean);
  if (terms.length === 0 || paras.length <= 3) return text.slice(0, 3500);
  const scored = paras
    .map((p) => {
      const lower = p.toLowerCase();
      const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (scored.length === 0) return text.slice(0, 3500);
  return scored.map((x) => x.p).join("\n\n").slice(0, 3500);
}

const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").slice(-9);

// Customer memory: recognise returning callers from OUR contacts + call
// history, and remember new ones — the workspace's own CRM, no external
// system needed.
// find_patient (built-in): identify an existing patient by name, then phone
// only when several share the name — per the booking policy.
async function findPatient(userId: string, name: string, phone: string): Promise<string> {
  if (!name && !phone) return "Ask for the patient's name first, then call find_patient again.";
  const contacts = await listContacts(userId);
  const q = name.toLowerCase();
  let matches = name
    ? contacts.filter((c) => {
        const full = c.name.toLowerCase();
        return full === q || full.includes(q) || q.includes(full.split(" ")[0]);
      })
    : contacts;
  if (phone) {
    const digits = normalizePhone(phone);
    if (digits.length >= 7) {
      const byPhone = matches.filter((c) => normalizePhone(c.phone) === digits);
      matches = byPhone.length > 0 ? byPhone : matches.filter((c) => normalizePhone(c.phone) === digits);
    }
  }
  if (matches.length === 0) {
    return `No existing patient named "${name}" found — treat them as a NEW patient (don't mention records).`;
  }
  if (matches.length > 1) {
    return `${matches.length} patients match the name "${name}". Ask for their full phone number, then call find_patient again with both name and phone.`;
  }
  const c = matches[0];
  const calls = (await listCalls(userId))
    .filter((call) => normalizePhone(call.callerNumber) === normalizePhone(c.phone) && normalizePhone(c.phone).length >= 7)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lastCall = calls[0];
  const upcoming = await findUpcomingAppointment(userId, c.name, c.phone);
  const parts = [
    `Found exactly one patient: ${c.name}${c.phone ? ` (${c.phone})` : ""}.`,
    c.metadata?.email ? `Email: ${c.metadata.email}.` : "",
    lastCall
      ? `Last contact: ${new Date(lastCall.startedAt).toLocaleDateString()} — ${lastCall.summary?.slice(0, 140) ?? "no summary"}.`
      : "No previous call history.",
    upcoming
      ? `Upcoming appointment: ${new Date(upcoming.startsAt).toLocaleString()}${upcoming.doctor ? ` with ${upcoming.doctor}` : ""} (${upcoming.status}).`
      : "No upcoming appointment on file.",
    upcoming
      ? "Ask whether they want to keep/change that appointment or book a new one."
      : "Ask whether they want to book a new appointment.",
  ].filter(Boolean);
  return parts.join(" ");
}

async function lookupCustomer(
  userId: string,
  args: Record<string, unknown>,
  callerNumber?: string
): Promise<string> {
  const contacts = await listContacts(userId);
  const phone = String(args.phone ?? callerNumber ?? "").trim();
  const name = String(args.name ?? "").trim().toLowerCase();

  let match: Contact | undefined;
  if (phone) {
    const np = normalizePhone(phone);
    if (np.length >= 6) match = contacts.find((c) => normalizePhone(c.phone) === np);
  }
  if (!match && name) {
    match = contacts.find((c) => c.name.toLowerCase() === name) ??
      contacts.find((c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()));
  }
  if (!match) {
    return "No existing record found — treat them as a new customer, and use save_customer to add them.";
  }

  // Last visit = their most recent call in the log.
  const calls = await listCalls(userId);
  const np = normalizePhone(match.phone);
  const lastCall = calls.find((c) => !c.isTest && normalizePhone(c.callerNumber) === np);

  const parts = [
    `Existing customer: ${match.name}`,
    `phone ${match.phone}`,
    match.metadata?.email && `email ${match.metadata.email}`,
    match.category && `category ${match.category}`,
    lastCall &&
      `last contact ${new Date(lastCall.startedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${lastCall.summary ? ` — ${lastCall.summary}` : ""}`,
    match.metadata?.notes && `notes: ${match.metadata.notes}`,
  ].filter(Boolean);
  return parts.join("; ");
}

async function saveCustomer(
  userId: string,
  args: Record<string, unknown>,
  callerNumber?: string
): Promise<string> {
  const name = String(args.name ?? "").trim();
  if (!name) return "A name is required to save the customer.";
  const phone = String(args.phone ?? callerNumber ?? "").trim();
  const email = String(args.email ?? "").trim();
  const notes = String(args.notes ?? "").trim();

  const contacts = await listContacts(userId);
  const np = normalizePhone(phone);
  const existing =
    (np.length >= 6 && contacts.find((c) => normalizePhone(c.phone) === np)) ||
    contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    const metadata = { ...(existing.metadata ?? {}) };
    if (email) metadata.email = email;
    if (notes) metadata.notes = [metadata.notes, notes].filter(Boolean).join(" | ").slice(0, 1000);
    await updateContact(userId, existing.id, {
      name: name || existing.name,
      phone: phone || existing.phone,
      metadata,
    });
    return `Updated ${name}'s record.`;
  }

  await createContact({
    id: newId("ct"),
    userId,
    name,
    phone: phone || "Unknown",
    tag: "customer",
    category: "Customer",
    source: "AI Agent",
    createdAt: new Date().toISOString(),
    metadata: {
      ...(email ? { email } : {}),
      ...(notes ? { notes } : {}),
    },
  });
  return `Saved ${name} as a new customer.`;
}

// Executes agent tools that need server-side work, called BY VAPI mid-call
// (send_email, cal_com). Vapi POSTs a tool-calls message; we run the tool and
// reply with results so the agent can tell the caller what happened.

interface VapiToolCall {
  id: string;
  function?: { name?: string; arguments?: Record<string, unknown> | string };
}

// Resolve a datetime the agent passed — an ISO string ideally, but also
// simple relative words as a safety net ("today", "tomorrow", weekday names).
// Returns an ISO string or null.
function resolveWhen(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  const now = new Date();
  const lower = s.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = 10, minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3] === "pm" && hour < 12) hour += 12;
    if (timeMatch[3] === "am" && hour === 12) hour = 0;
  }
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = days.findIndex((d) => lower.includes(d));
  if (lower.includes("today")) { /* target = today */ }
  else if (lower.includes("tomorrow")) target.setDate(target.getDate() + 1);
  else if (wd >= 0) {
    let diff = (wd - now.getDay() + 7) % 7;
    if (diff === 0 || lower.includes("next")) diff += 7 * (diff === 0 ? 1 : 0);
    if (lower.includes("next") && diff <= 7) diff = ((wd - now.getDay() + 7) % 7) + 7;
    target.setDate(now.getDate() + (diff === 0 ? 7 : diff));
  } else {
    return null; // couldn't resolve
  }
  return target.toISOString();
}

function parseArgs(call: VapiToolCall): Record<string, unknown> {
  const raw = call.function?.arguments;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

export async function POST(request: Request) {
  // Shared-secret check (the tool's server headers carry it).
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-vl-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId") ?? "";
  const toolId = url.searchParams.get("toolId") ?? "";
  const agent = await findAgentAnyUser(agentId);
  // "builtin_calendar" is the always-on appointment tool set — it has no
  // per-agent tool record.
  const tool =
    toolId === "builtin_calendar"
      ? ({ id: toolId, type: "builtin_calendar" } as unknown as NonNullable<Agent["tools"]>[number])
      : agent?.tools?.find((t) => t.id === toolId);
  if (!agent || !tool) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const calls: VapiToolCall[] = body?.message?.toolCalls ?? body?.message?.toolCallList ?? [];
  if (calls.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const callerNumber: string | undefined = body?.message?.call?.customer?.number;

  const results = await Promise.all(
    calls.map(async (call) => {
      const args = parseArgs(call);
      try {
        if (toolId === "builtin_calendar") {
          const fn = call.function?.name ?? "";
          const name = String(args.patient_name ?? args.name ?? "").trim();
          const phone = String(args.phone ?? "").trim() || callerNumber;

          if (fn === "find_patient") {
            const result = await findPatient(agent.userId, String(args.name ?? "").trim(), String(args.phone ?? "").trim());
            return { toolCallId: call.id, result };
          }
          if (fn === "book_appointment") {
            if (!name) {
              return { toolCallId: call.id, result: "ERROR: no patient name. Ask for the patient's name, then call book_appointment again. Do NOT tell the caller it is booked." };
            }
            const when = resolveWhen(String(args.datetime ?? ""));
            if (!when) {
              return { toolCallId: call.id, result: "ERROR: the date/time was not understood. Ask the caller for a specific day and time, compute the absolute date, and call book_appointment again. Do NOT tell the caller it is booked yet." };
            }
            const apt = await bookAppointment(agent.userId, {
              patientName: name,
              phone,
              email: String(args.email ?? "").trim() || undefined,
              doctor: String(args.doctor ?? "").trim() || undefined,
              service: String(args.service ?? "").trim() || undefined,
              startsAt: when,
              notes: String(args.notes ?? "").trim() || undefined,
              source: "call",
            });
            return {
              toolCallId: call.id,
              result: `SUCCESS: appointment booked for ${apt.patientName} on ${new Date(apt.startsAt).toLocaleString()}${apt.doctor ? ` with ${apt.doctor}` : ""}. Read this exact day, date and time back to the caller to confirm.`,
            };
          }
          if (fn === "reschedule_appointment") {
            const when = resolveWhen(String(args.new_datetime ?? ""));
            if (!when) {
              return { toolCallId: call.id, result: "ERROR: ask for a specific new date and time, then call reschedule_appointment again with an absolute date." };
            }
            const existing = await findUpcomingAppointment(agent.userId, name || undefined, phone);
            if (!existing) {
              return { toolCallId: call.id, result: "No existing appointment found for that patient — offer to book a new one." };
            }
            await rescheduleAppointment(agent.userId, existing, when);
            return {
              toolCallId: call.id,
              result: `SUCCESS: appointment moved to ${new Date(when).toLocaleString()} for ${existing.patientName}. Read the new day, date and time back to confirm.`,
            };
          }
          if (fn === "cancel_appointment") {
            const existing = await findUpcomingAppointment(agent.userId, name || undefined, phone);
            if (!existing) {
              return { toolCallId: call.id, result: "No appointment found for that patient." };
            }
            await cancelAppointment(agent.userId, existing);
            return {
              toolCallId: call.id,
              result: `The ${new Date(existing.startsAt).toLocaleString()} appointment for ${existing.patientName} is canceled.`,
            };
          }
          return { toolCallId: call.id, result: "Unknown calendar action." };
        }
        if (tool.type === "customer_memory") {
          const fn = call.function?.name;
          const result =
            fn === "save_customer"
              ? await saveCustomer(agent.userId, args, callerNumber)
              : await lookupCustomer(agent.userId, args, callerNumber);
          return { toolCallId: call.id, result };
        }

        if (tool.type === "knowledge_base") {
          const query = String(args.query ?? args.question ?? "").trim();
          const result = await searchKnowledge(agent, query || "overview");
          return { toolCallId: call.id, result };
        }

        if (tool.type === "send_email") {
          const to = String(args.email ?? "").trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return { toolCallId: call.id, result: "Invalid email address — ask the caller to repeat it." };
          }
          const summary = String(args.summary ?? "");
          const content = (tool.config?.emailContent ?? "Thank you for calling us today.")
            .replaceAll("{{caller_name}}", String(args.name ?? "there"))
            .replaceAll("{{call_summary}}", summary);
          const ok = await sendEmail({
            to,
            subject: tool.config?.emailSubject ?? "Follow-up from our call",
            html: content.replaceAll("\n", "<br/>"),
          });
          return {
            toolCallId: call.id,
            result: ok
              ? `Email sent to ${to}.`
              : "Email sending is not configured on the server (RESEND_API_KEY missing).",
          };
        }

        if (tool.type === "cal_com") {
          const apiKey = tool.config?.calApiKey ?? "";
          const eventTypeId = Number(tool.config?.calEventTypeId ?? 0);
          if (!apiKey || !eventTypeId) {
            return { toolCallId: call.id, result: "Cal.com is not fully configured for this agent." };
          }
          const res = await fetch(`https://api.cal.com/v1/bookings?apiKey=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventTypeId,
              start: String(args.start ?? ""),
              responses: {
                name: String(args.name ?? "Caller"),
                email: String(args.email ?? ""),
              },
              timeZone: "UTC",
              language: "en",
              metadata: {},
            }),
          });
          if (res.ok) {
            return { toolCallId: call.id, result: `Meeting booked for ${args.start}.` };
          }
          const detail = await res.text();
          console.error("Cal.com booking failed:", detail);
          return {
            toolCallId: call.id,
            result: "That time couldn't be booked — offer the caller a different time.",
          };
        }

        return { toolCallId: call.id, result: "This tool has no server action." };
      } catch (e) {
        console.error("Tool execution failed:", { tool: tool.type, fn: call.function?.name, error: e });
        return {
          toolCallId: call.id,
          result: `The action failed (${(e as Error).message.slice(0, 180)}) — apologise, do not claim success, and offer a callback.`,
        };
      }
    })
  );

  return NextResponse.json({ results });
}
