# Civilizational Curriculum — Launch Brief

**Handing instructions:** Give this file to Claude together with `curriculum.html`. Work through the phases in order. Do not start Phase 2 until Phase 1 acceptance criteria pass. Section 10 lists decisions that must be answered by the product owner before Phase 1 begins.

---

## 1. What exists today

A single self-contained `curriculum.html` (~135 KB, no build step, no dependencies) containing:

- **Content**: 8 thematic sections, 38 works, 6 counterweights, 7 reading phases. Fully bilingual EN/FR. Hour estimates are exact and internally consistent (953 h curriculum + 5 h prescribed re-read = 958 h scheduled).
- **Two browse axes**: by theme (8) and by reading order (7 phases, with counterweights inline at their sequenced positions).
- **A scheduling engine**: splits the reading order into fixed-length sessions across a chosen cadence, conserving hours exactly.
- **A calendar**: month grid + agenda, day sheets, mark-complete, progress that syncs bidirectionally with book-level read state.
- **Three visual themes** (Codex / Flash / Ledger) — brand not yet chosen.
- **Module separation already done**: `PERSIST`, `SCHEDULE` (pure, no DOM), `VIEW: CALENDAR`, router.

**The single most valuable asset for this migration is `SCHEDULE`.** It is already pure — no DOM, no globals beyond `BOOKS`/`PHASES`/`COUNTERWEIGHTS`. Lift it verbatim into `src/lib/schedule.js` and run the identical file on both client and server. Do not rewrite it.

---

## 2. Gap analysis

Grouped by whether it blocks a public launch.

### 2.1 Blockers — cannot launch without these

| # | Gap | Why it blocks |
|---|---|---|
| B1 | **No URLs.** Everything is in-memory state. | You cannot share a link to a section or a book. Zero SEO — ~106 indexable pages currently invisible to search. This is both the biggest growth loss and a basic UX failure. |
| B2 | **No real persistence.** Artifact storage with an in-memory fallback. | A reading calendar that resets on reload is not a product. |
| B3 | **No backend, auth, or database.** | Required by the two requested features. |
| B4 | **No legal pages, no privacy posture.** | You will be collecting emails and publishing display names. Not optional once you have accounts. |
| B5 | **Content rights are unresolved.** | The whole site is a derivative of Saylor's copyrighted article. Selection and arrangement are themselves protectable. See §9. |
| B6 | **No brand decision.** Three themes still ship. | Cannot launch a product that asks the visitor to pick its identity. |

### 2.2 Required — needed for a credible launch

| # | Gap | Note |
|---|---|---|
| R1 | No error handling for network/storage failure, no loading states, no 404 page | |
| R2 | No favicon, app icons, manifest, OG images | Links shared on WhatsApp — the primary distribution channel for this audience — will render as bare text |
| R3 | Fonts loaded from Google (3 blocking requests) | Self-host. Matters on mobile data in West Africa |
| R4 | No analytics, no error tracking | Flying blind post-launch |
| R5 | No sitemap.xml / robots.txt | |
| R6 | No tests, no CI | The scheduling engine is arithmetic — it must be tested |
| R7 | Accessibility unaudited | Modal focus trap, `aria-live` on progress, contrast across all themes |
| R8 | **15 French editions unverified, 11 works have no French edition, 0 ISBNs, no real book covers** | The French audience is the differentiator; unverified data undermines it |

### 2.3 Should have — strong value, not blocking

- **PWA / offline-first.** High priority for this market specifically. A reading calendar is the ideal offline use case: cache the shell, queue completions, sync when connectivity returns. Treat this as near-required rather than nice-to-have.
- Email reading reminders (largest retention lever for a habit product)
- Onboarding for first-time visitors
- Data export

### 2.4 Later

- Notes/highlights per work
- Reading groups or cohorts
- Additional languages
- Native apps

---

## 3. Target architecture

### 3.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **Astro 5** (static + islands) | ~53 content pages × 2 languages need to be statically generated and indexable. Astro keeps the existing vanilla JS as islands — no framework rewrite |
| Interactive | Existing vanilla JS, hydrated as islands | The calendar and leaderboard are the only parts needing JS |
| Styling | Existing CSS, extracted to files | The three-theme token system already works. Keep it, delete the two unchosen themes |
| Backend | **Supabase** (Postgres + Auth + RLS + Edge Functions + pg_cron) | Row-level security handles leaderboard privacy declaratively. Generous free tier |
| Hosting | **Cloudflare Pages** | Already in use for DNS. Static output, global edge, free |
| Email | **Resend** | Magic links + reminders. Supabase's built-in SMTP is rate-limited and unsuitable for production |
| Analytics | **Cloudflare Web Analytics** | Free, cookieless, no consent banner required |
| Errors | Sentry (free tier) | |
| CI | GitHub Actions → Cloudflare Pages | |

**Estimated running cost: $0–25/month** until meaningful scale (Supabase Pro at $25 when the free tier is exceeded; domain ~$12/year).

**Lighter alternative** if shipping in one week matters more than organic traffic: Vite + vanilla + Supabase, single-page, no static generation. Accept near-zero SEO. Only choose this if the launch is time-boxed — migrating later costs more than doing it now.

### 3.2 File layout

```
/
├─ src/
│  ├─ content/
│  │  ├─ curriculum.json          # sections, books, counterweights — SINGLE SOURCE OF TRUTH
│  │  └─ ui.json                  # all EN/FR interface strings
│  ├─ lib/
│  │  ├─ schedule.js              # PURE — lifted verbatim from curriculum.html
│  │  ├─ badges.js                # PURE — badge criteria evaluation
│  │  ├─ progress.js              # PURE — session ↔ book reconciliation
│  │  ├─ supabase.js              # client singleton
│  │  └─ store.js                 # local-first state + offline sync queue
│  ├─ components/                 # StrataBar, SectionCard, BookSheet (.astro)
│  │                              # Calendar, Leaderboard, AuthWidget (islands)
│  ├─ layouts/Base.astro
│  ├─ pages/
│  │  ├─ [lang]/index.astro
│  │  ├─ [lang]/theme/[section].astro
│  │  ├─ [lang]/order/[phase].astro
│  │  ├─ [lang]/work/[slug].astro     # 44 pages × 2 langs — the SEO engine
│  │  ├─ [lang]/calendar.astro
│  │  ├─ [lang]/leaderboard.astro
│  │  ├─ [lang]/profile.astro
│  │  ├─ [lang]/privacy.astro
│  │  └─ [lang]/terms.astro
│  └─ styles/
├─ supabase/
│  ├─ migrations/
│  └─ functions/
│     ├─ create-schedule/
│     ├─ complete-session/
│     ├─ import-progress/
│     └─ refresh-leaderboard/
├─ tests/
└─ public/                        # icons, og images, robots.txt, sitemap.xml
```

**Rule: content never lives in code.** `curriculum.json` is edited without touching rendering logic. This is already true in the prototype — preserve it.

---

## 4. Database schema

```sql
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
-- Generated server-side at schedule creation. ~479 rows/user at 2h daily.
create table sessions (
  id              bigserial primary key,
  user_id         uuid not null references auth.users on delete cascade,
  schedule_id     uuid not null references schedules on delete cascade,
  seq             int  not null,
  scheduled_date  date not null,
  hours           numeric(4,1) not null,
  parts           jsonb not null,        -- [{kind,n|id,from,to,take,s,phase}]
  completed_at    timestamptz,           -- SERVER-SET ONLY
  credited        boolean not null default false,   -- counts toward leaderboard
  unique (schedule_id, seq)
);
create index sessions_user_date on sessions (user_id, scheduled_date);
create index sessions_user_done on sessions (user_id, completed_at) where completed_at is not null;

-- ---------- badges ----------
create table badges (
  code        text primary key,
  tier        text not null check (tier in ('milestone','phase','section','streak','special')),
  name_en     text not null, name_fr text not null,
  desc_en     text not null, desc_fr text not null,
  sort_order  int not null default 0
);
create table user_badges (
  user_id    uuid not null references auth.users on delete cascade,
  badge_code text not null references badges,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- ---------- leaderboard (materialized, refreshed by pg_cron) ----------
create table leaderboard_stats (
  user_id          uuid primary key references auth.users on delete cascade,
  verified_hours   numeric(7,1) not null default 0,
  hours_30d        numeric(7,1) not null default 0,
  current_streak   int not null default 0,
  longest_streak   int not null default 0,
  adherence_pct    numeric(5,2),
  works_completed  int not null default 0,
  badge_count      int not null default 0,
  updated_at       timestamptz not null default now()
);

-- Public projection — the ONLY thing anon can read
create view public_leaderboard as
select p.display_name, p.country_code,
       s.verified_hours, s.hours_30d, s.current_streak,
       s.adherence_pct, s.works_completed, s.badge_count
from leaderboard_stats s
join profiles p on p.id = s.user_id
where p.leaderboard_opt_in = true;
```

### RLS policies

```sql
alter table profiles  enable row level security;
alter table schedules enable row level security;
alter table sessions  enable row level security;
alter table user_badges enable row level security;
alter table leaderboard_stats enable row level security;

create policy own_profile   on profiles   for all    using (auth.uid() = id);
create policy own_schedules on schedules  for all    using (auth.uid() = user_id);
create policy own_sessions  on sessions   for select using (auth.uid() = user_id);
create policy own_badges    on user_badges for select using (auth.uid() = user_id);
create policy own_stats     on leaderboard_stats for select using (auth.uid() = user_id);

grant select on public_leaderboard to anon, authenticated;
```

**`sessions` has no client-side UPDATE policy.** Completion happens only through the `complete-session` edge function. This is the load-bearing security decision — see §6.

---

## 5. Accounts

### 5.1 Method

**Magic link (passwordless) as primary**, Google OAuth as secondary. No passwords: nothing to reset, nothing to leak, and it suits a mobile-first audience.

### 5.2 Guest mode must keep working

Do not gate the product behind sign-up. Anonymous visitors browse, build a schedule, and mark sessions using `localStorage` exactly as today. Sign-in is offered as *"save your progress across devices"*, not as a wall.

### 5.3 Local → cloud migration

The most important flow to get right. On first sign-in with existing local data:

1. Detect local state (schedule config, completed sessions, read books).
2. Prompt: *"You have progress on this device. Import it?"*
3. On accept, call `import-progress`, which creates the schedule server-side and marks sessions complete with **`credited = false`**.
4. Clear local state; the cloud becomes authoritative.

**Imported progress never counts toward the leaderboard.** It is real progress and shows on the user's own profile and badges, but it is self-declared and unverifiable. Say this plainly in the UI — one line, no apology. It is also what makes the leaderboard trustworthy.

### 5.4 Offline sync

Local-first. All writes go to an outbox in IndexedDB and flush when online. On conflict, server wins for `completed_at`; the client never overwrites a server completion timestamp.

---

## 6. Leaderboard and badges

### 6.1 The core problem

**A leaderboard over self-reported reading is trivially gameable.** Anyone can mark 38 books complete in ten seconds and hold the top spot permanently. If this is not solved first, the leaderboard is worse than having none — it actively discourages honest users.

Everything below follows from that.

### 6.2 Verified vs declared progress

| | Verified | Declared |
|---|---|---|
| Session completed on or after its scheduled date | ✅ | — |
| Within the daily hour cap | ✅ | — |
| Within the rate limit | ✅ | — |
| Imported from local storage | — | ✅ |
| Bulk-marked / backfilled beyond the daily allowance | — | ✅ |
| Counts on leaderboard & streaks | **Yes** | **No** |
| Counts on own profile & badges | Yes | Yes |

### 6.3 Server-enforced rules — `complete-session`

All checks run in the edge function against **server time**. The client is never trusted.

```
1.  completed_at := now()                        -- server-set, always
2.  reject if session.scheduled_date > current_date   -- no reading the future
3.  credited := true, downgraded to false if any of:
      a. sum(credited hours for that calendar day) + session.hours > 12
      b. more than 3 back-dated sessions already credited today
      c. fewer than 60 seconds since the previous completion
4.  rate limit: 20 completions per user per hour → 429
5.  recompute streak, award badges, upsert leaderboard_stats
```

Tune the constants after launch with real data; ship conservative.

### 6.4 Streak definition

Define streaks over **scheduled sessions, not calendar days** — otherwise weekly readers can never build one.

> **Current streak** = number of consecutive scheduled sessions completed on or before the end of their scheduled day.

A missed session resets it. This works identically for daily, weekdays, and weekly cadences.

### 6.5 Boards

Four, tabbed. Multiple boards prevent early adopters from permanently owning a single ranking.

1. **Current streak** — the headline board. Rewards consistency, hardest to fake.
2. **Hours — last 30 days** — rolling, keeps competition live.
3. **Hours — all time** — the long game.
4. **Adherence %** — completed-on-time ÷ scheduled-to-date. Minimum 20 sessions to qualify.

Opt-in only. Display name required. Never expose email. Country flag optional.

### 6.6 Badge set

**Milestones (verified hours):** `h10` `h50` `h100` `h250` `h500` `h953`

**Phases (7):** `phase1`…`phase7` — one per completed reading phase

**Sections (8):** `sec_memory` `sec_geography` `sec_war` `sec_uncertainty` `sec_liberty` `sec_capital` `sec_energy` `sec_money`

**Streaks:** `streak7` `streak30` `streak100` `streak365`

**Special:**

| Code | Earned by | Why it's good |
|---|---|---|
| `durants` | All 12 Durant volumes (294 h) | The hardest thing in the curriculum by a wide margin |
| `whitepaper` | Completing the Bitcoin white paper session | The curriculum's destination |
| `adversarial` | Completing a work **and** its named counterweight (Keegan + Clausewitz; Rothbard + Federalist Papers) | Directly rewards Saylor's "Read Adversarially" instruction — the intellectual core of the piece |
| `first_week` | 7 sessions in the first 7 days | Activation |
| `comeback` | A completion after 30+ days inactive | Rewards returning rather than shaming lapsing |

Badge criteria live in `src/lib/badges.js` as pure predicates over a progress snapshot, so the same file evaluates client-side (instant feedback) and server-side (authoritative award).

---

## 7. Phased plan

### Phase 1 — Foundation (no new features)

Goal: same product, real architecture. Ship this before touching accounts.

1. Scaffold Astro; extract CSS to files; delete the two unchosen themes.
2. Move all content to `src/content/curriculum.json` and `ui.json`.
3. Lift `SCHEDULE`, badge and progress logic into `src/lib/*.js` as pure ES modules.
4. Build real routed pages, including a page per work (the SEO engine).
5. Self-host fonts; add favicon, manifest, per-page OG images, sitemap, robots.txt.
6. Add Vitest tests for the scheduling engine.
7. Deploy to Cloudflare Pages via GitHub Actions.

**Acceptance**
- [ ] Every section, phase and work has a unique shareable URL in both languages
- [ ] `curriculum.html` behaviour is fully reproduced — nothing regressed
- [ ] Schedule tests prove hours conserved (958 h) for all 3 cadences × 5 durations, no weekend dates under `weekdays`, dates unique and ascending
- [ ] Lighthouse ≥ 95 on performance, accessibility, best practices, SEO
- [ ] No horizontal overflow at 320 px
- [ ] Sitemap lists all pages; each has a distinct title, description and OG image

### Phase 2 — Accounts

1. Supabase project, schema, RLS.
2. Magic link + Google OAuth; profile creation on first sign-in.
3. `create-schedule` edge function generating session rows.
4. `import-progress` for local → cloud migration.
5. Local-first store with IndexedDB outbox and offline sync.
6. Profile page: display name, locale, leaderboard opt-in, data export, account deletion.
7. Privacy policy and terms.

**Acceptance**
- [ ] Guest mode fully functional without an account
- [ ] Sign in on device A, progress appears on device B
- [ ] Local progress imports once, is marked `credited = false`, and local state is cleared
- [ ] Completing sessions offline queues and syncs on reconnect
- [ ] A user cannot read or write another user's rows (verify by direct API call with a foreign JWT)
- [ ] Account deletion removes all rows within 30 days and is self-service
- [ ] Data export returns complete JSON

### Phase 3 — Leaderboard and badges

1. `complete-session` with all §6.3 checks.
2. `badges.js` predicates + award on completion.
3. `refresh-leaderboard` on pg_cron (every 15 min).
4. Leaderboard page, 4 boards, opt-in flow.
5. Badge display on profile with locked/unlocked states.

**Acceptance**
- [ ] `sessions` cannot be updated directly by any client — verified by attempted direct API write
- [ ] Marking 50 sessions rapidly results in credited progress capped per §6.3, remainder declared
- [ ] A future-dated session cannot be completed
- [ ] Streak survives a weekly cadence correctly
- [ ] Only opted-in users appear on the public leaderboard; opting out removes them within one refresh cycle
- [ ] Anonymous users can read `public_leaderboard` and nothing else
- [ ] Badges awarded identically by client prediction and server authority

### Phase 4 — Retention

PWA with offline caching; email reading reminders honouring cadence and timezone; onboarding; streak-at-risk nudge.

---

## 8. Non-negotiables

1. **Never trust the client for anything that affects the leaderboard.** Timestamps, credit and badges are server-decided.
2. **`schedule.js` is shared, not duplicated.** Client and server must produce byte-identical schedules.
3. **Content stays out of code.**
4. **Guest mode never breaks.** Auth is an upgrade, not a gate.
5. **Every new user-facing string ships in EN and FR simultaneously.** No English-only leakage.
6. **No feature ships without its acceptance criteria passing.**
7. **Hour arithmetic must remain exact.** 953 h curriculum, 958 h scheduled. Any change that breaks the test suite is a bug, not a new baseline.

---

## 9. Legal and content

These are the items most likely to be skipped and most likely to cause a problem.

- **Derivative work.** The site is built on Saylor's copyrighted article — and a curated selection and arrangement is itself protectable, independent of the prose. All display notes are already independently written rather than reproduced. Keep prominent attribution and a link to the original on every page.
- **Reach out to Saylor before launch.** He published this to be spread; a bilingual, free, well-built companion is amplification. Explicit goodwill is worth more than a legal opinion, and it costs one message.
- **Label it unofficial.** "An independent reading companion to Michael Saylor's curriculum. Not affiliated with or endorsed by the author." Provide a takedown contact.
- **Book covers.** Do not hotlink retailer images. Use Open Library covers (open licence) with the existing typographic tiles as fallback, or keep tiles only.
- **Affiliate links.** If Amazon Associates is used, disclosure is legally required. Also note that Amazon ships poorly to Benin — consider ebook and regional retailer links first, which serves the audience better anyway.
- **Privacy.** Publishing display names on a leaderboard is publishing personal data. Requires: opt-in consent, privacy policy, self-service export and deletion, and a named data contact. Cloudflare Web Analytics avoids a cookie banner.
- **Content verification.** Verify the 15 unconfirmed French editions and source ISBNs before launch. The French-availability filter is the site's most distinctive feature and it must be correct.

---

## 10. Decisions needed before Phase 1

Blocking — the product owner must answer these first.

1. **Brand.** Codex, Flash, or Ledger? Two get deleted.
2. **Domain.** Subdomain of an existing property, or standalone?
3. **Astro or the lighter Vite path?** SEO versus a one-week ship.
4. **Amazon affiliate — yes or no?** Changes the legal surface and the link strategy.
5. **Has Saylor been contacted?**

Non-blocking, can be resolved during implementation:

6. Leaderboard scope — global only, or also by country?
7. Should declared (imported) progress be shown publicly on profiles, or kept private?
8. Email reminders at launch, or Phase 4?

---

## 11. Explicitly out of scope for v1

Documented so they are not accidentally designed out — and not accidentally built in.

- Notes, highlights or reviews per work
- Social features beyond the leaderboard (following, comments, groups)
- Additional languages beyond EN/FR
- Native mobile apps (the PWA covers this)
- Payments, subscriptions or any monetisation
- User-submitted curricula or custom reading lists
- Integrations with Goodreads, Kindle or library systems
