-- VoiceLine AI — Supabase schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Tables use a simple document model (id + user_id + jsonb payload) so the
-- app's data layer stays tiny. Normalize into columns later if/when needed.

create table if not exists users (
  id text primary key,
  user_id text,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists agents (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists calls (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists campaigns (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists contacts (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists phone_numbers (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists webhooks (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists knowledge_bases (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists integrations (
  id text primary key,
  user_id text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists agents_user_idx on agents (user_id);
create index if not exists calls_user_idx on calls (user_id);
create index if not exists campaigns_user_idx on campaigns (user_id);
create index if not exists contacts_user_idx on contacts (user_id);
create index if not exists phone_numbers_user_idx on phone_numbers (user_id);
create index if not exists webhooks_user_idx on webhooks (user_id);
create index if not exists knowledge_bases_user_idx on knowledge_bases (user_id);
create index if not exists integrations_user_idx on integrations (user_id);

-- The app talks to these tables with the service-role key from the server
-- only (never from the browser), so RLS stays enabled with no public access.
alter table users enable row level security;
alter table agents enable row level security;
alter table calls enable row level security;
alter table campaigns enable row level security;
alter table contacts enable row level security;
alter table phone_numbers enable row level security;
alter table webhooks enable row level security;
alter table knowledge_bases enable row level security;
alter table integrations enable row level security;
