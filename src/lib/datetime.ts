// Resolve a spoken/typed date-time ("tomorrow at 3pm", "next Monday 10:00",
// an ISO string) into an absolute ISO datetime. Returns null when it can't be
// understood, so the agent knows to ask again instead of inventing a date.
export function resolveWhen(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

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
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const wd = days.findIndex((d) => lower.includes(d));
  if (lower.includes("today")) { /* target stays today */ }
  else if (lower.includes("tomorrow")) target.setDate(target.getDate() + 1);
  else if (wd >= 0) {
    let diff = (wd - now.getDay() + 7) % 7;
    if (lower.includes("next") && diff <= 7) diff += 7;
    target.setDate(now.getDate() + (diff === 0 ? 7 : diff));
  } else {
    return null;
  }
  return target.toISOString();
}
