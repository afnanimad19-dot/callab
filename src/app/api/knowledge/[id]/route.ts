import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteKnowledgeBase, updateKnowledgeBase, KnowledgeBase } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Partial<KnowledgeBase> = { updatedAt: new Date().toISOString() };
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body?.url === "string") patch.url = body.url.slice(0, 500);
  if (typeof body?.content === "string") patch.content = body.content.slice(0, 20000);
  if (typeof body?.autoUpdate === "boolean") patch.autoUpdate = body.autoUpdate;
  if (typeof body?.crawl === "boolean") patch.crawl = body.crawl;
  if (typeof body?.multipleUrls === "boolean") patch.multipleUrls = body.multipleUrls;

  const updated = await updateKnowledgeBase(session.userId, id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ knowledgeBase: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const removed = await deleteKnowledgeBase(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
