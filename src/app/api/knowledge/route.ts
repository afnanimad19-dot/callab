import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createKnowledgeBase, newId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const kb = await createKnowledgeBase({
    id: newId("kb"),
    userId: session.userId,
    name,
    description: String(body?.description ?? "").trim(),
    docsCount: 0,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ knowledgeBase: kb }, { status: 201 });
}
