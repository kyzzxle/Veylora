# Veylora development roadmap

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Site framework | **Astro 7** (static output) | Every page ships as real HTML, so educational text and quizzes are readable by search engines and screen readers. JavaScript is only sent for the interactive parts of each page ("islands"). |
| Language | **TypeScript** | Simulations involve a lot of numeric state; types catch mistakes early. |
| 2D simulations | **HTML Canvas** and **SVG** | Fast, light, and work on every device. Used for particle, graph and diagram-style models. |
| 3D simulations | **Three.js**, lazy-loaded | Only downloaded on simulator pages that need 3D (cell, skeleton, solar system, geometry). Never loaded on the homepage. |
| Styling | Plain CSS with design tokens | One design system for light and dark mode, no build-time CSS framework to maintain. |
| Fonts | Self-hosted via Fontsource | No third-party font requests, which keeps the privacy policy simple. |
| Backend | None | The site is fully static. The contact form posts to a form service only once you configure one. |

Hosting: any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Run `npm run build` and deploy the `dist/` folder.

## How the code is organised

```
src/
  data/branches.ts          Catalog of every branch and topic (single source of truth)
  data/quizzes/*.ts         Quiz questions per simulator
  layouts/BaseLayout.astro  <head>, SEO tags, theme, header, footer
  layouts/SimulatorLayout.astro  Shared simulator page template
  components/               Header, Footer, Quiz, AdSlot, cards, icons…
  components/sim/           Simulator kit components (SimShell, controls, graph, table)
  simulators/shared/        Simulator kit scripts (controller, graph, drag, 3D, table)
  simulators/templates/     Starter templates: 2D drag, graph, 3D, experiment
  simulators/<slug>/        Client-side code for each simulation
  pages/                    One file per route
```

Adding a new topic: add or update its entry in `branches.ts`, write its simulation in `src/simulators/<slug>/`, its quiz in `src/data/quizzes/`, and its page in `src/pages/<branch>/<slug>.astro` using `SimulatorLayout`. Then set `status: 'live'`. Branch pages, search, the homepage and related-topic links update automatically.

## Stages

1. **Foundation** — project setup, design system, light/dark theme, header, footer, homepage, branch pages, legal/trust pages, search, 404.
2. **First complete simulator** — Osmosis and Cell Tonicity, establishing the simulator page template, controls, quiz system and ad-safe layout.
3. **Reusable simulator system** — shared helpers for canvas loops, 3D scenes (Three.js), graphs and parameter controls.
4. **Initial library** — 15–25 complete simulators across branches.
5. **Complete library** — all 50 topics.
6. **Quality and monetization prep** — full testing, accessibility and performance review, AdSense policy check, deployment prep.

## Status

- [x] Stage 1
- [x] Stage 2
- [x] Stage 3 — see docs/SIMULATOR_GUIDE.md
- [x] Stage 4 — 18 live simulators across all 10 branches
- [ ] Stage 5
- [ ] Stage 6

## Stage 4 progress

Target: 18 live simulators covering all 10 branches.

- [x] Biology — Osmosis and Cell Tonicity
- [x] Physics — Projectile Motion
- [x] Physics — Pendulum Motion
- [x] Physics — Wave Interference
- [x] Mathematics — Graphing Functions
- [x] Mathematics — Vector Addition
- [x] Astronomy — Phases of the Moon
- [x] Astronomy — Planetary Orbits and Gravity
- [x] Mathematics — Probability and Random Experiments
- [x] Ecology — Ecosystem Population Dynamics
- [x] Chemistry — Atomic Structure
- [x] Chemistry — Acid-Base Reactions
- [x] Anatomy — Nervous System and Neuron Firing
- [x] Ecology — Climate Change
- [x] Biology — Natural Selection and Evolution
- [x] Zoology — Animal Classification
- [x] Botany — Transpiration
- [x] Earth Science — Earth's Layers

## Stage 5 progress

Remaining 32 topics, built in batches of four (each batch is committed and pushed).

- [x] Batch 1: Newton's laws, circuits, balancing equations, reaction rates
- [x] Batch 2: photosynthesis, seed germination, tropisms, plant anatomy
- [ ] Batch 3: cell structure, plant cell, animal vs. plant cell, DNA replication
- [ ] Batch 4: heart and circulation, respiratory, digestive, skeletal
- [ ] Batch 5: solar system, stellar life cycle, black holes, 3D geometry
- [ ] Batch 6: plate tectonics, rock cycle, weather, water cycle
- [ ] Batch 7: carbon cycle, biodiversity, pollution, food webs
- [ ] Batch 8: animal adaptations, animal locomotion, chemical bonding, data visualization
