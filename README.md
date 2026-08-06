# VoiceLine AI

A full-stack **AI voice agent platform with live human supervision** — businesses sign up, build no-code voice agents, run outbound campaigns, and supervise every call from their own dashboard.

Light purple design. Runs on **Netlify** with **Supabase** as the database and **Vapi** as the voice pipeline.

## What's inside

- **Landing page** — hero, "See it in action", features, human-supervisor section, deployment steps, comparison table, enterprise band, FAQ, CTA.
- **Auth** — signup/login per business (bcrypt passwords, JWT httpOnly cookie sessions, middleware-protected routes).
- **Dashboard**
  - **Home Dashboard** — stat cards, success-rate gauge, calls/duration/success-rate charts, performance by agent & campaign, end-call reasons, concurrent calls.
  - **AI Agents** — create/edit/pause/delete agents (voice, greeting, instructions). Syncs to Vapi automatically when `VAPI_API_KEY` is set.
  - **Knowledge Bases** — the documents agents answer from.
  - **Launch your AI** — outbound campaigns: pick an agent + goal, launch/pause; wired to Vapi outbound calling.
  - **Phone Numbers / Contacts / Call Logs / Live Monitoring** — numbers, campaign contacts, full call transcripts with sentiment, and a live console with one-click supervisor takeover.
  - **Integrations / Webhooks / Settings.**
- **Demo data** — every new account is seeded with agents, a week of calls, campaigns, and contacts, so the whole product demos before real telephony is connected.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000 → "Get started" → create an account
```

No configuration needed locally — data goes to `data/db.json` (gitignored).

## Deploy to Netlify (permanent hosting)

1. **Push this repo to GitHub** (already done if you're reading this there).
2. In Netlify: **Add new site → Import an existing project → GitHub** → pick this repo. Netlify detects Next.js via `netlify.toml`; keep the defaults and deploy. From now on every push auto-deploys.
3. **Create a Supabase project** (free at supabase.com) → open **SQL Editor** → paste and run `supabase/schema.sql` once.
4. In Netlify: **Site configuration → Environment variables**, add:

   | Variable | Value |
   |---|---|
   | `AUTH_SECRET` | a long random string (e.g. run `openssl rand -hex 32`) |
   | `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
   | `VAPI_API_KEY` | (optional, enables real calls) Vapi → dashboard → API key |

5. **Redeploy** (Deploys → Trigger deploy). Done — signups now persist in Supabase.

> Without the Supabase variables the app still runs in demo mode, but on
> serverless hosting the filesystem is temporary, so accounts would not
> persist between visits. Set the variables for anything permanent.

## Connecting Vapi (real calls)

The integration points are already in the code (`src/lib/vapi.ts`):

- **Agent sync** — creating/updating an agent creates/updates a Vapi assistant (greeting → firstMessage, instructions → system prompt).
- **Outbound campaigns** — "Launch your AI" campaigns call `startOutboundCall()` per contact via Vapi's `/call` API once you've provisioned a Vapi phone number.
- **Next step** — add a webhook route that receives Vapi's end-of-call reports and writes them into the `calls` table, replacing the demo data; point Vapi's server URL at it.

## Architecture

```
src/lib/db.ts        — one data layer, two backends:
                        • file store (local dev, zero config)
                        • Supabase (auto-enabled by env vars)
src/lib/auth.ts      — JWT sessions (httpOnly cookie)
src/lib/vapi.ts      — Vapi assistant sync + outbound calls
src/middleware.ts    — protects /dashboard/**
src/app/api/**       — auth, agents, campaigns, contacts, webhooks, knowledge, live feed
src/app/dashboard/** — all dashboard sections
supabase/schema.sql  — run once in Supabase
netlify.toml         — Netlify build config
```

## Roadmap

1. ✅ Product shell: landing, auth, dashboard, campaigns, demo data
2. ✅ Netlify + Supabase deployment path
3. Vapi live: webhook ingestion of real calls, phone-number provisioning UI
4. Live supervision on real calls: streaming transcripts (Supabase Realtime), listen-in audio, takeover
5. Knowledge base uploads with embeddings; calendar/CRM/SMS actions
6. Billing (Stripe, per-minute metering), team roles, compliance controls

## Design note

The design is inspired by the best products in this category but is an
original implementation — don't reuse another company's logo, brand name, or
copied assets when you publish this.
