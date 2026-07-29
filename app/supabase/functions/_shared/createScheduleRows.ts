// Reuses the client's own schedule engine so server and client produce
// byte-identical schedules (non-negotiable #2 — schedule.js is shared,
// not duplicated). VERIFY this relative import resolves under
// `supabase functions serve` / `supabase functions deploy` once Docker
// is available locally — if the bundler can't reach outside
// supabase/functions/, replace this import with a one-line re-export
// shim at supabase/functions/_shared/schedule.js
// (`export * from "../../../src/lib/schedule.js";`) instead of
// duplicating the algorithm here.
import { buildSchedule } from "../../../src/lib/schedule.js";

export interface ScheduleCfg {
  start: string;
  cadence: "daily" | "weekdays" | "weekly";
  hours: number;
}

export function isValidCfg(cfg: unknown): cfg is ScheduleCfg {
  const c = cfg as Partial<ScheduleCfg> | null;
  return (
    !!c &&
    typeof c.start === "string" &&
    (c.cadence === "daily" ||
      c.cadence === "weekdays" ||
      c.cadence === "weekly") &&
    typeof c.hours === "number" &&
    c.hours >= 1 &&
    c.hours <= 12
  );
}

/** Builds the session rows for a schedule, ready to insert into `sessions`. */
export function scheduleSessionRows(
  userId: string,
  scheduleId: string,
  cfg: ScheduleCfg,
) {
  const sessions = buildSchedule(cfg);
  const rows = sessions.map((s: any) => ({
    user_id: userId,
    schedule_id: scheduleId,
    seq: s.i,
    scheduled_date: s.date,
    hours: s.hours,
    parts: s.parts,
  }));
  return { sessions, rows };
}
