# Simulator kit — developer guide

Every simulator on Veylora is built from the same kit, so they all look, behave and perform the same way. This guide explains the pieces and how to build a new topic.

To see working examples, run `npm.cmd run dev` and open **http://localhost:4321/dev/sim-kit/**. That page exists only in development and is never published.

## 1. Pick a template

| Kind of simulator | Start from | Good for |
|---|---|---|
| **2D canvas with dragging** | `src/simulators/templates/Drag2DTemplate.astro` + `drag-2d.ts` | Vectors, circuits, food webs, moon phases, anything you move by hand |
| **Graph-based model** | `GraphTemplate.astro` + `graph-template.ts` | Function graphs, waves, population curves, climate models |
| **3D model** | `ThreeTemplate.astro` + `three-template.ts` | Cells, skeleton, heart, solar system, Earth's layers, 3D geometry |
| **Experiment with recorded trials** | `ExperimentTemplate.astro` + `experiment.ts` | Pendulum, reaction rates, germination, transpiration |
| **Animated particle model** | `src/simulators/osmosis/` | Diffusion, gas behaviour, reaction particles |

Copy the two files into `src/simulators/<topic>/`, rename them, and change the model.

## 2. The building blocks

### Components (`src/components/sim/`)

| Component | What it renders |
|---|---|
| `SimShell` | The simulator frame: stage, Start/Pause, Reset, badge, hint, tooltip, overlay, loading and error fallbacks, panel, readouts, and a "below" area. Props: `id`, `label`, `aspect`, `hint`, `playable`, `showTime`, `loadingText`, `badge`. |
| `SliderControl` | Labelled range slider with live value, scale labels and help text. Its default slot can hold `PresetButtons`. |
| `ChoiceControl` | Segmented radio buttons (e.g. "Animal / Plant"). |
| `PresetButtons` | Quick-set buttons for a slider. |
| `ToggleControl` | Checkbox. |
| `Readout` | One measurement tile. Put inside `<Fragment slot="readouts">`. |
| `SimKey` | Colour key explaining what shapes and colours mean. |
| `GraphPanel` | Titled graph canvas with legend; `compare` adds Save/Clear buttons. |
| `DataTable` | HTML table of recorded trials with Record, Download CSV and Clear. |

SimShell slots: default (controls panel), `stage` (replaces the default canvas, e.g. a 3D container), `toolbar` (extra buttons next to Reset), `readouts`, `below` (graphs and tables).

### Script modules (`src/simulators/shared/`)

| Module | Use it for |
|---|---|
| `controller.ts` → `createSimController(root, { step, render, reset })` | Play/pause loop (auto-pauses off-screen), Reset, overlays, tooltips, badge, time, announcements, errors. Omit `step` for static models. |
| `controller.ts` → `mountSim('#id', init)` | Starts a simulator safely; any error shows the fallback message instead of a broken page. |
| `controls.ts` → `controls(root)` | `.range()`, `.choice()`, `.toggle()`, `.presets()`, `.readout()`, `.showWhen()`. |
| `graph.ts` → `LineGraph`, `runComparer` | Lines, data points, reference lines, auto-extending axes, legend, saved-run comparison. |
| `drag.ts` → `enableDrag(canvas, { hit, move, click })` | Mouse/touch dragging that doesn't block page scrolling. |
| `three.ts` → `createThreeScene(container, opts)` | Lazy-loaded Three.js scene with orbit controls, zoom/reset tools, keyboard orbit, picking, theme colours and WebGL fallback. |
| `datatable.ts` → `createDataTable(root, id, columns, { onRecord })` | Recording experiment trials. |
| `index.ts` | `fitCanvas`, `createLoop`, `readPalette`, `clamp`, `lerp`. |

## 3. Rules every simulator follows

1. **Teach one idea.** The model must be scientifically meaningful, not decoration.
2. **Working Reset** that restores the default conditions.
3. **Written instructions** in the page's `instructions` slot.
4. **Keyboard alternative** for every drag or click interaction (usually a slider).
5. **Touch-friendly:** use `enableDrag`; 3D views use the built-in tap-to-activate. Never set `touch-action: none` on a whole canvas.
6. **Theme-aware colours:** read colours with `readPalette` and refresh them on `themechange`. Never hard-code a colour that becomes unreadable in one theme.
7. **Live description:** update the canvas `aria-label` and use `sim.announce()` for important changes (not every frame).
8. **Respect reduced motion:** the controller starts paused for users who ask for less motion. Avoid decorative motion.
9. **Performance:** draw only what changes; the loop already pauses off-screen. Keep particle counts modest on small screens.
10. **No ads inside the simulator.** Ad slots belong to `SimulatorLayout` only.

## 4. Publishing a new topic

1. Build the simulator in `src/simulators/<topic>/`.
2. Write at least five quiz questions in `src/data/quizzes/<topic>.ts` (mix Basic, Intermediate and Advanced).
3. Create `src/pages/<branch>/<topic>.astro` with `SimulatorLayout` (copy `src/pages/biology/osmosis.astro`). Include: introduction, instructions, explanation, key terms, formulas, applications, misconceptions, model limitations, key takeaways and references.
4. Set `status: 'live'` (and optionally `minutes` and `related`) for the topic in `src/data/branches.ts`.
5. Run `npm.cmd run check` and `npm.cmd run build`, then test on desktop and phone sizes in light and dark mode.
