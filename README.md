# VoiceLine AI

A full-stack starter for an **AI voice agent platform with live human supervision** — the same product category as Callab AI: businesses build no-code voice agents that answer their phone lines, while supervisors watch live transcripts and can take over any call.

This repo already contains a working product you can run today:

- **Marketing landing page** — hero, features, live-supervision spotlight, use cases, FAQ, CTA.
- **Business signup & login** — each business gets its own isolated workspace (JWT sessions in httpOnly cookies, bcrypt-hashed passwords, middleware-protected routes).
- **Dashboard** — analytics overview, agent builder (create/edit/pause/delete agents with voice, greeting, and instructions), searchable call history with transcripts/sentiment/outcomes, and a **live monitoring console** with streaming transcripts, sentiment/confidence flags, and one-click "take over call".
- **Demo data** — new accounts are seeded with realistic agents and a week of call history so the product demos end-to-end before real telephony is wired in. The live console runs on a simulated feed (`/api/live`).

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000, click "Get started", create an account
```

Set `AUTH_SECRET` in `.env` for anything beyond local dev.

## Architecture

```
Browser
  ├── Landing page (/)                    — public marketing site
  ├── /signup, /login                     — auth pages → /api/auth/*
  └── /dashboard/**                       — protected by src/middleware.ts (JWT cookie)
        ├── Overview                      — aggregated call metrics
        ├── Live monitoring               — polls /api/live every 3s (→ WebSocket later)
        ├── Agents                        — CRUD via /api/agents
        ├── Call history                  — transcripts, sentiment, outcomes
        └── Settings                      — workspace + integration slots

src/lib/db.ts     — data layer (file-backed for dev; swap for Postgres here only)
src/lib/auth.ts   — JWT session create/verify
src/lib/demo-data.ts — demo seeding (delete when real telephony lands)
```

Every route reads/writes storage **only** through `src/lib/db.ts`, so moving to Postgres (Prisma or Drizzle) means reimplementing one file — pages and API routes don't change.

## Roadmap: from this starter to a production platform

### Phase 1 — Product shell (✅ done in this repo)
Landing page, multi-tenant auth, dashboard, agent builder, call history, live-monitoring UI.

### Phase 2 — Real database & hosting
1. Replace `src/lib/db.ts` with Postgres (Neon/Supabase) + Prisma or Drizzle. Keep the same function signatures.
2. Add email verification and password reset (Resend or similar).
3. Deploy on Vercel (or Fly.io/Railway). Set `AUTH_SECRET`, `DATABASE_URL`.

### Phase 3 — Real voice calls
This is the core. Two viable paths:

**Path A — Voice-agent API platform (fastest, recommended to start):**
Use [Vapi](https://vapi.ai), [Retell AI](https://retellai.com), or [Bland](https://bland.ai). They handle telephony + speech-to-text + LLM + text-to-speech and give you webhooks.
1. When a user creates/edits an agent in the dashboard, sync it to the provider via their API (the agent's `systemPrompt`, `greeting`, and `voice` map directly).
2. Buy/assign phone numbers through the provider and store them on the agent.
3. Receive `call.started` / `transcript.updated` / `call.ended` webhooks → write them into your `calls` table → replace the simulated `/api/live` with real data.

**Path B — Build the pipeline yourself (more control, more work):**
1. **Telephony:** Twilio Programmable Voice with Media Streams (bidirectional audio over WebSocket), or SIP trunking into [LiveKit](https://livekit.io).
2. **Realtime voice loop:** LiveKit Agents or Pipecat orchestrating: Deepgram (speech-to-text) → Claude (`claude-sonnet-5` for the conversation; tool calls for booking/lookup) → ElevenLabs or Cartesia (text-to-speech).
3. Stream partial transcripts into Redis/pub-sub → serve to the dashboard over WebSocket/SSE.

### Phase 4 — Live human supervision (the differentiator)
1. Replace the polling in `LiveConsole` with a WebSocket subscription per workspace.
2. **Listen-in:** supervisors get a muted audio leg of the call (Twilio conference or LiveKit room subscription).
3. **Sentiment/confidence scoring:** run a cheap model (Haiku) over the rolling transcript every few turns; flag calls when sentiment drops or the agent's confidence is low — the UI for this already exists.
4. **Takeover:** the "Take over call" button moves the human from muted listener to active speaker and silences the AI (in LiveKit: publish/unpublish tracks; in Twilio: conference participant controls). Log the takeover as a `supervisor` transcript turn (the call-detail page already renders these).

### Phase 5 — Knowledge base & actions
1. Document upload → chunk → embed (e.g. Voyage or OpenAI embeddings) → pgvector; retrieval feeds the agent's context.
2. Tool/function calling for real actions: calendar booking (Google/Outlook APIs), CRM writes (HubSpot/Salesforce), SMS confirmations (Twilio SMS).
3. Post-call pipeline: summary, outcome extraction, sentiment — one LLM call on `call.ended`, written to the `calls` table.

### Phase 6 — Sell it to businesses
1. **Billing:** Stripe subscriptions + per-minute usage metering.
2. **Teams:** invite teammates, roles (owner / supervisor / viewer).
3. **Compliance:** call-recording consent by jurisdiction, retention windows, PII redaction in transcripts, audit logs; SOC 2 / HIPAA only when target customers demand it.
4. **White-label option:** per-tenant branding if you want agencies reselling it.

## Important note on the design

The design here is **original** — same product category and page structure as callab.ai (hero → features → supervision → use cases → FAQ), but its own visual identity. Don't pixel-copy another company's site or reuse their brand assets; that creates copyright/trademark exposure precisely when you start selling to businesses.
