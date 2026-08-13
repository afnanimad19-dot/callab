// Subscription plan tiers (AED / month). Each tier unlocks features and sets
// limits; locked features show a lock + "Upgrade" prompt in the UI, and the
// hard limits (e.g. agent count) are enforced server-side. Real charging comes
// with the Stripe integration — changing tier here updates entitlements.

import type { User } from "./db";

export type PlanTierKey = "starter" | "professional" | "business";

export interface PlanTier {
  key: PlanTierKey;
  name: string;
  priceAED: number;
  tagline: string;
  limits: {
    agents: number; // max AI agents
    minutes: number; // included voice minutes / month
  };
  features: {
    allChannels: boolean; // Instagram + Messenger (WhatsApp always on)
    outbound: boolean; // outbound call campaigns
    broadcast: boolean; // WhatsApp broadcast / bulk template sends
    calendarSheets: boolean; // Google Calendar + Sheets
    prioritySupport: boolean;
  };
}

export const PLAN_TIERS: PlanTier[] = [
  {
    key: "starter",
    name: "Starter",
    priceAED: 1500,
    tagline: "Get started with an AI receptionist on WhatsApp & inbound calls.",
    limits: { agents: 2, minutes: 1000 },
    features: {
      allChannels: false,
      outbound: false,
      broadcast: false,
      calendarSheets: true,
      prioritySupport: false,
    },
  },
  {
    key: "professional",
    name: "Professional",
    priceAED: 3000,
    tagline: "The full clinic setup — every channel and outbound campaigns.",
    limits: { agents: 5, minutes: 3000 },
    features: {
      allChannels: true,
      outbound: true,
      broadcast: false,
      calendarSheets: true,
      prioritySupport: true,
    },
  },
  {
    key: "business",
    name: "Business",
    priceAED: 5000,
    tagline: "Scale across locations with broadcasts and priority support.",
    limits: { agents: 15, minutes: 6000 },
    features: {
      allChannels: true,
      outbound: true,
      broadcast: true,
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

// The lowest tier that unlocks a given feature — used for "Upgrade to X" copy.
export function tierForFeature(feature: keyof PlanTier["features"]): PlanTier | null {
  return PLAN_TIERS.find((p) => p.features[feature]) ?? null;
}
