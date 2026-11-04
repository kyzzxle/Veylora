# Veylora — the interactive science lab

A free educational website with interactive science simulations, clear explanations and quizzes, covering 10 branches of science (50 planned topics).

Built with [Astro](https://astro.build) and TypeScript. Every page is static HTML, so it is fast, works with screen readers and search engines, and can be hosted anywhere.

## Quick start

Requirements: [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

**On Windows PowerShell**, if you see *"running scripts is disabled on this system"*, type `npm.cmd` instead of `npm` (for example `npm.cmd run dev`). Press `Ctrl + C` in the terminal to stop the server.

Then open http://localhost:4321.

| Command | What it does |
|---|---|
| `npm run dev` | Start the local development server with live reload |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` folder locally |
| `npm run check` | Type-check the project |

## Settings

Copy `.env.example` to `.env` and fill in what you need. Everything is optional, and anything left blank is switched off.

| Variable | Purpose |
|---|---|
| `SITE_URL` | Your live address (e.g. `https://www.example.com`). Turns on canonical URLs, `sitemap-index.xml` and the sitemap line in `robots.txt`. |
| `PUBLIC_CONTACT_EMAIL` | Email shown on the contact page and offered as a fallback. |
| `PUBLIC_CONTACT_ENDPOINT` | Form service URL (e.g. Formspree). Without it, the contact form validates input but clearly tells visitors their message was **not** sent. |
| `PUBLIC_ADSENSE_CLIENT` | AdSense publisher ID (`ca-pub-…`). Loads the AdSense script and switches the privacy policy to its advertising disclosures. |
| `PUBLIC_ADSENSE_SLOT_TOP` / `_SIDEBAR` / `_MID` | Ad unit IDs for the three reserved ad areas on simulator pages. |

If you deploy on a host such as Netlify, Vercel or Cloudflare Pages, set these as environment variables in the host's dashboard instead of using a `.env` file.

## Project structure

```
src/
  data/branches.ts            Catalog of all branches and topics (single source of truth)
  data/site.ts                Site name and settings read from environment variables
  data/quizzes/               Quiz questions per simulator
  layouts/BaseLayout.astro    <head>, SEO, theme, header, footer
  layouts/SimulatorLayout.astro  Template shared by every simulator page
  components/                 Header, Footer, Quiz, AdSlot, cards, icons…
  simulators/shared/          Canvas, animation-loop, theme and slider helpers
  simulators/osmosis/         The Osmosis simulator (markup + engine)
  pages/                      One file per page/route
  styles/global.css           Design system (colours, type, buttons, forms)
  styles/sim.css              Shared simulator UI
docs/ROADMAP.md               Stack, architecture and stage plan
```

## Adding a simulator

Full details are in [docs/SIMULATOR_GUIDE.md](docs/SIMULATOR_GUIDE.md). Working templates for 2D, graph, 3D and experiment simulators are at http://localhost:4321/dev/sim-kit/ while `npm.cmd run dev` is running (this page is never published).

1. Build the simulation in `src/simulators/<topic>/` (an `.astro` file for the controls and a `.ts` file for the logic). Reuse the helpers in `src/simulators/shared/` and the classes in `src/styles/sim.css`.
2. Write its quiz (at least five questions) in `src/data/quizzes/<topic>.ts`.
3. Create `src/pages/<branch>/<topic>.astro` using `SimulatorLayout` — see `src/pages/biology/osmosis.astro` as the reference.
4. In `src/data/branches.ts`, change the topic's `status` to `'live'`.

The branch page, homepage, search, navigation counts and related-topic links update automatically.

## Deployment

The output is a static site. Any static host works:

- **Build command:** `npm run build`
- **Output directory:** `dist`

## Before applying for Google AdSense

This is a preparation checklist, not a guarantee of approval. Check Google's current policies first.

- [x] Publish at least 15–25 complete simulators (Stage 4). 18 of 50 are live, covering all 10 branches.
- [ ] Set `SITE_URL` and deploy on your own domain with HTTPS.
- [ ] Set `PUBLIC_CONTACT_ENDPOINT` (or `PUBLIC_CONTACT_EMAIL`) so visitors can actually reach you.
- [ ] After approval, add `public/ads.txt` with the line Google gives you.
- [ ] Set the `PUBLIC_ADSENSE_*` variables. Review the generated privacy policy text.
- [ ] Set up a Google-certified consent management platform (CMP) for visitors in the EEA, UK and Switzerland — the privacy policy states consent is requested once ads are on.
- [ ] Because many visitors may be children, review Google's guidance on child-directed content and COPPA, and decide whether to tag the site or pages as child-directed.
- [ ] Re-read the privacy policy and update `legalUpdated` in `src/data/site.ts` whenever you change it.

Ad areas are only rendered in content sections, never next to simulator controls. In development, dashed placeholders show where they will appear; in production nothing renders until AdSense IDs are set.
