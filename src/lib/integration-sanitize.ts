// Defensive sanitizers for the custom-integration wizard payloads.

import { IntegrationFlowStep, IntegrationVariable } from "./db";

export function sanitizeFlowSteps(input: unknown): IntegrationFlowStep[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const src = s as IntegrationFlowStep;
      const headers: Record<string, string> = {};
      if (src.headers && typeof src.headers === "object") {
        for (const [k, v] of Object.entries(src.headers).slice(0, 15)) {
          if (k) headers[String(k).slice(0, 80)] = String(v).slice(0, 500);
        }
      }
      return {
        id: String(src.id ?? `step_${Math.random().toString(36).slice(2, 10)}`).slice(0, 40),
        method: src.method === "POST" ? ("POST" as const) : ("GET" as const),
        url: String(src.url ?? "").slice(0, 800),
        headers,
        timeoutSec: Math.min(120, Math.max(1, Number(src.timeoutSec) || 20)),
        retryLimit: Math.min(10, Math.max(0, Number(src.retryLimit) || 0)),
        totalTimeoutSec: Math.min(600, Math.max(1, Number(src.totalTimeoutSec) || 60)),
        dependsOn: src.dependsOn ? String(src.dependsOn).slice(0, 40) : undefined,
        successKey: src.successKey ? String(src.successKey).slice(0, 120) : undefined,
        successValue: src.successValue !== undefined ? String(src.successValue).slice(0, 200) : undefined,
      };
    })
    .filter((s) => /^https?:\/\/.+/.test(s.url))
    .slice(0, 10);
}

export function sanitizeVariables(input: unknown): IntegrationVariable[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v) => v && typeof v === "object")
    .map((v) => {
      const src = v as IntegrationVariable;
      return {
        name: String(src.name ?? "").replace(/[^\w.-]/g, "").slice(0, 60),
        jsonPath: String(src.jsonPath ?? "").slice(0, 200),
        sourceType: src.sourceType === "custom" ? ("custom" as const) : ("response" as const),
        sourceStep: src.sourceStep ? String(src.sourceStep).slice(0, 40) : undefined,
        dataType: String(src.dataType ?? "String").slice(0, 20),
        customValue: src.customValue !== undefined ? String(src.customValue).slice(0, 500) : undefined,
      };
    })
    .filter((v) => v.name)
    .slice(0, 30);
}

export function sanitizeRecord(input: unknown, maxEntries = 20): Record<string, string> {
  const out: Record<string, string> = {};
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input).slice(0, maxEntries)) {
      if (k) out[String(k).slice(0, 80)] = String(v).slice(0, 500);
    }
  }
  return out;
}
