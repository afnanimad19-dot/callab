// Google Calendar sync. One OAuth app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// in env) serves every customer — each workspace owner connects THEIR OWN
// Google account, and their refresh token is stored on their user record.
// Appointments push to the connected account's primary calendar.

import { findUserById, updateUser, User } from "./db";
import type { Appointment } from "./db";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{
  refreshToken?: string;
  email?: string;
} | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { refresh_token?: string; id_token?: string; access_token?: string };
    // Best-effort email from the id_token payload (no external calls needed).
    let email: string | undefined;
    if (data.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString());
        email = payload.email;
      } catch { /* fine without it */ }
    }
    return { refreshToken: data.refresh_token, email };
  } catch {
    return null;
  }
}

async function accessTokenFor(user: User): Promise<string | null> {
  const refresh = user.googleRefreshToken;
  if (!refresh || !googleConfigured()) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refresh,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}

function eventBody(a: Appointment) {
  const start = new Date(a.startsAt);
  const end = a.endsAt ? new Date(a.endsAt) : new Date(start.getTime() + 30 * 60000);
  return {
    summary: `${a.patientName}${a.doctor ? ` — ${a.doctor}` : ""}${a.service ? ` (${a.service})` : ""}`,
    description: [
      a.phone && `Phone: ${a.phone}`,
      a.notes && `Notes: ${a.notes}`,
      `Status: ${a.status}`,
      "Booked via VoiceLine AI",
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

// Push an appointment to the owner's Google Calendar (create / update /
// delete on cancel). Silent no-op when Google isn't connected.
export async function syncAppointmentToGoogle(
  userId: string,
  appointment: Appointment
): Promise<string | undefined> {
  const user = await findUserById(userId);
  if (!user?.googleRefreshToken) return appointment.gcalEventId;
  const token = await accessTokenFor(user);
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

export async function disconnectGoogle(userId: string) {
  await updateUser(userId, { googleRefreshToken: undefined, googleEmail: undefined });
}
