import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listConversations } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = (await listConversations(session.userId)).sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt)
  );
  return NextResponse.json({ conversations });
}
