# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

The real project lives in `app/`, not the repo root. The repo root only holds `LAUNCH-BRIEF.md` (the spec — see below) and `curriculum.html` (the original single-file prototype, kept as a content/behavior reference during migration, not a build target). All commands below run from `app/`.

Stack: Astro 7 (static + islands), TypeScript (`astro/tsconfigs/strict`), Vitest. Node >=22.12.0 required. No `.nvmrc` exists to enforce this.

## Commands (run from `app/`)

- `npm run dev` — dev server on port 4321
- `npm run build` — production build to `app/dist`
- `npm test` — run Vitest once (`npm run test:watch` for watch mode)
- No `npm run lint`/`astro check` script exists yet even though `@astrojs/check` is a devDependency — TS checking isn't wired into CI.

## Full spec

`@LAUNCH-BRIEF.md` is the project's spec and source of truth — read it before any non-trivial change. It documents the target DB schema, the phased rollout plan, and the rules below in full.

## Non-negotiables (LAUNCH-BRIEF §8)

1. Never trust the client for anything that affects the leaderboard — timestamps, credit, and badges are server-decided (applies once Phase 3 lands).
2. `src/lib/schedule.js` is a single shared pure module — client and server must produce byte-identical schedules. Never fork or duplicate it.
3. Content stays out of code: curriculum/UI copy lives only in `src/content/curriculum.json` and `src/content/ui.json`, never hardcoded in components or logic.
4. Guest mode (localStorage) must never break. Auth is an upgrade, not a gate.
5. Every new user-facing string ships in EN and FR simultaneously in `ui.json` — no English-only leakage.
6. No feature ships without its acceptance criteria passing.
7. Hour arithmetic must stay exact (953h curriculum, 958h scheduled). A broken test on this is a bug to fix, not a new baseline to accept.

## Current state

- Phase 1 (static Astro foundation) is largely built: routed pages, content extraction, `schedule.js` lifted and tested, CI/deploy wired up. Phases 2-4 (Supabase accounts, leaderboard/badges, PWA) are not started — no `supabase/`, auth, or badge code exists yet.
- Only one brand theme (Codex) is implemented in `src/styles/global.css`; `curriculum.html` still contains two other theme token sets that were not carried over.
- `astro.config.mjs` has a placeholder `SITE` domain (`curriculum.example.com`) marked TODO — sitemap/OG URLs are wrong until the real domain is set.
- CI (`.github/workflows/deploy.yml`) runs `npm ci && npm test && npm run build` on every push/PR; the deploy-to-Cloudflare-Pages job (push to `main` only) needs `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo secrets that are not yet configured.
- This directory is not yet a git repository.
