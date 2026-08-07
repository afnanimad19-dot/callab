import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Campaign, CampaignSchedule, findAgent, updateCampaign } from "@/lib/db";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sanitizeSchedule(input: unknown): CampaignSchedule {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    startDate: String(src.startDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    endDate: String(src.endDate ?? "").slice(0, 10),
    from: String(src.from ?? "09:00").slice(0, 5),
    to: String(src.to ?? "17:00").slice(0, 5),
    days: Array.isArray(src.days)
      ? src.days.map(String).filter((d) => DAYS.includes(d))
      : ["Mon", "Tue", "Wed", "Thu", "Fri"],
    timezone: String(src.timezone ?? "UTC").slice(0, 40),
    retryAttempts: Boolean(src.retryAttempts),
  };
}

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
  if (typeof body?.phoneNumber === "string") patch.phoneNumber = body.phoneNumber.slice(0, 30);
  if (body?.schedule && typeof body.schedule === "object") {
    patch.schedule = sanitizeSchedule(body.schedule);
  }
  if (body?.filters && typeof body.filters === "object") {
    patch.filters = {
      sources: Array.isArray(body.filters.sources) ? body.filters.sources.map(String).slice(0, 20) : [],
      tags: Array.isArray(body.filters.tags) ? body.filters.tags.map(String).slice(0, 20) : [],
      categories: Array.isArray(body.filters.categories) ? body.filters.categories.map(String).slice(0, 20) : [],
    };
  }
  if (typeof body?.agentId === "string" && body.agentId) {
    const agent = await findAgent(session.userId, body.agentId);
    if (agent) {
      patch.agentId = agent.id;
      patch.agentName = agent.name;
    }
  }

  const campaign = await updateCampaign(session.userId, id, patch);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}
