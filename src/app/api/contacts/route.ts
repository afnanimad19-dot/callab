import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createContact, newId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  }

  const contact = await createContact({
    id: newId("cnt"),
    userId: session.userId,
    name,
    phone,
    tag: String(body?.tag ?? "").trim() || "lead",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ contact }, { status: 201 });
}
