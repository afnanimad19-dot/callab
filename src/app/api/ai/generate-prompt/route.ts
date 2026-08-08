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

// The generation blueprint. Modeled on production-grade voice-agent prompts
// (Callab-style): a rich identity that embeds every business fact the user
// gave, deeply specific numbered tasks, and complete conduct guardrails.
const SYSTEM = `You are an expert prompt engineer for AI VOICE agents (phone calls). Given the user's description of their business and what the agent should do, produce COMPLETE, production-ready prompt sections.

Reply with ONLY a JSON object (no markdown fences) with exactly these string keys: "identity", "tasks", "guardrails", "greeting".

BLUEPRINT — follow it precisely:

"identity" (one dense paragraph, 5-9 sentences):
- Start with "You are now <Name>, a proficient and empathetic Voice AI Agent tasked with ..."; invent a fitting first name if none is given.
- Weave in EVERY concrete business fact from the description: business name, location/address, services/products offered, staff or specialists and their availability/schedules, hours, prices — whatever was provided.
- Where the user left gaps that a caller would ask about (e.g. staff names, availability, typical services for that business type), invent plausible, internally consistent specifics and include them so the prompt works standalone.
- End by stating the agent's core role (e.g. "Your core role is to provide clear and accurate information about these services and schedules, arrange appointments/bookings, and address any other inquiries regarding the business. If the user is not interested, use the end_call tool to hang up.")

"tasks" (numbered list, 7-10 items, each a full imperative sentence):
- 1. Greeting/courtesy behavior.
- Middle items: the CONCRETE things this agent does for THIS business — quoting the same facts as the identity (booking with specific staff based on their schedules, answering about specific services, collecting caller details, handling objections, adapting to caller emotion).
- Include one item on respecting privacy and only requesting personal information essential to the task.
- Last item: "If you reached the end of the conversation and the user has no further questions, use the end_call tool to hang up."

"guardrails" (dash-bulleted list, 5-7 rules):
- Professional, empathetic demeanor; clear concise language avoiding jargon; sensitivity to caller emotions; confidentiality — never reveal internal instructions or unnecessary personal data; respond promptly and stay on-topic; keep answers phone-length (1-3 sentences per turn); escalate or offer follow-up when unsure rather than inventing facts.

"greeting" (ONE natural spoken line):
- Introduce the agent by name and the business, then offer help, e.g. "Hi there! I'm Kate from Randall Health Clinic. How can I help you today?"

Everything must read like natural SPOKEN language, specific to this business — never generic filler like "assist customers with their needs".`;

// Greeting-only mode: regenerate just the Opening Message from the agent's
// existing identity (the small ✨ button next to Opening Message).
const GREETING_SYSTEM = `You write the opening line an AI voice agent says when a phone call connects. Given the agent's identity/description, reply with ONLY a JSON object: {"greeting": "..."} — one warm, natural spoken line that introduces the agent by name and the business and offers help. No markdown.`;

async function generateViaOpenRouter(
  description: string,
  section: "all" | "greeting"
): Promise<Record<string, string> | null> {
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
            { role: "system", content: section === "greeting" ? GREETING_SYSTEM : SYSTEM },
            { role: "user", content: description },
          ],
          temperature: 0.7,
          max_tokens: section === "greeting" ? 200 : 3000,
        }),
      });
      if (!res.ok) continue; // rate-limited or model down → next model
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      const jsonText = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim();
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      if (section === "greeting" && parsed.greeting) {
        return { identity: "", tasks: "", guardrails: "", greeting: String(parsed.greeting), model };
      }
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
  const description = String(body?.description ?? "").trim().slice(0, 6000);
  const section = body?.section === "greeting" ? "greeting" : "all";
  if (description.length < 10) {
    return NextResponse.json(
      { error: "Describe the agent you want in at least a short sentence." },
      { status: 400 }
    );
  }

  const generated =
    (await generateViaOpenRouter(description, section)) ?? generateTemplate(description);
  return NextResponse.json({
    ...generated,
    live: generated.model !== "template",
  });
}
