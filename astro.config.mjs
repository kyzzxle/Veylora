// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The live address. SITE_URL can override it (for example for a staging copy).
const SITE_URL = process.env.SITE_URL || 'https://veyloralab.tech';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  // The search page is not indexed (see robots.txt), so it is left out of the sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes('/search/') })],
  build: { format: 'directory' },
});
