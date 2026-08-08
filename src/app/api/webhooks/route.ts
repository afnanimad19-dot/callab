import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createWebhook, newId, WebhookStep, WebhookVariable } from "@/lib/db";
import { sanitizeSteps } from "@/lib/webhook-sanitize";
import { sanitizeRecord } from "@/lib/integration-sanitize";

function parseVariables(input: unknown): WebhookVariable[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v: unknown) => v && typeof v === "object")
    .map((v: Record<string, unknown>) => ({
      name: String(v.name ?? "").slice(0, 60),
      jsonPath: String(v.jsonPath ?? "").slice(0, 120),
      sourceType: (v.sourceType === "static" ? "static" : "response") as WebhookVariable["sourceType"],
      sourceStep: v.sourceStep ? String(v.sourceStep).slice(0, 80) : undefined,
      dataType: (["number", "boolean"].includes(String(v.dataType))
        ? String(v.dataType)
        : "string") as WebhookVariable["dataType"],
      value: String(v.value ?? "").slice(0, 200),
    }))
    .filter((v: WebhookVariable) => v.name)
    .slice(0, 20);
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? "");
}

// Runs the webhook's steps in order (used by Test Flow) and returns each
// step's status without persisting anything.
async function testSteps(steps: WebhookStep[], vars: Record<string, string>) {
  const results: { name: string; method: string; url: string; ok: boolean; status: number | string }[] = [];
  for (const step of steps) {
    const url = substitute(step.url, vars);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { method: step.method, signal: controller.signal });
      clearTimeout(timer);
      results.push({ name: step.name || url, method: step.method, url, ok: res.ok, status: res.status });
      if (!res.ok) break;
    } catch (e) {
      results.push({ name: step.name || url, method: step.method, url, ok: false, status: (e as Error).message });
      break;
    }
  }
  return results;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const steps = sanitizeSteps(body?.steps).filter((s) => /^https:\/\/.+/.test(s.url));
  const predefinedVariables = sanitizeRecord(body?.predefinedVariables);

  // Test Flow: execute the steps without saving anything.
  if (body?.test === true) {
    if (steps.length === 0) {
      return NextResponse.json({ error: "Add at least one step with a valid https:// URL to test." }, { status: 400 });
    }
    const vars = { ...predefinedVariables };
    for (const v of parseVariables(body?.variables)) {
      if (v.sourceType === "static" && v.value) vars[v.name] = v.value;
    }
    const results = await testSteps(steps, vars);
    const ok = results.every((r) => r.ok);
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
  }

  // The webhook's endpoint URL comes from the first step (Callab-style builder)
  // or from an explicit top-level url (legacy payloads).
  const url = String(body?.url ?? "").trim() || steps[0]?.url || "";
  if (!/^https:\/\/.+/.test(url)) {
    return NextResponse.json({ error: "Add at least one step with a valid https:// URL." }, { status: 400 });
  }

  const webhook = await createWebhook({
    id: newId("wbh"),
    userId: session.userId,
    url,
    events:
      Array.isArray(body?.events) && body.events.length
        ? body.events.map(String).slice(0, 10)
        : ["call.started", "call.ended"],
    active: true,
    createdAt: new Date().toISOString(),
    name: String(body?.name ?? "").trim() || "Custom webhook",
    steps,
    variables: parseVariables(body?.variables),
    predefinedVariables,
  });
  return NextResponse.json({ webhook }, { status: 201 });
}
