/* Scroll-reveal for card/row/tile elements. Progressive enhancement only:
   the .reveal class (which offsets an element's position) is applied here,
   never in CSS, so a slow/failed script load leaves content exactly where
   it belongs instead of stuck mid-animation. Content itself is never
   hidden (only translated) — a scroll reveal must not risk leaving real
   content invisible for crawlers, slow connections, or anything that
   doesn't fire a real intersection event.

   Stagger is done via setTimeout, not a CSS transition-delay, because a
   delay on the shared `transform` transition would also lag the hover
   tilt on these same elements — the reveal offset and the hover tilt
   can't have different delays through one property. */
const SELECTOR = ".card, .bk, .srow, .cw, .pace-cell, .calsum > div";
const STAGGER_MS = 55;

export function initReveal() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const els = document.querySelectorAll(SELECTOR);
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      let batch = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        io.unobserve(el);
        setTimeout(() => el.classList.add("is-revealed"), batch * STAGGER_MS);
        batch = (batch + 1) % 8;
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );

  els.forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
}
