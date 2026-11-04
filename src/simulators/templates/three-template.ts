import type * as T from 'three';
import { createSimController } from '../shared/controller';
import { controls } from '../shared/controls';
import { createThreeScene, WebGLUnavailableError } from '../shared/three';

interface ShapeInfo {
  name: string;
  about: string;
  volume: (s: number) => number;
  area: (s: number) => number;
}

const INFO: Record<string, ShapeInfo> = {
  cube: {
    name: 'Cube (side 1)',
    about: 'Six square faces. V = s³, A = 6s².',
    volume: (s) => s ** 3,
    area: (s) => 6 * s ** 2,
  },
  sphere: {
    name: 'Sphere (radius 0.6)',
    about: 'Every surface point is the same distance from the centre. V = 4⁄3πr³, A = 4πr².',
    volume: (s) => (4 / 3) * Math.PI * (0.6 * s) ** 3,
    area: (s) => 4 * Math.PI * (0.6 * s) ** 2,
  },
  cone: {
    name: 'Cone (radius 0.6, height 1.2)',
    about: 'A circular base narrowing to a point. V = ⅓πr²h.',
    volume: (s) => (1 / 3) * Math.PI * (0.6 * s) ** 2 * (1.2 * s),
    area: (s) => {
      const r = 0.6 * s;
      const h = 1.2 * s;
      return Math.PI * r * (r + Math.hypot(r, h));
    },
  },
};

export async function initThreeTemplate(root: HTMLElement) {
  const container = root.querySelector<HTMLElement>('[data-three]')!;
  const state = { size: 1, spin: true, selected: null as string | null };

  const ui = controls(root);
  const sim = createSimController(root, {
    render: () => view?.requestRender(),
    reset() {
      sizeCtl.set(1);
      spinCtl.set(true);
      select(null);
      view?.resetView();
    },
  });

  let view: Awaited<ReturnType<typeof createThreeScene>> | null = null;
  try {
    view = await createThreeScene(container, {
      label: 'A cube, a sphere and a cone. Drag to rotate, click a shape for details.',
      camera: { position: [0, 2.2, 6] },
      onFrame: (dt) => group.rotation.y += dt * 0.35,
    });
  } catch (err) {
    sim.fail(
      err instanceof WebGLUnavailableError
        ? 'Your browser or device does not support 3D graphics (WebGL), so this model cannot be shown. The explanation and quiz below still work.'
        : undefined,
    );
    return;
  }
  const { THREE, scene } = view;

  // Build the shapes. Theme-aware colours come from CSS tokens.
  const group = new THREE.Group();
  scene.add(group);
  const mat = (token: string) => new THREE.MeshStandardMaterial({ color: view!.cssColor(token), roughness: 0.45, metalness: 0.05 });
  const meshes: Record<string, T.Mesh> = {
    cube: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat('accent')),
    sphere: new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 32), mat('accent-2')),
    cone: new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 48), mat('sim-solute')),
  };
  meshes.cube.position.x = -2;
  meshes.cone.position.x = 2;
  for (const [id, m] of Object.entries(meshes)) {
    m.userData.id = id;
    group.add(m);
  }
  const grid = new THREE.GridHelper(8, 16, view.cssColor('border-strong'), view.cssColor('sim-grid'));
  grid.position.y = -1;
  scene.add(grid);

  function select(id: string | null) {
    state.selected = id;
    for (const [k, m] of Object.entries(meshes)) {
      (m.material as T.MeshStandardMaterial).emissive.setHex(k === id ? 0x333333 : 0x000000);
    }
    updateReadouts();
    view?.requestRender();
  }

  function updateReadouts() {
    const info = state.selected ? INFO[state.selected] : null;
    ui.readout('sel', info ? info.name : 'None');
    ui.readout('vol', info ? `${info.volume(state.size).toFixed(3)} units³` : '—');
    ui.readout('area', info ? `${info.area(state.size).toFixed(3)} units²` : '—');
  }

  view.onPick(
    () => Object.values(meshes),
    (hit, at) => {
      const id = (hit?.object.userData.id as string | undefined) ?? null;
      select(id);
      if (id) sim.showTooltip(at.x, at.y, INFO[id].name, INFO[id].about);
      else sim.hideTooltip();
    },
  );

  const sizeCtl = ui.range('three-size', (v) => `${v.toFixed(2)}×`, (v) => {
    state.size = v;
    group.scale.setScalar(v);
    updateReadouts();
    view?.requestRender();
  });
  const spinCtl = ui.toggle('three-spin', (v) => {
    state.spin = v;
    view?.setAnimating(v && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });

  view.setAnimating(state.spin && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  sim.setLoading(null);
  updateReadouts();
}
