// Google Sheets appointment log. Reuses the SAME per-customer Google
// connection as the calendar (see gcal.ts) — no extra OAuth. On the first
// booking we auto-create a spreadsheet in the connected account and store its
// id on the user; every booking / reschedule / cancel appends one row, so the
// clinic always has a live, shareable log of every appointment.

import { findUserById, updateUser, type User, type Appointment } from "./db";
import { googleAccessToken, googleConfigured } from "./gcal";

const SPREADSHEET_TITLE = "VoiceLine AI — Appointments";
const TAB = "Appointments";
const HEADERS = [
  "Logged (UTC)",
  "Status",
  "Patient",
  "Phone",
  "Email",
  "Doctor",
  "Service",
  "Date",
  "Time",
  "Source",
  "Notes",
];

export function googleSheetUrl(sheetId?: string): string | null {
  return sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null;
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

// Wall-clock date/time straight from the stored naive ISO string (no timezone
// conversion) — matches how the Calendar tab shows UAE time.
function wallDate(iso: string): string {
  return (iso.split("T")[0] ?? "").trim();
}
function wallTime(iso: string): string {
  const t = iso.split("T")[1] ?? "";
  return t.slice(0, 5); // HH:MM
}

async function ensureSpreadsheet(user: User, token: string): Promise<string | null> {
  if (user.googleSheetId) return user.googleSheetId;

  const created = await fetch(SHEETS, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: TAB } }],
    }),
  });
  if (!created.ok) {
    console.error("Sheets create failed:", await created.text());
    return null;
  }
  const id = ((await created.json()) as { spreadsheetId?: string }).spreadsheetId;
  if (!id) return null;

  // Header row.
  await fetch(
    `${SHEETS}/${id}/values/${TAB}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [HEADERS] }),
    }
  ).catch(() => {});

  await updateUser(user.id, { googleSheetId: id });
  return id;
}

// Append one row for an appointment event. Never throws — logging must never
// break a booking. Silent no-op when Google isn't connected.
export async function logAppointmentToSheet(
  userId: string,
  appointment: Appointment,
  statusOverride?: Appointment["status"]
): Promise<void> {
  if (!googleConfigured()) return;
  const user = await findUserById(userId);
  if (!user?.googleRefreshToken) return;
  const token = await googleAccessToken(user);
  if (!token) return;

  try {
    const sheetId = await ensureSpreadsheet(user, token);
    if (!sheetId) return;

    const row = [
      new Date().toISOString(),
      statusOverride ?? appointment.status,
      appointment.patientName,
      appointment.phone ?? "",
      appointment.email ?? "",
      appointment.doctor ?? "",
      appointment.service ?? "",
      wallDate(appointment.startsAt),
      wallTime(appointment.startsAt),
      appointment.source ?? "",
      appointment.notes ?? "",
    ];

    const res = await fetch(
      `${SHEETS}/${sheetId}/values/${TAB}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      }
    );
    // A stale sheet id (spreadsheet deleted) — forget it so the next booking
    // recreates a fresh one.
    if (res.status === 404 && user.googleSheetId) {
      await updateUser(userId, { googleSheetId: undefined });
    }
  } catch (e) {
    console.error("Sheets append failed:", e);
  }
}
