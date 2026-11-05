/**
 * 3D cell explorer built on the shared Three.js scene.
 * A quarter of the cell is removed with two clipping planes (x > 0 and z > 0),
 * so the same cut works for the round animal cell and the box-shaped plant cell.
 */
import type * as T from 'three';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { ORGANELLES, ORGANELLE_LIST, type CellKind } from './data';

/** Deterministic pseudo-random numbers so the cell looks the same every visit. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export async function initCell3D(root: HTMLElement, kind: CellKind) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-pick]')!;
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;
  const ui = controls(root);
  const st = { selected: '', cut: true, labels: false, explored: new Set<string>() };

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  let applyCut = () => {};
  let highlight = (_id: string) => {};
  let positionLabels = () => {};

  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      select('');
      cutCtl.set(true);
      spinCtl.set(false);
      view?.resetView();
    },
  });

  function select(id: string) {
    st.selected = id;
    pick.value = id;
    if (id) {
      const o = ORGANELLES[id];
      st.explored.add(id);
      infoTitle.textContent = o.name;
      infoText.textContent = `${o.job} ${o.detail}`;
      ui.readout('selected', o.name);
      ui.readout('found', o.foundIn, o.foundIn === 'Plant cells only' ? 'ok' : null);
    } else {
      infoTitle.textContent = 'Click an organelle';
      infoText.textContent = 'Rotate the cell and click any structure, or choose one from the list above.';
      ui.readout('selected', '—');
      ui.readout('found', '—');
    }
    ui.readout('count', `${st.explored.size} of ${ORGANELLE_LIST[kind].length}`);
    highlight(id);
    positionLabels();
  }
  pick.addEventListener('change', () => select(pick.value));
  const cutCtl = ui.toggle(`${kind}-cut`, (v) => ((st.cut = v), applyCut()));
  const spinCtl = ui.toggle(`${kind}-spin`, (v) => view?.setAnimating(v && !prefersReducedMotion()));
  ui.toggle(`${kind}-labels`, (v) => ((st.labels = v), positionLabels()));
  select('');

  try {
    view = await createThreeScene(container, {
      label: `A 3D ${kind} cell. Click an organelle to learn about it.`,
      camera: { position: [4.2, 2.6, 4.6] },
      minDistance: 2.5,
      maxDistance: 12,
      onFrame: (dt) => (cell.rotation.y += dt * 0.15),
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). The organelle list, descriptions and quiz still work.'
        : undefined,
    );
    return;
  }
  const { THREE, scene, renderer } = view;
  renderer.localClippingEnabled = true;
  const cell = new THREE.Group();
  scene.add(cell);
  const rand = rng(kind === 'animal' ? 7 : 11);

  // Clip away the quarter where x > 0 and z > 0 (in the cell's own frame)
  const planes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  const clipMats: T.Material[] = [];
  const groups: Record<string, T.Object3D[]> = {};
  const add = (id: string, obj: T.Object3D) => {
    obj.traverse((o) => (o.userData.organelle = id));
    (groups[id] ??= []).push(obj);
    cell.add(obj);
  };
  const mat = (colour: string, opts: Partial<T.MeshStandardMaterialParameters> = {}, clip = false) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.55, metalness: 0.02, ...opts });
    if (clip) {
      m.clippingPlanes = planes;
      m.clipIntersection = true;
      clipMats.push(m);
    }
    return m;
  };

  // Keep planes in the cell's frame while it spins
  const updatePlanes = () => {
    const q = cell.quaternion;
    planes[0].normal.set(-1, 0, 0).applyQuaternion(q);
    planes[1].normal.set(0, 0, -1).applyQuaternion(q);
  };

  /* ---------- Build the cell ---------- */
  const isPlant = kind === 'plant';
  const nucleusPos = isPlant ? new THREE.Vector3(-0.85, 0.25, -0.45) : new THREE.Vector3(-0.2, 0.15, -0.25);
  const placeInside = (r: number, avoid: { p: T.Vector3; r: number }[], box?: [number, number, number]) => {
    for (let i = 0; i < 200; i++) {
      const v = box
        ? new THREE.Vector3((rand() * 2 - 1) * box[0], (rand() * 2 - 1) * box[1], (rand() * 2 - 1) * box[2])
        : new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(1.55);
      if (!box && v.length() > 1.6 - r) continue;
      if (avoid.every((a) => v.distanceTo(a.p) > a.r + r)) return v;
    }
    return new THREE.Vector3(0, -1, 0);
  };

  if (isPlant) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 2.4), mat(ORGANELLES.wall.colour, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }, true));
    add('wall', wall);
    const membrane = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.2), mat(ORGANELLES.membrane.colour, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }, true));
    add('membrane', membrane);
    const vac = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat(ORGANELLES.vacuole.colour, { transparent: true, opacity: 0.45, depthWrite: false }, true));
    vac.scale.set(1.15, 0.78, 0.78);
    vac.position.set(0.35, -0.05, 0.1);
    add('vacuole', vac);
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(ORGANELLES.chloroplasts.colour));
      c.scale.set(0.22, 0.09, 0.14);
      const side = i % 4;
      c.position.set(-1.35 + rand() * 2.7, side < 2 ? (side ? 0.95 : -0.95) : -0.8 + rand() * 1.6, side >= 2 ? (side === 2 ? 0.95 : -0.95) : -0.8 + rand() * 1.6);
      c.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      add('chloroplasts', c);
    }
  } else {
    const membrane = new THREE.Mesh(new THREE.SphereGeometry(1.85, 64, 48), mat(ORGANELLES.membrane.colour, { transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }, true));
    add('membrane', membrane);
  }

  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(isPlant ? 0.42 : 0.62, 40, 28), mat(ORGANELLES.nucleus.colour, { transparent: true, opacity: 0.75 }, true));
  nucleus.position.copy(nucleusPos);
  add('nucleus', nucleus);
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(isPlant ? 0.15 : 0.22, 24, 16), mat(ORGANELLES.nucleolus.colour));
  nucleolus.position.copy(nucleusPos).add(new THREE.Vector3(0.08, 0.05, 0.08));
  add('nucleolus', nucleolus);

  // Rough ER: curved sheets around the nucleus, studded with ribosomes
  const rerMat = mat(ORGANELLES.rer.colour);
  const ribMat = mat(ORGANELLES.ribosomes.colour);
  const nR = isPlant ? 0.42 : 0.62;
  for (let i = 0; i < (isPlant ? 3 : 5); i++) {
    const r = nR + 0.18 + i * 0.12;
    const sheet = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 48, Math.PI * 0.9), rerMat);
    sheet.position.copy(nucleusPos);
    sheet.rotation.set(Math.PI / 2 + i * 0.25, 0.3, -0.4 + i * 0.2);
    add('rer', sheet);
  }
  // Ribosomes (free in cytoplasm)
  const ribCount = isPlant ? 70 : 120;
  const ribGeo = new THREE.SphereGeometry(0.025, 6, 4);
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, ribCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ribCount; i++) {
    dummy.position.copy(isPlant ? placeInside(0.03, [{ p: new THREE.Vector3(0.35, -0.05, 0.1), r: 0.95 }], [1.5, 1.0, 1.0]) : placeInside(0.03, [{ p: nucleusPos, r: nR + 0.1 }]));
    dummy.updateMatrix();
    ribs.setMatrixAt(i, dummy.matrix);
  }
  add('ribosomes', ribs);

  // Smooth ER (animal cell): tubes
  if (!isPlant) {
    for (let i = 0; i < 3; i++) {
      const pts = Array.from({ length: 5 }, (_, k) => new THREE.Vector3(-0.2 + k * 0.18 - i * 0.2, -0.9 + Math.sin(k + i) * 0.15, 0.4 + i * 0.25));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 8), mat(ORGANELLES.ser.colour));
      add('ser', tube);
    }
  }

  // Golgi apparatus: stacked curved sacs
  const golgiPos = isPlant ? new THREE.Vector3(-0.9, -0.55, 0.55) : new THREE.Vector3(0.75, -0.45, -0.75);
  for (let i = 0; i < 5; i++) {
    const sac = new THREE.Mesh(new THREE.TorusGeometry(0.32 - i * 0.03, 0.04, 8, 32, Math.PI * 0.8), mat(ORGANELLES.golgi.colour));
    sac.position.copy(golgiPos).add(new THREE.Vector3(0, i * 0.09, 0));
    sac.rotation.set(Math.PI / 2, 0, 0.6);
    sac.scale.set(1, 1, 0.5);
    add('golgi', sac);
  }

  // Mitochondria
  const occupied = [{ p: nucleusPos, r: nR + 0.2 }, { p: golgiPos, r: 0.45 }];
  for (let i = 0; i < (isPlant ? 4 : 7); i++) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 12), mat(ORGANELLES.mitochondria.colour));
    const pos = isPlant ? placeInside(0.2, [...occupied, { p: new THREE.Vector3(0.35, -0.05, 0.1), r: 0.95 }], [1.4, 0.9, 0.9]) : placeInside(0.25, occupied);
    m.position.copy(pos);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    occupied.push({ p: pos, r: 0.25 });
    add('mitochondria', m);
  }

  if (!isPlant) {
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat(ORGANELLES.lysosomes.colour));
      const pos = placeInside(0.12, occupied);
      l.position.copy(pos);
      occupied.push({ p: pos, r: 0.12 });
      add('lysosomes', l);
    }
    const cen = new THREE.Group();
    const cyl = () => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12), mat(ORGANELLES.centrioles.colour));
    const c1 = cyl();
    const c2 = cyl();
    c2.rotation.z = Math.PI / 2;
    c2.position.x = 0.12;
    cen.add(c1, c2);
    cen.position.copy(nucleusPos).add(new THREE.Vector3(0.75, 0.55, 0.1));
    add('centrioles', cen);
  }

  /* ---------- Selection highlight ---------- */
  highlight = (id: string) => {
    for (const [gid, objs] of Object.entries(groups)) {
      for (const o of objs)
        o.traverse((m) => {
          const mm = (m as T.Mesh).material as T.MeshStandardMaterial | undefined;
          if (!mm || !('emissive' in mm)) return;
          mm.emissive.setHex(gid === id && id ? 0x555555 : 0x000000);
        });
    }
    view?.requestRender();
  };

  /* ---------- Labels ---------- */
  const labelLayer = document.createElement('div');
  labelLayer.className = 'earth-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.parentElement!.appendChild(labelLayer);
  const labels = ORGANELLE_LIST[kind]
    .filter((id) => groups[id])
    .map((id) => {
      const el = document.createElement('span');
      el.textContent = ORGANELLES[id].name;
      labelLayer.appendChild(el);
      return { id, el };
    });
  const tmp = new THREE.Vector3();
  positionLabels = () => {
    if (!view) return;
    labelLayer.hidden = false;
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const l of labels) {
      const obj = groups[l.id][0];
      obj.getWorldPosition(tmp);
      if (l.id === 'membrane' || l.id === 'wall') tmp.set(isPlant ? -1.7 : -1.3, l.id === 'wall' ? 1.25 : 1.35, isPlant ? -1.25 : -0.8).applyQuaternion(cell.quaternion);
      if (l.id === 'vacuole') tmp.set(0.9, 0.1, 0.4).applyQuaternion(cell.quaternion);
      if (l.id === 'ribosomes') tmp.set(0.6, 0.9, 0.2).applyQuaternion(cell.quaternion);
      tmp.project(view.camera);
      // All labels when the toggle is on; otherwise only the selected organelle
      l.el.style.display = tmp.z < 1 && (st.labels || l.id === st.selected) ? '' : 'none';
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
      l.el.style.outline = l.id === st.selected ? '2px solid var(--accent)' : '';
    }
  };
  view.controls.addEventListener('change', positionLabels);

  applyCut = () => {
    for (const m of clipMats) {
      (m as T.MeshStandardMaterial).clippingPlanes = st.cut ? planes : [];
      m.needsUpdate = true;
    }
    view?.requestRender();
  };

  view.onPick(
    () => cell.children,
    (hit, at) => {
      const id = hit?.object.userData.organelle as string | undefined;
      if (!id) return;
      select(id);
      sim.showTooltip(at.x, at.y, ORGANELLES[id].name, ORGANELLES[id].job);
      positionLabels();
    },
    // Ignore hits inside the cut-away quarter (x > 0 and z > 0 in the cell's frame)
    (hit) => {
      const material = (hit.object as T.Mesh).material as T.Material;
      if (!st.cut || !material.clippingPlanes?.length) return true; // only clipped surfaces can be hidden
      const local = cell.worldToLocal(hit.point.clone());
      return !(local.x > 0.001 && local.z > 0.001);
    },
  );

  // Keep clipping planes and labels in step with any rotation
  const tick = () => {
    updatePlanes();
    if (view?.animating) positionLabels();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  sim.setLoading(null);
  positionLabels();
  view.requestRender();
}
