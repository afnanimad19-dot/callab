// Minimal text chat-completion via OpenRouter's free models, with a fallback
// chain. Used for the text (chat) agent so it can hold a real conversation
// with the agent's identity, tasks, and knowledge — separate from the voice
// pipeline. Returns null if no key is set or every model is unavailable.

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatComplete(
  messages: ChatMsg[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  for (const model of MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts?.temperature ?? 0.5,
          max_tokens: opts?.maxTokens ?? 500,
        }),
      });
      if (!res.ok) continue; // rate-limited / down → next model
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return text.trim();
    } catch {
      // network hiccup → try the next model
    }
  }
  return null;
}
