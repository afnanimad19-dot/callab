"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 0%, rgba(139,92,246,0.22) 0%, rgba(217,70,239,0.10) 45%, rgba(7,7,9,0) 75%)",
        }}
      />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5">
          <span className="orb inline-block h-10 w-10" aria-hidden />
          <span className="text-2xl tracking-tight">
            <span className="font-bold">Voice</span>
            <span className="font-light text-ink-300">Line AI</span>
          </span>
        </Link>
        <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">
          Voice AI Agents
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-ink-300">
          Low-latency, multilingual Voice AI Agents that take action, integrate
          easily, and scale globally
        </p>

        <div className="card mt-8 !p-7">
          <h2 className="text-2xl font-bold">
            {mode === "login" ? "Login" : "Create account"}
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            {mode === "login"
              ? "Enter your credentials to access your account"
              : "Your business gets its own dashboard, agents, and call logs"}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
                    Your name
                  </label>
                  <input id="name" name="name" className="field" placeholder="Enter your name" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="company">
                    Company
                  </label>
                  <input id="company" name="company" className="field" placeholder="Enter your company name" required />
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="field pr-11"
                  placeholder="Enter your password"
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
              {busy ? "One moment…" : mode === "login" ? "→ Login" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-400">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-medium text-accent-600 hover:text-accent-500">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-accent-600 hover:text-accent-500">
                  Login
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
