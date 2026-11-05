/**
 * 3D muscle atlas built from simple shapes (no model files to download).
 * Units are metres; the figure stands about 1.8 m tall facing +z.
 * Limbs are nested groups at each joint so a contracting muscle can move
 * its joint: shoulder → elbow → wrist, hip → knee → ankle, waist and neck.
 * Muscles are ellipsoids; contraction shortens them and makes them thicker.
 */
import type * as T from 'three';
import type { ThreeScene } from '../shared/three';
import { MUSCLES, type Pose } from './data';

const SKIN = '#d9c8b5';
const MUSCLE = '#b8423c';
const CONTRACT = '#e8584c';
const STRETCH = '#5b8fd6';

export function buildAtlas(view: ThreeScene) {
  const { THREE, scene } = view;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const body = new THREE.Group();
  scene.add(body);

  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 });
  const unit = new THREE.SphereGeometry(1, 28, 18);

  interface Part {
    mesh: T.Mesh;
    base: T.Vector3;
    mat: T.MeshStandardMaterial;
  }
  const parts = new Map<string, Part[]>();

  const capsule = (parent: T.Object3D, at: T.Vector3, r: number, len: number, scale?: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), skinMat);
    m.position.copy(at);
    if (scale) m.scale.set(...scale);
    parent.add(m);
    return m;
  };
  const blob = (parent: T.Object3D, at: T.Vector3, s: [number, number, number], mat: T.Material = skinMat) => {
    const m = new THREE.Mesh(unit, mat);
    m.position.copy(at);
    m.scale.set(...s);
    parent.add(m);
    return m;
  };
  /** A muscle: an ellipsoid tagged with its id for picking. */
  const muscle = (id: string, parent: T.Object3D, at: T.Vector3, s: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const mat = new THREE.MeshStandardMaterial({ color: MUSCLE, roughness: 0.55 });
    const m = blob(parent, at, s, mat);
    m.rotation.set(...rot);
    m.userData.muscle = id;
    if (!parts.has(id)) parts.set(id, []);
    parts.get(id)!.push({ mesh: m, base: V(...s), mat });
    return m;
  };

  /* ---------- Pelvis, trunk, neck and head ---------- */
  blob(body, V(0, 0.95, 0), [0.17, 0.1, 0.11]);
  const trunk = new THREE.Group();
  trunk.position.set(0, 1.0, 0);
  body.add(trunk);
  capsule(trunk, V(0, 0.27, 0), 0.14, 0.3, [1.2, 1, 0.72]);
  capsule(trunk, V(0, 0.59, 0), 0.05, 0.08);
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  trunk.add(head);
  blob(head, V(0, 0.12, 0.005), [0.088, 0.11, 0.1]);
  blob(head, V(0, 0.09, 0.07), [0.02, 0.03, 0.025]); // nose

  muscle('rectus', trunk, V(-0.03, 0.17, 0.092), [0.028, 0.15, 0.022]);
  muscle('rectus', trunk, V(0.03, 0.17, 0.092), [0.028, 0.15, 0.022]);
  muscle('trapezius', trunk, V(0, 0.47, -0.075), [0.15, 0.11, 0.03]);
  for (const s of [-1, 1]) {
    muscle('pectoralis', trunk, V(s * 0.085, 0.42, 0.083), [0.08, 0.06, 0.03], [0, 0, s * 0.15]);
    muscle('obliques', trunk, V(s * 0.12, 0.16, 0.06), [0.04, 0.12, 0.045], [0, 0, s * 0.25]);
    muscle('latissimus', trunk, V(s * 0.1, 0.25, -0.083), [0.08, 0.16, 0.03], [0, 0, -s * 0.25]);
    muscle('sternocleidomastoid', trunk, V(s * 0.035, 0.6, 0.028), [0.014, 0.065, 0.014], [0.35, 0, s * 0.4]);
  }

  /* ---------- Arms ---------- */
  const shoulders: T.Group[] = [];
  const elbows: T.Group[] = [];
  const wrists: T.Group[] = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.215, 0.49, 0);
    sh.userData.side = s;
    trunk.add(sh);
    shoulders.push(sh);
    blob(sh, V(0, 0, 0), [0.05, 0.05, 0.05]);
    capsule(sh, V(0, -0.15, 0), 0.042, 0.22);
    muscle('deltoid', sh, V(s * 0.015, -0.035, 0), [0.058, 0.085, 0.06]);
    muscle('biceps', sh, V(0, -0.15, 0.035), [0.034, 0.1, 0.03]);
    muscle('triceps', sh, V(0, -0.14, -0.035), [0.036, 0.11, 0.03]);

    const el = new THREE.Group();
    el.position.set(0, -0.3, 0);
    sh.add(el);
    elbows.push(el);
    blob(el, V(0, 0, 0), [0.04, 0.04, 0.04]);
    capsule(el, V(0, -0.13, 0), 0.034, 0.2);
    muscle('forearm', el, V(0, -0.08, 0.022), [0.03, 0.09, 0.024]);

    const wr = new THREE.Group();
    wr.position.set(0, -0.27, 0);
    el.add(wr);
    wrists.push(wr);
    blob(wr, V(0, -0.06, 0), [0.035, 0.065, 0.016]);
  }

  /* ---------- Legs ---------- */
  const hips: T.Group[] = [];
  const knees: T.Group[] = [];
  const ankles: T.Group[] = [];
  for (const s of [-1, 1]) {
    muscle('gluteus', body, V(s * 0.08, 0.92, -0.085), [0.075, 0.085, 0.05]);
    const hip = new THREE.Group();
    hip.position.set(s * 0.09, 0.95, 0);
    body.add(hip);
    hips.push(hip);
    capsule(hip, V(0, -0.21, 0), 0.066, 0.3);
    muscle('quadriceps', hip, V(0, -0.2, 0.048), [0.052, 0.16, 0.036]);
    muscle('hamstrings', hip, V(0, -0.21, -0.048), [0.046, 0.15, 0.032]);

    const kn = new THREE.Group();
    kn.position.set(0, -0.44, 0);
    hip.add(kn);
    knees.push(kn);
    blob(kn, V(0, 0, 0.01), [0.05, 0.05, 0.05]);
    capsule(kn, V(0, -0.2, 0), 0.046, 0.3);
    muscle('gastrocnemius', kn, V(0, -0.11, -0.038), [0.042, 0.1, 0.036]);
    muscle('tibialis', kn, V(s * 0.02, -0.17, 0.034), [0.02, 0.12, 0.017]);

    const an = new THREE.Group();
    an.position.set(0, -0.42, 0);
    kn.add(an);
    ankles.push(an);
    blob(an, V(0, -0.01, 0), [0.04, 0.04, 0.04]);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.22), skinMat);
    foot.position.set(0, -0.04, 0.055);
    an.add(foot);
  }

  /* ---------- Pose and colours ---------- */
  const rad = (d: number) => (d * Math.PI) / 180;
  function setPose(p: Pose) {
    trunk.rotation.set(rad(p.trunkFlex ?? 0), rad(p.trunkTwist ?? 0), 0);
    head.rotation.y = rad(p.head ?? 0);
    shoulders.forEach((sh) => {
      const s = sh.userData.side as number;
      sh.position.y = 0.49 + 0.035 * (p.shrug ?? 0);
      sh.rotation.set(-rad(p.shoulderFlex ?? 0), 0, s * rad(p.shoulderAbd ?? 0));
    });
    elbows.forEach((g) => (g.rotation.x = -rad(p.elbow ?? 10)));
    wrists.forEach((g) => (g.rotation.x = -rad(p.wrist ?? 0)));
    // Only the figure's right leg moves, so it keeps standing on the left
    hips[0].rotation.x = -rad(p.hip ?? 0);
    knees[0].rotation.x = rad(p.knee ?? 0);
    ankles[0].rotation.x = rad(p.ankle ?? 0);
  }

  const black = new THREE.Color(0);
  /** Colour and shape every muscle: the selected one contracts by c (0–1). */
  function update(selected: string, c: number, accent: T.Color) {
    const ant = MUSCLES[selected]?.antagonist;
    for (const [id, list] of parts) {
      const active = id === selected;
      const stretched = id === ant && c > 0.02;
      for (const { mesh, base, mat } of list) {
        const k = active ? c : stretched ? -0.6 * c : 0;
        // Muscles keep their volume: shorter means thicker
        mesh.scale.set(base.x * (1 + 0.24 * k), base.y * (1 - 0.18 * k), base.z * (1 + 0.24 * k));
        mat.color.set(active && c > 0.02 ? CONTRACT : stretched ? STRETCH : MUSCLE);
        // Selected but relaxed: a soft accent glow; contracting: a red glow
        if (active && c > 0.02) mat.emissive.set(CONTRACT);
        else mat.emissive.copy(active ? accent : black);
        mat.emissiveIntensity = active ? (c > 0.02 ? 0.12 + 0.25 * c : 0.35) : 0;
      }
    }
    setPose(MUSCLES[selected]?.pose(c) ?? {});
    view.requestRender();
  }

  return { body, update, setPose };
}
