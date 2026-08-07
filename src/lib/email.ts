// Email sending via Resend (set RESEND_API_KEY + EMAIL_FROM). When not
// configured, sendEmail returns false and callers fall back to showing the
// invite details in the UI so the flow still works end to end.

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "VoiceLine AI <onboarding@resend.dev>",
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("Email send failed:", e);
    return false;
  }
}
