/**
 * createThreeScene — a ready-to-use 3D view for simulators.
 *
 * - Three.js is downloaded only when this function runs (dynamic import),
 *   so pages without 3D never load it.
 * - Checks WebGL support first and throws WebGLUnavailableError if missing,
 *   so the caller can show a fallback.
 * - Orbit controls with damping; zoom and reset-view buttons; arrow keys and
 *   +/− when the 3D view has keyboard focus.
 * - Scroll-friendly: mouse-wheel zoom only after clicking into the view, and
 *   on touch screens the view must be tapped before one-finger rotation
 *   takes over from page scrolling.
 * - Renders only when something changes or an animation is running, and
 *   pauses entirely when scrolled off-screen.
 * - Click/tap picking for "inspect this part" tooltips.
 */
import type * as ThreeNS from 'three';
import { createLoop, readPalette } from './index';

export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL is not available in this browser.');
  }
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface ThreeSceneOptions {
  /** Accessible description of the 3D view. */
  label: string;
  camera?: { fov?: number; position?: [number, number, number]; target?: [number, number, number] };
  minDistance?: number;
  maxDistance?: number;
  /** Called each frame while animating (see setAnimating). */
  onFrame?: (dt: number, elapsed: number) => void;
  /** Called after the theme changes, to recolour materials. */
  onTheme?: () => void;
}

export async function createThreeScene(container: HTMLElement, opts: ThreeSceneOptions) {
  if (!hasWebGL()) throw new WebGLUnavailableError();

  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const cssColor = (token: string) => new THREE.Color(readPalette([token])[token] || '#888');

  /* Renderer, scene, camera */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', opts.label);
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = cssColor('sim-bg');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(5, 8, 6);
  scene.add(sun);

  const camPos = opts.camera?.position ?? [4, 3, 6];
  const camTarget = opts.camera?.target ?? [0, 0, 0];
  const camera = new THREE.PerspectiveCamera(opts.camera?.fov ?? 45, 1, 0.1, 1000);
  camera.position.set(...camPos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...camTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance ?? 2;
  controls.maxDistance = opts.maxDistance ?? 30;
  controls.enableZoom = false; // enabled after the user clicks into the view
  controls.update();

  let needsRender = true;
  let animating = false;
  let elapsed = 0;
  const requestRender = () => {
    needsRender = true;
  };
  controls.addEventListener('change', requestRender);

  /* Size */
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  /* Loop: runs while visible; renders only when needed */
  const loop = createLoop((dt) => {
    if (animating) {
      elapsed += dt;
      opts.onFrame?.(dt, elapsed);
      needsRender = true;
    }
    if (controls.update()) needsRender = true;
    if (needsRender) {
      needsRender = false;
      renderer.render(scene, camera);
    }
  }, container);
  loop.start();

  /* Scroll-friendly interaction */
  const stage = container.parentElement ?? container;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  canvas.addEventListener('pointerdown', () => (controls.enableZoom = true));
  canvas.addEventListener('pointerleave', () => (controls.enableZoom = false));

  const tools = document.createElement('div');
  tools.className = 'sim-3d-tools';
  tools.innerHTML = `
    <button type="button" data-z="in" aria-label="Zoom in">+</button>
    <button type="button" data-z="out" aria-label="Zoom out">−</button>
    <button type="button" data-z="reset" aria-label="Reset view">Reset view</button>
    <button type="button" data-z="done" hidden>Done</button>`;
  stage.appendChild(tools);

  let activateBtn: HTMLButtonElement | null = null;
  const setTouchActive = (on: boolean) => {
    controls.enabled = on;
    canvas.style.touchAction = on ? 'none' : 'pan-y';
    if (activateBtn) activateBtn.hidden = on;
    tools.querySelector<HTMLElement>('[data-z="done"]')!.hidden = !on;
  };
  if (coarse) {
    activateBtn = document.createElement('button');
    activateBtn.type = 'button';
    activateBtn.className = 'sim-3d-activate';
    activateBtn.innerHTML = '<span>Tap to rotate and zoom the 3D model</span>';
    activateBtn.addEventListener('click', () => setTouchActive(true));
    stage.appendChild(activateBtn);
    setTouchActive(false);
  }

  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  function orbit(dTheta: number, dPhi: number, scale = 1) {
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += dTheta;
    spherical.phi = Math.min(Math.PI - 0.05, Math.max(0.05, spherical.phi + dPhi));
    spherical.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, spherical.radius * scale));
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    requestRender();
  }
  function resetView() {
    camera.position.set(...camPos);
    controls.target.set(...camTarget);
    controls.update();
    requestRender();
  }
  tools.addEventListener('click', (e) => {
    const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z;
    if (z === 'in') orbit(0, 0, 0.8);
    if (z === 'out') orbit(0, 0, 1.25);
    if (z === 'reset') resetView();
    if (z === 'done') setTouchActive(false);
  });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    const map: Record<string, [number, number, number]> = {
      ArrowLeft: [0.12, 0, 1],
      ArrowRight: [-0.12, 0, 1],
      ArrowUp: [0, -0.1, 1],
      ArrowDown: [0, 0.1, 1],
      '+': [0, 0, 0.85],
      '=': [0, 0, 0.85],
      '-': [0, 0, 1.18],
    };
    if (map[k]) {
      e.preventDefault();
      orbit(...map[k]);
    }
  });

  /* Picking */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(clientX: number, clientY: number, objects: ThreeNS.Object3D[], accept?: (hit: ThreeNS.Intersection) => boolean) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(objects, true);
    return (accept ? hits.find(accept) : hits[0]) ?? null;
  }
  /**
   * Call cb when the user clicks or taps (without dragging) on the view.
   * `accept` can skip hits — for example parts hidden by clipping planes,
   * which the raycaster would otherwise still report.
   */
  function onPick(
    objects: () => ThreeNS.Object3D[],
    cb: (hit: ThreeNS.Intersection | null, at: { x: number; y: number }) => void,
    accept?: (hit: ThreeNS.Intersection) => boolean,
  ) {
    let down = { x: 0, y: 0, t: 0 };
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    canvas.addEventListener('pointerup', (e) => {
      const still = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 600;
      if (!still || (coarse && !controls.enabled)) return;
      const r = stage.getBoundingClientRect();
      cb(pickAt(e.clientX, e.clientY, objects(), accept), { x: e.clientX - r.left, y: e.clientY - r.top });
    });
  }

  /* Theme */
  window.addEventListener('themechange', () =>
    requestAnimationFrame(() => {
      scene.background = cssColor('sim-bg');
      opts.onTheme?.();
      requestRender();
    }),
  );

  return {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    requestRender,
    resetView,
    onPick,
    cssColor,
    setAnimating(on: boolean) {
      animating = on;
      requestRender();
    },
    get animating() {
      return animating;
    },
  };
}

export type ThreeScene = Awaited<ReturnType<typeof createThreeScene>>;
