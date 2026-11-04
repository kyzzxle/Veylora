/**
 * Site-wide behaviour: theme toggle, header menus, scroll reveal and the
 * range-slider fill. Loaded once per page by BaseLayout.
 */

const THEME_KEY = 'veylora-theme';
const root = document.documentElement;

/* ---------- Theme ---------- */
function currentTheme(): 'light' | 'dark' {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setTheme(theme: 'light' | 'dark') {
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this page */
  }
  updateThemeButtons();
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

function updateThemeButtons() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-label', `Switch to ${next} theme`);
    btn.title = `Switch to ${next} theme`;
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
});
updateThemeButtons();

// Follow OS changes only when the visitor has not chosen a theme.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {}
  if (!saved) {
    root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    updateThemeButtons();
    window.dispatchEvent(new CustomEvent('themechange', { detail: currentTheme() }));
  }
});

/* ---------- Header ---------- */
const header = document.querySelector<HTMLElement>('[data-header]');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const navPanel = document.querySelector<HTMLElement>('[data-nav-panel]');
const megaToggle = document.querySelector<HTMLButtonElement>('[data-mega-toggle]');
const mega = document.querySelector<HTMLElement>('[data-mega]');

function setMenu(open: boolean) {
  if (!menuToggle || !navPanel) return;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.querySelector('.sr-only')!.textContent = open ? 'Close menu' : 'Open menu';
  navPanel.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

function setMega(open: boolean) {
  if (!megaToggle || !mega) return;
  megaToggle.setAttribute('aria-expanded', String(open));
  mega.classList.toggle('is-open', open);
}

menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
megaToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  setMega(megaToggle.getAttribute('aria-expanded') !== 'true');
});

document.addEventListener('click', (e) => {
  const t = e.target as Node;
  if (mega && megaToggle && !mega.contains(t) && !megaToggle.contains(t)) setMega(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (megaToggle?.getAttribute('aria-expanded') === 'true') {
    setMega(false);
    megaToggle.focus();
  } else if (menuToggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuToggle.focus();
  }
});

// Close the mobile panel if the window grows past the breakpoint.
window.matchMedia('(min-width: 921px)').addEventListener('change', (e) => {
  if (e.matches) setMenu(false);
});

/* ---------- Scroll reveal ---------- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealEls = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  revealEls.forEach((el) => io.observe(el));
}

/* ---------- Range slider fill (WebKit has no native progress track) ---------- */
function paintRange(input: HTMLInputElement) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const pct = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}
document.addEventListener('input', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLInputElement && t.type === 'range') paintRange(t);
});
document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange);
// Simulators can call this after changing a slider value from code.
(window as unknown as { paintRange: typeof paintRange }).paintRange = paintRange;
