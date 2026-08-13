// Google Sheets logging. Uses the SHEETS connection (see google.ts). The
// clinic picks WHICH spreadsheet + tab to log into (or we create one for
// them), then every appointment AND every enquiry (a caller/chatter who gave
// their details but didn't book) is appended as a row with a Status and the
// Channel it came through — so the sheet doubles as a live lead tracker.

import { findUserById, type Appointment } from "./db";
import { accessTokenForService, saveServiceConn, getServiceConn, serviceConnected, googleConfigured } from "./google";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_TAB = "Appointments";
const HEADERS = [
  "Logged (UTC)",
  "Channel",
  "Status",
  "Patient",
  "Phone",
  "Email",
  "Doctor",
  "Service",
  "Date",
  "Time",
  "Notes",
];

export function googleSheetUrl(spreadsheetId?: string): string | null {
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null;
}

// Accept a full URL or a raw spreadsheet id.
export function extractSpreadsheetId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

// Wall-clock date/time straight from the stored naive ISO string (no timezone
// conversion) — matches how the Calendar tab shows UAE time.
function wallDate(iso: string): string {
  return (iso.split("T")[0] ?? "").trim();
}
function wallTime(iso: string): string {
  return (iso.split("T")[1] ?? "").slice(0, 5);
}

async function fetchTabs(spreadsheetId: string, token: string): Promise<{ title: string; tabs: string[] } | null> {
  const res = await fetch(
    `${SHEETS}/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  };
  return {
    title: data.properties?.title ?? "Spreadsheet",
    tabs: (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean),
  };
}

// Write the header row if the chosen tab's first row is empty.
async function ensureHeader(spreadsheetId: string, tab: string, token: string): Promise<void> {
  const range = encodeURIComponent(`${quoteTab(tab)}!A1:K1`);
  const check = await fetch(`${SHEETS}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (check.ok) {
    const data = (await check.json()) as { values?: string[][] };
    if (data.values && data.values.length && data.values[0].length) return; // already has a header
  }
  await fetch(`${SHEETS}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [HEADERS] }),
  }).catch(() => {});
}

// --- Configuration actions (called from the Integrations UI) ----------------

export async function createSpreadsheetForUser(
  userId: string
): Promise<{ url: string; name: string; tabs: string[]; tab: string } | null> {
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "sheets")) return null;
  const token = await accessTokenForService(user, "sheets");
  if (!token) return null;

  const res = await fetch(SHEETS, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: "VoiceLine AI — Appointments & Leads" },
      sheets: [{ properties: { title: DEFAULT_TAB } }],
    }),
  });
  if (!res.ok) {
    console.error("Sheets create failed:", await res.text());
    return null;
  }
  const created = (await res.json()) as { spreadsheetId?: string; properties?: { title?: string } };
  const id = created.spreadsheetId;
  if (!id) return null;
  await ensureHeader(id, DEFAULT_TAB, token);
  await saveServiceConn(userId, "sheets", {
    spreadsheetId: id,
    spreadsheetName: created.properties?.title ?? "VoiceLine AI — Appointments & Leads",
    sheetTab: DEFAULT_TAB,
  });
  return { url: googleSheetUrl(id)!, name: created.properties?.title ?? "Spreadsheet", tabs: [DEFAULT_TAB], tab: DEFAULT_TAB };
}

export async function useSpreadsheetForUser(
  userId: string,
  urlOrId: string
): Promise<{ url: string; name: string; tabs: string[]; tab: string } | { error: string }> {
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "sheets")) return { error: "Connect Google Sheets first." };
  const token = await accessTokenForService(user, "sheets");
  if (!token) return { error: "Could not reach Google — reconnect Sheets." };
  const id = extractSpreadsheetId(urlOrId);
  if (!id) return { error: "That doesn't look like a Google Sheet link." };

  const meta = await fetchTabs(id, token);
  if (!meta) return { error: "Can't open that sheet with the connected account. Make sure it's owned by (or shared with) that Google account." };
  const tab = meta.tabs[0] ?? DEFAULT_TAB;
  await ensureHeader(id, tab, token);
  await saveServiceConn(userId, "sheets", { spreadsheetId: id, spreadsheetName: meta.title, sheetTab: tab });
  return { url: googleSheetUrl(id)!, name: meta.title, tabs: meta.tabs, tab };
}

export async function setSheetTabForUser(userId: string, tab: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) return false;
  const conn = getServiceConn(user, "sheets");
  if (!conn?.spreadsheetId) return false;
  const token = await accessTokenForService(user, "sheets");
  if (!token) return false;
  await ensureHeader(conn.spreadsheetId, tab, token);
  await saveServiceConn(userId, "sheets", { sheetTab: tab });
  return true;
}

// Current sheet config for the Integrations card.
export function sheetConfig(user: { googleServices?: { sheets?: { spreadsheetId?: string; spreadsheetName?: string; sheetTab?: string } } } | null | undefined) {
  const s = user?.googleServices?.sheets;
  return {
    spreadsheetId: s?.spreadsheetId ?? null,
    spreadsheetName: s?.spreadsheetName ?? null,
    sheetTab: s?.sheetTab ?? null,
    url: googleSheetUrl(s?.spreadsheetId),
  };
}

// --- Row logging ------------------------------------------------------------

async function appendRow(userId: string, row: (string | undefined)[]): Promise<void> {
  if (!googleConfigured()) return;
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "sheets")) return;
  const token = await accessTokenForService(user, "sheets");
  if (!token) return;

  const conn = getServiceConn(user, "sheets");
  let spreadsheetId = conn?.spreadsheetId;
  let tab = conn?.sheetTab || DEFAULT_TAB;

  // No sheet chosen yet → create one automatically so logging never silently
  // drops data the first time.
  if (!spreadsheetId) {
    const made = await createSpreadsheetForUser(userId);
    if (!made) return;
    spreadsheetId = extractSpreadsheetId(made.url)!;
    tab = made.tab;
  }

  try {
    const range = encodeURIComponent(`${quoteTab(tab)}!A1`);
    const res = await fetch(
      `${SHEETS}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row.map((c) => c ?? "")] }),
      }
    );
    if (res.status === 404) {
      // The chosen spreadsheet was deleted — forget it so the next call recreates.
      await saveServiceConn(userId, "sheets", { spreadsheetId: undefined, sheetTab: undefined });
    }
  } catch (e) {
    console.error("Sheets append failed:", e);
  }
}

// Appointment lifecycle row. Never throws — logging must not break a booking.
export async function logAppointmentToSheet(
  userId: string,
  appointment: Appointment,
  status: "Booked" | "Rescheduled" | "Canceled"
): Promise<void> {
  await appendRow(userId, [
    new Date().toISOString(),
    channelLabel(appointment.source),
    status,
    appointment.patientName,
    appointment.phone,
    appointment.email,
    appointment.doctor,
    appointment.service,
    wallDate(appointment.startsAt),
    wallTime(appointment.startsAt),
    appointment.notes,
  ]);
}

// Lead row for someone who interacted but did NOT book (enquiry / no-show of
// intent). Keeps the sheet a full record of everyone who reached out.
export async function logLeadToSheet(
  userId: string,
  lead: {
    name?: string;
    phone?: string;
    email?: string;
    channel?: string;
    status?: string;
    notes?: string;
  }
): Promise<void> {
  await appendRow(userId, [
    new Date().toISOString(),
    channelLabel(lead.channel),
    lead.status || "Enquiry (no booking)",
    lead.name || "Unknown",
    lead.phone,
    lead.email,
    "",
    "",
    "",
    "",
    lead.notes,
  ]);
}

function channelLabel(source?: string): string {
  switch (source) {
    case "call": return "Call";
    case "chat": return "Chat";
    case "manual": return "Manual";
    default: return source || "";
  }
}
