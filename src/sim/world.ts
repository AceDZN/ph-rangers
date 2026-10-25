// The valley grid: every cell is a zone with water volume, signed acid/base excess, salt,
// undissolved weak base and released heat. Spreading moves amounts, never creates them.

import { netForPH, phFromNet } from './chem';
import { GALILEE, Layout, distToPolyline, inRect, terrainHeight } from './layout';

export enum Kind {
  Soil = 0,
  Path = 1,
  Creek = 2,
  Pond = 3,
  Blueberry = 4,
  Hive = 5,
  School = 6,
  Quarry = 7,
  Orchard = 8,
}

export const KNOW_LITMUS = 1;
export const KNOW_PHENOL = 2;
export const KNOW_UNIVERSAL = 4;

export interface Band {
  lo: number;
  hi: number;
}

export const BANDS: Record<Kind, Band> = {
  [Kind.Soil]: { lo: 6, hi: 8 },
  [Kind.Path]: { lo: 6, hi: 8 },
  [Kind.Creek]: { lo: 6, hi: 8.5 },
  [Kind.Pond]: { lo: 6.5, hi: 8.5 },
  [Kind.Blueberry]: { lo: 4.5, hi: 5.5 },
  [Kind.Hive]: { lo: 6, hi: 8.5 },
  [Kind.School]: { lo: 6, hi: 8.5 },
  [Kind.Quarry]: { lo: 6, hi: 8.5 },
  [Kind.Orchard]: { lo: 6, hi: 8 },
};

/** Litres of soil water and buffer (mol per pH unit, active pH 4–9) per cell kind. */
const SOIL: Record<Kind, { v0: number; beta: number }> = {
  [Kind.Soil]: { v0: 20, beta: 0.0015 },
  [Kind.Path]: { v0: 20, beta: 0.0015 },
  [Kind.Creek]: { v0: 20, beta: 0.0015 },
  [Kind.Pond]: { v0: 400, beta: 0.055 },
  [Kind.Blueberry]: { v0: 20, beta: 0.005 },
  [Kind.Hive]: { v0: 20, beta: 0.0015 },
  [Kind.School]: { v0: 20, beta: 0.001 },
  [Kind.Quarry]: { v0: 20, beta: 0.0015 },
  [Kind.Orchard]: { v0: 20, beta: 0.0025 },
};

export interface Source {
  cell: number;
  /** Signed excess per second (+ acid, − base). */
  excessPerSec: number;
  waterPerSec: number;
  from: number;
  to: number;
}

export interface Rain {
  /** Cells with x between x0 and x1 (metres) get rain this step. */
  x0: number;
  x1: number;
  acidPerSec: number;
  waterPerSec: number;
}

export interface Ledger {
  acidIn: number;
  baseIn: number;
  weakIn: number;
  salt: number;
  waterIn: number;
}

const RUNOFF_RATE = 0.9; // fraction of excess water leaving per second
const INFILTRATION = 0.12; // excess water soaking in per second
const DIFFUSION = 0.012; // soil-to-soil mixing per second
const CREEK_FLOW = 0.22; // fraction of a creek cell's contents moving downstream per second
const WEAK_RATE = 0.003; // mol/s a weak-base canister can release per cell (slow)
const WEAK_CAP = 8.5; // a weak base cannot push pH above this
const HEAT_DECAY = 1.6;

export class Grid {
  readonly layout: Layout;
  readonly n: number;
  readonly cell: number;
  readonly count: number;
  readonly E: Float64Array;
  readonly V: Float64Array;
  readonly V0: Float64Array;
  readonly beta: Float64Array;
  readonly S: Float64Array;
  readonly W: Float64Array;
  readonly heat: Float64Array;
  readonly pH: Float64Array;
  readonly kind: Uint8Array;
  readonly h: Float32Array;
  readonly down: Int32Array;
  readonly know: Uint8Array;
  readonly bloom: Float32Array;
  readonly scarred: Uint8Array;
  /** Ground a ranger has reason to suspect (reported spills, sprayed cells). Never derived from pH. */
  readonly suspect: Uint8Array;
  readonly creekCells: number[] = [];
  readonly pondCells: number[] = [];
  readonly ledger: Ledger = { acidIn: 0, baseIn: 0, weakIn: 0, salt: 0, waterIn: 0 };
  private dirty: Uint8Array;
  /** Reaction heat produced during the last step, for sound/FX. */
  lastReacted = 0;

  constructor(layout: Layout = GALILEE) {
    this.layout = layout;
    this.cell = layout.cell;
    this.n = Math.round(layout.size / layout.cell);
    this.count = this.n * this.n;
    const c = this.count;
    this.E = new Float64Array(c);
    this.V = new Float64Array(c);
    this.V0 = new Float64Array(c);
    this.beta = new Float64Array(c);
    this.S = new Float64Array(c);
    this.W = new Float64Array(c);
    this.heat = new Float64Array(c);
    this.pH = new Float64Array(c).fill(7);
    this.kind = new Uint8Array(c);
    this.h = new Float32Array(c);
    this.down = new Int32Array(c).fill(-1);
    this.know = new Uint8Array(c);
    this.bloom = new Float32Array(c);
    this.scarred = new Uint8Array(c);
    this.suspect = new Uint8Array(c);
    this.dirty = new Uint8Array(c);
    this.classify();
    for (let i = 0; i < c; i++) {
      const s = SOIL[this.kind[i] as Kind];
      this.V0[i] = s.v0;
      this.V[i] = s.v0;
      this.beta[i] = s.beta;
    }
  }

  idx(i: number, j: number): number {
    return j * this.n + i;
  }

  /** Cell index containing world point x, z (clamped to the map). */
  cellAt(x: number, z: number): number {
    const i = Math.min(this.n - 1, Math.max(0, Math.floor(x / this.cell)));
    const j = Math.min(this.n - 1, Math.max(0, Math.floor(z / this.cell)));
    return this.idx(i, j);
  }

  center(c: number): [number, number] {
    const i = c % this.n;
    const j = Math.floor(c / this.n);
    return [(i + 0.5) * this.cell, (j + 0.5) * this.cell];
  }

  neighbours(c: number): number[] {
    const i = c % this.n;
    const j = Math.floor(c / this.n);
    const out: number[] = [];
    if (i > 0) out.push(c - 1);
    if (i < this.n - 1) out.push(c + 1);
    if (j > 0) out.push(c - this.n);
    if (j < this.n - 1) out.push(c + this.n);
    return out;
  }

  /** Cells whose centres lie within `r` metres of x, z. */
  cellsInRadius(x: number, z: number, r: number): number[] {
    const out: number[] = [];
    for (let c = 0; c < this.count; c++) {
      const [cx, cz] = this.center(c);
      if (Math.hypot(cx - x, cz - z) <= r) out.push(c);
    }
    return out;
  }

  band(c: number): Band {
    return BANDS[this.kind[c] as Kind];
  }

  private classify() {
    const L = this.layout;
    for (let c = 0; c < this.count; c++) {
      const [x, z] = this.center(c);
      this.h[c] = terrainHeight(L, x, z);
      let k = Kind.Soil;
      if (Math.hypot(x - L.quarry.x, z - L.quarry.z) < L.quarry.r) k = Kind.Quarry;
      if (inRect(L.terraces, x, z)) k = Kind.Orchard;
      if (inRect(L.blueberry, x, z)) k = Kind.Blueberry;
      if (distToPolyline(x, z, L.road) < 1.6) k = Kind.Path;
      if (L.hives.some((h) => Math.hypot(x - h[0], z - h[1]) < 4.2)) k = Kind.Hive;
      if (Math.hypot(x - L.school.x, z - (L.school.z - 6)) < 5) k = Kind.School;
      if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pond.r) k = Kind.Pond;
      this.kind[c] = k;
      if (k === Kind.Pond) this.pondCells.push(c);
    }
    // Rasterise the creek into an ordered, 4-connected chain of cells.
    const chain: number[] = [];
    const push = (c: number) => {
      if (this.kind[c] === Kind.Pond) return;
      if (chain[chain.length - 1] !== c) chain.push(c);
    };
    for (let s = 0; s < L.creek.length - 1; s++) {
      const a = L.creek[s];
      const b = L.creek[s + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.ceil(len / 0.25);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const c = this.cellAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        const last = chain[chain.length - 1];
        if (last !== undefined && last !== c && this.kind[c] !== Kind.Pond) {
          const li = last % this.n;
          const lj = Math.floor(last / this.n);
          const ci = c % this.n;
          const cj = Math.floor(c / this.n);
          if (li !== ci && lj !== cj) push(this.idx(ci, lj));
        }
        push(c);
      }
    }
    for (const c of chain) this.kind[c] = Kind.Creek;
    for (let k = 0; k < chain.length - 1; k++) this.down[chain[k]] = chain[k + 1];
    // The last creek cell drains into the nearest pond cell.
    if (chain.length && this.pondCells.length) {
      const [lx, lz] = this.center(chain[chain.length - 1]);
      let best = this.pondCells[0];
      let bd = Infinity;
      for (const p of this.pondCells) {
        const [px, pz] = this.center(p);
        const d = Math.hypot(px - lx, pz - lz);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      this.down[chain[chain.length - 1]] = best;
    }
    this.creekCells.push(...chain);
  }

  // ---------- amounts ----------

  /** Add signed excess to a cell; opposite excesses react to salt + water and release heat. */
  addExcess(c: number, amount: number) {
    if (amount === 0) return;
    const e = this.E[c];
    if (e * amount < 0) {
      const r = Math.min(Math.abs(e), Math.abs(amount));
      this.S[c] += r;
      this.heat[c] += r;
      this.ledger.salt += r;
      this.lastReacted += r;
    }
    this.E[c] = e + amount;
    this.dirty[c] = 1;
  }

  /** External input of acid/base (spray, spill source, rain). Updates the ledger. */
  inject(c: number, amount: number, litres: number) {
    if (amount > 0) this.ledger.acidIn += amount;
    else this.ledger.baseIn -= amount;
    if (litres > 0) {
      this.V[c] += litres;
      this.ledger.waterIn += litres;
    }
    this.addExcess(c, amount);
    this.dirty[c] = 1;
  }

  /** Drop undissolved weak base (antacid-style) into a cell. */
  addWeakBase(c: number, amount: number) {
    this.W[c] += amount;
    this.ledger.weakIn += amount;
  }

  /** Set a cell to a given pH by placing the needed excess (used to author spills). */
  setPH(c: number, pH: number) {
    const target = netForPH(pH, this.V[c], this.beta[c]);
    const delta = target - this.E[c];
    this.inject(c, delta, 0);
    this.heat[c] = 0;
  }

  private move(from: number, to: number, frac: number) {
    if (frac <= 0) return;
    const e = this.E[from] * frac;
    const s = this.S[from] * frac;
    const w = this.W[from] * frac;
    this.E[from] -= e;
    this.S[from] -= s;
    this.W[from] -= w;
    this.S[to] += s;
    this.W[to] += w;
    this.addExcess(to, e);
    this.dirty[from] = 1;
  }

  // ---------- step ----------

  step(dt: number, t: number, sources: Source[] = [], rain: Rain | null = null) {
    this.lastReacted = 0;
    for (const s of sources) {
      if (t >= s.from && t < s.to) this.inject(s.cell, s.excessPerSec * dt, s.waterPerSec * dt);
    }
    if (rain) {
      for (let c = 0; c < this.count; c++) {
        const [x] = this.center(c);
        if (x >= rain.x0 && x <= rain.x1) this.inject(c, rain.acidPerSec * dt, rain.waterPerSec * dt);
      }
    }
    this.releaseWeakBase(dt);
    this.flowCreek(dt);
    this.runoff(dt);
    this.diffuse(dt);
    this.mixPond();
    for (let c = 0; c < this.count; c++) {
      if (this.heat[c] > 0) this.heat[c] = Math.max(0, this.heat[c] - this.heat[c] * HEAT_DECAY * dt - 1e-5);
    }
    this.refreshPH();
  }

  private releaseWeakBase(dt: number) {
    for (let c = 0; c < this.count; c++) {
      const w = this.W[c];
      if (w <= 0) continue;
      const need = this.E[c] - netForPH(WEAK_CAP, this.V[c], this.beta[c]);
      if (need <= 0) continue;
      const r = Math.min(w, WEAK_RATE * dt, need);
      this.W[c] -= r;
      this.ledger.baseIn += r;
      this.ledger.weakIn -= r;
      this.addExcess(c, -r);
    }
  }

  private flowCreek(dt: number) {
    const frac = Math.min(1, CREEK_FLOW * dt);
    // Walk downstream-first so a parcel moves at most one cell per step.
    for (let k = this.creekCells.length - 1; k >= 0; k--) {
      const c = this.creekCells[k];
      const d = this.down[c];
      if (d < 0) continue;
      this.move(c, d, frac);
      const extra = this.V[c] - this.V0[c];
      if (extra > 0) {
        const q = extra * Math.min(1, 2 * dt);
        this.V[c] -= q;
        this.V[d] += q;
      }
    }
  }

  private runoff(dt: number) {
    for (let c = 0; c < this.count; c++) {
      const k = this.kind[c];
      if (k === Kind.Pond || k === Kind.Creek) continue;
      const extra = this.V[c] - this.V0[c];
      if (extra <= 0.01) {
        if (extra > 0) this.V[c] = this.V0[c];
        continue;
      }
      const surf = this.h[c] + extra * 0.01;
      const nb = this.neighbours(c);
      let total = 0;
      const drops: number[] = [];
      for (const o of nb) {
        const oe = Math.max(0, this.V[o] - this.V0[o]);
        const d = surf - (this.h[o] + oe * 0.01);
        drops.push(d > 0 ? d : 0);
        total += d > 0 ? d : 0;
      }
      const leave = extra * Math.min(1, RUNOFF_RATE * dt);
      if (total > 0) {
        for (let n = 0; n < nb.length; n++) {
          if (drops[n] <= 0) continue;
          const q = (leave * drops[n]) / total;
          const frac = q / this.V[c];
          this.move(c, nb[n], frac);
          this.V[c] -= q;
          this.V[nb[n]] += q;
        }
      }
      const soak = (this.V[c] - this.V0[c]) * Math.min(1, INFILTRATION * dt);
      if (soak > 0) this.V[c] -= soak;
      this.dirty[c] = 1;
    }
    // The pond slowly evaporates back toward its normal level.
    for (const p of this.pondCells) {
      const extra = this.V[p] - this.V0[p];
      if (extra > 0) this.V[p] -= extra * Math.min(1, 0.05 * dt);
    }
  }

  /** Move a signed amount between two cells; any cancellation forms salt + heat in `to`. */
  private transfer(from: number, to: number, amount: number) {
    const before = Math.abs(this.E[from]) + Math.abs(this.E[to]);
    this.E[from] -= amount;
    this.E[to] += amount;
    const r = (before - Math.abs(this.E[from]) - Math.abs(this.E[to])) / 2;
    if (r > 1e-15) {
      this.S[to] += r;
      this.heat[to] += r;
      this.ledger.salt += r;
      this.lastReacted += r;
    }
    this.dirty[from] = 1;
    this.dirty[to] = 1;
  }

  private diffuse(dt: number) {
    const k = Math.min(0.2, DIFFUSION * dt);
    const n = this.n;
    for (let c = 0; c < this.count; c++) {
      if (!soilLike(this.kind[c])) continue;
      const i = c % n;
      // Only right and down neighbours so every pair is visited once.
      const pair = (o: number) => {
        if (!soilLike(this.kind[o]) || !sameSoil(this.kind[c], this.kind[o])) return;
        const ca = this.E[c] / this.V[c];
        const cb = this.E[o] / this.V[o];
        if (Math.abs(ca - cb) < 1e-10) return;
        this.transfer(c, o, k * (ca - cb) * Math.min(this.V[c], this.V[o]) * 0.5);
      };
      if (i < n - 1) pair(c + 1);
      if (c + n < this.count) pair(c + n);
    }
  }

  private mixPond() {
    const P = this.pondCells;
    if (!P.length) return;
    let e = 0;
    let v = 0;
    let s = 0;
    let w = 0;
    let anyDirty = false;
    for (const p of P) {
      e += this.E[p];
      v += this.V[p];
      s += this.S[p];
      w += this.W[p];
      if (this.dirty[p]) anyDirty = true;
    }
    if (!anyDirty) return;
    for (const p of P) {
      this.E[p] = e / P.length;
      this.V[p] = v / P.length;
      this.S[p] = s / P.length;
      this.W[p] = w / P.length;
      this.dirty[p] = 1;
    }
  }

  refreshPH(all = false) {
    for (let c = 0; c < this.count; c++) {
      if (!all && !this.dirty[c]) continue;
      this.pH[c] = phFromNet(this.E[c], this.V[c], this.beta[c]);
      this.dirty[c] = 0;
    }
  }

  /** pH of a group of cells treated as one zone (sum of amounts, volumes, buffers). */
  zonePH(cells: number[]): number {
    let e = 0;
    let v = 0;
    let b = 0;
    for (const c of cells) {
      e += this.E[c];
      v += this.V[c];
      b += this.beta[c];
    }
    return phFromNet(e, v, b);
  }

  totalExcess(): number {
    let e = 0;
    for (let c = 0; c < this.count; c++) e += this.E[c];
    return e;
  }

  totalSalt(): number {
    let s = 0;
    for (let c = 0; c < this.count; c++) s += this.S[c];
    return s;
  }

  totalWeak(): number {
    let w = 0;
    for (let c = 0; c < this.count; c++) w += this.W[c];
    return w;
  }

  inBand(c: number, tol = 0): boolean {
    const b = this.band(c);
    const p = this.pH[c];
    return p >= b.lo - tol && p <= b.hi + tol;
  }
}

/** Blueberry beds are walled peat: they only mix with each other. */
function sameSoil(a: number, b: number): boolean {
  return (a === Kind.Blueberry) === (b === Kind.Blueberry);
}

function soilLike(k: number): boolean {
  return k !== Kind.Pond && k !== Kind.Creek;
}
