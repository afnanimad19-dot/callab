// Appointment helpers shared by the Calendar API, the agents' booking tools
// (voice + chat), and manual creation. Creating an appointment also creates
// or links the patient's Contact, and pushes to Google Calendar if connected.

import {
  Appointment, createAppointment, createContact, listAppointments,
  listContacts, newId, updateAppointment, updateContact,
} from "./db";
import { syncAppointmentToGoogle } from "./gcal";
import { logAppointmentToSheet } from "./gsheets";
import { sendBookingConfirmation } from "./notify";

const norm = (p?: string) => (p ?? "").replace(/[^\d]/g, "").slice(-9);

// How long a booking really occupies the schedule. Each appointment blocks a
// SERVICE window (default 40 min when no explicit end time is given), and for
// mobile/home services — recognised by having NO named doctor/staff — an extra
// TRAVEL buffer so the driver can reach the next customer. Result: doorstep
// bookings sit ~70 min apart, in-clinic bookings 40 min, never 15.
export const SERVICE_MINUTES = 40;
export const TRAVEL_BUFFER_MINUTES = 30;
const MIN = 60_000;

// Friendly label for where a contact came from, based on the booking channel.
function sourceLabel(source?: string): string {
  switch (source) {
    case "call": return "Voice call";
    case "chat": return "Chat";
    case "manual": return "Manual";
    default: return "AI Agent";
  }
}

export async function ensureContact(
  userId: string,
  name: string,
  phone?: string,
  email?: string,
  source?: string
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
    source: sourceLabel(source),
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
  const contactId = await ensureContact(userId, input.patientName, input.phone, input.email, input.source);
  const now = new Date().toISOString();
  const appointment: Appointment = {
    id: newId("apt"),
    userId,
    patientName: input.patientName.trim(),
    phone: input.phone?.trim(),
    email: input.email?.trim(),
    doctor: input.doctor?.trim(),
    service: input.service?.trim(),
    status: "booked",
    startsAt: input.startsAt,
    // Store a real end time so the calendar (and conflict checks) see the full
    // service window, not a zero-length moment.
    endsAt:
      input.endsAt ??
      new Date(Date.parse(input.startsAt) + SERVICE_MINUTES * MIN)
        .toISOString()
        .replace(/\.\d{3}Z$/, ""),
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
  await logAppointmentToSheet(userId, appointment, "Booked");
  // Thank-you / confirmation email to the patient via Resend. Never blocks
  // the booking.
  if (appointment.email) {
    sendBookingConfirmation(userId, appointment).catch((e) =>
      console.error("Booking confirmation email failed:", e)
    );
  }
  return appointment;
}

// Book with real scheduling guardrails, shared by the voice and chat agents:
// - the same patient can't be booked twice into an overlapping window
//   (duplicate, not an error);
// - a slot that overlaps ANY other active booking's service window (plus the
//   travel buffer for mobile services) is a conflict — unless both bookings
//   name DIFFERENT doctors/staff, who can genuinely work in parallel. This is
//   what stops "I said 2pm and it said yes" double-bookings for businesses
//   that don't use doctor names at all (e.g. a mobile car wash).
// On conflict it also computes the next genuinely free time to offer back.
export async function bookAppointmentSafe(
  userId: string,
  input: Parameters<typeof bookAppointment>[1]
): Promise<
  | { status: "booked"; appointment: Appointment }
  | { status: "duplicate"; appointment: Appointment }
  | { status: "conflict"; doctor?: string; when: string; nextFree: string }
> {
  const active = (await listAppointments(userId)).filter((a) => a.status !== "canceled");
  const startMs = Date.parse(input.startsAt);
  const serviceMs = SERVICE_MINUTES * MIN;
  const endMs = input.endsAt ? Date.parse(input.endsAt) : startMs + serviceMs;
  const windowOf = (a: Appointment): [number, number] => {
    const s = Date.parse(a.startsAt);
    return [s, a.endsAt ? Date.parse(a.endsAt) : s + serviceMs];
  };
  const sameName = (a: Appointment) =>
    a.patientName.trim().toLowerCase() === input.patientName.trim().toLowerCase();
  const samePhone = (a: Appointment) =>
    Boolean(input.phone) && norm(a.phone) === norm(input.phone) && norm(input.phone).length >= 7;

  // Already booked for this patient in an overlapping window → don't duplicate.
  const dup = active.find((a) => {
    const [as, ae] = windowOf(a);
    return startMs < ae && as < endMs && (sameName(a) || samePhone(a));
  });
  if (dup) return { status: "duplicate", appointment: dup };

  const clash = findSlotConflict(
    active.filter((a) => !sameName(a) && !samePhone(a)),
    { startsAt: input.startsAt, endsAt: input.endsAt, doctor: input.doctor }
  );
  if (clash) return { status: "conflict", ...clash };

  const appointment = await bookAppointment(userId, input);
  return { status: "booked", appointment };
}

// Does the requested slot collide with any existing booking's occupied
// window? Two bookings only coexist at overlapping times when BOTH name a
// doctor and the doctors differ (parallel chairs). Missing staff on either
// side means one shared resource (the mobile team, the wash crew) → they
// can't overlap, and the TRAVEL buffer applies between them. Also used for
// reschedules (pass excludeId so the appointment doesn't clash with itself).
export function findSlotConflict(
  activeAppointments: Appointment[],
  slot: { startsAt: string; endsAt?: string; doctor?: string; excludeId?: string }
): { doctor?: string; when: string; nextFree: string } | null {
  const active = activeAppointments.filter(
    (a) => a.status !== "canceled" && a.id !== slot.excludeId
  );
  const serviceMs = SERVICE_MINUTES * MIN;
  const startMs = Date.parse(slot.startsAt);
  const endMs = slot.endsAt ? Date.parse(slot.endsAt) : startMs + serviceMs;
  const windowOf = (a: Appointment): [number, number] => {
    const s = Date.parse(a.startsAt);
    return [s, a.endsAt ? Date.parse(a.endsAt) : s + serviceMs];
  };
  const mine = slot.doctor?.trim().toLowerCase();
  const blocks = (a: Appointment, s: number, e: number) => {
    const theirs = a.doctor?.trim().toLowerCase();
    if (mine && theirs && mine !== theirs) return false; // different named staff → parallel
    const buffer = !mine || !theirs ? TRAVEL_BUFFER_MINUTES * MIN : 0;
    const [as, ae] = windowOf(a);
    return s < ae + buffer && as < e + buffer;
  };

  const clash = active.find((a) => blocks(a, startMs, endMs));
  if (!clash) return null;

  // Walk forward from the clashing window until a candidate slot clears
  // every existing booking (bounded — a packed day still terminates).
  let candidate = windowOf(clash)[1] + TRAVEL_BUFFER_MINUTES * MIN;
  for (let i = 0; i < 24; i++) {
    const blocker = active.find((a) => blocks(a, candidate, candidate + serviceMs));
    if (!blocker) break;
    candidate = windowOf(blocker)[1] + TRAVEL_BUFFER_MINUTES * MIN;
  }
  // Round up to the next quarter hour so the offer sounds natural.
  candidate = Math.ceil(candidate / (15 * MIN)) * (15 * MIN);
  return {
    doctor: clash.doctor?.trim() || undefined,
    when: new Date(startMs).toLocaleString(),
    nextFree: new Date(candidate).toLocaleString(),
  };
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
  await logAppointmentToSheet(userId, patched, "Rescheduled");
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
  await logAppointmentToSheet(userId, { ...appointment, status: "canceled" }, "Canceled");
  return (
    (await updateAppointment(userId, appointment.id, {
      status: "canceled",
      gcalEventId: undefined,
      updatedAt: new Date().toISOString(),
    })) ?? null
  );
}
