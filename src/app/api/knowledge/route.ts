import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createKnowledgeBase, KnowledgeBase, newId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Resource name is required." }, { status: 400 });
  }

  const type = ["file", "url", "text", "gdoc"].includes(body?.type)
    ? (body.type as KnowledgeBase["type"])
    : "text";

  if (type === "url" || type === "gdoc") {
    const url = String(body?.url ?? "").trim();
    if (!/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const kb = await createKnowledgeBase({
    id: newId("kb"),
    userId: session.userId,
    name,
    description:
      type === "url"
        ? "Website/URL content"
        : type === "gdoc"
          ? "Google Doc content"
          : type === "file"
            ? "Uploaded file(s)"
            : "Text content",
    docsCount: type === "file" ? Number(body?.docsCount ?? 1) || 1 : 1,
    createdAt: now,
    updatedAt: now,
    type,
    url: String(body?.url ?? "").slice(0, 500),
    content: String(body?.content ?? "").slice(0, 20000),
    autoUpdate: Boolean(body?.autoUpdate),
    crawl: Boolean(body?.crawl),
    multipleUrls: Boolean(body?.multipleUrls),
  });
  return NextResponse.json({ knowledgeBase: kb }, { status: 201 });
}
