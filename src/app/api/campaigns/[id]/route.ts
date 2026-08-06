import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateCampaign } from "@/lib/db";

// When Vapi is configured, setting a campaign to "running" is where outbound
// calls kick off via startOutboundCall() over the contact list (see lib/vapi.ts).

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const status = String(body?.status ?? "");
  if (!["draft", "running", "paused", "completed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const campaign = await updateCampaign(session.userId, id, {
    status: status as "draft" | "running" | "paused" | "completed",
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}
