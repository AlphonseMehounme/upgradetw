/* The reading calendar. Fully client-rendered — like curriculum.html, this
   view has no useful server-rendered content because it's entirely a
   function of the visitor's own local state (guest mode, §5.2). */
import {
  buildSchedule,
  spanLabel,
  schedStats,
  fromIso,
  todayIso,
  iso,
  addDays,
} from "../lib/schedule.js";
import {
  BOOKS,
  COUNTERWEIGHTS,
  accentVar,
  localizedTitle,
  ui,
} from "../lib/content.js";
import { loadState, setSchedule, toggleSessionDone } from "./state.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export function initCalendar() {
  const root = document.getElementById("calRoot");
  if (!root) return;
  const lang = root.dataset.lang;
  const T = ui(lang);
  const ov = document.getElementById("ov");
  const daysheet = document.getElementById("daysheet");

  let state = loadState();
  let sched = state.cfg ? buildSchedule(state.cfg) : null;
  let byDate = sched ? new Map(sched.map((x) => [x.date, x])) : null;
  let done = new Set(state.done);

  let showSetup = !sched;
  const draft = {
    start: state.cfg?.start ?? todayIso(),
    cadence: state.cfg?.cadence ?? "daily",
    hours: state.cfg?.hours ?? 2,
  };
  let calY = null,
    calM = null;
  let openDayKey = null;

  const titleOf = (it) => {
    const src =
      it.kind === "cw"
        ? COUNTERWEIGHTS.find((c) => c.id === it.id)
        : BOOKS.find((b) => b.n === it.n);
    return localizedTitle(src, lang);
  };
  const srcOf = (it) =>
    it.kind === "cw"
      ? COUNTERWEIGHTS.find((c) => c.id === it.id)
      : BOOKS.find((b) => b.n === it.n);
  const fmtDate = (v, opt) =>
    fromIso(v).toLocaleDateString(
      lang === "fr" ? "fr-FR" : "en-GB",
      opt || { day: "numeric", month: "short", year: "numeric" },
    );

  /** Collapses consecutive same-book sessions into a single date-range row
      (e.g. "01 Aug - 03 Aug"), so a book split across several days shows
      once instead of repeating the same title on every day it's read. */
  function groupAgendaRows(sessions) {
    const groups = [];
    for (const x of sessions) {
      const lead = x.parts.find((pt) => !pt.marker) || x.parts[0];
      const key = lead.kind === "cw" ? `cw:${lead.id}` : `bk:${lead.n}`;
      const last = groups[groups.length - 1];
      const consecutive =
        last &&
        last.key === key &&
        iso(addDays(fromIso(last.end), 1)) === x.date;
      if (consecutive) {
        last.end = x.date;
        last.hours += x.hours;
        last.sessions.push(x);
      } else {
        groups.push({
          key,
          lead,
          start: x.date,
          end: x.date,
          hours: x.hours,
          sessions: [x],
        });
      }
    }
    return groups.map((g) => ({
      ...g,
      allDone: g.sessions.every((s) => done.has(s.date)),
    }));
  }

  function render() {
    if (sched && !showSetup) renderCalView();
    else renderSetup();
  }

  function renderSetup() {
    const preview = buildSchedule({
      start: draft.start,
      cadence: draft.cadence,
      hours: draft.hours,
    });
    const end = preview[preview.length - 1].date;
    const span = spanLabel(draft.start, end, T);
    const years = (fromIso(end) - fromIso(draft.start)) / (365.25 * 864e5);
    root.innerHTML = `
      <section class="calhead">
        <div class="eyebrow">${esc(T.tabCalendar)}</div>
        <h1>${esc(T.calTitle)}</h1>
        <p>${esc(T.calLede)}</p>
      </section>
      <div class="setup">
        <div class="fld"><span class="eyebrow">${esc(T.startDate)}</span>
          <input type="date" id="fStart" value="${draft.start}"></div>
        <div class="fld"><span class="eyebrow">${esc(T.cadence)}</span><div class="opts">
          ${[
            ["daily", T.cadDaily],
            ["weekdays", T.cadWeekdays],
            ["weekly", T.cadWeekly],
          ]
            .map(
              ([k, l]) =>
                `<button class="opt" data-cad="${k}" aria-pressed="${draft.cadence === k}">${esc(l)}</button>`,
            )
            .join("")}
        </div></div>
        <div class="fld"><span class="eyebrow">${esc(T.perSession)}</span><div class="opts">
          ${[1, 2, 3, 5, 8].map((h) => `<button class="opt" data-hrs="${h}" aria-pressed="${draft.hours === h}">${h} h</button>`).join("")}
        </div></div>
        <div class="calsum">
          <div><div class="k">${esc(T.sessions)}</div><div class="v">${preview.length}</div></div>
          <div><div class="k">${esc(T.finishes)}</div><div class="v">${esc(fmtDate(end))}</div></div>
          <div><div class="k">${esc(T.span)}</div><div class="v">${esc(span)}</div></div>
        </div>
        ${years >= 5 ? `<p class="warn">${esc(T.longWarn)}</p>` : ""}
        ${sched ? `<p class="note">${esc(T.regenNote)}</p>` : ""}
        <button class="cta" id="genBtn">${esc(T.generate)}</button>
      </div>`;
  }

  function renderCalView() {
    const st = schedStats(sched, done);
    if (calY === null) {
      const nxt =
        sched.find((x) => !done.has(x.date) && x.date >= todayIso()) ||
        sched.find((x) => x.date >= todayIso()) ||
        sched[0];
      const d = fromIso(nxt.date);
      calY = d.getFullYear();
      calM = d.getMonth();
    }
    const first = new Date(calY, calM, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysIn = new Date(calY, calM + 1, 0).getDate();
    const rows = Math.ceil((offset + daysIn) / 7);
    const dow = [...Array(7)].map((_, i) =>
      new Date(2024, 0, 1 + i)
        .toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
          weekday: "short",
        })
        .slice(0, 3),
    );
    const monthLabel = first.toLocaleDateString(
      lang === "fr" ? "fr-FR" : "en-GB",
      { month: "long", year: "numeric" },
    );

    let cells = "";
    for (let i = 0; i < rows * 7; i++) {
      const dayNum = i - offset + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysIn;
      if (!inMonth) {
        cells += `<div class="day out"></div>`;
        continue;
      }
      const key = `${calY}-${String(calM + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const ses = byDate.get(key);
      const isToday = key === todayIso();
      if (!ses) {
        cells += `<div class="day${isToday ? " today" : ""}"><span class="dn">${dayNum}</span></div>`;
        continue;
      }
      const lead = ses.parts.find((pt) => !pt.marker) || ses.parts[0];
      const extra = ses.parts.filter((pt) => !pt.marker).length - 1;
      cells += `<button class="day has${isToday ? " today" : ""}" data-day="${key}" data-done="${done.has(key)}"
          style="--c:${accentVar(lead.s)}">
        <span class="dn">${dayNum}</span>
        <span class="dot"></span>
        <span class="chip">${esc(titleOf(lead))}${extra > 0 ? ` +${extra}` : ""}</span>
        <span class="dh">${ses.hours}h</span></button>`;
    }

    const monthSes = sched.filter((x) => {
      const d = fromIso(x.date);
      return d.getFullYear() === calY && d.getMonth() === calM;
    });
    const agenda = monthSes.length
      ? groupAgendaRows(monthSes)
          .map((g) => {
            const dateLabel =
              g.start === g.end
                ? esc(fmtDate(g.start, { day: "2-digit", month: "short" }))
                : `${esc(fmtDate(g.start, { day: "2-digit", month: "short" }))} – ${esc(fmtDate(g.end, { day: "2-digit", month: "short" }))}`;
            return `<button class="arow" data-day="${g.start}" data-done="${g.allDone}" style="--c:${accentVar(g.lead.s)}">
            <span class="ad">${dateLabel}</span>
            <span class="at">${esc(titleOf(g.lead))}</span>
            <span class="ah">${g.hours}h</span></button>`;
          })
          .join("")
      : `<p class="empty">${esc(T.emptyMonth)}</p>`;

    const pct = st.total ? Math.round((st.doneN / st.total) * 100) : 0;
    const pill =
      st.delta < 0
        ? `<span class="pill bad">${Math.abs(st.delta)} ${esc(T.behindBy)}</span>`
        : `<span class="pill ok">${st.delta > 0 ? `${st.delta} ${esc(T.aheadBy)}` : esc(T.onTrack)}</span>`;

    root.innerHTML = `
      <section class="calhead" style="padding-bottom:.4rem">
        <div class="eyebrow">${esc(T.calProgress)}</div>
        <h1 style="font-size:clamp(1.5rem,3.6vw,2.1rem)">${st.doneN} / ${st.total} ${esc(T.sessionsDone)}</h1>
      </section>
      <div class="calsum">
        <div><div class="k">${esc(T.hours)}</div><div class="v">${st.doneH}<small> / ${st.hours}</small></div></div>
        <div><div class="k">${esc(T.finishes)}</div><div class="v">${esc(fmtDate(st.end))}</div></div>
        <div><div class="k">${esc(T.span)}</div><div class="v">${esc(spanLabel(st.start, st.end, T))}</div></div>
        <div><div class="k">${esc(T.today)}</div><div class="v" style="font-size:1rem;padding-top:.25rem">${pill}</div></div>
      </div>
      <div class="obar" style="margin-bottom:.4rem"><span class="oseg" style="--c:var(--brass);flex:0 0 100%"><i style="--f:${pct}%"></i></span></div>
      <div class="calnav">
        <button class="nav-b" data-mo="-1" aria-label="prev">‹</button>
        <button class="nav-b" data-mo="1" aria-label="next">›</button>
        <span class="mo">${esc(monthLabel)}</span>
        <button class="linkbtn" id="todayBtn">${esc(T.jumpToday)}</button>
        <span style="flex:1"></span>
        <button class="linkbtn" id="regenBtn">${esc(T.regenerate)}</button>
      </div>
      <div class="calgrid">
        ${dow.map((d) => `<div class="dow">${esc(d)}</div>`).join("")}
        ${cells}
      </div>
      <div class="agenda"><h3>${esc(T.thisMonth)}</h3>${agenda}</div>`;
  }

  function openDay(key) {
    const ses = byDate.get(key);
    if (!ses) return;
    const isDone = done.has(key);
    const parts = ses.parts
      .map((pt) => {
        const src = srcOf(pt),
          acc = accentVar(pt.s);
        if (pt.marker) {
          return `<div class="dpart" style="--c:${acc}">
            <div class="eyebrow" style="color:${acc}">${esc(T.alongside)}</div>
            <div class="dt" style="margin-top:.35rem">${esc(titleOf(pt))}</div>
            <div class="da">${esc(src.author)} · ${esc(T.untimed)}</div></div>`;
        }
        const total = src.h[1];
        return `<div class="dpart" style="--c:${acc}">
          <div class="dt">${esc(titleOf(pt))}${pt.kind === "reread" ? ` <span class="tag" style="color:${acc};border-color:${acc}">${esc(T.reread)}</span>` : ""}</div>
          <div class="da">${esc(src.author)}</div>
          <div class="dr">${esc(T.hoursOf)} ${pt.from + 1}–${pt.to} ${esc(T.ofWork)} ${total}</div>
          <div class="prg"><i style="--o:${(pt.from / total) * 100}%;--w:${(pt.take / total) * 100}%"></i></div></div>`;
      })
      .join("");

    daysheet.innerHTML = `
      <button class="x" id="xBtn" aria-label="${esc(T.close)}">×</button>
      <div class="crumb">
        <span class="tag">${esc(T.session)} ${ses.i + 1}</span>
        <span class="tag">${ses.hours} ${esc(T.hours)}</span>
        ${isDone ? `<span class="tag" style="color:var(--a2);border-color:var(--a2)">${esc(T.markedDone)}</span>` : ""}
      </div>
      <h2 style="font-family:var(--f-display);font-weight:600;font-size:clamp(1.24rem,3.2vw,1.62rem);margin:.7rem 0 0">${esc(fmtDate(key, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</h2>
      <div style="margin-top:1.2rem">${parts}</div>
      <div class="acts">
        <button class="btn pri" id="dayMark" data-day="${key}" data-on="${isDone}" style="--c:var(--a2)">
          ${esc(isDone ? T.markedDone : T.markDone)}</button>
      </div>`;
    ov.dataset.open = "true";
    document.body.style.overflow = "hidden";
    openDayKey = key;
    document.getElementById("xBtn")?.focus();
  }

  function closeDay() {
    ov.dataset.open = "false";
    document.body.style.overflow = "";
    openDayKey = null;
  }

  root.addEventListener("click", (e) => {
    const cad = e.target.closest("[data-cad]");
    if (cad) {
      draft.cadence = cad.dataset.cad;
      renderSetup();
      return;
    }

    const hrsBtn = e.target.closest("[data-hrs]");
    if (hrsBtn) {
      draft.hours = +hrsBtn.dataset.hrs;
      renderSetup();
      return;
    }

    if (e.target.closest("#genBtn")) {
      const cfg = { ...draft };
      state = setSchedule(cfg);
      sched = buildSchedule(cfg);
      byDate = new Map(sched.map((x) => [x.date, x]));
      done = new Set(state.done);
      showSetup = false;
      calY = null;
      render();
      return;
    }
    if (e.target.closest("#regenBtn")) {
      draft.start = state.cfg.start;
      draft.cadence = state.cfg.cadence;
      draft.hours = state.cfg.hours;
      showSetup = true;
      render();
      return;
    }
    const mo = e.target.closest("[data-mo]");
    if (mo) {
      let m = calM + Number(mo.dataset.mo);
      if (m < 0) {
        m = 11;
        calY--;
      } else if (m > 11) {
        m = 0;
        calY++;
      }
      calM = m;
      renderCalView();
      return;
    }
    if (e.target.closest("#todayBtn")) {
      const d = new Date();
      calY = d.getFullYear();
      calM = d.getMonth();
      renderCalView();
      return;
    }
    const dayEl = e.target.closest("[data-day]");
    if (dayEl) {
      openDay(dayEl.dataset.day);
      return;
    }
  });

  root.addEventListener("change", (e) => {
    if (e.target.id === "fStart") {
      draft.start = e.target.value || todayIso();
      renderSetup();
    }
  });

  ov.addEventListener("click", (e) => {
    const dm = e.target.closest("#dayMark");
    if (dm) {
      const key = dm.dataset.day;
      state = toggleSessionDone(key);
      done = new Set(state.done);
      openDay(key);
      renderCalView();
      return;
    }
    if (e.target.closest("#xBtn") || e.target.id === "ov") {
      closeDay();
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openDayKey) closeDay();
  });

  window.addEventListener("curriculum:sync", () => {
    state = loadState();
    sched = state.cfg ? buildSchedule(state.cfg) : null;
    byDate = sched ? new Map(sched.map((x) => [x.date, x])) : null;
    done = new Set(state.done);
    showSetup = !sched;
    if (openDayKey) closeDay();
    render();
  });

  render();
}
