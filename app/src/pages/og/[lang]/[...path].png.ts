import type { APIRoute } from "astro";
import {
  LANGS,
  SECTIONS,
  PHASES,
  BOOKS,
  COUNTERWEIGHTS,
  groups,
  localizedTitle,
  accentHex,
  slugOfBook,
  slugOfCw,
  ui,
} from "../../../lib/content.js";
import { renderOgImage } from "../../../lib/og.js";

export const prerender = true;

function entries(lang: "en" | "fr") {
  const T = ui(lang);
  const list: {
    path: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    accent?: string;
  }[] = [];

  list.push({
    path: "home",
    eyebrow: T.kicker,
    title: T.title,
    subtitle: T.subtitle,
  });
  list.push({
    path: "order",
    eyebrow: T.kicker,
    title: T.inOrder,
    subtitle: T.calLede,
  });
  list.push({
    path: "calendar",
    eyebrow: T.kicker,
    title: T.tabCalendar,
    subtitle: T.calLede,
  });

  const themeGroups = groups("theme", lang);
  SECTIONS.forEach((s, i) => {
    const g = themeGroups[i];
    list.push({
      path: `theme/${s.id}`,
      eyebrow: `${T.sectionLabel} ${s.numeral}`,
      title: g.title,
      subtitle: g.anchor,
      accent: s.accent,
    });
  });

  const phaseGroups = groups("phase", lang);
  PHASES.forEach((p, i) => {
    const g = phaseGroups[i];
    list.push({
      path: `order/${p.id}`,
      eyebrow: `${T.phaseLabel} ${p.n}`,
      title: g.title,
      subtitle: "",
      accent: g.accentHex,
    });
  });

  BOOKS.forEach((b) => {
    list.push({
      path: `work/${slugOfBook(b.n)}`,
      eyebrow: `${T.work} ${b.n}`,
      title: localizedTitle(b, lang),
      subtitle: b.author,
      accent: accentHex(b.s),
    });
  });
  COUNTERWEIGHTS.forEach((c) => {
    list.push({
      path: `work/${slugOfCw(c.id)}`,
      eyebrow: T.counterweight,
      title: localizedTitle(c, lang),
      subtitle: c.author,
      accent: accentHex(c.s),
    });
  });

  return list;
}

export function getStaticPaths() {
  return (LANGS as ("en" | "fr")[]).flatMap((lang) =>
    entries(lang).map((e) => ({ params: { lang, path: e.path }, props: e })),
  );
}

export const GET: APIRoute = async ({ props }) => {
  const { eyebrow, title, subtitle, accent } = props as {
    eyebrow: string;
    title: string;
    subtitle: string;
    accent?: string;
  };
  const png = await renderOgImage({ eyebrow, title, subtitle, accent });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
