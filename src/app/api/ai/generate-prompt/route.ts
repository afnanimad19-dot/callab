import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// "Generate Prompt Sections": describe the agent you want and get back the
// Agent Identity / Tasks / Style Guardrails sections, Callab-style.
//
// Uses OpenRouter (set OPENROUTER_API_KEY) with a fallback chain of models —
// if one is rate-limited or down, the next takes over. With no key, a solid
// template generator keeps the feature working.

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

const SYSTEM = `You write prompt sections for AI voice agents. Given a description of the agent a user wants, reply with ONLY a JSON object (no markdown fences) with exactly these string keys:
- "identity": 2-4 sentences defining who the agent is, its personality, tone, and role. Start with "You are ...".
- "tasks": a numbered list (1., 2., ...) of 6-9 specific tasks/goals/actions the agent performs.
- "guardrails": a dash-bulleted list of 4-6 style/conduct rules (tone, privacy, brevity, escalation).
- "greeting": one short, natural opening line the agent says when the call starts.
Write for spoken conversation: natural, concise, professional.`;

async function generateViaOpenRouter(description: string): Promise<Record<string, string> | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  for (const model of MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: description },
          ],
          temperature: 0.7,
          max_tokens: 1200,
        }),
      });
      if (!res.ok) continue; // rate-limited or model down → next model
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      const jsonText = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim();
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      if (parsed.identity && parsed.tasks) {
        return {
          identity: String(parsed.identity),
          tasks: String(parsed.tasks),
          guardrails: String(parsed.guardrails ?? ""),
          greeting: String(parsed.greeting ?? ""),
          model,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Keeps the feature usable before OPENROUTER_API_KEY is configured.
function generateTemplate(description: string): Record<string, string> {
  const clean = description.trim().replace(/\s+/g, " ");
  return {
    identity: `You are a proficient and empathetic AI voice agent for the following business: ${clean}. You speak naturally and professionally, keep answers concise for a phone conversation, and always stay helpful, patient, and on-topic.`,
    tasks: `1. Greet callers courteously and identify how you can help.
2. Answer questions about the business accurately: ${clean}.
3. Collect the caller's name, contact details, and reason for calling when relevant.
4. Assist with bookings, appointments, or orders where applicable.
5. Adjust your responses to the caller's emotions and needs.
6. Escalate to a human teammate when the caller asks or when you cannot help.
7. Summarize agreed next steps before the call ends.
8. If the conversation is finished and the caller has no further questions, use the end_call tool to hang up.`,
    guardrails: `- Maintain a professional, warm demeanor that conveys empathy and understanding.
- Use clear, concise language and avoid unnecessary jargon.
- Never invent facts — if you don't know, say so and offer to follow up.
- Respect caller privacy; only request personal details essential to the task.
- Keep responses short and conversational — this is a phone call, not an essay.`,
    greeting: "Hi there! Thanks for calling — how can I help you today?",
    model: "template",
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const description = String(body?.description ?? "").trim().slice(0, 2000);
  if (description.length < 10) {
    return NextResponse.json(
      { error: "Describe the agent you want in at least a short sentence." },
      { status: 400 }
    );
  }

  const generated = (await generateViaOpenRouter(description)) ?? generateTemplate(description);
  return NextResponse.json({
    ...generated,
    live: generated.model !== "template",
  });
}
