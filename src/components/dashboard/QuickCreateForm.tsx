"use client";

// Small reusable "+ New X" button that expands into an inline form and POSTs
// to the given endpoint. Used by Knowledge Bases, Contacts, and Webhooks.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";

interface Field {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export default function QuickCreateForm({
  endpoint,
  buttonLabel,
  fields,
}: {
  endpoint: string;
  buttonLabel: string;
  fields: Field[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setOpen(false);
      toast("Saved.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        {buttonLabel}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card w-full space-y-3 !p-5 sm:max-w-md">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input
            id={f.name}
            name={f.name}
            className="field"
            placeholder={f.placeholder}
            required={f.required}
          />
        </div>
      ))}
      {error && (
        <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary !py-2 disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
