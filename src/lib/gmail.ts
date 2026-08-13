// Gmail sending. Uses the GMAIL connection (see google.ts) so confirmation and
// thank-you emails go out FROM the clinic's own Gmail address. Falls back to
// Resend (sendEmail) when Gmail isn't connected but RESEND_API_KEY is set, so
// the flow still works either way.

import { findUserById, type Appointment, type User } from "./db";
import { accessTokenForService, getServiceConn, serviceConnected } from "./google";
import { sendEmail } from "./email";

export function gmailConnected(user: User | null | undefined): boolean {
  return serviceConnected(user, "gmail");
}

// RFC 2822 message → base64url, sent through the Gmail API.
async function sendViaGmail(
  user: User,
  from: string,
  opts: { to: string; subject: string; html: string }
): Promise<boolean> {
  const token = await accessTokenForService(user, "gmail");
  if (!token) return false;
  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ].join("\r\n");
  const raw = Buffer.from(`${headers}\r\n\r\n${opts.html}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) console.error("Gmail send failed:", await res.text());
    return res.ok;
  } catch (e) {
    console.error("Gmail send error:", e);
    return false;
  }
}

// Send an email as the clinic: Gmail first, Resend as fallback.
export async function sendClinicEmail(
  userId: string,
  opts: { to: string; subject: string; html: string }
): Promise<boolean> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.to)) return false;
  const user = await findUserById(userId);
  if (user && gmailConnected(user)) {
    const conn = getServiceConn(user, "gmail");
    const from = conn?.email
      ? `${user.company || "Clinic"} <${conn.email}>`
      : conn?.email ?? user.company ?? "Clinic";
    const ok = await sendViaGmail(user, from, opts);
    if (ok) return true;
    // fall through to Resend if Gmail failed
  }
  return sendEmail(opts);
}

// Nicely formatted booking confirmation / thank-you email.
function wallDate(iso: string) {
  const d = iso.split("T")[0] ?? "";
  const t = (iso.split("T")[1] ?? "").slice(0, 5);
  return { date: d, time: t };
}

export async function sendBookingConfirmation(userId: string, appointment: Appointment): Promise<boolean> {
  const to = appointment.email?.trim();
  if (!to) return false;
  const user = await findUserById(userId);
  const clinic = user?.company || "our clinic";
  const { date, time } = wallDate(appointment.startsAt);

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

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Appointment confirmed ✅</h2>
    <p style="margin:0 0 16px;color:#4b5563">Thank you for booking with ${clinic}. Here are your details:</p>
    <table style="border-collapse:collapse;margin:0 0 18px">${table}</table>
    <p style="margin:0 0 6px;color:#4b5563">If you need to reschedule or cancel, just reply to this email or call us.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:13px">Sent by ${clinic}</p>
  </div>`;

  return sendClinicEmail(userId, {
    to,
    subject: `Your appointment on ${date} at ${time} — ${clinic}`,
    html,
  });
}
