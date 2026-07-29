/* ===================================================================
   MODULE: CONTENT — content access + presentation helpers.
   Content itself lives only in src/content/*.json (rule §3.2: content
   never lives in code). Everything here derives from that data.
   =================================================================== */
import curriculum from "../content/curriculum.json" with { type: "json" };
import uiStrings from "../content/ui.json" with { type: "json" };

export const SECTIONS = curriculum.sections;
export const PHASES = curriculum.phases;
export const BOOKS = curriculum.books;
export const COUNTERWEIGHTS = curriculum.counterweights;
export const UI = uiStrings;

export const LANGS = ["en", "fr"];

export function ui(lang) {
  return UI[lang] ?? UI.en;
}

/** Pick the localized value of a {en,fr} object, falling back to en. */
export function L(o, lang) {
  if (o && typeof o === "object" && !Array.isArray(o)) return o[lang] ?? o.en;
  return o;
}

const ACC = ["--a1", "--a2", "--a3", "--a4", "--a5", "--a6", "--a7", "--a8"];
const secIndex = (id) => SECTIONS.findIndex((s) => s.id === id);
export const accentVar = (sid) => `var(${ACC[secIndex(sid)] ?? "--a1"})`;
export const accentHex = (sid) => SECTIONS[secIndex(sid)]?.accent ?? "#8B6F47";

export const TOTAL_MIN = BOOKS.reduce((a, b) => a + b.h[0], 0);
export const TOTAL_MAX = BOOKS.reduce((a, b) => a + b.h[1], 0);

export const H = (bks) => bks.reduce((a, b) => a + b.h[1], 0);
export const readHrs = (bks, read) =>
  bks.filter((b) => read.has(b.n)).reduce((a, b) => a + b.h[1], 0);

function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* precompute slugs once, disambiguating any collision by appending the item's number/id */
const _slugMap = new Map();
function registerSlug(item, key) {
  let slug = slugify(item.sub ? `${item.title} ${item.sub}` : item.title);
  if (_slugMap.has(slug)) slug = `${slug}-${key}`;
  _slugMap.set(slug, key);
  return slug;
}
export const BOOK_SLUGS = new Map(
  BOOKS.map((b) => [b.n, registerSlug(b, `b${b.n}`)]),
);
export const CW_SLUGS = new Map(
  COUNTERWEIGHTS.map((c) => [c.id, registerSlug(c, c.id)]),
);
export const SLUG_TO_WORK = new Map([
  ...BOOKS.map((b) => [BOOK_SLUGS.get(b.n), { kind: "book", item: b }]),
  ...COUNTERWEIGHTS.map((c) => [CW_SLUGS.get(c.id), { kind: "cw", item: c }]),
]);

export const slugOfBook = (n) => BOOK_SLUGS.get(n);
export const slugOfCw = (id) => CW_SLUGS.get(id);

/** groups() — the current axis (8 themes or 7 phases), mirrors curriculum.html's groups(). */
export function groups(view, lang) {
  if (view === "theme") {
    return SECTIONS.map((s, i) => ({
      key: s.id,
      kind: "section",
      label: s.numeral,
      accent: `var(${ACC[i]})`,
      accentHex: s.accent,
      title: L(s.title, lang),
      anchor: L(s.anchor, lang),
      teaser: L(s.teaser, lang),
      intro: L(s.intro, lang),
      against: L(s.readAgainst, lang),
      books: BOOKS.filter((b) => b.s === s.id),
      cws: COUNTERWEIGHTS.filter((c) => c.s === s.id),
      seq: null,
    }));
  }
  return PHASES.map((p) => {
    const bks = BOOKS.filter((b) => b.ph === p.n);
    const allCw = COUNTERWEIGHTS.filter((c) => c.ph === p.n);
    const acc = bks.length ? accentVar(bks[0].s) : "var(--a1)";
    const accHex = bks.length ? accentHex(bks[0].s) : "#8B6F47";
    const seq = [
      ...bks.map((b) => ({
        item: b,
        ord: b.ord,
        isCw: false,
        isReread: false,
      })),
      ...allCw
        .filter((c) => c.ord)
        .map((c) => ({ item: c, ord: c.ord, isCw: true, isReread: false })),
      ...(p.reread || []).map((r) => ({
        item: BOOKS.find((b) => b.n === r.n),
        ord: r.ord,
        isCw: false,
        isReread: true,
      })),
    ].sort((a, b) => a.ord - b.ord);
    const note = L(p.note, lang);
    return {
      key: p.id,
      kind: "phase",
      label: String(p.n),
      accent: acc,
      accentHex: accHex,
      title: L(p.title, lang),
      anchor: "",
      teaser: note.split(/(?<=\.)\s/)[0],
      intro: note,
      against: "",
      books: bks,
      cws: allCw.filter((c) => !c.ord),
      seq,
    };
  });
}

export function frTag(item) {
  if (item.fr === "published") return { cls: "fr-yes", label: "FR" };
  if (item.fr === "original") return { cls: "fr-yes", label: "FR" };
  if (item.fr === "unverified") return { cls: "fr-maybe", label: "FR ?" };
  return { cls: "", label: "EN" };
}

export function frLine(item, lang) {
  const T = ui(lang);
  if (item.fr === "original") return `${T.frOriginal} · ${item.titleFr}`;
  if (item.fr === "published") return `${T.frEdition} : ${item.titleFr}`;
  if (item.fr === "unverified")
    return `${T.frUnverified}${item.titleFr ? ` : ${item.titleFr}` : ""}`;
  return T.frNone;
}

export function localizedTitle(item, lang) {
  return lang === "fr" && item.titleFr && item.fr !== "none"
    ? item.titleFr
    : item.title;
}

export function bookQuery(b) {
  return encodeURIComponent(`${b.title} ${b.author}`);
}
