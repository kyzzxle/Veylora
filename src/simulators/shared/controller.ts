/**
 * createSimController wires a <SimShell> to a simulation:
 * - Start/Pause button and an animation loop that pauses off-screen
 * - Reset button
 * - re-render on theme change and on demand (requestRender)
 * - overlay messages, click-to-inspect tooltips, badge, time readout
 * - screen-reader announcements and graceful error display
 *
 * Usage:
 *   const sim = createSimController(root, {
 *     step: (dt) => { ...advance the model... },
 *     render: () => { ...draw... },
 *     reset: () => { ...restore defaults... },
 *   });
 */
import { clamp, createAnnouncer, createLoop, onThemeChange, type Loop } from './index';

export interface SimControllerOptions {
  /** Advance the model by dt seconds. Omit for static (non-animated) simulators. */
  step?: (dt: number) => void;
  /** Draw the current state. Called every frame while running, or on request. */
  render: () => void;
  /** Restore defaults. The controller hides overlays/tooltips and re-renders afterwards. */
  reset?: () => void;
  /** Start running immediately. Defaults to true, or false for reduced-motion users. */
  autoplay?: boolean;
  /** Called when play state changes. */
  onPlayChange?: (playing: boolean) => void;
}

export interface SimController {
  root: HTMLElement;
  stage: HTMLElement;
  readonly running: boolean;
  play(): void;
  pause(): void;
  requestRender(): void;
  announce(msg: string): void;
  setBadge(text: string): void;
  setTime(seconds: number, suffix?: string): void;
  showOverlay(title: string, text: string, action?: { label: string; onClick: () => void }): void;
  hideOverlay(): void;
  showTooltip(x: number, y: number, title: string, html: string): void;
  hideTooltip(): void;
  setLoading(text: string | null): void;
  fail(message?: string): void;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSimController(root: HTMLElement, opts: SimControllerOptions): SimController {
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const stage = q('[data-stage]') ?? root;
  const playBtn = q<HTMLButtonElement>('[data-play]');
  const playLabel = q('[data-play-label]');
  const badge = q('[data-badge]');
  const timeEl = q('[data-time]');
  const overlay = q('[data-overlay]');
  const tooltip = q('[data-tooltip]');
  const hint = q('[data-hint]');
  const loading = q('[data-loading]');
  const error = q('[data-error]');
  const announce = createAnnouncer(q('[data-status]'));

  let loop: Loop | null = null;
  if (opts.step) {
    const step = opts.step;
    loop = createLoop((dt) => {
      step(dt);
      opts.render();
    }, stage);
  }

  let pending = 0;
  const requestRender = () => {
    if (loop?.running || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      opts.render();
    });
  };

  function setPlaying(on: boolean) {
    if (!loop) return;
    if (on) loop.start();
    else loop.pause();
    playBtn?.setAttribute('aria-pressed', String(on));
    if (playLabel) playLabel.textContent = on ? 'Pause' : 'Start';
    opts.onPlayChange?.(on);
    if (!on) requestRender();
  }
  playBtn?.addEventListener('click', () => setPlaying(!loop?.running));
  if (!loop && playBtn) playBtn.hidden = true;

  /* Tooltip */
  let tipTimer = 0;
  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }
  function showTooltip(x: number, y: number, title: string, html: string) {
    if (!tooltip) return;
    tooltip.innerHTML = `<strong>${title}</strong>${html}`;
    tooltip.hidden = false;
    if (hint) hint.hidden = true;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    tooltip.style.left = `${clamp(x + 14, 8, w - tooltip.offsetWidth - 8)}px`;
    tooltip.style.top = `${clamp(y + 14, 8, h - tooltip.offsetHeight - 8)}px`;
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(hideTooltip, 6000);
    announce(`${title}. ${tooltip.textContent?.slice(title.length) ?? ''}`);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });

  /* Overlay */
  const overlayTitle = q('[data-overlay-title]');
  const overlayText = q('[data-overlay-text]');
  const overlayAction = q<HTMLButtonElement>('[data-overlay-action]');
  let overlayHandler: (() => void) | null = null;
  overlayAction?.addEventListener('click', () => overlayHandler?.());
  function showOverlay(title: string, text: string, action?: { label: string; onClick: () => void }) {
    if (!overlay) return;
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlayAction) {
      overlayAction.hidden = !action;
      overlayAction.textContent = action?.label ?? '';
      overlayHandler = action?.onClick ?? null;
    }
    overlay.hidden = false;
  }
  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  /* Reset */
  q('[data-reset]')?.addEventListener('click', () => {
    hideOverlay();
    hideTooltip();
    opts.reset?.();
    requestRender();
    announce('Simulation reset.');
  });

  onThemeChange(() => opts.render());

  const controller: SimController = {
    root,
    stage,
    get running() {
      return !!loop?.running;
    },
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    requestRender,
    announce,
    setBadge(text) {
      if (!badge) return;
      badge.textContent = text;
      badge.hidden = !text;
    },
    setTime(seconds, suffix = 's') {
      if (timeEl) timeEl.textContent = `t = ${seconds.toFixed(1)} ${suffix}`;
    },
    showOverlay,
    hideOverlay,
    showTooltip,
    hideTooltip,
    setLoading(text) {
      if (!loading) return;
      loading.hidden = !text;
      const t = loading.querySelector('[data-loading-text]');
      if (t && text) t.textContent = text;
    },
    fail(message) {
      setPlaying(false);
      if (loading) loading.hidden = true;
      if (error) {
        error.hidden = false;
        const t = error.querySelector('[data-error-text]');
        if (t && message) t.textContent = message;
      }
    },
  };

  // Start after the caller has finished setting up (next frame).
  requestAnimationFrame(() => setPlaying(opts.autoplay ?? !prefersReducedMotion()));
  return controller;
}

/**
 * Run a simulator's init function safely: any error shows the fallback
 * message instead of a broken page.
 */
export function mountSim(selector: string, init: (root: HTMLElement) => void | Promise<void>) {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) return;
  const fail = (err: unknown) => {
    console.error(err);
    root.querySelector<HTMLElement>('[data-loading]')?.setAttribute('hidden', '');
    root.querySelector<HTMLElement>('[data-error]')?.removeAttribute('hidden');
  };
  try {
    const result = init(root);
    if (result instanceof Promise) result.catch(fail);
  } catch (err) {
    fail(err);
  }
}
