/**
 * Solar System Explorer.
 *
 * Planets move on circular orbits in one plane, with their real periods.
 * Positions start from today's date using each planet's mean longitude at
 * J2000.0 (1 January 2000, 12:00 UTC), so the layout roughly matches the sky.
 *
 * Three views:
 *   fit   – orbits on a √(distance) scale and enlarged planets, so all fit
 *   true  – 1 AU = 10 scene units with real diameters on the same scale;
 *           planets become specks, so coloured markers show where they are
 *   sizes – planets lined up beside the Sun at true relative size
 */
import type * as T from 'three';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { AU_KM, PLANETS, SUN } from './data';

const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;
const AU = 10; // scene units per AU at true scale
const SUN_KM = SUN.diameter / 2;

export async function initSolar(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const follow = root.querySelector<HTMLSelectElement>('[data-follow]')!;
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;
  const ui = controls(root);

  const todayDays = () => (Date.now() - J2000) / DAY_MS;
  const st = { days: todayDays(), speed: 30, mode: 'fit' as 'fit' | 'true' | 'sizes', orbits: true, labels: true, selected: 'earth', follow: '' };

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  let layout = () => {};
  let place = () => {};

  const sim = createSimController(root, {
    step(dt) {
      st.days += dt * st.speed;
    },
    render() {
      place();
      updateReadouts();
      view?.requestRender();
    },
    reset() {
      st.days = todayDays();
      speedCtl.set(30, false);
      st.speed = 30;
      modeCtl.set('fit', false);
      st.mode = 'fit';
      follow.value = '';
      st.follow = '';
      select('earth');
      layout();
      view?.resetView();
    },
  });

  /* ---------- Scale ---------- */
  const SIZE_K = 0.1 / 6378; // "sizes" view: Earth radius = 0.1 units
  const orbitRadius = (a: number) => (st.mode === 'true' ? a * AU : 4 + 5.2 * Math.sqrt(a));
  const planetRadius = (d: number) =>
    st.mode === 'true' ? (d / 2 / AU_KM) * AU : st.mode === 'sizes' ? (d / 2) * SIZE_K : 0.16 + 0.3 * Math.pow(d / 12756, 0.45);
  const sunRadius = () => (st.mode === 'true' ? (SUN_KM / AU_KM) * AU : st.mode === 'sizes' ? SUN_KM * SIZE_K : 2.2);
  /** x position of each planet in the "sizes" line-up (Sun centred at the origin). */
  const lineUpX = (i: number) => {
    let x = sunRadius() + 0.6;
    for (let j = 0; j < i; j++) x += planetRadius(PLANETS[j].diameter) * 2 + 0.35;
    return x + planetRadius(PLANETS[i].diameter);
  };
  const angleOf = (i: number, days: number) => ((PLANETS[i].L0 + (360 * days) / PLANETS[i].period) * Math.PI) / 180;

  function select(id: string) {
    st.selected = id;
    const p = PLANETS.find((q) => q.id === id);
    if (p) {
      infoTitle.textContent = p.name;
      infoText.textContent = p.fact;
    } else {
      infoTitle.textContent = SUN.name;
      infoText.textContent = SUN.fact;
    }
    updateReadouts();
  }

  function updateReadouts() {
    const date = new Date(J2000 + st.days * DAY_MS);
    ui.readout('date', date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
    const p = PLANETS.find((q) => q.id === st.selected);
    if (!p) {
      ui.readout('selected', 'The Sun');
      ui.readout('distance', '—');
      ui.readout('period', '—');
      ui.readout('size', `${SUN.diameter.toLocaleString()} km across (109 × Earth)`);
      ui.readout('moons', '—');
      ui.readout('temp', 'about 5,500 °C (surface)');
      ui.readout('day', 'about 27 days at the equator');
      return;
    }
    ui.readout('selected', `${p.name} (${p.kind.toLowerCase()})`);
    const lightMin = (p.a * AU_KM) / 299_792.458 / 60;
    ui.readout('distance', `${p.a} AU · ${Math.round((p.a * AU_KM) / 1e6).toLocaleString()} million km · light takes ${lightMin < 60 ? `${lightMin.toFixed(1)} min` : `${(lightMin / 60).toFixed(1)} h`}`);
    ui.readout('period', p.period < 1000 ? `${p.period} Earth days` : `${(p.period / 365.25).toFixed(1)} Earth years`);
    ui.readout('size', `${p.diameter.toLocaleString()} km across (${(p.diameter / 12756).toFixed(2)} × Earth)`);
    ui.readout('moons', p.moons);
    ui.readout('temp', p.temp);
    ui.readout('day', p.day);
  }

  /* ---------- Controls ---------- */
  const speedCtl = ui.range('so-speed', (v) => (v < 365 ? `${v} days per second` : `${(v / 365).toFixed(1)} years per second`), (v) => (st.speed = v));
  const modeCtl = ui.choice<'fit' | 'true' | 'sizes'>('so-mode', (v) => {
    st.mode = v;
    if (v === 'sizes') follow.value = st.follow = '';
    layout();
    fitView();
  });
  ui.toggle('so-orbits', (v) => ((st.orbits = v), layout()));
  ui.toggle('so-labels', (v) => ((st.labels = v), sim.requestRender()));
  follow.addEventListener('change', () => {
    st.follow = follow.value;
    if (follow.value) select(follow.value);
    fitView();
  });
  root.querySelector('[data-today]')!.addEventListener('click', () => ((st.days = todayDays()), sim.requestRender()));
  select('earth');

  try {
    view = await createThreeScene(container, {
      label: 'A 3D model of the Sun and the eight planets moving in their orbits. Click a planet to learn about it.',
      camera: { position: [0, 29, 45], target: [0, 0, 0] },
      minDistance: 0.05,
      maxDistance: 120,
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). The planet facts and quiz still work.'
        : undefined,
    );
    return;
  }
  const { THREE, scene, camera } = view;
  const vw = view;
  camera.far = 2000;
  camera.near = 0.001;
  camera.updateProjectionMatrix();
  // Light comes from the Sun: dim the default lights and add a point light at the centre
  scene.traverse((o) => {
    if ((o as T.Light).isLight) (o as T.Light).intensity *= 0.25;
  });
  scene.add(new THREE.PointLight(0xffffff, 3, 0, 0));

  // Background stars
  const starGeo = new THREE.BufferGeometry();
  const pts: number[] = [];
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 1500; i++) {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = 900;
    pts.push(r * Math.sqrt(1 - u * u) * Math.cos(t), r * u, r * Math.sqrt(1 - u * u) * Math.sin(t));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: '#ffcc55' }));
  sun.userData.body = 'sun';
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.18 }));
  scene.add(glow);

  const bodies = PLANETS.map((p) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: p.colour, roughness: 0.8 }));
    mesh.userData.body = p.id;
    scene.add(mesh);
    if (p.id === 'saturn') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 2.3, 64), new THREE.MeshBasicMaterial({ color: '#d8c38f', side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
      ring.rotation.x = -Math.PI / 2 + 0.47;
      ring.userData.body = 'saturn';
      mesh.add(ring);
    }
    // A marker that stays a few pixels wide so tiny true-scale planets can be found
    const markerGeo = new THREE.BufferGeometry();
    markerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const marker = new THREE.Points(markerGeo, new THREE.PointsMaterial({ color: p.colour, size: 7, sizeAttenuation: false }));
    scene.add(marker);
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: p.colour, transparent: true, opacity: 0.35 }));
    scene.add(orbit);
    return { p, mesh, marker, orbit };
  });

  layout = () => {
    const sr = sunRadius();
    sun.scale.setScalar(sr);
    glow.scale.setScalar(sr * 1.25);
    glow.visible = st.mode === 'fit';
    for (const b of bodies) {
      b.mesh.scale.setScalar(planetRadius(b.p.diameter));
      const r = orbitRadius(b.p.a);
      const ring: number[] = [];
      for (let i = 0; i < 160; i++) {
        const t = (i / 160) * Math.PI * 2;
        ring.push(Math.cos(t) * r, 0, -Math.sin(t) * r);
      }
      b.orbit.geometry.dispose();
      b.orbit.geometry = new THREE.BufferGeometry();
      b.orbit.geometry.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
      b.orbit.visible = st.orbits && st.mode !== 'sizes';
      b.marker.visible = st.mode === 'true';
    }
    vw.controls.maxDistance = st.mode === 'true' ? 900 : 120;
    place();
    vw.requestRender();
  };

  const prevPos = new THREE.Vector3();
  place = () => {
    bodies.forEach((b, i) => {
      const a = angleOf(i, st.days);
      const r = orbitRadius(b.p.a);
      if (st.mode === 'sizes') b.mesh.position.set(lineUpX(i), 0, 0);
      else b.mesh.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
      b.marker.position.copy(b.mesh.position);
      b.mesh.rotation.y += 0.01;
    });
    // Keep the camera locked to the followed planet
    if (st.follow) {
      const target = bodies.find((b) => b.p.id === st.follow)!.mesh.position;
      const delta = target.clone().sub(prevPos);
      vw.camera.position.add(delta);
      vw.controls.target.copy(target);
      prevPos.copy(target);
    }
    positionLabels();
  };

  function fitView() {
    if (st.follow) {
      const b = bodies.find((q) => q.p.id === st.follow)!;
      const r = b.mesh.scale.x;
      prevPos.copy(b.mesh.position);
      vw.controls.target.copy(b.mesh.position);
      vw.camera.position.copy(b.mesh.position).add(new THREE.Vector3(r * 4 + 0.3, r * 2.5 + 0.2, r * 6 + 0.5));
    } else {
      if (st.mode === 'sizes') {
        // Look along the line-up from in front, with the Sun's edge on the left
        vw.controls.target.set(sunRadius() + 4.8, 0, 0);
        vw.camera.position.set(sunRadius() + 4.8, 1.5, 10.5);
      } else {
        const k = st.mode === 'true' ? 300 / 32.5 : 1;
        vw.controls.target.set(0, 0, 0);
        vw.camera.position.set(0, 29 * k, 45 * k);
      }
    }
    vw.controls.update();
    vw.requestRender();
  }

  /* ---------- Labels ---------- */
  const labelLayer = document.createElement('div');
  labelLayer.className = 'earth-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.parentElement!.appendChild(labelLayer);
  const labels = bodies.map((b) => {
    const el = document.createElement('span');
    el.textContent = b.p.name;
    labelLayer.appendChild(el);
    return { b, el };
  });
  const tmp = new THREE.Vector3();
  function positionLabels() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const { b, el } of labels) {
      tmp.copy(b.mesh.position);
      tmp.y += b.mesh.scale.x * 1.6;
      tmp.project(vw.camera);
      const show = st.labels && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      el.style.display = show || b.p.id === st.selected ? '' : 'none';
      if (tmp.z >= 1) el.style.display = 'none';
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -100%)`;
      el.style.outline = b.p.id === st.selected ? '2px solid var(--accent)' : '';
    }
  }
  vw.controls.addEventListener('change', positionLabels);

  vw.onPick(
    () => [sun, ...bodies.map((b) => b.mesh)],
    (hit, at) => {
      let id = hit?.object.userData.body as string | undefined;
      // On true scale planets are specks: pick the nearest marker on screen instead
      if (!id && st.mode === 'true') {
        const r = container.getBoundingClientRect();
        let best = 24;
        for (const b of bodies) {
          tmp.copy(b.mesh.position).project(vw.camera);
          const d = Math.hypot(((tmp.x + 1) / 2) * r.width - at.x, ((1 - tmp.y) / 2) * r.height - at.y);
          if (d < best && tmp.z < 1) ((best = d), (id = b.p.id));
        }
      }
      if (!id) return;
      select(id);
      const p = PLANETS.find((q) => q.id === id);
      sim.showTooltip(at.x, at.y, p ? p.name : SUN.name, p ? p.fact : SUN.fact);
      positionLabels();
    },
  );

  layout();
  sim.setLoading(null);
  sim.requestRender();
}
