/* ===================================================================
   MODULE: SCHEDULE — pure functions, no DOM.
   Lifted verbatim from curriculum.html (the prototype). Do not rewrite
   the algorithm — it is already correct and tested (see schedule.test.js).
   The only globals it depends on are the content arrays below, which are
   pure data, not application state. This file must produce byte-identical
   output whether it runs in the browser or on the server (Supabase edge
   functions in Phase 2), so nothing here may read Date.now(), locale, or
   any other ambient/environment state.
   =================================================================== */
import { BOOKS, PHASES, COUNTERWEIGHTS } from "./content.js";

export { BOOKS, PHASES, COUNTERWEIGHTS };

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (v) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const todayIso = () => iso(new Date());

/* the full curriculum flattened into Saylor's reading order */
export function readingLine() {
  const out = [];
  PHASES.forEach((p) => {
    [
      ...BOOKS.filter((b) => b.ph === p.n).map((b) => ({
        kind: "book",
        ord: b.ord,
        n: b.n,
        hours: b.h[1],
        s: b.s,
      })),
      ...COUNTERWEIGHTS.filter((c) => c.ph === p.n && c.ord).map((c) => ({
        kind: "cw",
        ord: c.ord,
        id: c.id,
        hours: 0,
        s: c.s,
      })),
      ...(p.reread || []).map((r) => {
        const b = BOOKS.find((x) => x.n === r.n);
        return { kind: "reread", ord: r.ord, n: b.n, hours: b.h[1], s: b.s };
      }),
    ]
      .sort((a, b) => a.ord - b.ord)
      .forEach((it) => out.push({ ...it, phase: p.n }));
  });
  return out;
}

/* split the reading line into fixed-length sessions, then date them */
export function buildSchedule(cfg) {
  const per = cfg.hours,
    sessions = [];
  let cur = { parts: [], hours: 0 };
  const flush = () => {
    if (cur.parts.length) {
      sessions.push(cur);
      cur = { parts: [], hours: 0 };
    }
  };

  readingLine().forEach((it) => {
    if (it.hours === 0) {
      /* untimed companion text */
      const tgt = cur.parts.length ? cur : sessions[sessions.length - 1] || cur;
      tgt.parts.push({ ...it, marker: true });
      if (tgt === cur && !sessions.length && !cur.hours) {
      }
      return;
    }
    let placed = 0;
    while (placed < it.hours) {
      const take = Math.min(per - cur.hours, it.hours - placed);
      cur.parts.push({ ...it, from: placed, to: placed + take, take });
      cur.hours += take;
      placed += take;
      if (cur.hours >= per) flush();
    }
  });
  flush();

  let d = fromIso(cfg.start);
  const skipWeekend = () => {
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  };
  if (cfg.cadence === "weekdays") skipWeekend();
  sessions.forEach((ss, i) => {
    ss.i = i;
    ss.date = iso(d);
    if (cfg.cadence === "weekly") d = addDays(d, 7);
    else {
      d = addDays(d, 1);
      if (cfg.cadence === "weekdays") skipWeekend();
    }
  });
  return sessions;
}

export function spanLabel(a, b, T) {
  const A = fromIso(a),
    B = fromIso(b);
  let m =
    (B.getFullYear() - A.getFullYear()) * 12 + (B.getMonth() - A.getMonth());
  if (B.getDate() < A.getDate()) m--;
  m = Math.max(m, 0);
  const y = Math.floor(m / 12),
    mm = m % 12;
  return (y ? `${y}${T.yearsShort} ` : "") + `${mm} ${T.monthsShort}`;
}

export function schedStats(sched, done, refDateIso = todayIso()) {
  const total = sched.length;
  const doneN = sched.filter((x) => done.has(x.date)).length;
  const hours = sched.reduce((a, x) => a + x.hours, 0);
  const doneH = sched
    .filter((x) => done.has(x.date))
    .reduce((a, x) => a + x.hours, 0);
  const due = sched.filter((x) => x.date <= refDateIso).length;
  return {
    total,
    doneN,
    hours,
    doneH,
    due,
    delta: doneN - due,
    start: sched[0].date,
    end: sched[total - 1].date,
  };
}
