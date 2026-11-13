/**
 * /ads.txt — tells ad networks which publisher may sell ads on this site.
 * Generated only once an AdSense publisher ID is set in src/data/site.ts;
 * until then no file is published at all.
 */
import type { APIRoute } from 'astro';
import { site } from '../data/site';

export function getStaticPaths() {
  return site.adsenseClient ? [{ params: { adsfile: 'ads.txt' } }] : [];
}

export const GET: APIRoute = () => {
  const pub = (site.adsenseClient ?? '').replace(/^ca-/, '');
  // f08c47fec0942fa0 is Google's published certification authority ID.
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
