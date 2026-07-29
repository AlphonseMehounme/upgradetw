/* Bidirectional sync between local state/outbox and Supabase, for
   signed-in users only. No-ops entirely when Supabase isn't configured
   (non-negotiable #4).

   Push: flushes queued completions (outbox.js) through complete-session.
   Pull: adopts the active schedule's cfg if local cfg is missing/stale
   (so a fresh device can render a calendar at all) and unions the
   server's confirmed completions into local `done` — local can add,
   never remove, a server-confirmed completion (§5.4: server wins on
   completed_at, client never overwrites it). */
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { listOps, removeOp } from "./outbox.js";
import { loadState, saveState } from "./state.js";
import { setSignedIn } from "./authState.js";

let started = false;

export function initSync() {
  if (started || !isSupabaseConfigured()) return;
  started = true;
  const sb = supabase();

  sb.auth.onAuthStateChange((event, session) => {
    setSignedIn(Boolean(session?.user));
    if (event === "SIGNED_IN" && session?.user) runSync(session.user.id);
  });
  sb.auth.getSession().then(({ data }) => {
    setSignedIn(Boolean(data.session?.user));
    if (data.session?.user) runSync(data.session.user.id);
  });

  window.addEventListener("online", () => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) runSync(data.session.user.id);
    });
  });
}

async function runSync(userId) {
  await flushOutbox();
  await pullFromServer(userId);
}

async function flushOutbox() {
  const sb = supabase();
  const ops = await listOps();
  let flushed = false;
  for (const op of ops) {
    const { error } = await sb.functions.invoke("complete-session", {
      body: { date: op.date },
    });
    if (!error) {
      await removeOp(op.date);
      flushed = true;
    }
  }
  if (flushed) window.dispatchEvent(new CustomEvent("curriculum:sync"));
}

async function pullFromServer(userId) {
  const sb = supabase();
  const [{ data: schedule }, { data: sessions, error }] = await Promise.all([
    sb
      .from("schedules")
      .select("start_date, cadence, hours_per_session")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sb
      .from("sessions")
      .select("scheduled_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);
  if (error) return;

  const state = loadState();
  let next = state;
  let changed = false;

  if (schedule) {
    const cfg = {
      start: schedule.start_date,
      cadence: schedule.cadence,
      hours: schedule.hours_per_session,
    };
    if (!state.cfg || JSON.stringify(state.cfg) !== JSON.stringify(cfg)) {
      next = { ...next, cfg };
      changed = true;
    }
  }

  if (sessions) {
    const merged = new Set(next.done);
    for (const row of sessions) {
      if (!merged.has(row.scheduled_date)) {
        merged.add(row.scheduled_date);
        changed = true;
      }
    }
    next = { ...next, done: [...merged] };
  }

  if (changed) {
    saveState(next);
    window.dispatchEvent(new CustomEvent("curriculum:sync"));
  }
}
