// Minimal text chat-completion via OpenRouter's free models, with a fallback
// chain. Used for the text (chat) agent so it can hold a real conversation
// with the agent's identity, tasks, and knowledge — separate from the voice
// pipeline. Returns null if no key is set or every model is unavailable.

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

// The reason the last completion attempt failed (HTTP status/body or network),
// so callers can surface "rate limited" vs "bad key" instead of a blank null.
let _lastError = "";
export function lastLLMError(): string {
  return _lastError;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Like chatComplete but returns the raw assistant turn so the caller can run a
// tool-calling loop (content plus any tool_calls the model requested).
export async function chatCompleteRaw(
  messages: ChatMsg[],
  tools?: LLMTool[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string | null; toolCalls: ToolCall[] } | null> {
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
          ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
          temperature: opts?.temperature ?? 0.5,
          max_tokens: opts?.maxTokens ?? 600,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) continue;
      const toolCalls: ToolCall[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      const content: string | null = typeof msg.content === "string" ? msg.content : null;
      if (content || toolCalls.length) return { content, toolCalls };
    } catch {
      // next model
    }
  }
  return null;
}

export async function chatComplete(
  messages: ChatMsg[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) { _lastError = "OPENROUTER_API_KEY not set"; return null; }
  _lastError = "";
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
      if (!res.ok) {
        _lastError = `${model} → HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 140)}`;
        continue; // rate-limited / down → next model
      }
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return text.trim();
      _lastError = `${model} → empty response`;
    } catch (e) {
      _lastError = `${model} → ${(e as Error).message.slice(0, 120)}`;
    }
  }
  return null;
}
