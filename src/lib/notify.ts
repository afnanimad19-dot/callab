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

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Appointment confirmed ✅</h2>
    <p style="margin:0 0 16px;color:#4b5563">Thank you for booking with ${clinic}. Here are your details:</p>
    <table style="border-collapse:collapse;margin:0 0 18px">${table}</table>
    <p style="margin:0 0 6px;color:#4b5563">If you need to reschedule or cancel, just reply to this email or call us.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:13px">Sent by ${clinic}</p>
  </div>`;

  return sendEmail({
    to,
    subject: `Your appointment on ${date} at ${time} — ${clinic}`,
    html,
  });
}
