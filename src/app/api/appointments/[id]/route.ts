import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteAppointment, listAppointments, updateAppointment } from "@/lib/db";
import { cancelAppointment, rescheduleAppointment } from "@/lib/appointments";
import { syncAppointmentToGoogle } from "@/lib/gcal";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = (await listAppointments(session.userId)).find((a) => a.id === id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body?.action === "cancel") {
    const appointment = await cancelAppointment(session.userId, existing);
    return NextResponse.json({ appointment });
  }
  if (body?.action === "reschedule" && !Number.isNaN(Date.parse(body?.startsAt))) {
    // Store the wall-clock string verbatim (no toISOString — that would add a
    // Z and shift the hour when displayed in the local timezone).
    const appointment = await rescheduleAppointment(session.userId, existing, String(body.startsAt));
    return NextResponse.json({ appointment });
  }

  // General edit
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of ["patientName", "phone", "doctor", "service", "notes"] as const) {
    if (typeof body?.[key] === "string") patch[key] = body[key].slice(0, 500);
  }
  if (["booked", "rescheduled", "canceled", "completed"].includes(body?.status)) {
    patch.status = body.status;
  }
  if (body?.startsAt && !Number.isNaN(Date.parse(body.startsAt))) {
    patch.startsAt = String(body.startsAt); // wall-clock, no timezone conversion
  }
  const appointment = await updateAppointment(session.userId, id, patch);
  if (appointment) {
    const gcalEventId = await syncAppointmentToGoogle(session.userId, appointment);
    if (gcalEventId !== appointment.gcalEventId) {
      await updateAppointment(session.userId, id, { gcalEventId });
    }
  }
  return NextResponse.json({ appointment });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = (await listAppointments(session.userId)).find((a) => a.id === id);
  if (existing?.gcalEventId) {
    await syncAppointmentToGoogle(session.userId, { ...existing, status: "canceled" });
  }
  const removed = await deleteAppointment(session.userId, id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
