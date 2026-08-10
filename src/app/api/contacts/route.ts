import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createContact, deleteContact, insertContacts, listContacts, newId, Contact } from "@/lib/db";

// Bulk delete: { ids: [...] }. Only removes contacts owned by the caller.
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No ids provided." }, { status: 400 });

  const owned = new Set((await listContacts(session.userId)).map((c) => c.id));
  const toDelete = ids.filter((id) => owned.has(id));
  await Promise.all(toDelete.map((id) => deleteContact(id)));
  return NextResponse.json({ deleted: toDelete.length });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);

  // Bulk import: { contacts: [{name, phone, tag?, category?}, ...] }
  if (Array.isArray(body?.contacts)) {
    const rows: Contact[] = body.contacts
      .map((c: Record<string, unknown>) => ({
        id: newId("cnt"),
        userId: session.userId,
        name: String(c?.name ?? "").trim().slice(0, 80),
        phone: String(c?.phone ?? "").trim().slice(0, 30),
        tag: String(c?.tag ?? "imported").trim().slice(0, 40) || "imported",
        category: String(c?.category ?? "").trim().slice(0, 40),
        source: "Import",
        createdAt: new Date().toISOString(),
      }))
      .filter((c: Contact) => c.name && c.phone)
      .slice(0, 1000);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows — each contact needs a name and a phone." },
        { status: 400 }
      );
    }
    await insertContacts(rows);
    return NextResponse.json({ imported: rows.length }, { status: 201 });
  }

  // Single create
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const name = `${firstName} ${lastName}`.trim() || String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  }

  const metadataSrc =
    body?.metadata && typeof body.metadata === "object"
      ? (body.metadata as Record<string, unknown>)
      : {};
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadataSrc).slice(0, 10)) {
    if (String(k).trim()) metadata[String(k).slice(0, 40)] = String(v).slice(0, 200);
  }

  const contact = await createContact({
    id: newId("cnt"),
    userId: session.userId,
    name,
    phone,
    tag: String(body?.tag ?? "").trim() || "lead",
    category: String(body?.category ?? "Lead").trim(),
    source: "Manual",
    metadata,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ contact }, { status: 201 });
}
