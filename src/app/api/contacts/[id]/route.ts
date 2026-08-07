import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Contact, deleteContact, listContacts, updateContact } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Partial<Contact> = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body?.phone === "string" && body.phone.trim()) patch.phone = body.phone.trim().slice(0, 30);
  if (typeof body?.tag === "string" && body.tag.trim()) patch.tag = body.tag.trim().slice(0, 60);
  if (typeof body?.category === "string") patch.category = body.category.slice(0, 60);
  if (body?.metadata && typeof body.metadata === "object") {
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.metadata as Record<string, unknown>).slice(0, 30)) {
      metadata[String(k).slice(0, 60)] = String(v).slice(0, 200);
    }
    patch.metadata = metadata;
  }

  const updated = await updateContact(session.userId, id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ contact: updated });
}

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
