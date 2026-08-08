import { NextResponse } from "next/server";
import {
  findAgentAnyUser,
  listContacts,
  createContact,
  updateContact,
  listCalls,
  newId,
  Contact,
} from "@/lib/db";
import { sendEmail } from "@/lib/email";

const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").slice(-9);

// Customer memory: recognise returning callers from OUR contacts + call
// history, and remember new ones — the workspace's own CRM, no external
// system needed.
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
  const tool = agent?.tools?.find((t) => t.id === toolId);
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
        if (tool.type === "customer_memory") {
          const fn = call.function?.name;
          const result =
            fn === "save_customer"
              ? await saveCustomer(agent.userId, args, callerNumber)
              : await lookupCustomer(agent.userId, args, callerNumber);
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
        console.error("Tool execution failed:", e);
        return { toolCallId: call.id, result: "The action failed — apologise and offer a follow-up." };
      }
    })
  );

  return NextResponse.json({ results });
}
