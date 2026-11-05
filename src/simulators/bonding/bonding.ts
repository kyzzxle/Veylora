/**
 * Chemical bonding viewer: ball-and-stick or space-filling 3D models of small
 * molecules, ionic lattices and a giant covalent structure.
 * Bond orders are drawn as 1–3 parallel sticks; ionic attractions as thin
 * lines. Lone pairs appear as translucent lobes pointing away from the bonds
 * (VSEPR). Partial charges (δ+/δ−) come from Pauling electronegativities.
 */
import type * as T from 'three';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { bondType, ELEMENTS, SUBSTANCES, type Substance } from './data';

type View = 'stick' | 'fill';

export async function initBonding(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-substance]')!;
  const aboutEl = root.querySelector<HTMLElement>('[data-about]')!;
  const ui = controls(root);
  const st = { id: 'h2o', view: 'stick' as View, lone: true, charges: true, labels: true };

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  let build = () => {};

  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      Object.assign(st, { id: 'h2o', view: 'stick', lone: true, charges: true, labels: true });
      pick.value = 'h2o';
      viewCtl.set('stick', false);
      loneCtl.set(true, false);
      chargeCtl.set(true, false);
      labelCtl.set(true, false);
      spinCtl.set(false);
      build();
      fit();
    },
  });

  /* ---------- Readouts ---------- */
  function updateReadouts() {
    const s = SUBSTANCES[st.id];
    ui.readout('name', `${s.name} (${s.formula})`);
    sim.setBadge(s.kind === 'ionic' ? 'Ionic' : s.kind === 'giant' ? 'Giant covalent' : 'Covalent');
    aboutEl.textContent = s.about;
    const els = [...new Set(s.atoms.map((a) => a.el))];
    const ens = els.map((e) => ELEMENTS[e].en);
    const d = Math.max(...ens) - Math.min(...ens);
    ui.readout('type', s.kind === 'ionic' ? 'Ionic' : s.kind === 'giant' ? 'Covalent (giant structure)' : bondType(d));
    ui.readout('en', els.length > 1 ? `${els.map((e) => `${e} ${ELEMENTS[e].en}`).join(', ')} → difference ${d.toFixed(2)}` : `${els[0]} ${ELEMENTS[els[0]].en} → difference 0`);
    ui.readout('shape', `${s.shape}${s.angle !== '—' ? `, ${s.angle}` : ''}`);
    const orders = s.bonds.filter((b) => b[2] > 0).map((b) => b[2]);
    const names = ['', 'single', 'double', 'triple'];
    ui.readout(
      'bonds',
      s.kind === 'ionic'
        ? 'Electrostatic attraction between oppositely charged ions'
        : s.kind === 'giant'
          ? 'Every atom has 4 single covalent bonds'
          : [1, 2, 3].filter((o) => orders.includes(o)).map((o) => `${orders.filter((x) => x === o).length} ${names[o]}`).join(', ') + ' covalent bond' + (orders.length > 1 ? 's' : ''),
    );
    ui.readout('polar', s.polar);
    ui.readout('mp', s.mp);
  }

  /* ---------- Controls ---------- */
  pick.addEventListener('change', () => {
    st.id = pick.value;
    build();
    fit();
  });
  const viewCtl = ui.choice<View>('cb-view', (v) => ((st.view = v), build()));
  const loneCtl = ui.toggle('cb-lone', (v) => ((st.lone = v), build()));
  const chargeCtl = ui.toggle('cb-charges', (v) => ((st.charges = v), placeLabels()));
  const labelCtl = ui.toggle('cb-labels', (v) => ((st.labels = v), placeLabels()));
  const spinCtl = ui.toggle('cb-spin', (v) => view?.setAnimating(v && !prefersReducedMotion()));
  updateReadouts();

  try {
    view = await createThreeScene(container, {
      label: 'A 3D model of a molecule or crystal. Drag to rotate; click an atom to learn about it.',
      camera: { position: [0, 1.5, 6] },
      minDistance: 2,
      maxDistance: 30,
      onFrame: (dt) => {
        group.rotation.y += dt * 0.4;
        placeLabels();
      },
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). The bond information below still updates when you choose a substance.'
        : undefined,
    );
    return;
  }
  const { THREE, scene, camera, controls: orbit } = view;
  const vw = view;
  const group = new THREE.Group();
  scene.add(group);
  const V = (p: [number, number, number]) => new THREE.Vector3(...p);

  /* ---------- Labels (symbols and partial charges) ---------- */
  const labelLayer = document.createElement('div');
  labelLayer.className = 'earth-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.parentElement!.appendChild(labelLayer);
  let labels: { el: HTMLSpanElement; atom: T.Object3D }[] = [];
  const tmp = new THREE.Vector3();
  function placeLabels() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    // make sure the camera and model matrices are current before projecting
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    for (const l of labels) {
      l.atom.getWorldPosition(tmp);
      tmp.project(camera);
      const show = tmp.z < 1 && (st.labels || st.charges) && l.el.textContent !== '';
      l.el.style.display = show ? '' : 'none';
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  }
  orbit.addEventListener('change', placeLabels);

  /** Lone-pair directions: away from the atom's bonds, spread around that direction. */
  function loneDirs(s: Substance, i: number, n: number) {
    const me = V(s.atoms[i].p);
    const away = new THREE.Vector3();
    for (const [a, b] of s.bonds) {
      if (a === i) away.add(me.clone().sub(V(s.atoms[b].p)).normalize());
      if (b === i) away.add(me.clone().sub(V(s.atoms[a].p)).normalize());
    }
    if (away.lengthSq() < 1e-6) away.set(0, 1, 0);
    away.normalize();
    if (n === 1) return [away];
    // two perpendicular axes around "away"
    const ref = Math.abs(away.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(away, ref).normalize();
    const v = new THREE.Vector3().crossVectors(away, u).normalize();
    // with no offset, two lone pairs sit above and below the plane of the bonds (as in water)
    const spread = n === 2 ? 0.95 : 1.15;
    const out: T.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2;
      out.push(away.clone().multiplyScalar(Math.cos(spread)).add(u.clone().multiplyScalar(Math.sin(spread) * Math.cos(t))).add(v.clone().multiplyScalar(Math.sin(spread) * Math.sin(t))).normalize());
    }
    return out;
  }

  build = () => {
    for (const c of [...group.children]) {
      group.remove(c);
      c.traverse((o) => (o as T.Mesh).geometry?.dispose());
    }
    for (const l of labels) l.el.remove();
    labels = [];
    const s = SUBSTANCES[st.id];
    const ionic = s.kind === 'ionic';
    const fill = st.view === 'fill';
    const atomMeshes: T.Mesh[] = [];
    // Atoms
    s.atoms.forEach((a, i) => {
      const e = ELEMENTS[a.el];
      // ions: cations shrink, anions grow
      const ionR = a.charge ? (a.charge > 0 ? (a.el === 'Na' ? 1.02 : 0.72) : a.el === 'Cl' ? 1.81 : 1.4) : 0;
      const r = fill ? (ionic ? ionR : e.vdw) : ionic ? ionR * 0.45 : Math.max(0.22, e.cov * 0.45);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: e.colour, roughness: 0.35, metalness: 0.05 }));
      mesh.position.copy(V(a.p));
      mesh.userData.atom = i;
      group.add(mesh);
      atomMeshes.push(mesh);
      // label: symbol with charge, or δ+/δ−
      let text = st.labels ? a.el : '';
      if (a.charge) text = `${st.labels ? a.el : ''}${Math.abs(a.charge) > 1 ? Math.abs(a.charge) : ''}${a.charge > 0 ? '+' : '−'}`;
      else if (st.charges && s.kind === 'covalent') {
        // partial charge from the electronegativity of neighbours
        let net = 0;
        for (const [p, q] of s.bonds) {
          const other = p === i ? q : q === i ? p : -1;
          if (other >= 0) net += ELEMENTS[s.atoms[other].el].en - e.en;
        }
        if (Math.abs(net) > 0.3) text = `${text}${text ? ' ' : ''}δ${net > 0 ? '+' : '−'}`;
      }
      if (st.id === 'diamond') text = '';
      const el = document.createElement('span');
      el.textContent = text;
      labelLayer.appendChild(el);
      labels.push({ el, atom: mesh });
    });
    // Bonds
    if (!fill) {
      for (const [a, b, order] of s.bonds) {
        const pa = V(s.atoms[a].p);
        const pb = V(s.atoms[b].p);
        const dir = pb.clone().sub(pa);
        const len = dir.length();
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        const perp = new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(0.16);
        const n = Math.max(1, order);
        for (let k = 0; k < n; k++) {
          const off = perp.clone().multiplyScalar(k - (n - 1) / 2);
          const stick = new THREE.Mesh(
            new THREE.CylinderGeometry(order === 0 ? 0.03 : 0.07, order === 0 ? 0.03 : 0.07, len, 12),
            new THREE.MeshStandardMaterial({ color: order === 0 ? '#9aa3ad' : '#cfd4da', roughness: 0.5, transparent: order === 0, opacity: order === 0 ? 0.5 : 1 }),
          );
          stick.position.copy(mid).add(off);
          stick.quaternion.copy(q);
          group.add(stick);
        }
      }
    }
    // Lone pairs
    if (st.lone && s.kind === 'covalent') {
      s.atoms.forEach((a, i) => {
        if (!a.lone) return;
        for (const d of loneDirs(s, i, a.lone)) {
          const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffd166', transparent: true, opacity: 0.55, depthWrite: false }));
          lobe.scale.set(1, 1.7, 1);
          lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
          lobe.position.copy(V(a.p)).add(d.clone().multiplyScalar(fill ? ELEMENTS[a.el].vdw + 0.1 : 0.62));
          lobe.userData.lone = i;
          group.add(lobe);
        }
      });
    }
    group.userData.atoms = atomMeshes;
    updateReadouts();
    placeLabels();
    vw.requestRender();
  };

  function fit() {
    const s = SUBSTANCES[st.id];
    const R = Math.max(...s.atoms.map((a) => Math.hypot(...a.p))) + 1.5;
    camera.position.set(R * 0.3, R * 0.35, R * 1.7 + 1.2);
    orbit.target.set(0, 0, 0);
    orbit.update();
    placeLabels();
    vw.requestRender();
  }

  vw.onPick(
    () => group.children,
    (hit, at) => {
      if (!hit) return;
      const s = SUBSTANCES[st.id];
      if (hit.object.userData.lone !== undefined) {
        sim.showTooltip(at.x, at.y, 'Lone pair', 'A pair of outer electrons not used in bonding. Lone pairs repel bonding pairs and change the shape of the molecule.');
        return;
      }
      const i = hit.object.userData.atom as number | undefined;
      if (i === undefined) {
        sim.showTooltip(at.x, at.y, s.kind === 'ionic' ? 'Ionic attraction' : 'Covalent bond', s.kind === 'ionic' ? 'Not a shared pair: oppositely charged ions attract each other in every direction.' : 'A shared pair of electrons holding two atoms together. Double and triple bonds share two or three pairs.');
        return;
      }
      const a = s.atoms[i];
      const e = ELEMENTS[a.el];
      const charge = a.charge ? `It is an ion with charge ${a.charge > 0 ? '+' : '−'}${Math.abs(a.charge)}: it has ${a.charge > 0 ? 'lost' : 'gained'} ${Math.abs(a.charge)} electron${Math.abs(a.charge) > 1 ? 's' : ''}.` : '';
      sim.showTooltip(at.x, at.y, `${e.name} (${a.el})`, `Electronegativity ${e.en}. ${charge}`);
    },
  );

  build();
  fit();
  sim.setLoading(null);
}
