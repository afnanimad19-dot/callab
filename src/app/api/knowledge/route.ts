import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createKnowledgeBase, KnowledgeBase, newId } from "@/lib/db";
import { fetchWebsiteText } from "@/lib/web-content";

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

  // URL / Google Doc resources: fetch and index the actual page content so
  // agents can read it — not just store the link.
  let fetchedContent = "";
  let fetchedPages = 0;
  if (type === "url" || type === "gdoc") {
    const url = String(body?.url ?? "").trim();
    if (!/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 });
    }
    const fetched = await fetchWebsiteText(url, {
      crawl: Boolean(body?.crawl),
      gdoc: type === "gdoc",
    });
    if (!fetched) {
      return NextResponse.json(
        { error: "Couldn't read that URL — check it's public and reachable, then try again." },
        { status: 400 }
      );
    }
    fetchedContent = fetched.content;
    fetchedPages = fetched.pages;
  }

  const now = new Date().toISOString();
  const kb = await createKnowledgeBase({
    id: newId("kb"),
    userId: session.userId,
    name,
    description:
      type === "url"
        ? `Website content (${fetchedPages} page${fetchedPages === 1 ? "" : "s"} indexed)`
        : type === "gdoc"
          ? "Google Doc content"
          : type === "file"
            ? "Uploaded file(s)"
            : "Text content",
    docsCount: type === "file" ? Number(body?.docsCount ?? 1) || 1 : Math.max(1, fetchedPages),
    createdAt: now,
    updatedAt: now,
    type,
    url: String(body?.url ?? "").slice(0, 500),
    content: (fetchedContent || String(body?.content ?? "")).slice(0, 60000),
    fileName: String(body?.fileName ?? "").slice(0, 200) || undefined,
    autoUpdate: Boolean(body?.autoUpdate),
    crawl: Boolean(body?.crawl),
    multipleUrls: Boolean(body?.multipleUrls),
  });
  return NextResponse.json({ knowledgeBase: kb }, { status: 201 });
}
