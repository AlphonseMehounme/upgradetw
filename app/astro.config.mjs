// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const SITE = "https://civilizational-curriculum.pages.dev";

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
