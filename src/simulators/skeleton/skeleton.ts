/**
 * 3D human skeleton built from simple shapes (no model files to download).
 * Units are metres; the figure stands about 1.75 m tall facing +z.
 * Limbs are nested groups at each joint so the pose sliders can rotate them:
 *   shoulder (ball-and-socket) → elbow (hinge); hip (ball-and-socket) → knee
 *   (hinge); and the atlas–axis pivot turns the head.
 */
import type * as T from 'three';
import { createSimController, prefersReducedMotion } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';
import { BONES, BONE_TYPE, HIDDEN_BONES, JOINTS, JOINT_TYPE } from './data';

const DEF = { colour: 'plain' as 'plain' | 'type', joints: false, head: 0, arms: 0, elbows: 0, hip: 0, knee: 0 };

export async function initSkeleton(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const pick = root.querySelector<HTMLSelectElement>('[data-pick]')!;
  const infoTitle = root.querySelector<HTMLElement>('[data-info-title]')!;
  const infoText = root.querySelector<HTMLElement>('[data-info-text]')!;
  const ui = controls(root);
  const st = { ...DEF, selected: '', explored: new Set<string>() };

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  let recolour = () => {};
  let applyPose = () => {};

  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      Object.assign(st, DEF);
      colourCtl.set('plain', false);
      jointsCtl.set(false, false);
      for (const [c, v] of sliders) c.set(v, false);
      spinCtl.set(false);
      select('');
      applyPose();
      recolour();
      view?.resetView();
    },
  });

  function select(id: string) {
    st.selected = id;
    pick.value = BONES[id] ? id : '';
    if (BONES[id]) {
      const b = BONES[id];
      st.explored.add(id);
      infoTitle.textContent = b.name;
      infoText.textContent = `${b.about} ${BONE_TYPE[b.type].name}: ${BONE_TYPE[b.type].about.toLowerCase()}`;
      ui.readout('selected', b.name);
      ui.readout('type', BONE_TYPE[b.type].name);
      ui.readout('count', b.countNote ? `${b.count} (${b.countNote})` : `${b.count}`);
    } else if (JOINTS[id]) {
      const j = JOINTS[id];
      infoTitle.textContent = `${j.name}: ${JOINT_TYPE[j.type].name.toLowerCase()}`;
      infoText.textContent = j.about;
      ui.readout('selected', j.name);
      ui.readout('type', JOINT_TYPE[j.type].name);
      ui.readout('count', '—');
    } else {
      infoTitle.textContent = 'Click a bone';
      infoText.textContent = 'Rotate the skeleton and click any bone, or choose one from the list. Turn on “Show joints” to explore how bones connect.';
      ui.readout('selected', '—');
      ui.readout('type', '—');
      ui.readout('count', '—');
    }
    ui.readout('explored', `${st.explored.size} of ${Object.keys(BONES).length} groups`);
    recolour();
  }
  pick.addEventListener('change', () => select(pick.value));

  const colourCtl = ui.choice<'plain' | 'type'>('sk-colour', (v) => ((st.colour = v), ui.showWhen('[data-type-key]', v === 'type'), recolour()));
  const jointsCtl = ui.toggle('sk-joints', (v) => ((st.joints = v), ui.showWhen('[data-joint-key]', v), recolour()));
  const spinCtl = ui.toggle('sk-spin', (v) => view?.setAnimating(v && !prefersReducedMotion()));
  const sliders: [ReturnType<typeof ui.range>, number][] = [
    [ui.range('sk-head', (v) => `${v}°`, (v) => ((st.head = v), applyPose())), DEF.head],
    [ui.range('sk-arms', (v) => `${v}°`, (v) => ((st.arms = v), applyPose())), DEF.arms],
    [ui.range('sk-elbows', (v) => `${v}°`, (v) => ((st.elbows = v), applyPose())), DEF.elbows],
    [ui.range('sk-hip', (v) => `${v}°`, (v) => ((st.hip = v), applyPose())), DEF.hip],
    [ui.range('sk-knee', (v) => `${v}°`, (v) => ((st.knee = v), applyPose())), DEF.knee],
  ];
  ui.showWhen('[data-type-key]', false);
  ui.showWhen('[data-joint-key]', false);
  ui.readout('total', `206 (${206 - HIDDEN_BONES} shown; the 6 tiny ear bones and the hyoid are too small)`);
  select('');

  try {
    view = await createThreeScene(container, {
      label: 'A 3D human skeleton. Click a bone or joint to learn about it.',
      camera: { position: [0.9, 1.25, 2.6], target: [0, 0.9, 0] },
      minDistance: 0.5,
      maxDistance: 6,
      onFrame: (dt) => (body.rotation.y += dt * 0.3),
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL). The bone list, descriptions and quiz still work.'
        : undefined,
    );
    return;
  }

  const { THREE, scene } = view;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const body = new THREE.Group();
  scene.add(body);

  /* ---------- Materials ---------- */
  const boneMats = new Map<string, T.MeshStandardMaterial>();
  const matFor = (id: string) => {
    if (!boneMats.has(id)) boneMats.set(id, new THREE.MeshStandardMaterial({ color: '#e9e1cf', roughness: 0.65, metalness: 0.02 }));
    return boneMats.get(id)!;
  };
  const jointMeshes: T.Mesh[] = [];

  /* ---------- Shape helpers ---------- */
  const tag = (mesh: T.Object3D, id: string) => {
    mesh.traverse((o) => (o.userData.bone = id));
    return mesh;
  };
  /** A cylinder from a to b (with rounded ends). */
  const rod = (id: string, a: T.Vector3, b: T.Vector3, r: number, parent: T.Object3D, r2 = r) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, 12), matFor(id));
    m.position.y = len / 2;
    g.add(m);
    for (const [y, rr] of [[0, r], [len, r2]] as const) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.25, 12, 8), matFor(id));
      cap.position.y = y;
      g.add(cap);
    }
    g.position.copy(a);
    g.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    parent.add(tag(g, id));
    return g;
  };
  const blob = (id: string, pos: T.Vector3, scale: [number, number, number], parent: T.Object3D, rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), matFor(id));
    m.position.copy(pos);
    m.scale.set(...scale);
    m.rotation.set(...rot);
    parent.add(tag(m, id));
    return m;
  };
  const box = (id: string, pos: T.Vector3, size: [number, number, number], parent: T.Object3D, rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), matFor(id));
    m.position.copy(pos);
    m.rotation.set(...rot);
    parent.add(tag(m, id));
    return m;
  };
  // Joint markers are slightly larger than the bone ends around them, so a click lands on them first
  const joint = (id: string, pos: T.Vector3, parent: T.Object3D, r = 0.03) => {
    const j = JOINTS[id];
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 12),
      new THREE.MeshStandardMaterial({ color: JOINT_TYPE[j.type].colour, transparent: true, opacity: 0.85, depthTest: false }),
    );
    m.renderOrder = 2;
    m.position.copy(pos);
    m.userData.joint = id;
    m.visible = false;
    parent.add(m);
    jointMeshes.push(m);
  };

  /* ---------- Head and spine ---------- */
  const head = new THREE.Group();
  head.position.set(0, 1.53, -0.02);
  body.add(head);
  blob('skull', V(0, 0.135, 0.0), [0.08, 0.095, 0.1], head);
  blob('skull', V(0, 0.08, 0.04), [0.06, 0.055, 0.055], head); // face
  for (const s of [-1, 1]) blob('skull', V(s * 0.05, 0.085, 0.055), [0.018, 0.014, 0.02], head); // cheekbones
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), new THREE.MeshStandardMaterial({ color: '#2b2622' }));
    eye.position.set(s * 0.032, 0.11, 0.088);
    head.add(tag(eye, 'skull'));
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 3), new THREE.MeshStandardMaterial({ color: '#2b2622' }));
  nose.position.set(0, 0.08, 0.098);
  nose.rotation.x = Math.PI;
  head.add(tag(nose, 'skull'));
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 20, Math.PI), matFor('mandible'));
  jaw.rotation.set(Math.PI / 2, 0, Math.PI);
  jaw.position.set(0, 0.04, 0.03);
  head.add(tag(jaw, 'mandible'));
  joint('sutures', V(0, 0.23, 0), head, 0.025);
  joint('neck', V(0, 0.01, 0), head, 0.022);
  // vertebrae: cervical in the neck, thoracic, lumbar
  const spineZ = (y: number) => -0.06 + 0.025 * Math.sin(((y - 1.0) / 0.53) * Math.PI * 1.5);
  const vert = (id: string, y: number, r: number, h: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), matFor(id));
    m.position.set(0, y, spineZ(y));
    body.add(tag(m, id));
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.008, h * 0.6, 0.03), matFor(id));
    spine.position.set(0, y, spineZ(y) - r - 0.01);
    body.add(tag(spine, id));
  };
  for (let i = 0; i < 7; i++) vert('cervical', 1.455 + i * 0.011, 0.016, 0.009);
  for (let i = 0; i < 12; i++) vert('thoracic', 1.165 + i * 0.024, 0.02, 0.019);
  for (let i = 0; i < 5; i++) vert('lumbar', 1.025 + i * 0.028, 0.026, 0.023);

  /* ---------- Rib cage ---------- */
  for (let i = 0; i < 12; i++) {
    const y = 1.42 - i * 0.022;
    const radius = 0.08 + Math.sin(((i + 1) / 13) * Math.PI) * 0.065;
    const floating = i >= 10;
    const arc = floating ? Math.PI * 0.55 : Math.PI * 1.75;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0065, 6, 32, arc), matFor('ribs'));
    rib.rotation.x = Math.PI / 2 + 0.25; // horizontal, sloping down at the front
    // Angle −π/2 is the back. True ribs leave a gap at the back for the spine;
    // floating ribs are a short arc centred on the back that ends at the sides.
    rib.rotation.z = floating ? -Math.PI / 2 - arc / 2 : -Math.PI / 2 + (Math.PI * 2 - arc) / 2;
    rib.scale.set(1.15, 0.9, 1);
    rib.position.set(0, y, -0.005);
    body.add(tag(rib, 'ribs'));
  }
  box('sternum', V(0, 1.33, 0.115), [0.032, 0.17, 0.014], body, [-0.2, 0, 0]);

  /* ---------- Shoulders and arms ---------- */
  const shoulders: T.Group[] = [];
  const elbows: T.Group[] = [];
  for (const s of [-1, 1]) {
    rod('clavicle', V(s * 0.025, 1.455, 0.08), V(s * 0.17, 1.47, 0.0), 0.007, body);
    const scap = new THREE.Shape();
    scap.moveTo(0, 0);
    scap.lineTo(s * 0.09, 0.02);
    scap.lineTo(s * 0.02, -0.13);
    scap.closePath();
    const scapula = new THREE.Mesh(new THREE.ExtrudeGeometry(scap, { depth: 0.01, bevelEnabled: false }), matFor('scapula'));
    scapula.position.set(s * 0.07, 1.44, -0.1);
    scapula.rotation.y = s * -0.35;
    body.add(tag(scapula, 'scapula'));

    const sh = new THREE.Group();
    sh.position.set(s * 0.19, 1.43, -0.01);
    body.add(sh);
    shoulders.push(sh);
    blob('humerus', V(0, 0, 0), [0.026, 0.026, 0.026], sh);
    rod('humerus', V(0, -0.02, 0), V(0, -0.3, 0), 0.012, sh, 0.012);
    joint('shoulder', V(0, 0, 0), sh);

    const el = new THREE.Group();
    el.position.set(0, -0.3, 0);
    sh.add(el);
    elbows.push(el);
    joint('elbow', V(0, 0, 0), el, 0.026);
    rod('ulna', V(-s * 0.012, -0.005, -0.008), V(-s * 0.014, -0.25, 0), 0.008, el, 0.006);
    rod('radius', V(s * 0.012, -0.01, 0.006), V(s * 0.02, -0.25, 0.006), 0.006, el, 0.009);

    // Hand (palm facing forward)
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.26, 0);
    el.add(wrist);
    joint('wrist', V(0, 0, 0), wrist, 0.022);
    for (let i = 0; i < 8; i++) box('carpals', V((i % 4) * 0.012 - 0.018, -0.01 - Math.floor(i / 4) * 0.013, 0), [0.011, 0.011, 0.012], wrist);
    for (let f = 0; f < 5; f++) {
      const thumb = f === 0;
      const x = s * (thumb ? 0.03 : 0.022 - (f - 1) * 0.013);
      const baseY = -0.03;
      const tipDir = thumb ? V(s * 0.6, -1, 0.3).normalize() : V(0, -1, 0);
      const mLen = thumb ? 0.04 : 0.065;
      const m0 = V(x * (thumb ? 0.6 : 1), baseY, 0);
      const m1 = m0.clone().add(tipDir.clone().multiplyScalar(mLen));
      rod('metacarpals', m0, m1, 0.0045, wrist, 0.004);
      if (thumb) joint('thumb', m0, wrist, 0.012);
      let p = m1;
      const segs = thumb ? [0.032, 0.026] : [0.04, 0.025, 0.02];
      for (const len of segs) {
        const q = p.clone().add(tipDir.clone().multiplyScalar(len + 0.004));
        rod('handPhalanges', p.clone().add(tipDir.clone().multiplyScalar(0.004)), q, 0.0035, wrist, 0.003);
        p = q;
      }
    }
  }

  /* ---------- Pelvis and legs ---------- */
  rod('sacrum', V(0, 1.02, -0.07), V(0, 0.9, -0.05), 0.035, body, 0.012);
  for (const s of [-1, 1]) {
    blob('pelvis', V(s * 0.095, 1.0, -0.015), [0.07, 0.06, 0.016], body, [0.15, s * 0.9, s * 0.25]);
    rod('pelvis', V(s * 0.09, 0.93, 0.0), V(s * 0.018, 0.9, 0.06), 0.011, body);
  }
  const hips: T.Group[] = [];
  const knees: T.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.09, 0.92, 0);
    body.add(hip);
    hips.push(hip);
    blob('femur', V(0, 0, 0), [0.025, 0.025, 0.025], hip);
    rod('femur', V(s * 0.02, -0.03, 0), V(-s * 0.015, -0.42, 0), 0.014, hip, 0.013);
    joint('hip', V(0, 0, 0), hip);

    const knee = new THREE.Group();
    knee.position.set(-s * 0.015, -0.43, 0);
    hip.add(knee);
    knees.push(knee);
    blob('femur', V(0, 0.012, 0), [0.03, 0.018, 0.025], knee);
    blob('patella', V(0, 0.01, 0.033), [0.02, 0.024, 0.008], knee);
    joint('knee', V(0, 0, 0), knee, 0.028);
    rod('tibia', V(0, -0.015, 0), V(0, -0.39, 0), 0.016, knee, 0.014);
    rod('fibula', V(s * 0.03, -0.03, -0.008), V(s * 0.03, -0.38, -0.004), 0.006, knee);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.41, 0);
    knee.add(ankle);
    joint('ankle', V(0, 0, 0), ankle, 0.022);
    box('tarsals', V(0, -0.02, 0.0), [0.04, 0.03, 0.05], ankle);
    blob('tarsals', V(0, -0.04, -0.035), [0.022, 0.022, 0.03], ankle); // heel
    box('tarsals', V(0, -0.035, 0.04), [0.05, 0.02, 0.03], ankle);
    for (let t = 0; t < 5; t++) {
      const x = -s * 0.022 + s * t * 0.011;
      const a = V(x, -0.04, 0.055);
      const b = V(x * 1.15, -0.06, 0.12 - t * 0.006);
      rod('metatarsals', a, b, 0.0045, ankle, 0.004);
      let p = b;
      for (const len of t === 0 ? [0.025, 0.02] : [0.018, 0.012, 0.01]) {
        const q = p.clone().add(V(0, -0.003, len));
        rod('footPhalanges', p.clone().add(V(0, 0, 0.003)), q, 0.0035, ankle, 0.003);
        p = q;
      }
    }
  }

  /* ---------- Pose, colours and picking ---------- */
  const rad = (d: number) => (d * Math.PI) / 180;
  applyPose = () => {
    head.rotation.y = rad(st.head);
    shoulders.forEach((g, i) => (g.rotation.z = (i === 0 ? -1 : 1) * rad(st.arms)));
    elbows.forEach((g) => (g.rotation.x = -rad(st.elbows)));
    // Only the right leg moves, so the skeleton keeps standing on the left
    hips[0].rotation.x = -rad(st.hip);
    knees[0].rotation.x = rad(st.knee);
    view?.requestRender();
  };

  const accent = view.cssColor('accent');
  recolour = () => {
    for (const [id, m] of boneMats) {
      const type = BONES[id].type;
      m.color.set(st.colour === 'type' ? BONE_TYPE[type].colour : '#e9e1cf');
      const on = id === st.selected;
      m.emissive.copy(on ? accent : new THREE.Color(0));
      m.emissiveIntensity = on ? 0.55 : 0;
    }
    for (const j of jointMeshes) {
      j.visible = st.joints;
      const mat = j.material as T.MeshStandardMaterial;
      mat.emissive.copy(j.userData.joint === st.selected ? accent : new THREE.Color(0));
      mat.emissiveIntensity = j.userData.joint === st.selected ? 0.8 : 0;
    }
    view?.requestRender();
  };

  view.onPick(
    () => [body],
    (hit, at) => {
      const id = (hit?.object.userData.joint ?? hit?.object.userData.bone) as string | undefined;
      if (!id) return;
      select(id);
      const title = BONES[id]?.name ?? JOINTS[id].name;
      const text = BONES[id] ? `${BONE_TYPE[BONES[id].type].name}. ${BONES[id].about}` : `${JOINT_TYPE[JOINTS[id].type].name}. ${JOINTS[id].about}`;
      sim.showTooltip(at.x, at.y, title, text);
    },
    // Hidden joint markers must not be picked
    (hit) => hit.object.visible && (!hit.object.userData.joint || st.joints),
  );

  applyPose();
  recolour();
  sim.setLoading(null);
  view.requestRender();
}
