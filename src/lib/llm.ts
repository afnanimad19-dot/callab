// Chat LLM for the TEXT (chat) agent only — voice runs entirely on Vapi.
// Uses Qwen (Alibaba DashScope / Model Studio), which is OpenAI-compatible.
// Configure:
//   QWEN_API_KEY (or DASHSCOPE_API_KEY) – required
//   QWEN_MODEL     – optional, default "qwen3.7-plus" (e.g. qwen-plus, qwen-max)
//   QWEN_BASE_URL  – optional, default the international Model Studio endpoint;
//                    set to the China endpoint if your key is region-locked.
// We send enable_thinking:false so a "thinking" model returns a direct final
// answer in a normal (non-streaming) call — exactly what a chat reply needs.

const DEFAULT_BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3.7-plus";

function chatEndpoint(): string {
  const base = (process.env.QWEN_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  return `${base}/chat/completions`;
}
function chatModel(): string {
  return process.env.QWEN_MODEL || DEFAULT_MODEL;
}
function chatKey(): string | undefined {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
}

export function chatEngineConfigured(): boolean {
  return Boolean(chatKey());
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
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// The reason the last completion attempt failed (HTTP status/body or network),
// so callers can surface "rate limited" / "bad key" instead of a blank null.
let _lastError = "";
export function lastLLMError(): string {
  return _lastError;
}

export async function chatComplete(
  messages: ChatMsg[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const key = chatKey();
  if (!key) { _lastError = "QWEN_API_KEY not set"; return null; }
  _lastError = "";
  try {
    const res = await fetch(chatEndpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel(),
        messages,
        enable_thinking: false,
        temperature: opts?.temperature ?? 0.5,
        max_tokens: opts?.maxTokens ?? 600,
      }),
    });
    if (!res.ok) {
      _lastError = `${chatModel()} → HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`;
      return null;
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    if (text.trim()) return text.trim();
    _lastError = `${chatModel()} → empty response`;
    return null;
  } catch (e) {
    _lastError = `${chatModel()} → ${(e as Error).message.slice(0, 140)}`;
    return null;
  }
}

// Native tool-calling variant (kept for completeness; the chat agent uses a
// text-command protocol so it works even where tools aren't supported).
export async function chatCompleteRaw(
  messages: ChatMsg[],
  tools?: LLMTool[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string | null; toolCalls: ToolCall[] } | null> {
  const key = chatKey();
  if (!key) { _lastError = "QWEN_API_KEY not set"; return null; }
  _lastError = "";
  try {
    const res = await fetch(chatEndpoint(), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel(),
        messages,
        enable_thinking: false,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
        temperature: opts?.temperature ?? 0.5,
        max_tokens: opts?.maxTokens ?? 600,
      }),
    });
    if (!res.ok) {
      _lastError = `${chatModel()} → HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`;
      return null;
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return null;
    const toolCalls: ToolCall[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    const content: string | null = typeof msg.content === "string" ? msg.content : null;
    if (content || toolCalls.length) return { content, toolCalls };
    return null;
  } catch (e) {
    _lastError = `${chatModel()} → ${(e as Error).message.slice(0, 140)}`;
    return null;
  }
}
