// Minute metering. The billing period's used minutes are summed from the
// actual call log, so the balance bar reflects real calls — no static number.
// Included minutes come from the workspace's plan (billing.minutesTotal),
// defaulting to 1,000 when a plan hasn't been set.

import { findUserById, listCalls } from "./db";

export const DEFAULT_INCLUDED_MINUTES = 1000;

export interface Usage {
  usedMinutes: number;
  totalMinutes: number;
  remainingMinutes: number;
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
  const [user, calls] = await Promise.all([findUserById(userId), listCalls(userId)]);
  const billing = user?.billing;
  const totalMinutes =
    billing?.minutesTotal && billing.minutesTotal > 0 ? billing.minutesTotal : DEFAULT_INCLUDED_MINUTES;
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
    pct,
    periodStart,
    over: usedMinutes >= totalMinutes,
  };
}
