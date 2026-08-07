import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteContact, listContacts } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const exists = (await listContacts(session.userId)).some((c) => c.id === id);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteContact(id);
  return NextResponse.json({ ok: true });
}
