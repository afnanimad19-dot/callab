// Google Calendar sync. Uses the CALENDAR connection (see google.ts) — each
// workspace owner connects their own Google account for the calendar, which
// can differ from the account used for Sheets. Appointments push to
// that account's primary calendar.

import { findUserById, type Appointment } from "./db";
import { accessTokenForService, serviceConnected } from "./google";

function eventBody(a: Appointment) {
  const start = new Date(a.startsAt);
  const end = a.endsAt ? new Date(a.endsAt) : new Date(start.getTime() + 30 * 60000);
  return {
    summary: `${a.patientName}${a.doctor ? ` — ${a.doctor}` : ""}${a.service ? ` (${a.service})` : ""}`,
    description: [
      a.phone && `Phone: ${a.phone}`,
      a.email && `Email: ${a.email}`,
      a.notes && `Notes: ${a.notes}`,
      `Status: ${a.status}`,
      "Booked via VoiceLine AI",
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

// Push an appointment to the owner's Google Calendar (create / update /
// delete on cancel). Silent no-op when Calendar isn't connected.
export async function syncAppointmentToGoogle(
  userId: string,
  appointment: Appointment
): Promise<string | undefined> {
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "calendar")) return appointment.gcalEventId;
  const token = await accessTokenForService(user, "calendar");
  if (!token) return appointment.gcalEventId;

  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    if (appointment.status === "canceled" && appointment.gcalEventId) {
      await fetch(`${base}/${appointment.gcalEventId}`, { method: "DELETE", headers });
      return undefined;
    }
    if (appointment.gcalEventId) {
      await fetch(`${base}/${appointment.gcalEventId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(eventBody(appointment)),
      });
      return appointment.gcalEventId;
    }
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(eventBody(appointment)) });
    if (!res.ok) return undefined;
    return ((await res.json()) as { id?: string }).id;
  } catch (e) {
    console.error("Google Calendar sync failed:", e);
    return appointment.gcalEventId;
  }
}
