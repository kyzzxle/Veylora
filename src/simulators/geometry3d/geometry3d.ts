/**
 * 3D Geometry Explorer: rotate and resize solids, read their volume and
 * surface area, check Euler's formula and slice them to see cross-sections.
 * 1 scene unit = 1 cm. A clipping plane removes everything above the slice
 * and a flat "cap" shows the cross-section.
 */
import type * as T from 'three';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { SHAPES, type Dims, type ShapeId } from './shapes';

const DEF = { shape: 'cube' as ShapeId, a: 4, b: 3, h: 6, r: 3, slice: false, cut: 50, edges: true };

const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(x >= 10 ? 1 : 2));

export async function initGeometry3D(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const picker = root.querySelector<HTMLSelectElement>('[data-shape]')!;
  const aboutEl = root.querySelector<HTMLElement>('[data-about]')!;
  const ui = controls(root);
  const st = { ...DEF };

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  // Until the 3D view loads (or if it cannot), changes still update the readouts
  let rebuild = () => updateReadouts();

  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      Object.assign(st, DEF);
      picker.value = DEF.shape;
      for (const [c, v] of [[aCtl, DEF.a], [bCtl, DEF.b], [hCtl, DEF.h], [rCtl, DEF.r], [cutCtl, DEF.cut]] as const) c.set(v, false);
      sliceCtl.set(false, false);
      edgesCtl.set(true, false);
      spinCtl.set(false);
      showDims();
      rebuild();
      view?.resetView();
    },
  });

  const dims = (): Dims => ({ a: st.a, b: st.b, h: st.h, r: st.r });

  function showDims() {
    const used = SHAPES[st.shape].dims;
    for (const d of ['a', 'b', 'h', 'r'] as const) ui.showWhen(`[data-dim="${d}"]`, used.includes(d));
    ui.showWhen('[data-cut-only]', st.slice);
  }

  function updateReadouts() {
    const s = SHAPES[st.shape];
    const d = dims();
    ui.readout('shape', s.name);
    sim.setBadge(s.name);
    aboutEl.textContent = s.about;
    ui.readout('volume', `${fmt(s.volume(d))} cm³`);
    ui.readout('area', `${fmt(s.area(d))} cm²`);
    ui.readout('vf', s.vFormula);
    ui.readout('af', s.aFormula);
    if (s.fev) {
      const [F, E, V] = s.fev;
      ui.readout('fev', `${F} faces, ${E} edges, ${V} vertices · F − E + V = ${F - E + V} ✓ (Euler)`, 'ok');
    } else ui.readout('fev', s.curved ?? '—');
    if (st.slice) {
      const y = (st.cut / 100) * s.height(d);
      const sec = s.section(d, y);
      ui.readout('section', `${sec.shape}, ${fmt(sec.area)} cm² at height ${fmt(y)} cm`);
    } else ui.readout('section', 'Turn on “Slice the shape”');
    const ratio = s.area(d) / s.volume(d);
    ui.readout('ratio', `${ratio.toFixed(2)} cm² of surface per cm³`);
  }

  /* ---------- Controls ---------- */
  const onDim = (k: 'a' | 'b' | 'h' | 'r') => (v: number) => {
    st[k] = v;
    rebuild();
  };
  const aCtl = ui.range('g-a', (v) => `${v} cm`, onDim('a'));
  const bCtl = ui.range('g-b', (v) => `${v} cm`, onDim('b'));
  const hCtl = ui.range('g-h', (v) => `${v} cm`, onDim('h'));
  const rCtl = ui.range('g-r', (v) => `${v} cm`, onDim('r'));
  const sliceCtl = ui.toggle('g-slice', (v) => {
    st.slice = v;
    showDims();
    rebuild();
  });
  const cutCtl = ui.range('g-cut', (v) => `${v} % of the height`, (v) => ((st.cut = v), rebuild()));
  const edgesCtl = ui.toggle('g-edges', (v) => ((st.edges = v), rebuild()));
  const spinCtl = ui.toggle('g-spin', (v) => view?.setAnimating(v && !prefersReducedMotion()));
  picker.addEventListener('change', () => {
    st.shape = picker.value as ShapeId;
    showDims();
    rebuild();
  });
  showDims();
  updateReadouts();

  try {
    view = await createThreeScene(container, {
      label: 'A 3D shape you can rotate. Its measurements are shown below.',
      camera: { position: [11, 9, 14], target: [0, 3, 0] },
      minDistance: 6,
      maxDistance: 45,
      onFrame: (dt) => (group.rotation.y += dt * 0.4),
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). The formulas and readouts below still update when you move the sliders.'
        : undefined,
    );
    return;
  }
  const { THREE, scene, renderer } = view;
  renderer.localClippingEnabled = true;
  const group = new THREE.Group();
  scene.add(group);

  // 1 cm floor grid
  const grid = new THREE.GridHelper(20, 20, 0x888888, 0x555555);
  (grid.material as T.Material).transparent = true;
  (grid.material as T.Material).opacity = 0.35;
  scene.add(grid);

  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const accent = view.cssColor('accent');
  const solidMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.05, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1b1f2a });
  const capMat = new THREE.MeshStandardMaterial({ color: '#ffb84d', roughness: 0.6, side: THREE.DoubleSide });

  /** Geometry for the current shape, centred on its own middle. */
  function geometryFor(s: ShapeId, d: Dims): { geo: T.BufferGeometry; rotY: number; segs: number } {
    switch (s) {
      case 'cube':
        return { geo: new THREE.BoxGeometry(d.a, d.a, d.a), rotY: 0, segs: 0 };
      case 'cuboid':
        return { geo: new THREE.BoxGeometry(d.a, d.h, d.b), rotY: 0, segs: 0 };
      case 'cylinder':
        return { geo: new THREE.CylinderGeometry(d.r, d.r, d.h, 64), rotY: 0, segs: 64 };
      case 'cone':
        return { geo: new THREE.ConeGeometry(d.r, d.h, 64), rotY: 0, segs: 64 };
      case 'sphere':
        return { geo: new THREE.SphereGeometry(d.r, 64, 32), rotY: 0, segs: 64 };
      case 'pyramid':
        return { geo: new THREE.ConeGeometry(d.a / Math.SQRT2, d.h, 4), rotY: Math.PI / 4, segs: 4 };
      case 'prism':
        return { geo: new THREE.CylinderGeometry(d.a / Math.sqrt(3), d.a / Math.sqrt(3), d.h, 3), rotY: 0, segs: 3 };
      case 'tetrahedron': {
        const H = d.a * Math.sqrt(2 / 3);
        return { geo: new THREE.ConeGeometry(d.a / Math.sqrt(3), H, 3), rotY: 0, segs: 3 };
      }
    }
  }
  /** Circumradius of the cross-section at height y (for round and polygonal shapes). */
  function capRadius(s: ShapeId, d: Dims, y: number) {
    const H = SHAPES[s].height(d);
    const f = Math.max(0, 1 - y / H);
    switch (s) {
      case 'cylinder':
        return d.r;
      case 'cone':
        return d.r * f;
      case 'sphere':
        return Math.sqrt(Math.max(0, d.r * d.r - (y - d.r) ** 2));
      case 'pyramid':
        return (d.a / Math.SQRT2) * f;
      case 'prism':
        return d.a / Math.sqrt(3);
      case 'tetrahedron':
        return (d.a / Math.sqrt(3)) * f;
      default:
        return 0;
    }
  }

  rebuild = () => {
    for (const c of [...group.children]) {
      group.remove(c);
      (c as T.Mesh).geometry?.dispose();
    }
    const d = dims();
    const H = SHAPES[st.shape].height(d);
    const { geo, rotY, segs } = geometryFor(st.shape, d);
    const y = (st.cut / 100) * H;
    clip.constant = y;
    solidMat.clippingPlanes = st.slice ? [clip] : [];
    edgeMat.clippingPlanes = st.slice ? [clip] : [];
    solidMat.needsUpdate = edgeMat.needsUpdate = true;

    const mesh = new THREE.Mesh(geo, solidMat);
    mesh.position.y = H / 2;
    mesh.rotation.y = rotY;
    group.add(mesh);
    if (st.edges) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      group.add(edges);
    }
    if (st.slice) {
      const rc = capRadius(st.shape, d, y);
      const capGeo =
        st.shape === 'cube' ? new THREE.BoxGeometry(d.a, 0.02, d.a) : st.shape === 'cuboid' ? new THREE.BoxGeometry(d.a, 0.02, d.b) : new THREE.CylinderGeometry(rc, rc, 0.02, segs);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = Math.min(y, H - 0.01);
      cap.rotation.y = rotY;
      group.add(cap);
    }
    updateReadouts();
    view?.requestRender();
  };

  window.addEventListener('themechange', () =>
    requestAnimationFrame(() => {
      solidMat.color.copy(view!.cssColor('accent'));
      view?.requestRender();
    }),
  );

  rebuild();
  sim.setLoading(null);
}
