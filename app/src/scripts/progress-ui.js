/* Client-side hydration: fills in per-user reading progress on top of the
   statically-rendered (0-progress) HTML. Kept separate from the pure
   lib/*.js modules so those stay usable on the server untouched. */
import { groups as buildGroups, BOOKS, TOTAL_MAX, ui } from "../lib/content.js";
import { loadState, resetProgress, toggleBookRead } from "./state.js";

function readHrs(bks, read) {
  return bks.filter((b) => read.has(b.n)).reduce((a, b) => a + b.h[1], 0);
}

export function initOverviewProgress() {
  const cardsEl = document.querySelector(".cards[data-view]");
  if (!cardsEl) return;
  const view = cardsEl.dataset.view;
  const lang = cardsEl.dataset.lang;

  const render = () => {
    const read = new Set(loadState().read);
    const T = ui(lang);
    const G = buildGroups(view, lang);
    let doneH = 0,
      doneN = 0;

    G.forEach((g) => {
      const mx = g.books.reduce((a, b) => a + b.h[1], 0);
      const rh = readHrs(g.books, read);
      const readN = g.books.filter((b) => read.has(b.n)).length;
      doneH += rh;
      doneN += readN;

      const card = document.querySelector(`.card[data-group-key="${g.key}"]`);
      if (card) {
        const fill = mx ? (rh / mx) * 100 : 0;
        card
          .querySelector("[data-fill-bar]")
          ?.style.setProperty("--f", `${fill}%`);
        const cnt = card.querySelector("[data-fill-count]");
        if (cnt) cnt.textContent = `${readN}/${g.books.length}`;
      }
      const seg = document.querySelector(`.oseg[data-seg-key="${g.key}"] i`);
      if (seg) seg.style.setProperty("--f", `${mx ? (rh / mx) * 100 : 0}%`);
    });

    const hoursEl = document.querySelector("[data-progress-hours]");
    const restEl = document.querySelector("[data-progress-rest]");
    if (hoursEl) hoursEl.textContent = String(doneH);
    if (restEl)
      restEl.textContent = `/ ${TOTAL_MAX} ${T.hoursRead} · ${doneN}/${BOOKS.length} ${T.works}`;
  };

  render();
  document
    .querySelector("[data-reset-progress]")
    ?.addEventListener("click", () => {
      resetProgress();
      render();
    });
  window.addEventListener("curriculum:sync", render);
}

export function initDetailProgress() {
  const shd = document.querySelector(".shd[data-max-hours]");
  if (!shd) return;
  const mx = Number(shd.dataset.maxHours);

  const render = () => {
    const read = new Set(loadState().read);
    const nums = new Set(
      [...document.querySelectorAll("[data-book-n]")].map((el) =>
        Number(el.dataset.bookN),
      ),
    );
    let rh = 0;
    nums.forEach((n) => {
      if (read.has(n)) {
        const b = BOOKS.find((x) => x.n === n);
        if (b) rh += b.h[1];
      }
    });
    const pct = mx ? (rh / mx) * 100 : 0;
    shd.querySelector(".tick i")?.style.setProperty("--w", `${pct}%`);

    document.querySelectorAll("[data-book-n]").forEach((el) => {
      const n = Number(el.dataset.bookN);
      el.dataset.read = String(read.has(n));
    });
  };

  render();
  window.addEventListener("curriculum:sync", render);
}

export function initWorkProgress() {
  const markBtn = document.querySelector("[data-mark-read]");
  if (!markBtn) return;
  const n = Number(markBtn.dataset.markRead);

  const apply = (isRead) => {
    markBtn.dataset.on = String(isRead);
    markBtn.textContent = isRead
      ? markBtn.dataset.labelDone
      : markBtn.dataset.labelMark;
  };

  apply(loadState().read.includes(n));
  markBtn.addEventListener("click", () => {
    const next = toggleBookRead(n);
    apply(next.read.includes(n));
  });
  window.addEventListener("curriculum:sync", () =>
    apply(loadState().read.includes(n)),
  );
}
