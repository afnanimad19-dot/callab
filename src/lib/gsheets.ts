// Google Sheets logging. Uses the SHEETS connection (see google.ts). The
// clinic picks WHICH spreadsheet + tab to log into (or we create one for
// them), then MAPS each field to a column in that sheet. Every appointment AND
// every enquiry (a caller/chatter who gave their details but didn't book) is
// appended as a row — so the sheet doubles as a live lead tracker.

import { findUserById, type Appointment } from "./db";
import { accessTokenForService, saveServiceConn, getServiceConn, serviceConnected, googleConfigured } from "./google";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_TAB = "Appointments";

// The fields we can log, in default column order. `key` is stable; `label` is
// the default column header we create and the name shown in the mapping UI.
export const SHEET_FIELDS: { key: string; label: string }[] = [
  { key: "logged", label: "Logged (UTC)" },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "patient", label: "Patient" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "doctor", label: "Doctor" },
  { key: "service", label: "Service" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "notes", label: "Notes" },
];
const DEFAULT_HEADERS = SHEET_FIELDS.map((f) => f.label);

export function googleSheetUrl(spreadsheetId?: string): string | null {
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null;
}

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

// Wall-clock date/time from the stored naive ISO string (no timezone shift).
function wallDate(iso: string): string {
  return (iso.split("T")[0] ?? "").trim();
}
function wallTime(iso: string): string {
  return (iso.split("T")[1] ?? "").slice(0, 5);
}

// Guess a sensible default mapping from a sheet's existing headers.
function autoMap(columns: string[]): Record<string, string> {
  const patterns: Record<string, RegExp> = {
    logged: /log|time ?stamp|date ?added|created/i,
    channel: /channel|source|via/i,
    status: /status|stage|booked|outcome/i,
    patient: /patient|name|customer|client/i,
    phone: /phone|mobile|contact|number|whats/i,
    email: /e-?mail/i,
    doctor: /doctor|dentist|dr\b|provider/i,
    service: /service|treatment|reason|procedure/i,
    date: /^date|appointment date|appt date|day/i,
    time: /^time|appointment time|appt time/i,
    notes: /note|comment|message|summary|detail/i,
  };
  const map: Record<string, string> = {};
  for (const { key } of SHEET_FIELDS) {
    const col = columns.find((c) => patterns[key]?.test(c));
    if (col) map[key] = col;
  }
  return map;
}

async function fetchTabs(spreadsheetId: string, token: string): Promise<{ title: string; tabs: string[] } | null> {
  const res = await fetch(`${SHEETS}/${spreadsheetId}?fields=properties.title,sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

async function readHeaderRow(spreadsheetId: string, tab: string, token: string): Promise<string[]> {
  const range = encodeURIComponent(`${quoteTab(tab)}!A1:Z1`);
  const res = await fetch(`${SHEETS}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { values?: string[][] };
  return (data.values?.[0] ?? []).map((c) => String(c ?? "").trim());
}

// Ensure the chosen tab has a header row. If empty, write our defaults and use
// them; otherwise return the existing headers as-is.
async function ensureHeaders(spreadsheetId: string, tab: string, token: string): Promise<string[]> {
  const existing = await readHeaderRow(spreadsheetId, tab, token);
  if (existing.filter(Boolean).length) return existing;
  const range = encodeURIComponent(`${quoteTab(tab)}!A1`);
  await fetch(`${SHEETS}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [DEFAULT_HEADERS] }),
  }).catch(() => {});
  return DEFAULT_HEADERS;
}

// --- Configuration actions (called from the Integrations UI) ----------------

type SheetSetup = {
  url: string;
  name: string;
  tabs: string[];
  tab: string;
  columns: string[];
  mapping: Record<string, string>;
};

export async function createSpreadsheetForUser(userId: string): Promise<SheetSetup | null> {
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
  await ensureHeaders(id, DEFAULT_TAB, token);
  const mapping = Object.fromEntries(SHEET_FIELDS.map((f) => [f.key, f.label])); // identity
  await saveServiceConn(userId, "sheets", {
    spreadsheetId: id,
    spreadsheetName: created.properties?.title ?? "VoiceLine AI — Appointments & Leads",
    sheetTab: DEFAULT_TAB,
    columns: DEFAULT_HEADERS,
    mapping,
  });
  return {
    url: googleSheetUrl(id)!,
    name: created.properties?.title ?? "Spreadsheet",
    tabs: [DEFAULT_TAB],
    tab: DEFAULT_TAB,
    columns: DEFAULT_HEADERS,
    mapping,
  };
}

export async function useSpreadsheetForUser(
  userId: string,
  urlOrId: string
): Promise<SheetSetup | { error: string }> {
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "sheets")) return { error: "Connect Google Sheets first." };
  const token = await accessTokenForService(user, "sheets");
  if (!token) return { error: "Could not reach Google — reconnect Sheets." };
  const id = extractSpreadsheetId(urlOrId);
  if (!id) return { error: "That doesn't look like a Google Sheet link." };

  const meta = await fetchTabs(id, token);
  if (!meta) return { error: "Can't open that sheet with the connected account. Make sure it's owned by (or shared with) that Google account." };
  const tab = meta.tabs[0] ?? DEFAULT_TAB;
  const columns = await ensureHeaders(id, tab, token);
  const mapping = autoMap(columns);
  await saveServiceConn(userId, "sheets", {
    spreadsheetId: id,
    spreadsheetName: meta.title,
    sheetTab: tab,
    columns,
    mapping,
  });
  return { url: googleSheetUrl(id)!, name: meta.title, tabs: meta.tabs, tab, columns, mapping };
}

export async function setSheetTabForUser(userId: string, tab: string): Promise<SheetSetup | { error: string }> {
  const user = await findUserById(userId);
  if (!user) return { error: "Not found." };
  const conn = getServiceConn(user, "sheets");
  if (!conn?.spreadsheetId) return { error: "Pick a sheet first." };
  const token = await accessTokenForService(user, "sheets");
  if (!token) return { error: "Reconnect Sheets." };
  const columns = await ensureHeaders(conn.spreadsheetId, tab, token);
  const mapping = autoMap(columns);
  await saveServiceConn(userId, "sheets", { sheetTab: tab, columns, mapping });
  const meta = await fetchTabs(conn.spreadsheetId, token);
  return {
    url: googleSheetUrl(conn.spreadsheetId)!,
    name: conn.spreadsheetName ?? "Spreadsheet",
    tabs: meta?.tabs ?? [tab],
    tab,
    columns,
    mapping,
  };
}

// Save the field -> column mapping the user set in the UI.
export async function setMappingForUser(userId: string, mapping: Record<string, string>): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user || !getServiceConn(user, "sheets")?.spreadsheetId) return false;
  const clean: Record<string, string> = {};
  for (const { key } of SHEET_FIELDS) {
    const v = mapping[key];
    if (typeof v === "string" && v.trim()) clean[key] = v.trim();
  }
  await saveServiceConn(userId, "sheets", { mapping: clean });
  return true;
}

export function sheetConfig(user: { googleServices?: { sheets?: { spreadsheetId?: string; spreadsheetName?: string; sheetTab?: string; columns?: string[]; mapping?: Record<string, string> } } } | null | undefined) {
  const s = user?.googleServices?.sheets;
  return {
    spreadsheetId: s?.spreadsheetId ?? null,
    spreadsheetName: s?.spreadsheetName ?? null,
    sheetTab: s?.sheetTab ?? null,
    columns: s?.columns ?? [],
    mapping: s?.mapping ?? {},
    url: googleSheetUrl(s?.spreadsheetId),
    fields: SHEET_FIELDS,
  };
}

// --- Row logging ------------------------------------------------------------

async function appendData(userId: string, data: Record<string, string | undefined>): Promise<void> {
  if (!googleConfigured()) return;
  const user = await findUserById(userId);
  if (!user || !serviceConnected(user, "sheets")) return;
  const token = await accessTokenForService(user, "sheets");
  if (!token) return;

  let conn = getServiceConn(user, "sheets");
  // No sheet chosen yet → create one automatically so nothing is dropped.
  if (!conn?.spreadsheetId) {
    const made = await createSpreadsheetForUser(userId);
    if (!made) return;
    conn = getServiceConn((await findUserById(userId))!, "sheets");
  }
  if (!conn?.spreadsheetId) return;

  const spreadsheetId = conn.spreadsheetId;
  const tab = conn.sheetTab || DEFAULT_TAB;
  const columns = conn.columns?.length ? conn.columns : DEFAULT_HEADERS;
  const mapping = conn.mapping && Object.keys(conn.mapping).length
    ? conn.mapping
    : Object.fromEntries(SHEET_FIELDS.map((f) => [f.key, f.label]));

  // Build a row positioned by the mapping: each field's value goes into the
  // column its header maps to. Unmapped columns stay blank.
  const row = new Array(columns.length).fill("");
  for (const { key } of SHEET_FIELDS) {
    const header = mapping[key];
    if (!header) continue;
    const idx = columns.indexOf(header);
    if (idx >= 0) row[idx] = data[key] ?? "";
  }

  try {
    const range = encodeURIComponent(`${quoteTab(tab)}!A1`);
    const res = await fetch(
      `${SHEETS}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (res.status === 404) {
      await saveServiceConn(userId, "sheets", { spreadsheetId: undefined, sheetTab: undefined, columns: undefined, mapping: undefined });
    }
  } catch (e) {
    console.error("Sheets append failed:", e);
  }
}

function channelLabel(source?: string): string {
  switch (source) {
    case "call": return "Call";
    case "chat": return "Chat";
    case "manual": return "Manual";
    default: return source || "";
  }
}

// Appointment lifecycle row. Never throws — logging must not break a booking.
export async function logAppointmentToSheet(
  userId: string,
  appointment: Appointment,
  status: "Booked" | "Rescheduled" | "Canceled"
): Promise<void> {
  await appendData(userId, {
    logged: new Date().toISOString(),
    channel: channelLabel(appointment.source),
    status,
    patient: appointment.patientName,
    phone: appointment.phone,
    email: appointment.email,
    doctor: appointment.doctor,
    service: appointment.service,
    date: wallDate(appointment.startsAt),
    time: wallTime(appointment.startsAt),
    notes: appointment.notes,
  });
}

// Lead row for someone who interacted but did NOT book.
export async function logLeadToSheet(
  userId: string,
  lead: { name?: string; phone?: string; email?: string; channel?: string; status?: string; notes?: string }
): Promise<void> {
  await appendData(userId, {
    logged: new Date().toISOString(),
    channel: channelLabel(lead.channel),
    status: lead.status || "Enquiry (no booking)",
    patient: lead.name || "Unknown",
    phone: lead.phone,
    email: lead.email,
    notes: lead.notes,
  });
}
