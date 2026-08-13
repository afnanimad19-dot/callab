// Custom lifecycle pipeline stages. Each workspace can rename, recolor, add,
// remove and reorder the stages a conversation moves through. Stored on the
// workspace's ChannelSettings row (lifecycleStages); when unset, the defaults
// below apply so existing inboxes keep working.

export interface LifecycleStage {
  key: string; // stable id used on conversations
  label: string; // display name
  color: string; // palette key (see STAGE_COLORS)
}

export const DEFAULT_STAGES: LifecycleStage[] = [
  { key: "new_lead", label: "New Lead", color: "blue" },
  { key: "hot_lead", label: "Hot Lead", color: "orange" },
  { key: "payment", label: "Payment", color: "violet" },
  { key: "customer", label: "Customer", color: "emerald" },
];

// Palette: chip = list/badge style, dot = the small rail dot.
export const STAGE_COLORS: Record<string, { chip: string; dot: string }> = {
  blue: { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  orange: { chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  violet: { chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  emerald: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  red: { chip: "bg-red-100 text-red-700", dot: "bg-red-500" },
  amber: { chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  teal: { chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
  pink: { chip: "bg-pink-100 text-pink-700", dot: "bg-pink-500" },
  slate: { chip: "bg-slate-200 text-slate-700", dot: "bg-slate-500" },
};
export const STAGE_COLOR_KEYS = Object.keys(STAGE_COLORS);

export function colorOf(color: string) {
  return STAGE_COLORS[color] ?? STAGE_COLORS.slate;
}

// Normalize/clean an incoming stage list (from the editor). Ensures unique,
// slugged keys and valid colors, and never returns an empty list.
export function sanitizeStages(input: unknown): LifecycleStage[] {
  if (!Array.isArray(input)) return DEFAULT_STAGES;
  const seen = new Set<string>();
  const out: LifecycleStage[] = [];
  for (const raw of input) {
    const label = String((raw as LifecycleStage)?.label ?? "").trim().slice(0, 40);
    if (!label) continue;
    let key = String((raw as LifecycleStage)?.key ?? "").trim();
    if (!key) key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!key) key = `stage_${out.length + 1}`;
    while (seen.has(key)) key = `${key}_${out.length + 1}`;
    seen.add(key);
    const color = STAGE_COLORS[String((raw as LifecycleStage)?.color ?? "")] ? (raw as LifecycleStage).color : STAGE_COLOR_KEYS[out.length % STAGE_COLOR_KEYS.length];
    out.push({ key, label, color });
    if (out.length >= 12) break; // sane cap
  }
  return out.length ? out : DEFAULT_STAGES;
}

export function resolveStages(stages?: LifecycleStage[]): LifecycleStage[] {
  return stages && stages.length ? stages : DEFAULT_STAGES;
}
