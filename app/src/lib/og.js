/* Build-time OG image generation (satori -> SVG -> sharp -> PNG).
   Runs only during `astro build` (these endpoints are prerendered),
   never in the browser. */
import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/* Vite relocates this module during the build, so a path relative to
   import.meta.url is unreliable — resolve fonts through Node's own
   module resolution (via package exports) instead. */
const require = createRequire(import.meta.url);

const fonts = [
  {
    name: "Fraunces",
    weight: 600,
    style: "normal",
    pkg: "@fontsource/fraunces/files/fraunces-latin-600-normal.woff",
  },
  {
    name: "Fraunces",
    weight: 400,
    style: "italic",
    pkg: "@fontsource/fraunces/files/fraunces-latin-400-italic.woff",
  },
  {
    name: "Source Serif 4",
    weight: 400,
    style: "normal",
    pkg: "@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff",
  },
  {
    name: "IBM Plex Mono",
    weight: 500,
    style: "normal",
    pkg: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff",
  },
].map((f) => ({ ...f, data: readFileSync(require.resolve(f.pkg)) }));

const GROUND = "#F3EAD3";
const INK = "#2B2013";
const DIM = "#5C4F3A";
const RULE = "#DCCFA9";
const BRASS = "#9C7A22";

export async function renderOgImage({
  eyebrow,
  title,
  subtitle,
  accent = BRASS,
}) {
  const tree = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: GROUND,
        padding: "72px",
        fontFamily: "Source Serif 4",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "12px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    width: "14px",
                    height: "14px",
                    background: BRASS,
                    borderRadius: "2px",
                    transform: "rotate(45deg)",
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Fraunces",
                    fontWeight: 600,
                    fontSize: "24px",
                    color: INK,
                  },
                  children: "Curriculum",
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "22px",
              maxWidth: "980px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "IBM Plex Mono",
                    fontSize: "20px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: accent,
                  },
                  children: eyebrow,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Fraunces",
                    fontWeight: 600,
                    fontSize: "64px",
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    color: INK,
                    display: "flex",
                  },
                  children: title,
                },
              },
              subtitle
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontFamily: "Fraunces",
                        fontStyle: "italic",
                        fontSize: "28px",
                        color: DIM,
                        display: "flex",
                      },
                      children: subtitle,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: `1px solid ${RULE}`,
              paddingTop: "24px",
              fontFamily: "IBM Plex Mono",
              fontSize: "16px",
              color: DIM,
            },
            children: [
              { type: "div", props: { children: "After Michael Saylor" } },
              {
                type: "div",
                props: {
                  style: { color: accent },
                  children: "38 works · 953 hours",
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
