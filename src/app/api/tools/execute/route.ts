import { NextResponse } from "next/server";
import { findAgentAnyUser } from "@/lib/db";
import { sendEmail } from "@/lib/email";

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

  const results = await Promise.all(
    calls.map(async (call) => {
      const args = parseArgs(call);
      try {
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
