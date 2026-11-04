/**
 * enableDrag — drag objects on a canvas with mouse, pen or touch.
 *
 * Touch-friendly by design: a finger that lands on a draggable object drags
 * it; a finger that lands anywhere else scrolls the page as normal. Always
 * give draggable values a slider or keyboard alternative as well.
 *
 *   enableDrag(canvas, {
 *     hit: (x, y) => (near(x, y, ball) ? 'ball' : null),
 *     move: (id, x, y) => { ball.x = x; ball.y = y; sim.requestRender(); },
 *   });
 */

export interface DragHandlers<T extends string = string> {
  /** Return the id of the draggable object under (x, y), or null. */
  hit(x: number, y: number): T | null;
  move(id: T, x: number, y: number): void;
  start?(id: T, x: number, y: number): void;
  end?(id: T): void;
  /** Called on a click/tap that did not drag anything (for inspect tooltips). */
  click?(x: number, y: number): void;
}

export function enableDrag<T extends string>(canvas: HTMLElement, h: DragHandlers<T>) {
  let active: T | null = null;
  let moved = false;
  let downAt = { x: 0, y: 0 };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Stop the page from scrolling only when a touch starts on a draggable.
  canvas.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (t && e.touches.length === 1) {
        const p = local(t);
        if (h.hit(p.x, p.y)) e.preventDefault();
      }
    },
    { passive: false },
  );

  canvas.addEventListener('pointerdown', (e) => {
    const p = local(e);
    downAt = p;
    moved = false;
    const id = h.hit(p.x, p.y);
    if (!id) return;
    active = id;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    h.start?.(id, p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (active) {
      if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 3) moved = true;
      h.move(active, p.x, p.y);
    } else if (e.pointerType === 'mouse') {
      canvas.style.cursor = h.hit(p.x, p.y) ? 'grab' : '';
    }
  });

  const finish = (e: PointerEvent) => {
    const p = local(e);
    if (active) {
      const id = active;
      active = null;
      canvas.style.cursor = '';
      h.end?.(id);
      if (!moved) h.click?.(p.x, p.y);
    } else if (e.type === 'pointerup' && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 6) {
      h.click?.(p.x, p.y);
    }
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  return {
    get dragging() {
      return active;
    },
  };
}
