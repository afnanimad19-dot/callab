// Executes a custom integration's flow server-side: runs each step's HTTP
// request (with {{variable}} substitution), extracts variables from the
// responses, and — on a full run — imports contacts through the field
// mapping. This is what Start / Execute / Test Flow actually do.

import { Integration, createContact, listContacts, newId } from "./db";

type Json = unknown;

function getPath(obj: Json, path: string): Json {
  if (!path) return obj;
  let cur: Json = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, Json>)[part];
  }
  return cur;
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? "");
}

export interface FlowResult {
  ok: boolean;
  message: string;
  result: Json;
  imported?: number;
}

export async function runIntegrationFlow(
  integration: Integration,
  options: { importContacts: boolean }
): Promise<FlowResult> {
  const vars: Record<string, string> = { ...(integration.predefinedVariables ?? {}) };
  for (const v of integration.variables ?? []) {
    if (v.sourceType === "custom" && v.customValue) vars[v.name] = v.customValue;
  }

  const steps = integration.flowSteps ?? [];
  if (steps.length === 0) {
    return { ok: false, message: "No flow steps configured.", result: null };
  }

  const responses: Record<string, Json> = {};
  let lastResponse: Json = null;

  for (const step of steps) {
    if (step.dependsOn && !(step.dependsOn in responses)) {
      return { ok: false, message: `Step depends on a step that hasn't succeeded.`, result: lastResponse };
    }
    const url = substitute(step.url, vars);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(step.headers ?? {})) headers[k] = substitute(v, vars);

    let attempt = 0;
    let stepOk = false;
    let parsed: Json = null;
    const maxAttempts = Math.max(1, (step.retryLimit || 0) + 1);
    while (attempt < maxAttempts && !stepOk) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), (step.timeoutSec || 20) * 1000);
        const res = await fetch(url, {
          method: step.method,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Optional success condition
        if (step.successKey) {
          const actual = getPath(parsed, step.successKey);
          if (String(actual) !== String(step.successValue ?? "")) {
            throw new Error(`Success condition failed: ${step.successKey}=${String(actual)}`);
          }
        }
        stepOk = true;
      } catch (e) {
        if (attempt >= maxAttempts) {
          return {
            ok: false,
            message: `Step "${step.method} ${url.slice(0, 80)}" failed: ${(e as Error).message}`,
            result: parsed,
          };
        }
      }
    }

    responses[step.id] = parsed;
    lastResponse = parsed;

    // Extract response-sourced variables tied to this step.
    for (const v of integration.variables ?? []) {
      if (v.sourceType === "response" && (v.sourceStep === step.id || !v.sourceStep)) {
        const value = getPath(parsed, v.jsonPath);
        if (value !== undefined) vars[v.name] = typeof value === "string" ? value : JSON.stringify(value);
      }
    }
  }

  // The overall result: the "results" variable if defined, else the last response.
  const resultsVar = (integration.variables ?? []).find((v) => v.name === "results");
  const result = resultsVar ? getPath(lastResponse, resultsVar.jsonPath) ?? lastResponse : lastResponse;

  // Contact import via field mapping (Execute / Start runs only).
  let imported = 0;
  if (options.importContacts && integration.mapping && Object.keys(integration.mapping).length > 0) {
    const rows = Array.isArray(result)
      ? result
      : Array.isArray(getPath(result, "data"))
        ? (getPath(result, "data") as Json[])
        : Array.isArray(getPath(result, "results"))
          ? (getPath(result, "results") as Json[])
          : [];
    const existing = await listContacts(integration.userId);
    const seen = new Set(existing.map((c) => c.phone.replace(/[^\d]/g, "").slice(-9)));
    for (const row of rows.slice(0, 500)) {
      const name = String(getPath(row, integration.mapping.name ?? "") ?? "").trim();
      const phone = String(getPath(row, integration.mapping.phone ?? "") ?? "").trim();
      if (!name || !phone) continue;
      const key = phone.replace(/[^\d]/g, "").slice(-9);
      if (seen.has(key)) continue;
      seen.add(key);
      await createContact({
        id: newId("ct"),
        userId: integration.userId,
        name,
        phone,
        tag: String(getPath(row, integration.mapping.tag ?? "") ?? integration.tag ?? "imported").trim() || "imported",
        category: String(getPath(row, integration.mapping.category ?? "") ?? "").trim() || undefined,
        source: "Integration",
        createdAt: new Date().toISOString(),
      });
      imported++;
    }
  }

  return {
    ok: true,
    message: options.importContacts
      ? `Flow completed — ${imported} contact${imported === 1 ? "" : "s"} imported.`
      : "Flow completed successfully.",
    result,
    imported,
  };
}
