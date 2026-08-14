import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById, updateUser, newId, BillingState, BillingCard } from "@/lib/db";
import { getUsage } from "@/lib/usage";

// Workspace billing: minutes balance, plan, add-ons, payment methods, and
// billing history. Stored on the owner's user record. Purchases update the
// balances and write history entries; real card charging arrives with the
// Stripe integration (cards store display metadata only, never full numbers).

const PLANS = [
  { name: "1000 minutes - Monthly", price: 150, minutes: 1000 },
  { name: "5000 minutes - Monthly", price: 500, minutes: 5000 },
  { name: "10000 minutes - Monthly", price: 900, minutes: 10000 },
];

const MINUTE_PRICE = 0.15;
const ADDON_PRICE = 10;

function defaultBilling(): BillingState {
  const started = new Date();
  started.setDate(Math.min(started.getDate(), 26));
  return {
    planName: "5000 minutes - Monthly",
    planPrice: 500,
    planMinutes: 5000,
    startedAt: started.toISOString(),
    minutesTotal: 10000,
    minutesUsed: 16.2,
    addons: { workspace: 0, knowledgeBase: 0 },
    cards: [],
    history: [
      {
        id: newId("inv"),
        description: "Subscription Payment",
        detail: "Subscription Transaction",
        date: started.toISOString(),
        amount: 500,
        status: "Paid",
      },
    ],
  };
}

async function loadBilling(userId: string): Promise<BillingState> {
  const owner = await findUserById(userId);
  return owner?.billing ?? defaultBilling();
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const billing = await loadBilling(session.userId);
  // Show REAL minutes used this cycle (summed from the call log), not a static
  // figure — so the balance here matches the sidebar bar.
  const usage = await getUsage(session.userId);
  billing.minutesUsed = usage.usedMinutes;
  billing.minutesTotal = usage.totalMinutes;
  return NextResponse.json({ billing, plans: PLANS, minutePrice: MINUTE_PRICE, addonPrice: ADDON_PRICE });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role && session.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can manage billing." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const billing = await loadBilling(session.userId);
  const now = new Date().toISOString();

  switch (body?.action) {
    case "addMinutes": {
      const minutes = Math.min(100000, Math.max(1, Math.round(Number(body.minutes) || 0)));
      const amount = Math.round(minutes * MINUTE_PRICE * 100) / 100;
      billing.topupMinutes = (billing.topupMinutes ?? 0) + minutes;
      billing.history.unshift({
        id: newId("inv"),
        description: "Minutes Top-up",
        detail: `${minutes} calling minutes`,
        date: now,
        amount,
        status: "Paid",
      });
      break;
    }
    case "addCard": {
      if (billing.cards.length >= 5) {
        return NextResponse.json({ error: "You can save at most 5 cards." }, { status: 400 });
      }
      const digits = String(body.cardNumber ?? "").replace(/\D/g, "");
      if (digits.length < 12) {
        return NextResponse.json({ error: "Enter a valid card number." }, { status: 400 });
      }
      const card: BillingCard = {
        id: newId("card"),
        holder: String(body.holder ?? "").slice(0, 80),
        last4: digits.slice(-4),
        expMonth: String(body.expMonth ?? "").slice(0, 2),
        expYear: String(body.expYear ?? "").slice(0, 4),
        address: String(body.address ?? "").slice(0, 160),
        city: String(body.city ?? "").slice(0, 80),
        country: String(body.country ?? "").slice(0, 60),
        taxNumber: String(body.taxNumber ?? "").slice(0, 40) || undefined,
        isDefault: billing.cards.length === 0,
      };
      if (!card.holder) return NextResponse.json({ error: "Cardholder name is required." }, { status: 400 });
      billing.cards.push(card);
      break;
    }
    case "removeCard": {
      billing.cards = billing.cards.filter((c) => c.id !== body.cardId);
      if (!billing.cards.some((c) => c.isDefault) && billing.cards[0]) {
        billing.cards[0].isDefault = true;
      }
      break;
    }
    case "setDefaultCard": {
      billing.cards = billing.cards.map((c) => ({ ...c, isDefault: c.id === body.cardId }));
      break;
    }
    case "purchaseAddon": {
      const type = body.type === "knowledgeBase" ? "knowledgeBase" : "workspace";
      const qty = Math.min(50, Math.max(1, Math.round(Number(body.quantity) || 1)));
      billing.addons[type] += qty;
      billing.history.unshift({
        id: newId("inv"),
        description: "Add-on Purchase",
        detail: `${qty} × ${type === "workspace" ? "Workspace" : "Knowledge Base"} add-on`,
        date: now,
        amount: qty * ADDON_PRICE,
        status: "Paid",
      });
      break;
    }
    case "changePlan": {
      const plan = PLANS.find((p) => p.name === body.planName);
      if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      if (plan.name !== billing.planName) {
        billing.planName = plan.name;
        billing.planPrice = plan.price;
        // Adjust the pool by the difference in plan allowances.
        billing.minutesTotal = Math.max(
          billing.minutesUsed,
          billing.minutesTotal - billing.planMinutes + plan.minutes
        );
        billing.planMinutes = plan.minutes;
        billing.startedAt = now;
        billing.history.unshift({
          id: newId("inv"),
          description: "Subscription Payment",
          detail: `Plan changed to ${plan.name}`,
          date: now,
          amount: plan.price,
          status: "Paid",
        });
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  billing.history = billing.history.slice(0, 50);
  await updateUser(session.userId, { billing });
  return NextResponse.json({ billing });
}
