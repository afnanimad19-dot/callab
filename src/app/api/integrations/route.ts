import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createIntegration, newId } from "@/lib/db";
import { sanitizeSteps } from "@/lib/webhook-sanitize";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Integration name is required." }, { status: 400 });
  }
  const steps = sanitizeSteps(body?.steps);
  if (steps.length === 0) {
    return NextResponse.json({ error: "Add at least one step." }, { status: 400 });
  }

  const integration = await createIntegration({
    id: newId("int"),
    userId: session.userId,
    name,
    tag: String(body?.tag ?? "").trim().slice(0, 40),
    category: String(body?.category ?? "").trim().slice(0, 40),
    intervalSeconds: Math.min(Math.max(Number(body?.intervalSeconds) || 60, 10), 86400),
    steps,
    status: "idle",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ integration }, { status: 201 });
}
