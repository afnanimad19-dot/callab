// Resolve a spoken/typed date-time ("tomorrow at 3pm", "next Monday 10:00",
// an ISO string) into a WALL-CLOCK datetime string (no timezone suffix), e.g.
// "2026-08-14T10:00:00". Appointment times are wall-clock — 10am means 10am to
// everyone — so we deliberately DON'T attach a timezone/offset. Attaching one
// (like a trailing "Z") makes the calendar convert it to the viewer's timezone
// and shift the hour, which is the "booked 10am, shows 2pm" bug.
// Returns null when it can't be understood, so the agent asks again.

const pad = (n: number) => String(n).padStart(2, "0");
function naive(y: number, mo: number, d: number, hh: number, mm: number): string {
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
}

export function resolveWhen(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // Explicit date + time (with or without a trailing Z / offset). Read the
  // wall-clock components straight off the string — never convert timezone.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/);
  if (iso) {
    return naive(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5]);
  }

  const now = new Date();
  const lower = s.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = 10, minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3] === "pm" && hour < 12) hour += 12;
    if (timeMatch[3] === "am" && hour === 12) hour = 0;
  }

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = days.findIndex((d) => lower.includes(d));
  const target = new Date(now);
  if (lower.includes("today")) { /* today */ }
  else if (lower.includes("tomorrow")) target.setDate(target.getDate() + 1);
  else if (wd >= 0) {
    let diff = (wd - now.getDay() + 7) % 7;
    if (lower.includes("next") && diff <= 7) diff += 7;
    if (diff === 0) diff = 7;
    target.setDate(now.getDate() + diff);
  } else {
    // A plain date like "August 14" — take its calendar day, keep the parsed time.
    const p = Date.parse(s);
    if (Number.isNaN(p)) return null;
    const pd = new Date(p);
    return naive(pd.getFullYear(), pd.getMonth(), pd.getDate(), hour, minute);
  }
  return naive(target.getFullYear(), target.getMonth(), target.getDate(), hour, minute);
}
