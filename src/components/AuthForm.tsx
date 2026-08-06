"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 font-bold text-ink-950">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">VoiceLine AI</span>
        </Link>

        <div className="card !p-7">
          <h1 className="text-xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {mode === "login"
              ? "Log in to your business dashboard."
              : "Your team gets its own isolated dashboard, agents, and call history."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="label" htmlFor="name">Your name</label>
                  <input id="name" name="name" className="field" placeholder="Alex Rivera" required />
                </div>
                <div>
                  <label className="label" htmlFor="company">Company</label>
                  <input id="company" name="company" className="field" placeholder="Acme Dental" required />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" className="field" placeholder="you@company.com" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="field"
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy
                ? "One moment…"
                : mode === "login"
                  ? "Log in"
                  : "Create workspace"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-ink-400">
          {mode === "login" ? (
            <>Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-accent-400 hover:text-accent-300">Sign up</Link>
            </>
          ) : (
            <>Already have an account?{" "}
              <Link href="/login" className="font-medium text-accent-400 hover:text-accent-300">Log in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
