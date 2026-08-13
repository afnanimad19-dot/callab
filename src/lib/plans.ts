// Subscription plan tiers (AED / month). Each tier unlocks features and sets
// limits; locked features show a lock + "Upgrade" prompt in the UI, and the
// hard limits (agents, knowledge bases, minutes) are enforced server-side.
// Real charging comes with the Stripe integration — until then, changing tier
// updates entitlements so the gating can be tested.
//
// VOICE MINUTES — how the numbers were chosen:
//   The voice pipeline (Vapi) costs us, all-in, roughly $0.10 / minute
//   (Vapi platform fee + speech-to-text + LLM + text-to-speech + telephony).
//   Each plan bundles a block of minutes whose COST stays a small fraction of
//   the plan price, so voice is covered with healthy margin:
//     Starter  300 min  ≈ $30 cost   (plan ≈ $408)  → big margin
//     Pro      800 min  ≈ $80 cost   (plan ≈ $817)
//     Business 2000 min ≈ $200 cost  (plan ≈ $1362)
//   When a clinic runs out, they top up add-on minutes (billing → Add Minutes).

import type { User } from "./db";

export type PlanTierKey = "starter" | "professional" | "business";

// Approximate all-in Vapi cost per voice minute (USD). Used to show clinics the
// cost basis and to size each plan's minute bundle.
export const VAPI_COST_PER_MINUTE_USD = 0.1;

export interface PlanTier {
  key: PlanTierKey;
  name: string;
  priceAED: number;
  tagline: string;
  limits: {
    agents: number; // max AI agents
    minutes: number; // included voice minutes / month
    knowledgeBases: number; // max knowledge base items
  };
  features: {
    outbound: boolean; // outbound call campaigns ("Launch your AI")
    calendarSheets: boolean; // Google Calendar + Sheets
    prioritySupport: boolean;
  };
}

export const PLAN_TIERS: PlanTier[] = [
  {
    key: "starter",
    name: "Starter",
    priceAED: 1500,
    tagline: "An AI receptionist on WhatsApp, chat and inbound calls.",
    limits: { agents: 2, minutes: 300, knowledgeBases: 3 },
    features: {
      outbound: false,
      calendarSheets: true,
      prioritySupport: false,
    },
  },
  {
    key: "professional",
    name: "Professional",
    priceAED: 3000,
    tagline: "The full clinic setup — inbound and outbound campaigns.",
    limits: { agents: 5, minutes: 800, knowledgeBases: 10 },
    features: {
      outbound: true,
      calendarSheets: true,
      prioritySupport: true,
    },
  },
  {
    key: "business",
    name: "Business",
    priceAED: 5000,
    tagline: "Scale across locations with more agents, minutes and support.",
    limits: { agents: 15, minutes: 2000, knowledgeBases: 50 },
    features: {
      outbound: true,
      calendarSheets: true,
      prioritySupport: true,
    },
  },
];

export const DEFAULT_TIER: PlanTierKey = "professional";

export function getPlanTier(user: User | null | undefined): PlanTier {
  const key = (user?.planTier as PlanTierKey) || DEFAULT_TIER;
  return PLAN_TIERS.find((p) => p.key === key) ?? PLAN_TIERS[1];
}

export function planFeature(user: User | null | undefined, feature: keyof PlanTier["features"]): boolean {
  return getPlanTier(user).features[feature];
}

export function agentLimit(user: User | null | undefined): number {
  return getPlanTier(user).limits.agents;
}

export function knowledgeBaseLimit(user: User | null | undefined): number {
  return getPlanTier(user).limits.knowledgeBases;
}

// The lowest tier that unlocks a given feature — used for "Upgrade to X" copy.
export function tierForFeature(feature: keyof PlanTier["features"]): PlanTier | null {
  return PLAN_TIERS.find((p) => p.features[feature]) ?? null;
}
