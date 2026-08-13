// Appointment helpers shared by the Calendar API, the agents' booking tools
// (voice + chat), and manual creation. Creating an appointment also creates
// or links the patient's Contact, and pushes to Google Calendar if connected.

import {
  Appointment, createAppointment, createContact, listAppointments,
  listContacts, newId, updateAppointment, updateContact,
} from "./db";
import { syncAppointmentToGoogle } from "./gcal";

const norm = (p?: string) => (p ?? "").replace(/[^\d]/g, "").slice(-9);

export async function ensureContact(
  userId: string,
  name: string,
  phone?: string,
  email?: string
): Promise<string | undefined> {
  if (!name.trim()) return undefined;
  const cleanEmail = email?.trim();
  const contacts = await listContacts(userId);
  const existing = contacts.find(
    (c) =>
      (phone && norm(c.phone) === norm(phone) && norm(phone).length >= 7) ||
      c.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) {
    // Backfill the email if we now have one and the contact was missing it.
    if (cleanEmail && !existing.metadata?.email) {
      await updateContact(userId, existing.id, {
        metadata: { ...(existing.metadata ?? {}), email: cleanEmail },
      }).catch(() => {});
    }
    return existing.id;
  }
  const created = await createContact({
    id: newId("ct"),
    userId,
    name: name.trim(),
    phone: phone?.trim() ?? "",
    tag: "patient",
    source: "AI Agent",
    createdAt: new Date().toISOString(),
    ...(cleanEmail ? { metadata: { email: cleanEmail } } : {}),
  });
  return created.id;
}

export async function bookAppointment(
  userId: string,
  input: {
    patientName: string;
    phone?: string;
    email?: string;
    doctor?: string;
    service?: string;
    startsAt: string;
    endsAt?: string;
    notes?: string;
    source?: string;
  }
): Promise<Appointment> {
  const contactId = await ensureContact(userId, input.patientName, input.phone, input.email);
  const now = new Date().toISOString();
  const appointment: Appointment = {
    id: newId("apt"),
    userId,
    patientName: input.patientName.trim(),
    phone: input.phone?.trim(),
    doctor: input.doctor?.trim(),
    service: input.service?.trim(),
    status: "booked",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    notes: input.notes?.trim(),
    contactId,
    source: input.source ?? "call",
    createdAt: now,
    updatedAt: now,
  };
  // Insert FIRST — the booking must never fail because of calendar sync.
  await createAppointment(appointment);
  try {
    const gcalEventId = await syncAppointmentToGoogle(userId, appointment);
    if (gcalEventId) {
      appointment.gcalEventId = gcalEventId;
      await updateAppointment(userId, appointment.id, { gcalEventId });
    }
  } catch (e) {
    console.error("Google sync after booking failed:", e);
  }
  return appointment;
}

// Book with clinic guardrails: don't create a duplicate of the same patient at
// the same time, and don't double-book the SAME doctor at the SAME time for a
// DIFFERENT patient (that must be a different time or doctor). Used by both the
// voice and chat agents so bookings behave like a real clinic.
export async function bookAppointmentSafe(
  userId: string,
  input: Parameters<typeof bookAppointment>[1]
): Promise<
  | { status: "booked"; appointment: Appointment }
  | { status: "duplicate"; appointment: Appointment }
  | { status: "conflict"; doctor: string; when: string }
> {
  const active = (await listAppointments(userId)).filter((a) => a.status !== "canceled");
  const startMs = Date.parse(input.startsAt);
  const sameTime = (a: Appointment) => Math.abs(Date.parse(a.startsAt) - startMs) < 60_000;
  const sameName = (a: Appointment) =>
    a.patientName.trim().toLowerCase() === input.patientName.trim().toLowerCase();
  const samePhone = (a: Appointment) =>
    Boolean(input.phone) && norm(a.phone) === norm(input.phone) && norm(input.phone).length >= 7;

  // Already booked for this patient at this time → don't duplicate.
  const dup = active.find((a) => sameTime(a) && (sameName(a) || samePhone(a)));
  if (dup) return { status: "duplicate", appointment: dup };

  // Same doctor, same time, different patient → clash.
  if (input.doctor?.trim()) {
    const clash = active.find(
      (a) =>
        sameTime(a) &&
        a.doctor?.trim().toLowerCase() === input.doctor!.trim().toLowerCase() &&
        !sameName(a) &&
        !samePhone(a)
    );
    if (clash) {
      return { status: "conflict", doctor: input.doctor.trim(), when: new Date(startMs).toLocaleString() };
    }
  }

  const appointment = await bookAppointment(userId, input);
  return { status: "booked", appointment };
}

// Find the patient's next upcoming appointment by name/phone.
export async function findUpcomingAppointment(
  userId: string,
  patientName?: string,
  phone?: string
): Promise<Appointment | null> {
  const all = await listAppointments(userId);
  const nowIso = new Date().toISOString();
  const match = all
    .filter((a) => a.status !== "canceled")
    .filter(
      (a) =>
        (phone && norm(a.phone) === norm(phone) && norm(phone).length >= 7) ||
        (patientName && a.patientName.trim().toLowerCase() === patientName.trim().toLowerCase())
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = match.find((a) => a.startsAt >= nowIso);
  return upcoming ?? (match.length ? match[match.length - 1] : null);
}

export async function rescheduleAppointment(
  userId: string,
  appointment: Appointment,
  newStartsAt: string
): Promise<Appointment | null> {
  const patched: Appointment = {
    ...appointment,
    startsAt: newStartsAt,
    status: "rescheduled",
    updatedAt: new Date().toISOString(),
  };
  const gcalEventId = await syncAppointmentToGoogle(userId, patched);
  return (
    (await updateAppointment(userId, appointment.id, {
      startsAt: newStartsAt,
      status: "rescheduled",
      gcalEventId,
      updatedAt: patched.updatedAt,
    })) ?? null
  );
}

export async function cancelAppointment(
  userId: string,
  appointment: Appointment
): Promise<Appointment | null> {
  await syncAppointmentToGoogle(userId, { ...appointment, status: "canceled" });
  return (
    (await updateAppointment(userId, appointment.id, {
      status: "canceled",
      gcalEventId: undefined,
      updatedAt: new Date().toISOString(),
    })) ?? null
  );
}
