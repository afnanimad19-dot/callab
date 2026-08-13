"use client";

// Calendar tab: month / week / day views like Google Calendar. Appointments
// booked, rescheduled or canceled by agents (voice + chat) appear as colored
// tags on their dates; clicking one opens the full patient/doctor details
// with reschedule / cancel actions and a link to the auto-created contact.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, X, User, Phone, Stethoscope,
  Clock, FileText, CalendarDays, Trash2,
} from "lucide-react";
import type { Appointment } from "@/lib/db";
import { toast, toastError } from "@/components/Toast";

const STATUS_STYLE: Record<Appointment["status"], { chip: string; label: string }> = {
  booked: { chip: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Booked" },
  rescheduled: { chip: "bg-amber-100 text-amber-800 border-amber-200", label: "Rescheduled" },
  canceled: { chip: "bg-rose-100 text-rose-700 border-rose-200 line-through", label: "Canceled" },
  completed: { chip: "bg-ink-800 text-ink-300 border-ink-700", label: "Completed" },
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function CalendarPanel({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null); // YYYY-MM-DD
  const [dayModal, setDayModal] = useState<string | null>(null); // YYYY-MM-DD → day list popup

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = ymd(new Date(a.startsAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [appointments]);

  function shift(dir: -1 | 1) {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  }

  // Month grid: weeks starting Monday.
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = ymd(new Date());
  const title =
    view === "day"
      ? cursor.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : view === "week"
        ? `${weekDays[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`
        : cursor.toLocaleDateString([], { month: "long", year: "numeric" });

  function Tag({ a, compact = false }: { a: Appointment; compact?: boolean }) {
    const s = STATUS_STYLE[a.status];
    return (
      <button
        onClick={() => setSelected(a)}
        className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:opacity-80 ${s.chip}`}
        title={`${a.patientName}${a.doctor ? ` — ${a.doctor}` : ""} (${s.label})`}
      >
        {timeOf(a.startsAt)} {a.patientName}
        {!compact && a.doctor ? ` · ${a.doctor}` : ""}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-ink-400">
            Appointments your agents book, reschedule, and cancel — live from calls and chats
          </p>
        </div>
        <button onClick={() => setCreateFor(todayKey)} className="btn-primary flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New Appointment
        </button>
      </div>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 !p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} aria-label="Previous" className="btn-secondary !px-2.5 !py-2"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date())} className="btn-secondary !px-4 !py-2 !text-sm">Today</button>
          <button onClick={() => shift(1)} aria-label="Next" className="btn-secondary !px-2.5 !py-2"><ChevronRight className="h-4 w-4" /></button>
          <h2 className="ml-2 text-base font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Booked</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Rescheduled</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Canceled</span>
          </div>
          <div className="grid grid-cols-3 rounded-lg bg-ink-800/60 p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  view === v ? "bg-white shadow-sm" : "text-ink-400 hover:text-ink-200"
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month view */}
      {view === "month" && (
        <div className="card overflow-hidden !p-0">
          <div className="grid grid-cols-7 border-b border-ink-700 bg-ink-900/60">
            {DAY_NAMES.map((d) => (
              <p key={d} className="px-2 py-2 text-center text-xs font-semibold text-ink-400">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((d, i) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const items = byDay.get(key) ?? [];
              return (
                <div key={i}
                  className={`min-h-[104px] border-b border-r border-ink-800 p-1.5 ${inMonth ? "" : "bg-ink-900/40"}`}
                  onDoubleClick={() => setCreateFor(key)}
                >
                  <div className="flex items-center justify-between">
                    <button onClick={() => items.length && setDayModal(key)}
                      title={items.length ? `View ${items.length} appointment${items.length === 1 ? "" : "s"}` : undefined}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                        key === todayKey ? "bg-[#301C3F] font-bold text-white" : inMonth ? "text-ink-200" : "text-ink-500"
                      } ${items.length ? "cursor-pointer hover:ring-2 hover:ring-[#301C3F]/30" : ""}`}>
                      {d.getDate()}
                    </button>
                    <button onClick={() => setCreateFor(key)} aria-label={`Add appointment on ${key}`}
                      className="rounded p-0.5 text-ink-500 opacity-0 transition hover:bg-ink-800 hover:text-ink-200 [div:hover>div>&]:opacity-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1 max-h-[68px] space-y-1 overflow-y-auto">
                    {items.slice(0, 3).map((a) => <Tag key={a.id} a={a} compact />)}
                    {items.length > 3 && (
                      <button onClick={() => setDayModal(key)}
                        className="block w-full rounded px-1.5 text-left text-[11px] font-medium text-ink-400 hover:text-ink-200">
                        +{items.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="card overflow-hidden !p-0">
          <div className="grid grid-cols-7">
            {weekDays.map((d) => {
              const key = ymd(d);
              const items = byDay.get(key) ?? [];
              return (
                <div key={key} className="min-h-[380px] border-r border-ink-800 last:border-r-0">
                  <p className={`border-b border-ink-800 px-2 py-2 text-center text-xs font-semibold ${
                    key === todayKey ? "bg-[#301C3F]/10 text-[#301C3F]" : "text-ink-400"
                  }`}>
                    {d.toLocaleDateString([], { weekday: "short", day: "numeric" })}
                  </p>
                  <div className="space-y-1.5 p-1.5">
                    {items.map((a) => <Tag key={a.id} a={a} />)}
                    {items.length === 0 && (
                      <button onClick={() => setCreateFor(key)}
                        className="w-full rounded-md border border-dashed border-ink-700 py-2 text-[11px] text-ink-500 hover:text-ink-300">
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day view */}
      {view === "day" && (
        <div className="card">
          {(byDay.get(ymd(cursor)) ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-400">
              <CalendarDays className="mx-auto mb-2 h-7 w-7" />
              No appointments this day.
              <button onClick={() => setCreateFor(ymd(cursor))} className="btn-secondary mx-auto mt-4 block !text-sm">
                + Add appointment
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(byDay.get(ymd(cursor)) ?? []).map((a) => {
                const s = STATUS_STYLE[a.status];
                return (
                  <button key={a.id} onClick={() => setSelected(a)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:opacity-90 ${s.chip}`}>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold">{timeOf(a.startsAt)}</span>
                      <span className="text-sm font-semibold">{a.patientName}</span>
                      {a.doctor && <span className="text-sm">with {a.doctor}</span>}
                    </span>
                    <span className="text-xs font-semibold">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selected && (
        <AppointmentModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); router.refresh(); }}
        />
      )}
      {createFor && (
        <NewAppointmentModal
          date={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={() => { setCreateFor(null); toast("Appointment created."); router.refresh(); }}
        />
      )}
      {dayModal && (
        <DayModal
          dateKey={dayModal}
          items={(byDay.get(dayModal) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt))}
          onClose={() => setDayModal(null)}
          onPick={(a) => { setDayModal(null); setSelected(a); }}
          onAdd={() => { const d = dayModal; setDayModal(null); setCreateFor(d); }}
        />
      )}
    </div>
  );
}

// --- Day popup: all appointments for one day, scrollable ---------------------
function DayModal({
  dateKey, items, onClose, onPick, onAdd,
}: {
  dateKey: string;
  items: Appointment[];
  onClose: () => void;
  onPick: (a: Appointment) => void;
  onAdd: () => void;
}) {
  const title = new Date(`${dateKey}T00:00:00`).toLocaleDateString([], {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-ink-700 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="text-xs text-ink-400">{items.length} appointment{items.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {items.length === 0 && <p className="py-8 text-center text-sm text-ink-400">No appointments this day.</p>}
          {items.map((a) => {
            const s = STATUS_STYLE[a.status];
            return (
              <button key={a.id} onClick={() => onPick(a)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition hover:opacity-90 ${s.chip}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{a.patientName}</span>
                  <span className="block truncate text-xs opacity-80">
                    {timeOf(a.startsAt)}{a.doctor ? ` · ${a.doctor}` : ""}{a.service ? ` · ${a.service}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-ink-100 px-4 py-3">
          <button onClick={onAdd} className="btn-primary w-full !py-2 !text-sm">+ New appointment this day</button>
        </div>
      </div>
    </div>
  );
}

// --- Detail popup ------------------------------------------------------------

function AppointmentModal({
  appointment: a,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newDate, setNewDate] = useState(a.startsAt.slice(0, 10));
  const [newTime, setNewTime] = useState(new Date(a.startsAt).toTimeString().slice(0, 5));
  const s = STATUS_STYLE[a.status];

  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true);
    const res = await fetch(`/api/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) { toast(message); onChanged(); }
    else toastError("Could not update the appointment.");
  }

  async function remove() {
    if (!confirm("Delete this appointment entirely?")) return;
    setBusy(true);
    await fetch(`/api/appointments/${a.id}`, { method: "DELETE" });
    setBusy(false);
    toast("Appointment deleted.");
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{a.patientName}</h2>
            <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.chip}`}>{s.label}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <p className="flex items-center gap-2.5"><Clock className="h-4 w-4 shrink-0 text-ink-400" />
            {new Date(a.startsAt).toLocaleString([], { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
          </p>
          {a.doctor && <p className="flex items-center gap-2.5"><Stethoscope className="h-4 w-4 shrink-0 text-ink-400" /> {a.doctor}</p>}
          {a.service && <p className="flex items-center gap-2.5"><FileText className="h-4 w-4 shrink-0 text-ink-400" /> {a.service}</p>}
          {a.phone && <p className="flex items-center gap-2.5"><Phone className="h-4 w-4 shrink-0 text-ink-400" /> {a.phone}</p>}
          {a.notes && <p className="flex items-start gap-2.5"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" /> {a.notes}</p>}
          <p className="flex items-center gap-2.5">
            <User className="h-4 w-4 shrink-0 text-ink-400" />
            {a.contactId ? (
              <Link href="/dashboard/contacts" className="font-medium text-[#301C3F] underline-offset-2 hover:underline">
                View contact record
              </Link>
            ) : (
              <span className="text-ink-400">No linked contact</span>
            )}
            <span className="text-xs text-ink-500">· via {a.source === "manual" ? "manual entry" : a.source === "chat" ? "chat agent" : "AI call"}</span>
          </p>
        </div>

        {reschedOpen && (
          <div className="mt-4 flex items-end gap-2 rounded-xl border border-ink-700 p-3">
            <div className="flex-1">
              <label className="label !text-xs">New date</label>
              <input type="date" className="field !py-2" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label !text-xs">New time</label>
              <input type="time" className="field !py-2" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
            <button
              onClick={() => act({ action: "reschedule", startsAt: `${newDate}T${newTime}:00` }, "Appointment rescheduled.")}
              disabled={busy}
              className="btn-primary !py-2 !text-sm disabled:opacity-60">
              Move
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={remove} disabled={busy}
            className="flex items-center gap-1.5 text-sm font-medium text-signal-red hover:underline disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <div className="flex gap-2">
            {a.status !== "canceled" && (
              <>
                <button onClick={() => setReschedOpen((v) => !v)} className="btn-secondary !text-sm">Reschedule</button>
                <button onClick={() => act({ action: "cancel" }, "Appointment canceled.")} disabled={busy}
                  className="btn-secondary !text-sm !text-signal-red disabled:opacity-60">
                  Cancel Appointment
                </button>
              </>
            )}
            {a.status !== "completed" && a.status !== "canceled" && (
              <button onClick={() => act({ status: "completed" }, "Marked completed.")} disabled={busy}
                className="btn-primary !text-sm disabled:opacity-60">
                Mark Completed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Manual creation ---------------------------------------------------------

function NewAppointmentModal({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [doctor, setDoctor] = useState("");
  const [service, setService] = useState("");
  const [day, setDay] = useState(date);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName, phone, doctor, service, notes, startsAt: `${day}T${time}:00` }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onCreated();
    else setError(data.error ?? "Could not create the appointment.");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Appointment</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Patient Name</label>
            <input className="field" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Sarah Ahmed" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9715xxxxxxxx" />
          </div>
          <div>
            <label className="label">Doctor</label>
            <input className="field" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. Leila Hariri" />
          </div>
          <div>
            <label className="label">Service</label>
            <input className="field" value={service} onChange={(e) => setService(e.target.value)} placeholder="Cleaning" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="field" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea rows={2} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-signal-red">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={busy || !patientName.trim()} className="btn-primary disabled:opacity-50">
            {busy ? "Creating…" : "Create Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
