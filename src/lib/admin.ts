// Platform admin (operator) identification. The admin oversees ALL tenant
// workspaces. Admins are defined by env — never stored in the DB or editable in
// the UI — so the god-mode view can't be granted by data tampering.
//
//   ADMIN_EMAILS=you@example.com,ops@example.com   (comma-separated)
//   ADMIN_EMAIL=you@example.com                    (single, also accepted)

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
