// Defensive sanitizers for the agent editor's structured fields — a bad
// payload should degrade to defaults, never crash or store junk shapes.

import { Agent, AgentOutcome, DEFAULT_ADVANCED } from "./db";

export function sanitizeOutcomes(input: unknown): AgentOutcome[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((o) => o && typeof o === "object")
    .map((o) => ({
      name: String((o as AgentOutcome).name ?? "").slice(0, 80),
      description: String((o as AgentOutcome).description ?? "").slice(0, 300),
    }))
    .filter((o) => o.name || o.description)
    .slice(0, 20);
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
