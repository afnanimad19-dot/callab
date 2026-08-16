// Credit metering — modelled on how the voice provider bills: you hold a
// CREDIT balance and each minute of calling spends credits at a fixed rate.
// Used credits are derived from REAL call minutes in the log, so the balance
// reflects actual calls. Included credits come from the workspace's plan.
//
// CREDITS_PER_MINUTE is the rate you charge a client per voice minute. Default
// 1 credit = 1 voice minute (clean for clinics). Change it here to re-price;
// later, other usage (e.g. WhatsApp) can spend the same credits.

import { findDataOwner, listCalls } from "./db";
import { getPlanTier } from "./plans";

export const CREDITS_PER_MINUTE = 1;
export const DEFAULT_INCLUDED_MINUTES = 1000;

export interface Usage {
  // minutes (real, from the call log)
  usedMinutes: number;
  totalMinutes: number;
  remainingMinutes: number;
  // credits (minutes × rate) — the balance shown to the user
  usedCredits: number;
  totalCredits: number;
  remainingCredits: number;
  creditsPerMinute: number;
  pct: number; // 0..100 used
  periodStart: string; // ISO
  over: boolean;
}

// Start of the current monthly cycle: anchored to the plan's start day when
// known, otherwise the first of the calendar month.
function currentPeriodStart(startedAt?: string): string {
  const now = new Date();
  const anchorDay = startedAt ? new Date(startedAt).getUTCDate() : 1;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  // The most recent occurrence of the anchor day, not in the future.
  let start = new Date(Date.UTC(year, month, Math.min(anchorDay, 28)));
  if (start > now) start = new Date(Date.UTC(year, month - 1, Math.min(anchorDay, 28)));
  return start.toISOString();
}

export async function getUsage(userId: string): Promise<Usage> {
  const [owner, calls] = await Promise.all([findDataOwner(userId), listCalls(userId)]);
  const billing = owner?.billing;
  // Plan + top-up minutes come from the ROOT account (shared across its
  // workspaces); calls are metered per active workspace.
  const planMinutes = getPlanTier(owner).limits.minutes;
  const totalMinutes = planMinutes + (billing?.topupMinutes ?? 0);
  const periodStart = currentPeriodStart(billing?.startedAt);
  const usedSec = calls
    .filter((c) => c.startedAt >= periodStart)
    .reduce((s, c) => s + (c.durationSec || 0), 0);
  const usedMinutes = Math.round((usedSec / 60) * 10) / 10;
  const remainingMinutes = Math.max(0, Math.round((totalMinutes - usedMinutes) * 10) / 10);
  const pct = totalMinutes ? Math.min(100, Math.round((usedMinutes / totalMinutes) * 100)) : 0;
  return {
    usedMinutes,
    totalMinutes,
    remainingMinutes,
    usedCredits: Math.round(usedMinutes * CREDITS_PER_MINUTE * 10) / 10,
    totalCredits: Math.round(totalMinutes * CREDITS_PER_MINUTE * 10) / 10,
    remainingCredits: Math.round(remainingMinutes * CREDITS_PER_MINUTE * 10) / 10,
    creditsPerMinute: CREDITS_PER_MINUTE,
    pct,
    periodStart,
    over: usedMinutes >= totalMinutes,
  };
}
