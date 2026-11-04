/** Small canvas drawing helpers shared by simulators. */

export function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 3,
  head = 10,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.min(head, len * 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * h * 0.8, y2 - Math.sin(a) * h * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.45) * h, y2 - Math.sin(a - 0.45) * h);
  ctx.lineTo(x2 - Math.cos(a + 0.45) * h, y2 - Math.sin(a + 0.45) * h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text on a rounded "pill" background, clamped inside the canvas. */
export function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colors: { bg: string; fg: string },
  bounds?: { w: number; h: number },
  align: 'center' | 'left' = 'center',
) {
  ctx.save();
  ctx.font = '600 12px "IBM Plex Sans Variable", system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  let bx = align === 'center' ? x - tw / 2 - 8 : x;
  let by = y - 11;
  if (bounds) {
    bx = Math.max(4, Math.min(bounds.w - tw - 20, bx));
    by = Math.max(4, Math.min(bounds.h - 26, by));
  }
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + 16, 22, 11);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.fg;
  ctx.fillText(text, bx + 8, by + 15);
  ctx.restore();
}

export function gridLines(ctx: CanvasRenderingContext2D, w: number, h: number, step: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) ctx.moveTo(x + 0.5, 0), ctx.lineTo(x + 0.5, h);
  for (let y = 0; y < h; y += step) ctx.moveTo(0, y + 0.5), ctx.lineTo(w, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Mix a CSS hex colour with alpha, e.g. withAlpha('#ff0000', 0.3). Non-hex colours are returned unchanged. */
export function withAlpha(color: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const font = (size: number, weight = 600, family: 'body' | 'mono' = 'body') =>
  `${weight} ${size}px ${family === 'mono' ? '"JetBrains Mono Variable", ui-monospace, monospace' : '"IBM Plex Sans Variable", system-ui, sans-serif'}`;
