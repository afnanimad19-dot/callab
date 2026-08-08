import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteKnowledgeBase, updateKnowledgeBase, KnowledgeBase } from "@/lib/db";
import { fetchWebsiteText } from "@/lib/web-content";

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
  if (typeof body?.url === "string") {
    const url = body.url.slice(0, 500);
    patch.url = url;
    // Re-read the website whenever the URL is (re)saved so the indexed
    // content stays in sync with the link.
    if (/^https?:\/\/.+/.test(url)) {
      const fetched = await fetchWebsiteText(url, { crawl: Boolean(body?.crawl) });
      if (fetched) {
        patch.content = fetched.content;
        patch.docsCount = Math.max(1, fetched.pages);
        patch.description = `Website content (${fetched.pages} page${fetched.pages === 1 ? "" : "s"} indexed)`;
      }
    }
  }
  if (typeof body?.content === "string" && patch.content === undefined) {
    patch.content = body.content.slice(0, 60000);
  }
  if (typeof body?.fileName === "string") patch.fileName = body.fileName.slice(0, 200) || undefined;
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
