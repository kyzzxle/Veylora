/**
 * Shared helpers for canvas-based simulators.
 *
 * - fitCanvas: keeps a canvas sharp at any size / pixel density.
 * - createLoop: an animation loop that automatically pauses when the
 *   simulator scrolls off-screen or the tab is hidden (saves CPU/battery).
 * - readPalette / onThemeChange: read colours from CSS tokens so drawings
 *   follow light and dark mode.
 * - bindRange: wire a slider to its visible value and a callback.
 */

export interface CanvasSize {
  w: number;
  h: number;
  dpr: number;
}

export function fitCanvas(canvas: HTMLCanvasElement, onResize: (size: CanvasSize) => void) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
  const size: CanvasSize = { w: 0, h: 0, dpr: 1 };

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === size.w && h === size.h && dpr === size.dpr) return false;
    size.w = w;
    size.h = h;
    size.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };

  // Measure now (without calling back, so callers can finish setting up),
  // then call back on every later size change.
  measure();
  new ResizeObserver(() => {
    if (measure()) onResize(size);
  }).observe(canvas);
  return { ctx, size };
}

export interface Loop {
  start(): void;
  pause(): void;
  readonly running: boolean;
}

export function createLoop(step: (dt: number) => void, watch: Element): Loop {
  let running = false;
  let visible = true;
  let raf = 0;
  let last = 0;

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const shouldRun = running && visible && !document.hidden;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    sync();
  }).observe(watch);
  document.addEventListener('visibilitychange', sync);

  return {
    start() {
      running = true;
      sync();
    },
    pause() {
      running = false;
      sync();
    },
    get running() {
      return running;
    },
  };
}

export function readPalette<T extends string>(names: readonly T[]): Record<T, string> {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Record<T, string>;
  for (const n of names) out[n] = cs.getPropertyValue(`--${n}`).trim();
  return out;
}

export function onThemeChange(cb: () => void) {
  window.addEventListener('themechange', () => requestAnimationFrame(cb));
}

export function bindRange(
  input: HTMLInputElement,
  output: HTMLElement | null,
  format: (v: number) => string,
  onChange: (v: number) => void,
) {
  const update = () => {
    const v = Number(input.value);
    if (output) output.textContent = format(v);
    input.setAttribute('aria-valuetext', format(v));
    onChange(v);
  };
  input.addEventListener('input', update);
  if (output) output.textContent = format(Number(input.value));
  input.setAttribute('aria-valuetext', format(Number(input.value)));
  return {
    set(v: number, notify = true) {
      input.value = String(v);
      (window as unknown as { paintRange?: (i: HTMLInputElement) => void }).paintRange?.(input);
      if (notify) update();
      else if (output) output.textContent = format(v);
    },
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Announce important changes to screen readers without flooding them. */
export function createAnnouncer(el: HTMLElement | null) {
  let last = '';
  return (msg: string) => {
    if (!el || msg === last) return;
    last = msg;
    el.textContent = msg;
  };
}
