import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Campaign, updateCampaign } from "@/lib/db";

const STATUSES: Campaign["status"][] = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "stopped",
  "completed",
  "archived",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Campaign> = { updatedAt: new Date().toISOString() };

  if (STATUSES.includes(body?.status)) patch.status = body.status;
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.description === "string") patch.goal = body.description;

  const campaign = await updateCampaign(session.userId, id, patch);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}
