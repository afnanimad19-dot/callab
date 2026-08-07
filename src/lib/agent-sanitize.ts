// Defensive sanitizers for the agent editor's structured fields — a bad
// payload should degrade to defaults, never crash or store junk shapes.

import { Agent, AgentOutcome, AgentTool, DEFAULT_ADVANCED } from "./db";

export function sanitizeOutcomes(input: unknown): AgentOutcome[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((o) => o && typeof o === "object")
    .map((o) => ({
      name: String((o as AgentOutcome).name ?? "").slice(0, 80),
      description: String((o as AgentOutcome).description ?? "").slice(0, 300),
      possibleValues: Array.isArray((o as AgentOutcome).possibleValues)
        ? (o as AgentOutcome).possibleValues!.map((v) => String(v).slice(0, 60)).filter(Boolean).slice(0, 20)
        : undefined,
    }))
    .filter((o) => o.name || o.description)
    .slice(0, 20);
}

export function sanitizeTools(input: unknown): AgentTool[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const src = t as AgentTool;
      return {
        id: String(src.id ?? `tool_${Math.random().toString(36).slice(2, 10)}`).slice(0, 40),
        title: String(src.title ?? "").slice(0, 80),
        name: String(src.name ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .slice(0, 60),
        description: String(src.description ?? "").slice(0, 300),
        aiResponse: String(src.aiResponse ?? "").slice(0, 300),
      };
    })
    .filter((t) => t.title && t.name)
    .slice(0, 15);
}

export function sanitizeAdvanced(input: unknown): Agent["advanced"] {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_ADVANCED };
  for (const key of Object.keys(DEFAULT_ADVANCED) as (keyof typeof DEFAULT_ADVANCED)[]) {
    const v = src[key];
    const def = DEFAULT_ADVANCED[key];
    if (typeof def === "number" && typeof v === "number" && Number.isFinite(v)) {
      (out as Record<string, unknown>)[key] = v;
    } else if (typeof def === "boolean" && typeof v === "boolean") {
      (out as Record<string, unknown>)[key] = v;
    } else if (typeof def === "string" && typeof v === "string") {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
