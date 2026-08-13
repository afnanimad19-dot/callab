"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Star } from "lucide-react";
import type { PlanTier, PlanTierKey } from "@/lib/plans";
import { toast, toastError } from "@/components/Toast";

// Feature rows shown on every plan card. `value` returns what to render for a
// tier: a checkmark, a lock, or a number/label.
const ROWS: { label: string; value: (t: PlanTier) => { on: boolean; text?: string } }[] = [
  { label: "AI agents", value: (t) => ({ on: true, text: String(t.limits.agents) }) },
  { label: "Voice minutes / month", value: (t) => ({ on: true, text: t.limits.minutes.toLocaleString() }) },
  { label: "Knowledge bases", value: (t) => ({ on: true, text: String(t.limits.knowledgeBases) }) },
  { label: "Omnichannel inbox (WhatsApp, Instagram, Messenger)", value: () => ({ on: true }) },
  { label: "Inbound calls", value: () => ({ on: true }) },
  { label: "Google Calendar + Sheets", value: (t) => ({ on: t.features.calendarSheets }) },
  { label: "Outbound call campaigns", value: (t) => ({ on: t.features.outbound }) },
  { label: "Priority support", value: (t) => ({ on: t.features.prioritySupport }) },
];

export default function PlansPanel({
  tiers,
  current,
  agentsUsed,
  isOwner,
}: {
  tiers: PlanTier[];
  current: PlanTierKey;
  agentsUsed: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const currentIndex = tiers.findIndex((t) => t.key === current);

  async function choose(tier: PlanTier) {
    if (!isOwner) return toastError("Only the workspace owner can change the plan.");
    if (tier.key === current) return;
    if (agentsUsed > tier.limits.agents) {
      return toastError(`You have ${agentsUsed} agents — the ${tier.name} plan allows ${tier.limits.agents}. Remove some first.`);
    }
    setBusy(tier.key);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tier.key }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      toast(`You're now on the ${tier.name} plan.`);
      router.refresh();
    } else {
      toastError(data.error ?? "Could not change the plan.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Choose the plan that fits your clinic. Upgrade any time to unlock more agents and features.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((t, i) => {
          const isCurrent = t.key === current;
          const isUpgrade = i > currentIndex;
          return (
            <div
              key={t.key}
              className={`card relative flex flex-col ${isCurrent ? "ring-2 ring-[#301C3F]" : ""}`}
            >
              {t.key === "professional" && (
                <span className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#301C3F] px-2.5 py-0.5 text-[10px] font-bold text-white">
                  <Star className="h-3 w-3" /> MOST POPULAR
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{t.name}</h3>
                {isCurrent && <span className="badge-ok !text-[10px]">Current</span>}
              </div>
              <p className="mt-1 text-sm text-ink-400">{t.tagline}</p>
              <div className="mt-4">
                <span className="text-3xl font-extrabold">{t.priceAED.toLocaleString()}</span>
                <span className="ml-1 text-sm text-ink-400">AED / month</span>
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 border-t border-ink-800 pt-4 text-sm">
                {ROWS.map((row) => {
                  const v = row.value(t);
                  return (
                    <li key={row.label} className="flex items-center gap-2">
                      {v.on ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-ink-500" />
                      )}
                      <span className={v.on ? "text-ink-200" : "text-ink-500"}>
                        {row.label}
                        {v.text ? <span className="font-semibold"> — {v.text}</span> : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => choose(t)}
                disabled={busy === t.key || isCurrent}
                className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                  isCurrent
                    ? "cursor-default bg-ink-800 text-ink-300"
                    : "bg-[#301C3F] text-white hover:opacity-90"
                }`}
              >
                {busy === t.key
                  ? "Working…"
                  : isCurrent
                    ? "Your current plan"
                    : isUpgrade
                      ? `Upgrade to ${t.name}`
                      : `Switch to ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-500">
        Included voice minutes power your AI phone agent. When you run out, top up more anytime from
        Billing → Add Minutes. Changing plans updates your features immediately; card charging is
        handled at checkout (Stripe) — until that&apos;s connected, changes here adjust your
        entitlements for testing.
      </p>
    </div>
  );
}
