-- Phase 2 — accounts schema (profiles, schedules, sessions) + RLS.
-- Scope: LAUNCH-BRIEF.md §4, Phase 2 only. Deliberately excludes badges,
-- user_badges, leaderboard_stats and public_leaderboard — those are
-- Phase 3 (leaderboard/badges) and land in a later migration.

-- ---------- profiles ----------
create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  display_name        text not null check (char_length(display_name) between 2 and 32),
  country_code        text,
  locale              text not null default 'fr',
  leaderboard_opt_in  boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------- schedules ----------
create table schedules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  start_date          date not null,
  cadence             text not null check (cadence in ('daily','weekdays','weekly')),
  hours_per_session   int  not null check (hours_per_session between 1 and 12),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
create unique index one_active_schedule on schedules (user_id) where is_active;

-- ---------- sessions ----------
-- Generated server-side only (create-schedule / import-progress edge
-- functions, service role). ~479 rows/user at 2h daily.
create table sessions (
  id              bigserial primary key,
  user_id         uuid not null references auth.users on delete cascade,
  schedule_id     uuid not null references schedules on delete cascade,
  seq             int  not null,
  scheduled_date  date not null,
  hours           numeric(4,1) not null,
  parts           jsonb not null,        -- [{kind,n|id,from,to,take,s,phase}]
  completed_at    timestamptz,           -- SERVER-SET ONLY (complete-session / import-progress)
  credited        boolean not null default false,   -- counts toward leaderboard (Phase 3)
  unique (schedule_id, seq)
);
create index sessions_user_date on sessions (user_id, scheduled_date);
create index sessions_user_done on sessions (user_id, completed_at) where completed_at is not null;

-- ---------- RLS ----------
alter table profiles  enable row level security;
alter table schedules enable row level security;
alter table sessions  enable row level security;

create policy own_profile   on profiles   for all    using (auth.uid() = id);
create policy own_schedules on schedules  for all    using (auth.uid() = user_id);
create policy own_sessions  on sessions   for select using (auth.uid() = user_id);

-- No client-side insert/update policy on sessions: rows are only ever
-- written by create-schedule, import-progress and complete-session,
-- all running as service role. This is the load-bearing security
-- decision behind the whole leaderboard design (LAUNCH-BRIEF §4/§6) —
-- do not add a client write policy here even though schedules is
-- client-writable (a stray client-created schedule row with no
-- matching sessions is harmless clutter, not a security gap).

-- ---------- privileges ----------
-- RLS policies only take effect once the underlying role already has a
-- table-level grant to attempt the operation at all — Supabase's local
-- template does not grant these automatically for tables created by a
-- later migration (confirmed by running this migration against a real
-- local instance: PostgREST returned 42501 "permission denied" on
-- every table until these were added). RLS above still governs which
-- *rows* each grant can actually touch.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on profiles  to authenticated;
grant select, insert, update, delete on schedules to authenticated;
grant select                        on sessions   to authenticated;

grant select, insert, update, delete on profiles, schedules, sessions to service_role;
grant usage, select on sequence sessions_id_seq to service_role;
