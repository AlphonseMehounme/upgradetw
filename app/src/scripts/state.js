/* Browser-only local state. Guest mode: everything lives in localStorage.
   §5.2 — this must keep working with no account; §5.3 (Phase 2) migrates it
   to Supabase on first sign-in without changing this shape. */
import { buildSchedule } from "../lib/schedule.js";
import {
  setBookRead as pureSetBookRead,
  setSessionDone as pureSetSessionDone,
  syncBooks,
} from "../lib/progress.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { enqueueSessionOp } from "./outbox.js";
import { isSignedIn } from "./authState.js";

const KEY = "curriculum:v1";

/** Enqueues an outbox op for every date that entered/left `done`, so a
    book-read cascade (which can flip session completion too) is synced
    exactly like a direct calendar toggle. No-op for guests/signed-out
    visitors — isSignedIn() is a synchronous cache updated by
    auth-app.js's onAuthStateChange listener. */
function enqueueDoneDiff(prevDone, nextDone) {
  if (!isSignedIn()) return;
  const prevSet = new Set(prevDone);
  const nextSet = new Set(nextDone);
  for (const date of nextSet) {
    if (!prevSet.has(date)) enqueueSessionOp(date, true).catch(() => {});
  }
  for (const date of prevSet) {
    if (!nextSet.has(date)) enqueueSessionOp(date, false).catch(() => {});
  }
}

function defaultState() {
  return { cfg: null, done: [], read: [] };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const d = JSON.parse(raw);
    return {
      cfg: d.cfg ?? null,
      done: Array.isArray(d.done) ? d.done : [],
      read: Array.isArray(d.read) ? d.read : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function schedOf(state) {
  return state.cfg ? buildSchedule(state.cfg) : null;
}

export function toggleBookRead(n) {
  const state = loadState();
  const sched = schedOf(state);
  const { done, read } = pureSetBookRead(
    sched,
    new Set(state.done),
    new Set(state.read),
    n,
    !state.read.includes(n),
  );
  const next = { ...state, done: [...done], read: [...read] };
  saveState(next);
  enqueueDoneDiff(state.done, next.done);
  return next;
}

export function toggleSessionDone(date) {
  const state = loadState();
  const sched = schedOf(state);
  const { done, read } = pureSetSessionDone(
    sched,
    new Set(state.done),
    date,
    !state.done.includes(date),
  );
  const next = { ...state, done: [...done], read: [...read] };
  saveState(next);
  enqueueDoneDiff(state.done, next.done);
  return next;
}

export function resetProgress() {
  const state = loadState();
  const next = { ...state, done: [], read: [] };
  saveState(next);
  return next;
}

/** True if this device has a schedule or any progress worth offering to
    import on first sign-in (§5.3). */
export function hasLocalProgress() {
  const state = loadState();
  return Boolean(state.cfg) || state.done.length > 0 || state.read.length > 0;
}

/** Called after a successful import-progress call — the cloud becomes
    authoritative, so local state resets to a clean guest-mode default
    rather than carrying stale pre-import data forward. */
export function clearLocalStateAfterImport() {
  const next = defaultState();
  saveState(next);
  return next;
}

/**
 * Generate (or regenerate) the schedule for cfg. Matches curriculum.html's
 * genBtn handler: session completions are keyed by date, so regenerating
 * with a different start/cadence naturally leaves old dates behind — read
 * state is recomputed from whichever completed dates still line up with
 * the new schedule. Do not "fix" this to preserve read state independently
 * of dates; that is not how the prototype behaves and changing it here
 * would regress the migration's behavioural parity requirement.
 */
export function setSchedule(cfg) {
  const state = loadState();
  const sched = buildSchedule(cfg);
  const read = syncBooks(sched, new Set(state.done));
  const next = { ...state, cfg, read: [...read] };
  saveState(next);
  if (isSignedIn() && isSupabaseConfigured()) {
    supabase()
      .functions.invoke("create-schedule", { body: cfg })
      .catch(() => {});
  }
  return next;
}
