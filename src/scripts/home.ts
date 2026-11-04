/**
 * Homepage scroll effects: parallax layers and a molecule that rotates as
 * its section scrolls past. Disabled entirely for reduced-motion users.
 */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce) {
  const layers = [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    speed: Number(el.dataset.parallax) || 0,
  }));
  const rotators = [...document.querySelectorAll<HTMLElement>('[data-scroll-rotate]')];

  let ticking = false;
  const render = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    // Parallax only matters near the top of the page (hero).
    if (y < vh * 1.5) {
      for (const { el, speed } of layers) el.style.translate = `0 ${(y * speed).toFixed(1)}px`;
    }
    for (const el of rotators) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const progress = 1 - (r.top + r.height / 2) / vh; // ~0 entering, ~1 leaving
      el.style.setProperty('--rot', `${(progress * 160).toFixed(1)}deg`);
    }
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  render();
}
