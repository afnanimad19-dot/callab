// Customer notification emails, sent via Resend (see email.ts). Set
// RESEND_API_KEY (and EMAIL_FROM on a verified domain) in the environment.
// After a patient books — by voice, chat or manual entry — they get a
// confirmation & thank-you email with their appointment details.

import { findUserById, type Appointment } from "./db";
import { sendEmail } from "./email";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "VoiceLine AI <onboarding@resend.dev>";
}

function wallParts(iso: string) {
  return {
    date: iso.split("T")[0] ?? "",
    time: (iso.split("T")[1] ?? "").slice(0, 5),
  };
}

// UAE (GMT+4) wall-clock ISO → the UTC "basic" format Google Calendar wants
// (YYYYMMDDTHHMMSSZ). We store times as naive UAE wall-clock, so shift -4h.
function toGCalUTC(iso: string): string {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  const [, y, mo, d, hh, mm] = m.map(Number) as unknown as number[];
  const ms = Date.UTC(y, mo - 1, d, hh - 4, mm, 0); // -4 = UAE offset
  const dt = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}00Z`;
}

// A "one-click add to Google Calendar" link, like the one in event emails.
export function googleCalendarAddLink(a: Appointment, clinic: string, location?: string): string {
  const start = toGCalUTC(a.startsAt);
  const endIso = a.endsAt || new Date(Date.parse(a.startsAt.replace(/Z?$/, "")) + 30 * 60000).toISOString().slice(0, 19);
  const end = toGCalUTC(endIso);
  if (!start || !end) return "";
  const title = `${a.service ? a.service + " — " : "Appointment — "}${clinic}`;
  const details = [
    a.doctor ? `Doctor: ${a.doctor}` : "",
    a.service ? `Service: ${a.service}` : "",
    `Booked with ${clinic}.`,
  ].filter(Boolean).join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details,
    ...(location ? { location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function sendBookingConfirmation(userId: string, appointment: Appointment): Promise<boolean> {
  const to = appointment.email?.trim();
  if (!to) return false;
  const user = await findUserById(userId);
  const clinic = user?.company || "our clinic";
  const { date, time } = wallParts(appointment.startsAt);

  const rows = [
    ["Patient", appointment.patientName],
    ["Date", date],
    ["Time", time],
    appointment.doctor ? ["Doctor", appointment.doctor] : null,
    appointment.service ? ["Service", appointment.service] : null,
    appointment.phone ? ["Phone", appointment.phone] : null,
  ].filter(Boolean) as [string, string][];

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#6b7280">${k}</td><td style="padding:6px 0;font-weight:600;color:#111827">${v}</td></tr>`
    )
    .join("");

  // Clinic contact block (address, phone, map link) if the clinic filled them in.
  const addr = user?.clinicAddress?.trim();
  const phone = user?.clinicPhone?.trim();
  const map = user?.clinicMapUrl?.trim();
  const contactBits = [
    addr ? `<div style="margin:2px 0"><span style="color:#6b7280">Address:</span> ${addr}</div>` : "",
    phone ? `<div style="margin:2px 0"><span style="color:#6b7280">Phone:</span> ${phone}</div>` : "",
    map ? `<div style="margin:6px 0 0"><a href="${map}" style="color:#301C3F;font-weight:600">📍 View location on the map</a></div>` : "",
  ].join("");
  const contactBlock = contactBits
    ? `<div style="margin:0 0 18px;padding:12px 14px;background:#f9fafb;border-radius:10px;font-size:14px;color:#111827"><div style="font-weight:600;margin:0 0 4px">${clinic}</div>${contactBits}</div>`
    : "";

  // "Add to Google Calendar" button (like event-reminder emails) so the
  // patient can drop the appointment straight into their own calendar.
  const gcalLink = googleCalendarAddLink(appointment, clinic, addr || undefined);
  const calendarBlock = gcalLink
    ? `<div style="margin:0 0 20px">
         <a href="${gcalLink}" target="_blank"
            style="display:inline-block;background:#301C3F;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">
           📅 Add to Google Calendar
         </a>
       </div>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Appointment confirmed ✅</h2>
    <p style="margin:0 0 16px;color:#4b5563">Thank you for booking with ${clinic}. Here are your details:</p>
    <table style="border-collapse:collapse;margin:0 0 18px">${table}</table>
    ${calendarBlock}
    ${contactBlock}
    <p style="margin:0 0 6px;color:#4b5563">If you need to reschedule or cancel, just reply to this email or call us.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:13px">Sent by ${clinic}</p>
  </div>`;

  return sendEmail({
    to,
    subject: `Your appointment on ${date} at ${time} — ${clinic}`,
    html,
  });
}
