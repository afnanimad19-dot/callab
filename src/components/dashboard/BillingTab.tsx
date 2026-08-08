"use client";

// Billing tab — Callab-style layout with FUNCTIONAL flows:
//  - Add Minutes: right slide-over with quantity stepper, rate, and summary
//  - Manage Payment Methods: right slide-over, card list (max 5), Add Card
//    form (holder, card details, billing address/city/country, tax number)
//  - Change Subscription Plan: right slide-over with plan options
//  - Workspace / Knowledge Base "+" add-ons: centered purchase modal
// Purchases update the workspace billing state and billing history.

import { useEffect, useState } from "react";
import {
  Clock,
  Settings2,
  PlusCircle,
  Users as UsersIcon,
  Calendar,
  ArrowRight,
  Zap,
  CreditCard,
  ShieldCheck,
  Download,
  Database,
  BookOpen,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  ShoppingCart,
  MoreHorizontal,
} from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import type { BillingState, BillingCard } from "@/lib/db";

interface Plan {
  name: string;
  price: number;
  minutes: number;
}

interface BillingData {
  billing: BillingState;
  plans: Plan[];
  minutePrice: number;
  addonPrice: number;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMinutes(remaining: number) {
  const whole = Math.floor(remaining);
  const secs = Math.round((remaining - whole) * 60);
  return `${whole}:${String(secs).padStart(2, "0")}`;
}

export default function BillingTab() {
  const [data, setData] = useState<BillingData | null>(null);
  const [historyTab, setHistoryTab] = useState<"Billing History" | "Usage History" | "Minutes History">(
    "Billing History"
  );
  const [panel, setPanel] = useState<"minutes" | "payments" | "plan" | null>(null);
  const [addon, setAddon] = useState<"workspace" | "knowledgeBase" | null>(null);

  async function load() {
    const res = await fetch("/api/billing");
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function act(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toastError(json.error ?? "That didn't work — try again.");
      return false;
    }
    setData((d) => (d ? { ...d, billing: json.billing } : d));
    return true;
  }

  if (!data) {
    return <div className="card !p-10 text-center text-sm text-ink-400">Loading billing…</div>;
  }

  const b = data.billing;
  const remaining = Math.max(0, b.minutesTotal - b.minutesUsed);
  const pct = b.minutesTotal ? Math.round((remaining / b.minutesTotal) * 100) : 0;
  const nextBilling = new Date(b.startedAt);
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const defaultCard = b.cards.find((c) => c.isDefault) ?? b.cards[0];

  const minutesHistory = b.history.filter((h) => h.description === "Minutes Top-up");
  const usageHistory = b.history.filter((h) => h.description === "Add-on Purchase");

  return (
    <div className="space-y-5">
      {/* Minutes balance */}
      <div className="card !p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-ink-400" />
            <div>
              <p className="text-sm font-semibold">Minutes Balance</p>
              <p className="text-xs text-ink-400">Available calling minutes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight">{fmtMinutes(remaining)}</p>
            <p className="text-xs text-ink-400">of {b.minutesTotal.toLocaleString()} minutes</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
          <div className="h-full rounded-full bg-[#301C3F]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-ink-400">{pct}% remaining</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            className="btn-secondary flex items-center gap-2 !py-2 !text-sm"
            onClick={() => toast("Auto-recharge activates with the Stripe integration.")}
          >
            <Settings2 className="h-4 w-4" /> Auto-recharge
          </button>
          <button className="btn-dark flex items-center gap-2 !py-2.5" onClick={() => setPanel("minutes")}>
            <PlusCircle className="h-4 w-4" /> Add Minutes
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Plan */}
        <div className="card flex flex-col !p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">{b.planName}</h2>
              <p className="mt-0.5 text-sm text-ink-400">Your subscription details and plan information</p>
            </div>
            <span className="badge-ok">Active</span>
          </div>
          <div className="mt-4 rounded-xl border border-ink-700 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Monthly Price</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">${b.planPrice.toFixed(2)}</p>
              </div>
              <span className="rounded-full border border-ink-700 px-3 py-1 text-xs font-semibold">Monthly</span>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-ink-700 pt-4 text-sm">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-ink-400" />
                <span>
                  <span className="block text-xs text-ink-400">Started</span>
                  <span className="font-semibold">{fmtDate(b.startedAt)}</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-400" />
              <span className="flex items-center gap-2 text-right">
                <span>
                  <span className="block text-xs text-ink-400">Next Billing</span>
                  <span className="font-semibold">{fmtDate(nextBilling)}</span>
                </span>
                <Calendar className="h-4 w-4 text-ink-400" />
              </span>
            </div>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-wide text-ink-400">Included Features</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <FeatureTile icon={Clock} label="Minutes" value={b.planMinutes.toFixed(2)} />
            <FeatureTile icon={UsersIcon} label="Concurrency Limit" value="5" />
            <FeatureTile
              icon={Database}
              label="Workspace"
              value={String(5 + b.addons.workspace)}
              onAdd={() => setAddon("workspace")}
            />
            <FeatureTile
              icon={BookOpen}
              label="Knowledge Base"
              value={String(5 + b.addons.knowledgeBase)}
              onAdd={() => setAddon("knowledgeBase")}
            />
          </div>
          <div className="mt-5 flex flex-1 items-end justify-end">
            <button className="btn-secondary flex items-center gap-2" onClick={() => setPanel("plan")}>
              <Zap className="h-4 w-4" /> Change Plan
            </button>
          </div>
        </div>

        {/* Payment methods */}
        <div className="card flex flex-col !p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Payment Methods</h2>
              <p className="mt-0.5 text-sm text-ink-400">Manage your billing and payment options</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by Stripe
            </span>
          </div>
          <div className="mt-4 rounded-xl border border-ink-700 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-ink-400">Default Payment Method</p>
              {defaultCard && <span className="badge-ok">Default</span>}
            </div>
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#0D1526] p-6 text-white">
              <span className="absolute right-5 top-5 text-white/50">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="block h-8 w-11 rounded-md bg-amber-400" />
              <p className="mt-5 font-mono text-sm tracking-[0.3em] text-white/80">
                {defaultCard ? `•••• •••• •••• ${defaultCard.last4}` : "•••• •••• •••• ••••"}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <span>
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Expires</p>
                  <p className="font-mono text-sm">
                    {defaultCard ? `${defaultCard.expMonth}/${defaultCard.expYear.slice(-2)}` : "00/0"}
                  </p>
                </span>
                {defaultCard && <span className="text-xs text-white/60">{defaultCard.holder}</span>}
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-300">
              This card will be used for subscription renewals, add-on purchases, and auto-recharge payments.
            </p>
            <p className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3 text-sm">
              <span className="flex items-center gap-2 text-ink-400">
                <CreditCard className="h-4 w-4" /> Total payment methods
              </span>
              <span className="font-bold">{b.cards.length}</span>
            </p>
          </div>
          <div className="mt-5 flex flex-1 items-end justify-end">
            <button className="btn-secondary flex items-center gap-2" onClick={() => setPanel("payments")}>
              <CreditCard className="h-4 w-4" /> Manage Payment Methods
            </button>
          </div>
        </div>
      </div>

      {/* Billing history */}
      <div className="card !p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Billing History</h2>
            <p className="mt-0.5 text-sm text-ink-400">View and download your past invoices</p>
          </div>
          <div className="flex rounded-xl bg-ink-800 p-1">
            {(["Billing History", "Usage History", "Minutes History"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setHistoryTab(t)}
                className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                  historyTab === t ? "bg-ink-950 text-ink-100 shadow-sm" : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <HistoryTable
          rows={
            historyTab === "Billing History"
              ? b.history
              : historyTab === "Minutes History"
                ? minutesHistory
                : usageHistory
          }
          emptyText={
            historyTab === "Usage History"
              ? "Add-on purchases appear here."
              : "Minute top-ups appear here."
          }
        />
      </div>

      {/* Flows */}
      {panel === "minutes" && (
        <AddMinutesPanel
          minutePrice={data.minutePrice}
          card={defaultCard}
          onClose={() => setPanel(null)}
          onPurchase={async (minutes) => {
            if (await act({ action: "addMinutes", minutes })) {
              toast(`${minutes} minutes added to your balance.`);
              setPanel(null);
            }
          }}
        />
      )}
      {panel === "payments" && (
        <ManagePaymentsPanel
          cards={b.cards}
          onClose={() => setPanel(null)}
          onAction={act}
        />
      )}
      {panel === "plan" && (
        <ChangePlanPanel
          plans={data.plans}
          current={b.planName}
          onClose={() => setPanel(null)}
          onConfirm={async (planName) => {
            if (await act({ action: "changePlan", planName })) {
              toast("Subscription plan updated.");
              setPanel(null);
            }
          }}
        />
      )}
      {addon && (
        <PurchaseAddonModal
          type={addon}
          planIncluded={5}
          currentAddons={b.addons[addon]}
          unitPrice={data.addonPrice}
          onClose={() => setAddon(null)}
          onPurchase={async (quantity) => {
            if (await act({ action: "purchaseAddon", type: addon, quantity })) {
              toast(`Add-on purchased — ${addon === "workspace" ? "workspace" : "knowledge base"} allocation increased.`);
              setAddon(null);
            }
          }}
        />
      )}
    </div>
  );
}

function FeatureTile({
  icon: Icon,
  label,
  value,
  onAdd,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  onAdd?: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-ink-700 px-4 py-3.5">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label={`Buy more ${label}`}
          title={`Buy more ${label.toLowerCase()} ($10/unit monthly)`}
          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-ink-700 text-ink-400 transition hover:border-[#301C3F] hover:text-[#301C3F]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function HistoryTable({ rows, emptyText }: { rows: BillingState["history"]; emptyText: string }) {
  if (rows.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-ink-700 px-4 py-12 text-center text-sm text-ink-400">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-ink-700">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-ink-700 text-left text-xs text-ink-400">
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Invoices</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/70">
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-3.5">
                <span className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 shrink-0 text-accent-300" />
                  <span>
                    <span className="block font-semibold">{inv.description}</span>
                    <span className="block text-xs text-ink-400">{inv.detail}</span>
                  </span>
                </span>
              </td>
              <td className="px-4 py-3.5">
                <span className="block">{fmtDate(inv.date)}</span>
                <span className="block text-xs text-ink-400">
                  {new Date(inv.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </td>
              <td className="px-4 py-3.5 font-semibold">${inv.amount.toFixed(2)}</td>
              <td className="px-4 py-3.5">
                <span className="badge-ok">{inv.status}</span>
              </td>
              <td className="px-4 py-3.5 text-right">
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-ink-100"
                  onClick={() => toast("Invoice PDFs arrive with the Stripe integration.")}
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Add Minutes slide-over --------------------------------------------------

function AddMinutesPanel({
  minutePrice,
  card,
  onClose,
  onPurchase,
}: {
  minutePrice: number;
  card?: BillingCard;
  onClose: () => void;
  onPurchase: (minutes: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const total = Math.round(minutes * minutePrice * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-ink-400" />
            <div>
              <h2 className="text-base font-bold">Add Minutes</h2>
              <p className="text-xs text-ink-400">Purchase calling minutes for your account</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Minutes to add</p>
              <p className="text-xs font-medium text-accent-600">${minutePrice.toFixed(2)}/min</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setMinutes((m) => Math.max(1, m - 30))}
                aria-label="Less"
                className="btn-secondary !px-3.5 !py-2.5"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={1}
                className="field text-center"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              />
              <button
                onClick={() => setMinutes((m) => m + 30)}
                aria-label="More"
                className="btn-secondary !px-3.5 !py-2.5"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-ink-400" /> Payment Method
              </p>
              <p className="text-xs text-ink-400">{card ? "1 card" : "no card"}</p>
            </div>
            {card ? (
              <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-[#301C3F] px-4 py-3">
                <span className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-ink-300" />
                  <span className="font-mono text-sm">•••• {card.last4}</span>
                  {card.isDefault && <span className="badge-ok">Default</span>}
                </span>
                <CheckCircle2 className="h-5 w-5 text-[#301C3F]" />
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                No card saved yet — add one under Manage Payment Methods. The purchase still records to
                your account until Stripe charging is connected.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-ink-700 px-5 py-4">
          <p className="flex items-center justify-between text-sm text-ink-400">
            <span>
              {minutes} min × ${minutePrice.toFixed(2)}
            </span>
            <span>${total.toFixed(2)}</span>
          </p>
          <p className="mt-1 flex items-center justify-between text-base">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold">${total.toFixed(2)}</span>
          </p>
          <button
            onClick={async () => {
              setBusy(true);
              await onPurchase(minutes);
              setBusy(false);
            }}
            disabled={busy}
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2 !py-3 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> {busy ? "Processing…" : "Purchase Minutes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Manage Payment Methods slide-over --------------------------------------

function ManagePaymentsPanel({
  cards,
  onClose,
  onAction,
}: {
  cards: BillingCard[];
  onClose: () => void;
  onAction: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
          setMenuFor(null);
        }}
      >
        <div className="flex items-start justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-5 w-5 text-ink-400" />
            <div>
              <h2 className="text-base font-bold">Manage Payment Methods</h2>
              <p className="text-xs text-ink-400">View, update, or remove your saved cards</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {cards.length === 0 && (
            <p className="rounded-xl border border-ink-700 px-4 py-10 text-center text-sm text-ink-400">
              No cards saved yet — add your first one below.
            </p>
          )}
          {cards.map((c) => (
            <div key={c.id} className="relative flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-ink-300" />
                <span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm">•••• {c.last4}</span>
                    {c.isDefault && <span className="badge-ok">Default</span>}
                  </span>
                  <span className="block text-xs text-ink-400">
                    Expires {c.expMonth}/{c.expYear.slice(-2)} · {c.holder}
                  </span>
                </span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuFor(menuFor === c.id ? null : c.id);
                }}
                aria-label="Card actions"
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuFor === c.id && (
                <div className="absolute right-3 top-12 z-20 w-40 overflow-hidden rounded-xl border border-ink-700 bg-ink-950 py-1 shadow-xl shadow-black/20">
                  {!c.isDefault && (
                    <button
                      onClick={() => {
                        setMenuFor(null);
                        onAction({ action: "setDefaultCard", cardId: c.id });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink-200 transition hover:bg-ink-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Set default
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuFor(null);
                      onAction({ action: "removeCard", cardId: c.id }).then((ok) => ok && toast("Card removed."));
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-signal-red transition hover:bg-ink-800"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-5 py-4">
          <button
            onClick={() => setAdding(true)}
            disabled={cards.length >= 5}
            className="btn-secondary flex flex-1 items-center justify-center gap-2 !py-2.5 disabled:opacity-50"
            title={cards.length >= 5 ? "Maximum of 5 cards" : "Add a card"}
          >
            <PlusCircle className="h-4 w-4" /> Add Card
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">
            Close
          </button>
        </div>

        {adding && (
          <AddCardModal
            onClose={() => setAdding(false)}
            onSave={async (card) => {
              const ok = await onAction({ action: "addCard", ...card });
              if (ok) {
                toast("Card added.");
                setAdding(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddCardModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (card: Record<string, string>) => Promise<void>;
}) {
  const [holder, setHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Add Card</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by Stripe
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Cardholder</label>
            <input className="field" placeholder="Name on card" value={holder} onChange={(e) => setHolder(e.target.value)} />
          </div>
          <div>
            <label className="label">Card details</label>
            <input
              className="field font-mono !text-[13px]"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, "").slice(0, 19))}
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input className="field text-center" placeholder="MM" maxLength={2}
                value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ""))} />
              <input className="field text-center" placeholder="YYYY" maxLength={4}
                value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ""))} />
              <input className="field text-center" placeholder="CVC" maxLength={4}
                value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))} />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Only the last 4 digits are stored — full numbers are handled by the payment provider.
            </p>
          </div>
          <div>
            <label className="label">Billing address</label>
            <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Billing city</label>
              <input className="field" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="label">Billing country</label>
              <input className="field" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Tax number <span className="text-ink-500">(optional)</span></label>
            <input className="field" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={async () => {
                setBusy(true);
                await onSave({ holder, cardNumber, expMonth, expYear, address, city, country, taxNumber });
                setBusy(false);
              }}
              disabled={busy || !holder.trim() || cardNumber.replace(/\D/g, "").length < 12}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" /> {busy ? "Adding…" : "Add Card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Change Plan slide-over --------------------------------------------------

function ChangePlanPanel({
  plans,
  current,
  onClose,
  onConfirm,
}: {
  plans: Plan[];
  current: string;
  onClose: () => void;
  onConfirm: (planName: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col border-l border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-ink-400" />
            <div>
              <h2 className="text-base font-bold">Change Subscription Plan</h2>
              <p className="text-xs text-ink-400">Select a new plan for your subscription</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {plans.map((p) => {
            const isCurrent = p.name === current;
            const isSelected = p.name === selected;
            return (
              <button
                key={p.name}
                onClick={() => setSelected(p.name)}
                className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-4 text-left transition ${
                  isSelected ? "border-[#301C3F] bg-[#301C3F]/5" : "border-ink-700 hover:bg-ink-800/40"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {p.name}
                    {isCurrent && <span className="badge-muted">Current</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {p.minutes.toLocaleString()} calling minutes · 5 workspaces · 5 knowledge bases
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold">${p.price}</span>
                  <span className="block text-xs text-ink-400">/month</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-5 py-4">
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm(selected);
              setBusy(false);
            }}
            disabled={busy || selected === current}
            className="btn-primary flex-1 !py-2.5 disabled:opacity-50"
          >
            {busy ? "Updating…" : "Confirm Change"}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Purchase Add-on modal ---------------------------------------------------

function PurchaseAddonModal({
  type,
  planIncluded,
  currentAddons,
  unitPrice,
  onClose,
  onPurchase,
}: {
  type: "workspace" | "knowledgeBase";
  planIncluded: number;
  currentAddons: number;
  unitPrice: number;
  onClose: () => void;
  onPurchase: (quantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const label = type === "workspace" ? "Workspace" : "Knowledge Base";
  const Icon = type === "workspace" ? Database : BookOpen;
  const total = planIncluded + currentAddons;
  const amount = quantity * unitPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="h-5 w-5 text-ink-400" />
            <div>
              <h2 className="text-lg font-bold">Purchase Add-on</h2>
              <p className="text-xs text-ink-400">Add more {label.toLowerCase()} to your plan</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-ink-700 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4 text-ink-400" /> {label}
            <span className="text-xs font-normal text-ink-400">Current allocation</span>
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { n: planIncluded, l: "Plan" },
              { n: currentAddons, l: "Add-ons" },
              { n: total, l: "Total" },
            ].map((c) => (
              <div key={c.l} className="rounded-xl border border-ink-700 py-3">
                <p className="text-lg font-bold">{c.n}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">{c.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-ink-700 p-4">
          <p className="text-sm font-semibold">Quantity to add</p>
          <p className="text-xs text-ink-400">${unitPrice.toFixed(2)} per unit / monthly</p>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Less" className="btn-secondary !px-3.5 !py-2.5">
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              className="field text-center"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            />
            <button onClick={() => setQuantity((q) => q + 1)} aria-label="More" className="btn-secondary !px-3.5 !py-2.5">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-ink-700 p-4 text-sm">
          <p className="flex items-center justify-between text-ink-400">
            <span>New total {label.toLowerCase()}</span>
            <span className="font-bold text-ink-100">{total + quantity}</span>
          </p>
          <p className="mt-1.5 flex items-center justify-between">
            <span className="text-ink-400">Amount due</span>
            <span className="text-xl font-bold">${amount.toFixed(2)}</span>
          </p>
          <p className="mt-2 text-[11px] text-ink-500">Billed monthly. Charges appear on your next invoice.</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={async () => {
              setBusy(true);
              await onPurchase(quantity);
              setBusy(false);
            }}
            disabled={busy}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> {busy ? "Processing…" : `Purchase for $${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
