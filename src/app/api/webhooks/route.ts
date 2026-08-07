import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createWebhook, newId, WebhookVariable } from "@/lib/db";
import { sanitizeSteps } from "@/lib/webhook-sanitize";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = String(body?.url ?? "").trim();
  if (!/^https:\/\/.+/.test(url)) {
    return NextResponse.json({ error: "Enter a valid https:// URL." }, { status: 400 });
  }

  const variables: WebhookVariable[] = Array.isArray(body?.variables)
    ? body.variables
        .filter((v: unknown) => v && typeof v === "object")
        .map((v: Record<string, unknown>) => ({
          name: String(v.name ?? "").slice(0, 60),
          jsonPath: String(v.jsonPath ?? "").slice(0, 120),
          sourceType: v.sourceType === "static" ? "static" : "response",
          dataType: ["number", "boolean"].includes(String(v.dataType))
            ? (String(v.dataType) as "number" | "boolean")
            : "string",
          value: String(v.value ?? "").slice(0, 200),
        }))
        .filter((v: WebhookVariable) => v.name)
        .slice(0, 20)
    : [];

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
    steps: sanitizeSteps(body?.steps),
    variables,
  });
  return NextResponse.json({ webhook }, { status: 201 });
}
