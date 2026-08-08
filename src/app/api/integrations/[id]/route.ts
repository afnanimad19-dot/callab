import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteIntegration, listIntegrations, updateIntegration, Integration } from "@/lib/db";
import { runIntegrationFlow } from "@/lib/integration-run";
import { sanitizeFlowSteps, sanitizeVariables, sanitizeRecord } from "@/lib/integration-sanitize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const integration = (await listIntegrations(session.userId)).find((i) => i.id === id);
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Test Flow: execute without importing, return the raw result.
  if (body?.test === true) {
    const result = await runIntegrationFlow(integration, { importContacts: false });
    const runs = [
      { at: new Date().toISOString(), status: result.ok ? ("success" as const) : ("failed" as const), message: `Test: ${result.message}` },
      ...(integration.runs ?? []),
    ].slice(0, 20);
    await updateIntegration(session.userId, id, { runs });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  // Execute / Start: run the flow for real (imports contacts via mapping).
  if (body?.run === true) {
    const result = await runIntegrationFlow(integration, { importContacts: true });
    const runs = [
      { at: new Date().toISOString(), status: result.ok ? ("success" as const) : ("failed" as const), message: result.message },
      ...(integration.runs ?? []),
    ].slice(0, 20);
    const updated = await updateIntegration(session.userId, id, {
      lastRunAt: new Date().toISOString(),
      status: result.ok ? "success" : "failed",
      runs,
    });
    return NextResponse.json({ integration: updated, ...result }, { status: result.ok ? 200 : 502 });
  }

  const patch: Partial<Integration> = {};
  if (["idle", "running", "failed", "success", "stopped"].includes(body?.status)) {
    patch.status = body.status;
  }
  // Full edit from the wizard.
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.tag === "string") patch.tag = body.tag.trim().slice(0, 40);
  if (typeof body?.category === "string") patch.category = body.category.trim().slice(0, 40);
  if (body?.intervalSeconds !== undefined) {
    patch.intervalSeconds = Math.min(Math.max(Number(body.intervalSeconds) || 20, 5), 86400);
  }
  if (["Seconds", "Minutes", "Hours"].includes(body?.retryUnit)) patch.retryUnit = body.retryUnit;
  if (body?.maxRetries !== undefined) patch.maxRetries = Math.min(10, Math.max(0, Number(body.maxRetries) || 0));
  if (body?.predefinedVariables !== undefined) patch.predefinedVariables = sanitizeRecord(body.predefinedVariables);
  if (body?.flowSteps !== undefined) {
    const steps = sanitizeFlowSteps(body.flowSteps);
    if (steps.length === 0) {
      return NextResponse.json({ error: "Add at least one flow step with a valid URL." }, { status: 400 });
    }
    patch.flowSteps = steps;
  }
  if (body?.variables !== undefined) patch.variables = sanitizeVariables(body.variables);
  if (body?.mapping !== undefined) patch.mapping = sanitizeRecord(body.mapping, 10);

  const updated = await updateIntegration(session.userId, id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ integration: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deleteIntegration(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
