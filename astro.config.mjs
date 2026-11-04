// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Set SITE_URL (e.g. https://www.yourdomain.com) when you deploy.
// The sitemap is only generated once a real site URL is known.
const SITE_URL = process.env.SITE_URL;

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  integrations: SITE_URL ? [sitemap()] : [],
  build: { format: 'directory' },
});
