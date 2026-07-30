/* Rotates a small deck of book-cover tiles in the hero. Purely decorative
   (the component marks its root aria-hidden), so this only ever adjusts
   which 3 of the N tiles are shown — it never affects real content. */
const INTERVAL_MS = 4200;

export function initHeroCovers() {
  const root = document.querySelector("[data-hero-covers]");
  if (!root) return;

  const tiles = [...root.querySelectorAll(".tile")];
  if (tiles.length < 3) return;

  let order = tiles.map((_, i) => i);

  function paint() {
    for (const t of tiles) delete t.dataset.pos;
    order.slice(0, 3).forEach((tileIndex, pos) => {
      tiles[tileIndex].dataset.pos = String(pos);
    });
  }
  paint();

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  setInterval(() => {
    order.push(order.shift());
    paint();
  }, INTERVAL_MS);
}
