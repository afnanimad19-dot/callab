import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sanitizeFlow, newFlowId, ConversationFlow } from "@/lib/flow";

// Generate a conversation flow (nodes + edges) from a plain-language
// description, via OpenRouter free models with a deterministic fallback.

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];

const SYSTEM = `You design conversation flows for AI voice agents. Given a description of a business and what the call should do, reply with ONLY a JSON object:
{"nodes":[{"id":"n1","type":"start|prompt|webhook|transfer|end","label":"...","data":{...}}],"edges":[{"from":"n1","to":"n2","label":"short condition label","condition":"natural language condition"}]}
Rules:
- Exactly one "start" node with data: {"openingMessage":"the greeting line","goal":"call goal"}.
- 2-5 "prompt" nodes with data {"goal":"detailed instructions for this step"}.
- End with one "end" node with data {"closingMessage":"goodbye line"}.
- Add a "transfer" node (data {"transferType":"number","destination":"+15550100","message":"hold message"}) only if the description mentions transferring to a human.
- Keep ids short (n1, n2...). Every node except start must be reachable via edges. No markdown.`;

function fallbackFlow(brief: string): ConversationFlow {
  const start = newFlowId("node");
  const qualify = newFlowId("node");
  const help = newFlowId("node");
  const end = newFlowId("node");
  return {
    nodes: [
      {
        id: start, type: "start", label: "Start Call", x: 520, y: 100,
        data: {
          openingMessage: "Hello! Thank you for calling. How can I help you today?",
          goal: brief.slice(0, 300) || "Greet the caller and find out what they need.",
        },
      },
      {
        id: qualify, type: "prompt", label: "Understand Need", x: 620, y: 320,
        data: { goal: "Ask questions to understand exactly what the caller needs. Collect their name and reason for calling." },
      },
      {
        id: help, type: "prompt", label: "Assist Caller", x: 720, y: 540,
        data: { goal: "Help the caller with their request based on the business context. Answer questions clearly and confirm next steps." },
      },
      {
        id: end, type: "end", label: "Wrap Up", x: 820, y: 760,
        data: { closingMessage: "Thank you for calling! Have a great day. Goodbye!" },
      },
    ],
    edges: [
      { id: newFlowId("edge"), from: start, to: qualify, label: "Caller responds", transitionType: "nl", condition: "The caller has said why they are calling", backTransitionType: "always" },
      { id: newFlowId("edge"), from: qualify, to: help, label: "Need understood", transitionType: "nl", condition: "You understand what the caller needs", backTransitionType: "always" },
      { id: newFlowId("edge"), from: help, to: end, label: "Request handled", transitionType: "nl", condition: "The caller's request is handled and they have nothing else", backTransitionType: "always" },
    ],
    globalTools: [],
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const brief = String(body?.brief ?? "").slice(0, 3000);
  if (!brief.trim()) {
    return NextResponse.json({ error: "Describe what the flow should do first." }, { status: 400 });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    for (const model of MODELS) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: brief },
            ],
            temperature: 0.6,
            max_tokens: 4000,
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text: string = data?.choices?.[0]?.message?.content ?? "";
        const match = text.replace(/^```(json)?/m, "").replace(/```$/m, "").match(/\{[\s\S]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]) as { nodes?: unknown[]; edges?: { from?: string; to?: string; label?: string; condition?: string }[] };
        if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 2) continue;
        // Lay the generated nodes out in a cascade and normalize shapes.
        const nodes = (parsed.nodes as ConversationFlow["nodes"]).map((n, i) => ({
          ...n,
          x: 480 + i * 110,
          y: 100 + i * 220,
        }));
        const edges = (parsed.edges ?? []).map((e) => ({
          id: newFlowId("edge"),
          from: String(e.from ?? ""),
          to: String(e.to ?? ""),
          label: String(e.label ?? ""),
          transitionType: "nl" as const,
          condition: String(e.condition ?? e.label ?? ""),
          backTransitionType: "always" as const,
        }));
        const flow = sanitizeFlow({ nodes, edges, globalTools: [] });
        if (flow && flow.nodes.some((n) => n.type === "start")) {
          return NextResponse.json({ flow, live: true, model });
        }
      } catch {
        continue;
      }
    }
  }

  return NextResponse.json({ flow: fallbackFlow(brief), live: false });
}
