import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteIntegration, updateIntegration, Integration } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Integration> = {};
  if (["idle", "running", "failed", "success"].includes(body?.status)) {
    patch.status = body.status;
  }
  // "Execute" marks a manual run. Real step execution (calling each step's
  // URL with variable mapping) activates alongside live call events.
  if (body?.run === true) {
    patch.lastRunAt = new Date().toISOString();
    patch.status = "success";
  }
  const integration = await updateIntegration(session.userId, id, patch);
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ integration });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deleteIntegration(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
