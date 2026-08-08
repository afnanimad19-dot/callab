import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createIntegration, newId } from "@/lib/db";
import { sanitizeFlowSteps, sanitizeVariables, sanitizeRecord } from "@/lib/integration-sanitize";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Integration name is required." }, { status: 400 });
  }
  const flowSteps = sanitizeFlowSteps(body?.flowSteps);
  if (flowSteps.length === 0) {
    return NextResponse.json({ error: "Add at least one flow step with a valid URL." }, { status: 400 });
  }

  const integration = await createIntegration({
    id: newId("int"),
    userId: session.userId,
    name,
    tag: String(body?.tag ?? "").trim().slice(0, 40),
    category: String(body?.category ?? "").trim().slice(0, 40),
    intervalSeconds: Math.min(Math.max(Number(body?.intervalSeconds) || 20, 5), 86400),
    steps: [],
    status: "idle",
    createdAt: new Date().toISOString(),
    retryUnit: ["Seconds", "Minutes", "Hours"].includes(body?.retryUnit) ? body.retryUnit : "Seconds",
    maxRetries: Math.min(10, Math.max(0, Number(body?.maxRetries) || 3)),
    predefinedVariables: sanitizeRecord(body?.predefinedVariables),
    flowSteps,
    variables: sanitizeVariables(body?.variables),
    mapping: sanitizeRecord(body?.mapping, 10),
    runs: [],
  });
  return NextResponse.json({ integration }, { status: 201 });
}
