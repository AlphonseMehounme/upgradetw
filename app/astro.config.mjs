// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// TODO: replace with the real domain once §10.2 (domain decision) is made.
const SITE = "https://curriculum.example.com";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: "never",
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: { en: "en", fr: "fr" },
      },
    }),
  ],
});
