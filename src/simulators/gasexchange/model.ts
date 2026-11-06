/**
 * Gas exchange models (illustrative units, real shapes).
 *
 * Diffusion follows Fick's law: rate ∝ area × (difference in partial
 * pressure) ÷ barrier thickness. Blood carries oxygen bound to haemoglobin,
 * with a sigmoid saturation curve S(P) = Pⁿ / (Pⁿ + P50ⁿ), n = 2.7, P50 = 26 mmHg.
 *
 * Fish gill lamella: water and blood flow past each other, either in opposite
 * directions (countercurrent) or the same direction (parallel). Water carries
 * little oxygen, so its partial pressure falls as it gives oxygen up. The
 * countercurrent case is solved exactly by "shooting": guess the outflowing
 * water's PO₂ and bisect until the inflowing water matches.
 *
 * Mammal lung: alveolar air is well mixed (constant PO₂); blood picks up
 * oxygen along the capillary.
 *
 * Insect tracheae: oxygen diffuses from the spiracle down the tracheal tubes
 * to the tissues. With a steady demand, PO₂ falls linearly along the diffusion
 * path; flight raises demand enormously, and pumping (active ventilation)
 * shortens the distance that must be covered by diffusion alone.
 */
export const S = (P: number) => {
  const p = Math.max(P, 0);
  return Math.pow(p, 2.7) / (Math.pow(p, 2.7) + Math.pow(26, 2.7));
};
export const invS = (c: number) => {
  const x = Math.min(Math.max(c, 1e-9), 0.99999);
  return 26 * Math.pow(x / (1 - x), 1 / 2.7);
};

const N = 160;
const GW = 0.0035; // oxygen capacity of the water stream relative to the blood stream
const K0 = 3; // exchange constant with normal area and barrier

export interface Profile {
  x: number[];
  medium: number[];
  blood: number[];
}

/** One step of exchange that never lets blood overshoot the water or air beside it. */
function exchange(pm: number, pb: number, cb: number, k: number) {
  let J = (k * (pm - pb)) / N * 0.01;
  let cb2 = cb + J;
  let pb2 = invS(cb2);
  if ((J > 0 && pb2 > pm) || (J < 0 && pb2 < pm)) {
    cb2 = S(pm);
    pb2 = pm;
    J = cb2 - cb;
  }
  return { J, cb: cb2, pb: pb2 };
}

export function gill(counter: boolean, avail: number, area: number, thick: number, active = false) {
  const Pw0 = 155 * avail;
  // when active, blood returns with less oxygen and spends less time in the gill
  const Pb0 = active ? 15 : 25;
  const k = (K0 * area) / thick / (active ? 1.5 : 1);
  // an active fish also pumps more water over its gills
  const gw = GW * (active ? 1.8 : 1);
  const integ = (pwStart: number) => {
    let pw = pwStart;
    let cb = S(Pb0);
    let pb = Pb0;
    const prof: Profile = { x: [0], medium: [pw], blood: [pb] };
    for (let i = 0; i < N; i++) {
      const e = exchange(pw, pb, cb, k);
      cb = e.cb;
      pb = e.pb;
      pw += counter ? e.J / gw : -e.J / gw;
      prof.x.push((i + 1) / N);
      prof.medium.push(pw);
      prof.blood.push(pb);
    }
    return { pw, pb, prof };
  };
  let res;
  if (!counter) res = integ(Pw0);
  else {
    let lo = 0;
    let hi = Pw0;
    for (let it = 0; it < 50; it++) {
      const m = (lo + hi) / 2;
      if (integ(m).pw > Pw0) hi = m;
      else lo = m;
    }
    res = integ((lo + hi) / 2);
  }
  const waterOut = counter ? res.prof.medium[0] : res.pw;
  return { bloodOut: res.pb, satOut: S(res.pb), satIn: S(Pb0), waterIn: Pw0, waterOut, extraction: Pw0 > 0 ? 1 - waterOut / Pw0 : 0, uptake: gw * (Pw0 - waterOut), prof: res.prof };
}

export function lung(avail: number, area: number, thick: number, active = false) {
  const PA = 100 * avail;
  // exercise: blood returns with less oxygen and passes through the capillary about three times faster
  const Pb0 = active ? 25 : 40;
  const k = (1.6 * K0 * area) / thick / (active ? 3 : 1);
  let cb = S(Pb0);
  let pb = Pb0;
  const prof: Profile = { x: [0], medium: [PA], blood: [pb] };
  for (let i = 0; i < N; i++) {
    const e = exchange(PA, pb, cb, k);
    cb = e.cb;
    pb = e.pb;
    prof.x.push((i + 1) / N);
    prof.medium.push(PA);
    prof.blood.push(pb);
  }
  return { bloodOut: pb, satOut: S(pb), satIn: S(Pb0), alveolar: PA, uptake: S(pb) - S(Pb0), prof };
}

export function trachea(avail: number, area: number, length: number, flying: boolean) {
  const Pair = 159 * avail; // 21% of sea-level air pressure
  const demand = flying ? 40 : 1; // flight muscle uses many times more oxygen
  // pumping (abdominal ventilation) carries air by bulk flow through the big tubes,
  // leaving only the fine branches to diffusion
  const diffusionLength = length * (flying ? 0.12 : 1);
  const drop = (6 * demand * diffusionLength) / area; // PO₂ fall along the diffusion path (mmHg)
  const tip = Pair - drop;
  const prof: Profile = { x: [], medium: [], blood: [] };
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    // bulk flow keeps PO₂ almost at air level through the pumped part, then it falls
    const pumped = flying ? Math.min(1, f / 0.88) : 0;
    const p = flying ? (f < 0.88 ? Pair - 0.03 * drop * pumped : Pair - 0.03 * drop - 0.97 * drop * ((f - 0.88) / 0.12)) : Pair - drop * f;
    prof.x.push(f);
    prof.medium.push(Math.max(0, p));
  }
  return { air: Pair, tip, ok: tip > 20, demand, prof };
}
