/**
 * Earth's layers: a 3D cutaway with a depth probe.
 * The model removes a 90° wedge so the layers show on two flat cut faces.
 * Radii are to scale except the crust, which is exaggerated about 5×.
 */
import type * as T from 'three';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { LineGraph } from '../shared/graph';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { LAYERS, PROFILE, R_EARTH, layerAt, profileAt } from './data';

const SCALE = 2 / R_EARTH; // scene units per km
const CRUST_EXAGGERATION = 5;

/** Visual radius (scene units) for a given depth, with the crust exaggerated. */
function visualRadius(depth: number) {
  const crust = LAYERS[0].bottom;
  const crustVis = crust * CRUST_EXAGGERATION;
  // Map 0..crust → 0..crustVis and compress the mantle slightly to keep the total radius.
  if (depth <= crust) return (R_EARTH - (depth / crust) * crustVis) * SCALE;
  const restVis = R_EARTH - crustVis;
  const rest = R_EARTH - crust;
  return (restVis * (1 - (depth - crust) / rest)) * SCALE;
}

export async function initEarth(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const st = { depth: 0, cut: true, spin: true, labels: true };
  const ui = controls(root);

  /* ---------- Graphs (plain 2D, independent of WebGL) ---------- */
  const tGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ea-temp"]')!, {
    x: { min: 0, span: 6400, max: 6400, format: (v) => `${v / 1000}k km` },
    y: { min: 0, max: 6000, step: 1500, format: (v) => `${v}°` },
  });
  const dGraph = new LineGraph(root.querySelector<HTMLCanvasElement>('[data-graph="ea-dens"]')!, {
    x: { min: 0, span: 6400, max: 6400, format: (v) => `${v / 1000}k km` },
    y: { min: 0, max: 14, step: 3.5, format: (v) => `${v}` },
  });
  const boundaries = LAYERS.slice(1).map((l) => ({ value: l.top, label: '', color: 'border-strong', axis: 'x' as const }));
  tGraph.set('t', { label: 'Temperature (°C)', color: 'danger', points: PROFILE.map(([d, t]) => ({ x: d, y: t })), legend: false });
  dGraph.set('d', { label: 'Density (g/cm³)', color: 'accent', points: PROFILE.map(([d, , rho]) => ({ x: d, y: rho })), legend: false });

  function updateReadouts() {
    const l = layerAt(st.depth);
    const pr = profileAt(st.depth);
    ui.readout('layer', l.name);
    ui.readout('depth', `${Math.round(st.depth).toLocaleString()} km`);
    const roundT = pr.temp < 200 ? Math.round(pr.temp / 5) * 5 : Math.round(pr.temp / 50) * 50;
    ui.readout('temp', `≈ ${roundT.toLocaleString()} °C`);
    const atm = 1 + pr.pressure * 9869; // 1 GPa ≈ 9,869 atmospheres
    ui.readout('pressure', pr.pressure < 1 ? `${Math.round(atm).toLocaleString()} atm` : `${Math.round(pr.pressure)} GPa (≈ ${Math.round(atm / 1000).toLocaleString()},000 × air)`);
    ui.readout('density', `${pr.density.toFixed(1)} g/cm³`);
    ui.readout('state', l.state);
    sim.setBadge(`${l.name} · ${Math.round(st.depth).toLocaleString()} km`);
    for (const g of [tGraph, dGraph]) {
      g.opts.refs = [...boundaries, { value: st.depth, label: 'probe', color: 'sim-solute', axis: 'x' }];
    }
    tGraph.set('probe', { label: 'Probe', color: 'sim-solute', points: [{ x: st.depth, y: pr.temp }], type: 'points', legend: false });
    dGraph.set('probe', { label: 'Probe', color: 'sim-solute', points: [{ x: st.depth, y: pr.density }], type: 'points', legend: false });
    tGraph.draw();
    dGraph.draw();
  }

  // These are replaced once the 3D view has loaded; until then they do nothing.
  let placeProbe = () => {};
  let applyCut = () => {};
  let positionLabels = () => {};

  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      depthCtl.set(0);
      cutCtl.set(true);
      spinCtl.set(true);
      view?.resetView();
    },
  });
  const cutCtl = ui.toggle('ea-cut', (v) => ((st.cut = v), applyCut()));
  const spinCtl = ui.toggle('ea-spin', (v) => {
    st.spin = v;
    view?.setAnimating(v && !prefersReducedMotion());
  });
  ui.toggle('ea-labels', (v) => ((st.labels = v), positionLabels()));

  const depthCtl = ui.range('ea-depth', (v) => `${v.toLocaleString()} km`, (v) => {
    st.depth = v;
    updateReadouts();
    placeProbe();
  });
  updateReadouts();

  /* ---------- 3D scene ---------- */
  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  try {
    view = await createThreeScene(container, {
      label: 'A cutaway Earth showing crust, upper mantle, lower mantle, outer core and inner core.',
      camera: { position: [-3.6, 2.4, -4.4] }, // looking into the cut-away wedge
      minDistance: 2.6,
      maxDistance: 10,
      onFrame: (dt) => (earth.rotation.y += dt * 0.12),
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). You can still use the depth probe, readouts and graphs below.'
        : undefined,
    );
    return;
  }
  const { THREE, scene } = view;
  const earth = new THREE.Group();
  scene.add(earth);

  const pickables: T.Object3D[] = [];
  const cutParts: T.Object3D[] = [];
  const fullParts: T.Object3D[] = [];
  const mat = (colour: string, opts: Partial<T.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide, ...opts });

  LAYERS.forEach((layer, i) => {
    const rOuter = visualRadius(layer.top);
    const rInner = i === LAYERS.length - 1 ? 0 : visualRadius(layer.bottom);
    const m = mat(layer.colour, layer.id.includes('core') ? { emissive: new THREE.Color(layer.colour), emissiveIntensity: 0.25 } : {});
    // Outer surface with a 90° wedge removed
    const shell = new THREE.Mesh(new THREE.SphereGeometry(rOuter, 64, 48, 0, Math.PI * 1.5), m);
    shell.userData.layer = layer.id;
    earth.add(shell);
    pickables.push(shell);
    cutParts.push(shell);
    // Cut faces: two half-rings (semicircles for the inner core)
    for (const rotY of [0, -Math.PI / 2]) {
      const face = new THREE.Mesh(new THREE.RingGeometry(rInner, rOuter, 64, 1, Math.PI / 2, Math.PI), m);
      face.rotation.y = rotY;
      face.userData.layer = layer.id;
      earth.add(face);
      pickables.push(face);
      cutParts.push(face);
    }
  });

  // Ocean-and-land surface for the un-cut view, plus a matching cap for the wedge
  const surfaceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const surfaceGeo = new THREE.SphereGeometry(visualRadius(0) * 1.003, 96, 64);
  const colours: number[] = [];
  const pos = surfaceGeo.attributes.position;
  const ocean = new THREE.Color('#2a6fb0');
  const land = new THREE.Color('#5f8f3e');
  const ice = new THREE.Color('#eef4f8');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lat = Math.abs(y / visualRadius(0));
    const n = Math.sin(x * 2.1) * Math.cos(z * 1.7) + Math.sin((x + z) * 3.3) * 0.5 + Math.cos(y * 2.6) * 0.4;
    const c = lat > 0.88 ? ice : n > 0.45 ? land : ocean;
    colours.push(c.r, c.g, c.b);
  }
  surfaceGeo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.userData.layer = 'crust';
  surface.visible = false;
  earth.add(surface);
  fullParts.push(surface);

  // Depth probe marker on the cut face
  const probe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 16), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#4cc9f0'), emissiveIntensity: 0.9 }));
  earth.add(probe);
  placeProbe = () => {
    const r = visualRadius(st.depth);
    probe.position.set(-r, 0, -0.03); // on the z = 0 cut face, facing the open wedge
    probe.visible = st.cut;
    view?.requestRender();
  };

  // Floating labels (HTML, positioned each frame)
  const labelLayer = document.createElement('div');
  labelLayer.className = 'earth-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.parentElement!.appendChild(labelLayer);
  const labels = LAYERS.map((l) => {
    const el = document.createElement('span');
    el.textContent = l.name;
    labelLayer.appendChild(el);
    // The crust is thin, so its label sits just outside the globe
    const mid = l.id === 'crust' ? visualRadius(0) * 1.1 : (visualRadius(l.top) + (l.bottom === R_EARTH ? 0 : visualRadius(l.bottom))) / 2;
    return { el, anchor: new THREE.Vector3(-mid * 0.7071, mid * 0.7071, -0.02) };
  });
  const tmp = new THREE.Vector3();
  positionLabels = () => {
    labelLayer.hidden = !st.labels || !st.cut;
    if (labelLayer.hidden) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const l of labels) {
      tmp.copy(l.anchor).applyMatrix4(earth.matrixWorld).project(view!.camera);
      const visible = tmp.z < 1;
      l.el.style.display = visible ? '' : 'none';
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  };
  view.controls.addEventListener('change', positionLabels);

  applyCut = () => {
    cutParts.forEach((o) => (o.visible = st.cut));
    fullParts.forEach((o) => (o.visible = !st.cut));
    placeProbe();
    positionLabels();
    view?.requestRender();
  };

  view.onPick(
    () => (st.cut ? pickables : fullParts),
    (hit, at) => {
      const id = hit?.object.userData.layer as string | undefined;
      const layer = LAYERS.find((l) => l.id === id);
      if (!layer) return sim.hideTooltip();
      sim.showTooltip(
        at.x,
        at.y,
        layer.name,
        `${layer.top.toLocaleString()}–${layer.bottom.toLocaleString()} km deep. ${layer.state}. ${layer.composition}. ${layer.about}`,
      );
      depthCtl.set(Math.round((layer.top + layer.bottom) / 2 / 10) * 10);
    },
  );

  // Keep labels attached while spinning
  const tick = () => {
    if (view?.animating) positionLabels();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  view.setAnimating(st.spin && !prefersReducedMotion());
  applyCut();
  sim.setLoading(null);
}
