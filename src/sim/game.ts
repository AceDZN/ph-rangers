// Game state: ranger movement, the three-valve tank, indicator gadgets, spray packets,
// mission win/fail and learning events. Pure TypeScript; the renderer only reads it.

import { Strength, Valve, litmus, phClass, phFromNet, phenolphthalein, sprayExcess, sprayPH, universal } from './chem';
import { Circle, colliders, terrainHeight } from './layout';
import { Loadout, MISSIONS, MissionDef } from './missions';
import { Grid, KNOW_LITMUS, KNOW_PHENOL, KNOW_UNIVERSAL, Kind } from './world';

export type Gadget = 'litmus' | 'phenol' | 'mist' | 'canister';
export type Status = 'play' | 'won' | 'failed';

export interface Input {
  /** Camera-relative stick: x right, z forward, each −1..1. */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  spray: boolean;
  /** Camera yaw; forward = (sin yaw, cos yaw) in world x, z. */
  yaw: number;
  /** Aim point on the ground (world metres). */
  aimX: number;
  aimZ: number;
}

export const NO_INPUT: Input = { moveX: 0, moveZ: 0, sprint: false, spray: false, yaw: 0, aimX: 0, aimZ: 0 };

export interface Packet {
  valve: Valve;
  strength: Strength;
  litres: number;
  excess: number;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t0: number;
  tf: number;
}

export interface Throw {
  kind: Gadget;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t0: number;
  tf: number;
}

export interface Marker {
  cell: number;
  x: number;
  z: number;
}

export interface AssetState {
  id: string;
  name: string;
  icon: string;
  lo: number;
  hi: number;
  decay: number;
  cells: number[];
  at: [number, number];
  health: number;
  pH: number;
  minHealth: number;
}

export type FxEvent =
  | { type: 'land'; x: number; z: number; valve: Valve }
  | { type: 'fizz'; x: number; z: number; amount: number }
  | { type: 'overshoot'; x: number; z: number; pH: number; dir: 'acid' | 'base' }
  | { type: 'inband'; x: number; z: number }
  | { type: 'restored'; x: number; z: number; points: number; combo: number }
  | { type: 'gadget'; kind: Gadget; x: number; z: number }
  | { type: 'throw'; kind: Gadget }
  | { type: 'refill' }
  | { type: 'unlock' }
  | { type: 'empty' }
  | { type: 'won' }
  | { type: 'failed'; reason: string }
  | { type: 'asset-hurt'; id: string }
  | { type: 'toast'; text: string };

export interface LearnEvent {
  mission: string;
  t: number;
  action: string;
  cell?: number;
  pH?: number;
  value?: string;
  hintUsed: boolean;
  attempt: number;
  first?: boolean;
}

export const SPRAY_LPS = 0.8; // litres per second through the nozzle
export const PACKET_DT = 0.05; // one puff
export const SPRAY_RANGE = 15;
export const GADGET_RADIUS = 9;
const GRID_DT = 0.05;
const WIN_HOLD = 1.5;
/** Seconds for one universal-indicator mist charge to refill on its own. */
export const MIST_RECHARGE = 9;
const COMBO_WINDOW = 5;
/** Seconds a cell must stay clearly out of band before its plants visibly wilt. */
const WILT_TIME = 4;

export class Game {
  mission!: MissionDef;
  grid!: Grid;
  t = 0;
  status: Status = 'play';
  failReason = '';
  stars = 0;
  player = { x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, speed: 0, spraying: false };
  aim = { x: 0, z: 0, cell: 0 };
  tank = { valve: 'base' as Valve, strength: 1 as Strength, acid: 0, base: 0, water: 0, strength10: false };
  gadgets = { litmus: 0, phenol: 0, mist: 0, canister: 0 };
  packets: Packet[] = [];
  throws: Throw[] = [];
  markers: Marker[] = [];
  assets: AssetState[] = [];
  spill: number[] = [];
  decoys: number[] = [];
  stats = { chem: 0, water: 0, puffs: 0, refills: 0 };
  /** Points for ground brought back into its band (measured cells only, once each). */
  score = 0;
  combo = 0;
  bestCombo = 0;
  private lastRestore = -10;
  private restored = new Set<number>();
  /** 0..1 progress of the next mist charge. */
  mistCharge = 0;
  /** Each spill patch's pH at the start, for the results card. */
  startPH: number[] = [];
  private wilt = new Float32Array(0);
  tutorialStep = 0;
  hint = '';
  hintIndex = 0;
  hintsUsed = 0;
  refillT = 0;
  holdT = 0;
  events: LearnEvent[] = [];
  fx: FxEvent[] = [];
  attempts: Record<string, number> = {};
  private colliders: Circle[] = [];
  private sprayWas = false;
  private sprayTimer = 0;
  private sprayHeld = 0;
  private gridAcc = 0;
  private throwCd = 0;
  private firstSpray = true;
  private lastOvershoot = -10;
  private lastInband = -10;
  private emptyNotified = -10;

  constructor(missionId = MISSIONS[0].id) {
    this.load(missionId);
  }

  get loadout(): Loadout {
    return this.mission.loadout;
  }

  load(missionId: string) {
    const m = MISSIONS.find((x) => x.id === missionId) ?? MISSIONS[0];
    this.mission = m;
    this.grid = new Grid(m.layout);
    // Blueberry beds are naturally acidic peat (pH 5) unless a mission says otherwise.
    for (let c = 0; c < this.grid.count; c++) if (this.grid.kind[c] === Kind.Blueberry) this.grid.setPH(c, 5);
    const placed = m.setup(this.grid);
    this.spill = placed.spill;
    this.decoys = placed.decoys ?? [];
    // Reported ground: the spill patches, dust patches, leak points and their neighbours.
    const reported = [...this.spill, ...this.decoys, ...(m.sources ? m.sources(this.grid).map((x) => x.cell) : [])];
    for (const c of reported) {
      this.grid.suspect[c] = 1;
      for (const n of this.grid.neighbours(c)) this.grid.suspect[n] = 1;
    }
    this.grid.refreshPH(true);
    this.startPH = this.spill.map((c) => this.grid.pH[c]);
    this.t = 0;
    this.status = 'play';
    this.failReason = '';
    this.stars = 0;
    this.player = { x: m.start.x, z: m.start.z, y: 0, yaw: m.start.yaw, vx: 0, vz: 0, speed: 0, spraying: false };
    this.player.y = terrainHeight(m.layout, m.start.x, m.start.z);
    const L = m.loadout;
    this.tank = { valve: 'base', strength: 1, acid: L.acid, base: L.base, water: L.water, strength10: m.strength10 === 'yes' };
    this.gadgets = { litmus: L.litmus, phenol: L.phenol, mist: L.mist, canister: L.canister };
    this.packets = [];
    this.throws = [];
    this.markers = [];
    this.assets = m.assets.map((a) => {
      const cells = a.cells(this.grid);
      return { id: a.id, name: a.name, icon: a.icon, lo: a.lo, hi: a.hi, decay: a.decay, cells, at: a.at, health: 100, pH: this.grid.zonePH(cells), minHealth: 100 };
    });
    this.stats = { chem: 0, water: 0, puffs: 0, refills: 0 };
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lastRestore = -10;
    this.restored = new Set();
    this.mistCharge = 0;
    this.wilt = new Float32Array(this.grid.count);
    this.tutorialStep = 0;
    this.hint = '';
    this.hintIndex = 0;
    this.hintsUsed = 0;
    this.refillT = 0;
    this.holdT = 0;
    this.fx = [];
    this.colliders = colliders(m.layout);
    this.sprayWas = false;
    this.sprayTimer = 0;
    this.gridAcc = 0;
    this.throwCd = 0;
    this.firstSpray = true;
    this.attempts[m.id] = (this.attempts[m.id] ?? 0) + 1;
    this.aim = { x: m.start.x + Math.sin(m.start.yaw) * 8, z: m.start.z + Math.cos(m.start.yaw) * 8, cell: 0 };
    this.aim.cell = this.grid.cellAt(this.aim.x, this.aim.z);
    this.log('start');
  }

  restart() {
    this.load(this.mission.id);
  }

  nextMission(): boolean {
    const i = MISSIONS.findIndex((m) => m.id === this.mission.id);
    if (i < 0 || i >= MISSIONS.length - 1) return false;
    this.load(MISSIONS[i + 1].id);
    return true;
  }

  // ---------- discrete actions ----------

  selectValve(v: Valve) {
    if (this.tank.valve === v) return;
    this.tank.valve = v;
    this.log('valve', { value: v });
  }

  cycleValve(dir: 1 | -1) {
    const order: Valve[] = ['acid', 'base', 'water'];
    const i = order.indexOf(this.tank.valve);
    this.selectValve(order[(i + dir + 3) % 3]);
  }

  toggleStrength(): boolean {
    if (!this.tank.strength10) {
      this.fx.push({ type: 'toast', text: this.mission.strength10 === 'wagon' ? 'תרכיז ×10 מחכה בעגלת האספקה' : 'אין תרכיז ×10 במשימה הזו' });
      return false;
    }
    this.tank.strength = this.tank.strength === 1 ? 10 : 1;
    this.log('strength', { value: String(this.tank.strength) });
    return true;
  }

  tankPH(): number {
    return sprayPH(this.tank.valve, this.tank.strength);
  }

  throwGadget(kind: Gadget): boolean {
    if (this.status !== 'play' || this.throwCd > 0) return false;
    if (this.gadgets[kind] <= 0) {
      this.fx.push({ type: 'empty' });
      return false;
    }
    this.gadgets[kind]--;
    this.throwCd = 0.35;
    const d = Math.hypot(this.aim.x - this.player.x, this.aim.z - this.player.z);
    this.throws.push({ kind, fx: this.player.x, fz: this.player.z, tx: this.aim.x, tz: this.aim.z, t0: this.t, tf: this.t + 0.35 + d / 22 });
    this.fx.push({ type: 'throw', kind });
    return true;
  }

  useHint(): string {
    const hints = this.mission.hints;
    if (this.mission.noHints || !hints.length) {
      this.hint = 'אין רמזים במשימה הזו.';
      return this.hint;
    }
    this.hint = hints[this.hintIndex % hints.length];
    this.hintIndex++;
    this.hintsUsed++;
    this.log('hint', { value: String(this.hintIndex) });
    return this.hint;
  }

  // ---------- update ----------

  update(dt: number, input: Input) {
    if (this.status !== 'play') return;
    this.t += dt;
    this.throwCd = Math.max(0, this.throwCd - dt);
    if (this.gadgets.mist < this.loadout.mist) {
      this.mistCharge += dt / MIST_RECHARGE;
      if (this.mistCharge >= 1) {
        this.mistCharge = 0;
        this.gadgets.mist++;
        this.fx.push({ type: 'toast', text: 'ערפל אוניברסלי נטען +1' });
      }
    } else this.mistCharge = 0;
    if (this.t - this.lastRestore > COMBO_WINDOW) this.combo = 0;
    this.movePlayer(dt, input);
    this.setAim(input.aimX, input.aimZ);
    this.spray(dt, input.spray);
    this.packetsFly();
    this.throwsFly();
    this.refill(dt);
    this.gridAcc += dt;
    while (this.gridAcc >= GRID_DT - 1e-9) {
      this.gridAcc -= GRID_DT;
      this.stepGrid(GRID_DT);
      if (this.status !== 'play') break;
    }
    this.tutorial();
  }

  private movePlayer(dt: number, input: Input) {
    const p = this.player;
    const fx = Math.sin(input.yaw);
    const fz = Math.cos(input.yaw);
    const rx = -fz;
    const rz = fx;
    let mx = rx * input.moveX + fx * input.moveZ;
    let mz = rz * input.moveX + fz * input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const top = (input.sprint ? 8.5 : 5.6) * (input.spray ? 0.7 : 1);
    const k = Math.min(1, dt * 12);
    p.vx += (mx * top - p.vx) * k;
    p.vz += (mz * top - p.vz) * k;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    for (const c of this.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const r = c.r + 0.45;
      if (d < r && d > 1e-6) {
        p.x = c.x + (dx / d) * r;
        p.z = c.z + (dz / d) * r;
      }
    }
    const S = this.mission.layout.size;
    p.x = Math.min(S - 1, Math.max(1, p.x));
    p.z = Math.min(S - 1, Math.max(1, p.z));
    p.y = terrainHeight(this.mission.layout, p.x, p.z);
    p.speed = Math.hypot(p.vx, p.vz);
    let face = p.yaw;
    if (input.spray || this.throwCd > 0.15) face = Math.atan2(this.aim.x - p.x, this.aim.z - p.z);
    else if (p.speed > 0.4) face = Math.atan2(p.vx, p.vz);
    let d = face - p.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.yaw += d * Math.min(1, dt * 14);
  }

  setAim(x: number, z: number) {
    const p = this.player;
    let dx = x - p.x;
    let dz = z - p.z;
    let d = Math.hypot(dx, dz);
    if (d < 1e-6) {
      dx = Math.sin(p.yaw);
      dz = Math.cos(p.yaw);
      d = 1;
      x = p.x + dx * 3;
      z = p.z + dz * 3;
    }
    if (d > SPRAY_RANGE) {
      x = p.x + (dx / d) * SPRAY_RANGE;
      z = p.z + (dz / d) * SPRAY_RANGE;
    }
    const S = this.mission.layout.size;
    this.aim.x = Math.min(S - 0.5, Math.max(0.5, x));
    this.aim.z = Math.min(S - 0.5, Math.max(0.5, z));
    this.aim.cell = this.grid.cellAt(this.aim.x, this.aim.z);
  }

  private spray(dt: number, held: boolean) {
    const pressed = held && !this.sprayWas;
    this.sprayWas = held;
    this.player.spraying = held;
    if (!held) {
      this.sprayTimer = 0;
      return;
    }
    if (pressed) {
      this.sprayTimer = PACKET_DT * 2; // a tap always makes one puff
      this.sprayHeld = 0;
    } else this.sprayTimer += dt;
    this.sprayHeld += dt;
    // The nozzle opens gradually: half rate for the first 0.35 s so short holds stay gentle.
    const interval = this.sprayHeld < 0.35 ? PACKET_DT * 2 : PACKET_DT;
    while (this.sprayTimer >= interval - 1e-9) {
      this.sprayTimer -= interval;
      if (!this.emitPacket()) {
        this.sprayTimer = 0;
        break;
      }
    }
  }

  private emitPacket(): boolean {
    const { valve, strength } = this.tank;
    const litres = SPRAY_LPS * PACKET_DT;
    const excess = sprayExcess(valve, strength, litres);
    if (valve === 'water') {
      if (this.tank.water < litres - 1e-9) return this.empty();
      this.tank.water -= litres;
      this.stats.water += litres;
    } else {
      const need = Math.abs(excess);
      if (this.tank[valve] < need - 1e-12) return this.empty();
      this.tank[valve] -= need;
      this.stats.chem += need;
    }
    this.stats.puffs++;
    const p = this.player;
    const d = Math.hypot(this.aim.x - p.x, this.aim.z - p.z);
    this.packets.push({
      valve,
      strength,
      litres,
      excess,
      fx: p.x + Math.sin(p.yaw) * 0.5,
      fz: p.z + Math.cos(p.yaw) * 0.5,
      tx: this.aim.x,
      tz: this.aim.z,
      t0: this.t,
      tf: this.t + 0.12 + d / 24,
    });
    if (this.firstSpray) {
      this.firstSpray = false;
      const c = this.aim.cell;
      this.log('first-spray', { cell: c, pH: this.grid.pH[c], value: valve, first: true });
    }
    return true;
  }

  private empty(): boolean {
    if (this.t - this.emptyNotified > 1.5) {
      this.emptyNotified = this.t;
      this.fx.push({ type: 'empty' });
    }
    return false;
  }

  private packetsFly() {
    if (!this.packets.length) return;
    const g = this.grid;
    const keep: Packet[] = [];
    for (const k of this.packets) {
      if (this.t < k.tf) {
        keep.push(k);
        continue;
      }
      const c = g.cellAt(k.tx, k.tz);
      const b = g.band(c);
      const before = g.pH[c];
      const salt0 = g.ledger.salt;
      g.inject(c, k.excess, k.litres);
      g.suspect[c] = 1;
      g.refreshPH();
      const after = g.pH[c];
      const reacted = g.ledger.salt - salt0;
      this.fx.push({ type: 'land', x: k.tx, z: k.tz, valve: k.valve });
      // Neutralization heat is only noticeable while lots of acid or base is reacting
      // (far from neutral); near the band it tells the ranger nothing.
      if (reacted > 0 && (before < 4 || before > 10)) this.fx.push({ type: 'fizz', x: k.tx, z: k.tz, amount: reacted });
      const wasIn = before >= b.lo && before <= b.hi;
      const isIn = after >= b.lo && after <= b.hi;
      // Only measured ground (universal indicator) can tell the ranger "in band" or "overshot".
      const measured = (g.know[c] & KNOW_UNIVERSAL) !== 0;
      if (wasIn && !isIn && k.valve !== 'water') {
        const dir = after > b.hi ? 'base' : 'acid';
        this.log('overshoot', { cell: c, pH: after, value: k.valve });
        this.combo = 0;
        if (measured && this.t - this.lastOvershoot > 1.2) {
          this.lastOvershoot = this.t;
          this.fx.push({ type: 'overshoot', x: k.tx, z: k.tz, pH: after, dir });
        }
      } else if (!wasIn && isIn && measured && this.t - this.lastInband > 0.6) {
        this.lastInband = this.t;
        this.fx.push({ type: 'inband', x: k.tx, z: k.tz });
      }
    }
    this.packets = keep;
  }

  private throwsFly() {
    if (!this.throws.length) return;
    const g = this.grid;
    const keep: Throw[] = [];
    for (const k of this.throws) {
      if (this.t < k.tf) {
        keep.push(k);
        continue;
      }
      const c = g.cellAt(k.tx, k.tz);
      this.fx.push({ type: 'gadget', kind: k.kind, x: k.tx, z: k.tz });
      if (k.kind === 'litmus') {
        g.know[c] |= KNOW_LITMUS;
        this.markers = this.markers.filter((m) => m.cell !== c);
        this.markers.push({ cell: c, x: k.tx, z: k.tz });
        this.log('litmus', { cell: c, pH: g.pH[c], value: litmus(g.pH[c]) });
      } else if (k.kind === 'phenol' || k.kind === 'mist') {
        const flag = k.kind === 'phenol' ? KNOW_PHENOL : KNOW_UNIVERSAL;
        const cells = g.cellsInRadius(k.tx, k.tz, GADGET_RADIUS);
        for (const cc of cells) g.know[cc] |= flag;
        const pinks = cells.filter((cc) => phenolphthalein(g.pH[cc]) !== 'colorless').length;
        this.log(k.kind, { cell: c, pH: g.pH[c], value: k.kind === 'phenol' ? `pink:${pinks}` : universal(g.pH[c]) });
      } else {
        g.addWeakBase(c, 0.05);
        for (const n of g.neighbours(c)) g.addWeakBase(n, 0.02);
        this.stats.chem += 0.13;
        this.log('canister', { cell: c, pH: g.pH[c] });
      }
    }
    this.throws = keep;
  }

  private refill(dt: number) {
    const p = this.player;
    const near = this.mission.wagons.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 3.8);
    if (!near || p.spraying) {
      this.refillT = 0;
      return;
    }
    const L = this.loadout;
    const full =
      this.tank.acid >= L.acid - 1e-9 &&
      this.tank.base >= L.base - 1e-9 &&
      this.tank.water >= L.water - 1e-9 &&
      this.gadgets.litmus >= L.litmus &&
      this.gadgets.phenol >= L.phenol &&
      this.gadgets.mist >= L.mist &&
      this.gadgets.canister >= L.canister &&
      (this.tank.strength10 || this.mission.strength10 !== 'wagon');
    if (full) return;
    this.refillT += dt;
    if (this.refillT < 1) return;
    this.refillT = 0;
    this.tank.acid = L.acid;
    this.tank.base = L.base;
    this.tank.water = L.water;
    this.gadgets = { litmus: L.litmus, phenol: L.phenol, mist: L.mist, canister: L.canister };
    this.stats.refills++;
    this.fx.push({ type: 'refill' });
    this.log('refill');
    if (!this.tank.strength10 && this.mission.strength10 === 'wagon') {
      this.tank.strength10 = true;
      this.fx.push({ type: 'unlock' });
      this.log('unlock-x10');
    }
  }

  private stepGrid(dt: number) {
    const m = this.mission;
    const g = this.grid;
    g.step(dt, this.t, m.sources ? m.sources(g) : [], m.rain ? m.rain(this.t) : null);
    // Ground that stays well outside its band wilts after a while: plants show *where*
    // something is wrong (never which way, never when it is fixed), so the spread is visible.
    for (let c = 0; c < g.count; c++) {
      if (g.suspect[c]) continue;
      if (!g.inBand(c, m.tol + 0.3)) {
        this.wilt[c] += dt;
        if (this.wilt[c] > WILT_TIME) g.suspect[c] = 1;
      } else this.wilt[c] = 0;
    }
    // Restored ground blooms once it is known to be back in band.
    for (let c = 0; c < g.count; c++) {
      const inb = g.inBand(c);
      if (!inb) g.scarred[c] = 1;
      else if (g.scarred[c] && g.know[c] & KNOW_UNIVERSAL && !this.restored.has(c)) {
        this.restored.add(c);
        this.combo = this.t - this.lastRestore <= COMBO_WINDOW ? this.combo + 1 : 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.lastRestore = this.t;
        const points = 100 * Math.min(5, this.combo);
        this.score += points;
        const [x, z] = g.center(c);
        this.fx.push({ type: 'restored', x, z, points, combo: this.combo });
      }
      const target = inb && g.scarred[c] && g.know[c] ? 1 : 0;
      g.bloom[c] += (target - g.bloom[c]) * Math.min(1, dt * 1.5);
    }
    for (const a of this.assets) {
      a.pH = g.zonePH(a.cells);
      const out = a.pH < a.lo ? a.lo - a.pH : a.pH > a.hi ? a.pH - a.hi : 0;
      if (out > 0) {
        a.health -= a.decay * (1 + Math.min(2, out)) * dt;
        if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.fx.push({ type: 'asset-hurt', id: a.id });
      } else a.health = Math.min(100, a.health + 2 * dt);
      a.minHealth = Math.min(a.minHealth, a.health);
      if (a.health <= 0) {
        a.health = 0;
        this.fail(`${a.id}-${a.pH < a.lo ? 'acid' : 'base'}`);
        return;
      }
    }
    // A ranger signs off an area only after measuring it: every suspect cell must be misted.
    if (this.t >= m.minTime && this.allSurveyed() && this.allContained() && this.assets.every((a) => a.pH >= a.lo && a.pH <= a.hi)) {
      this.holdT += dt;
      if (this.holdT >= WIN_HOLD) this.win();
    } else this.holdT = 0;
  }

  private inArea(c: number): boolean {
    const [x, z] = this.grid.center(c);
    const A = this.mission.area;
    return x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1;
  }

  /** Cells in the mission area outside their band (± tolerance). */
  contaminated(): number[] {
    const out: number[] = [];
    for (let c = 0; c < this.grid.count; c++) if (this.inArea(c) && !this.grid.inBand(c, this.mission.tol)) out.push(c);
    return out;
  }

  /** Suspect ground not yet measured with universal indicator. */
  unsurveyed(): number {
    const g = this.grid;
    let n = 0;
    for (let c = 0; c < g.count; c++) if (g.suspect[c] && !(g.know[c] & KNOW_UNIVERSAL)) n++;
    return n;
  }

  allSurveyed(): boolean {
    return this.unsurveyed() === 0;
  }

  allContained(): boolean {
    for (let c = 0; c < this.grid.count; c++) if (this.inArea(c) && !this.grid.inBand(c, this.mission.tol)) return false;
    return true;
  }

  private win() {
    this.status = 'won';
    const minH = this.assets.length ? Math.min(...this.assets.map((a) => a.minHealth)) : 100;
    this.stars = 1 + (this.stats.chem <= this.mission.idealChem * 1.6 ? 1 : 0) + (minH >= 50 ? 1 : 0);
    this.score += 250 * this.stars + Math.round(minH * 5);
    this.fx.push({ type: 'won' });
    this.log('win', { value: `stars:${this.stars}` });
  }

  private fail(reason: string) {
    this.status = 'failed';
    this.failReason = reason;
    this.fx.push({ type: 'failed', reason });
    this.log('fail', { value: reason });
  }

  private tutorialDone(until: string): boolean {
    const g = this.grid;
    if (until === 'near-spill') {
      const [cx, cz] = g.center(this.spill[0]);
      return Math.hypot(this.player.x - cx, this.player.z - cz) < 13;
    }
    if (until === 'litmus-on-spill') return this.markers.some((m) => this.spill.includes(m.cell));
    if (until === 'mist-on-spill') return this.spill.filter((c) => g.know[c] & KNOW_UNIVERSAL).length >= this.spill.length / 2;
    if (until === 'spill-rising') return g.zonePH(this.spill) > 4.6;
    return this.status === 'won';
  }

  /** Jump to the furthest step already satisfied, so skipping ahead never leaves a stale prompt. */
  private tutorial() {
    const steps = this.mission.tutorial;
    if (!steps || this.tutorialStep >= steps.length) return;
    for (let i = steps.length - 1; i >= this.tutorialStep; i--) {
      if (this.tutorialDone(steps[i].until)) {
        this.tutorialStep = i + 1;
        return;
      }
    }
  }

  tutorialText(): string {
    const steps = this.mission.tutorial;
    if (!steps || this.tutorialStep >= steps.length) return '';
    return steps[this.tutorialStep].text;
  }

  /** Counts the ranger can know: measured cells out of band, unmeasured suspect ground, assets in danger. */
  objectiveInfo(): { main: string; bad: number; unknown: number; danger: number; wait: number } {
    const g = this.grid;
    let bad = 0;
    let unknown = 0;
    for (let c = 0; c < g.count; c++) {
      if (g.know[c] & KNOW_UNIVERSAL) {
        if (!g.inBand(c, this.mission.tol)) bad++;
      } else if (g.suspect[c]) unknown++;
    }
    const hurt = this.assets.filter((a) => a.health < 100 && (a.pH < a.lo || a.pH > a.hi));
    const wait = this.mission.minTime > 0 && this.t < this.mission.minTime ? Math.ceil(this.mission.minTime - this.t) : 0;
    let main: string;
    if (this.status === 'won') main = 'המשימה הושלמה!';
    else if (this.status === 'failed') main = 'המשימה נכשלה – נסו שוב';
    else if (this.holdT > 0) main = 'מחזיקים יציב... עוד רגע!';
    else if (hurt.length) main = `הגנו על ${hurt[0].name}!`;
    else if (this.mission.strength10 === 'wagon' && !this.tank.strength10 && this.t > 6) main = 'קחו תרכיז ×10 מעגלת האספקה';
    else if (bad > 0) main = `החזירו לטווח: ${bad} ${bad === 1 ? 'כתם' : 'כתמים'} (החיצים מראים)`;
    else if (unknown > 0) main = 'מדדו את הקרקע האפורה בערפל אוניברסלי';
    else if (wait > 0) main = 'החזיקו מעמד – הסערה עוד עוברת';
    else main = 'כמעט! הכול נמדד – בדקו שהכול בטווח';
    return { main, bad, unknown, danger: hurt.length, wait };
  }

  objective(): string {
    const o = this.objectiveInfo();
    if (this.status !== 'play') return o.main;
    return `${o.main} · מחוץ לטווח: ${o.bad} · לא נמדדו: ${o.unknown}${o.wait ? ` · עוד ${o.wait} שנ׳` : ''}`;
  }

  private log(action: string, extra: Partial<LearnEvent> = {}) {
    this.events.push({
      mission: this.mission?.id ?? '',
      t: Math.round(this.t * 100) / 100,
      action,
      hintUsed: this.hintsUsed > 0,
      attempt: this.attempts[this.mission?.id ?? ''] ?? 1,
      ...extra,
    });
    if (this.events.length > 2000) this.events.splice(0, this.events.length - 2000);
  }

  // ---------- read helpers ----------

  /** What the ranger knows about a cell from the indicators used on it. */
  readingAt(c: number): { kind: 'universal' | 'phenol' | 'litmus' | 'none'; pH?: number; text: string } {
    const g = this.grid;
    const k = g.know[c];
    const p = g.pH[c];
    if (k & KNOW_UNIVERSAL) return { kind: 'universal', pH: p, text: `pH ${p.toFixed(1)}` };
    if (k & KNOW_PHENOL) {
      const r = phenolphthalein(p);
      return { kind: 'phenol', text: r === 'colorless' ? 'פנולפתלאין: שקוף (pH מתחת ל-8.2)' : 'פנולפתלאין: ורוד – בסיסי (מעל 8.2)' };
    }
    if (k & KNOW_LITMUS) {
      const r = litmus(p);
      return { kind: 'litmus', text: r === 'acid' ? 'לקמוס: אדום – חומצי' : r === 'base' ? 'לקמוס: כחול – בסיסי' : 'לקמוס: אין שינוי ברור' };
    }
    return { kind: 'none', text: '?' };
  }

  /** pH the aimed cell would have after one more puff of the selected liquid (if measured). */
  nextPuffPH(): number | null {
    const g = this.grid;
    const c = this.aim.cell;
    if (!(g.know[c] & KNOW_UNIVERSAL)) return null;
    const litres = SPRAY_LPS * PACKET_DT;
    const ex = sprayExcess(this.tank.valve, this.tank.strength, litres);
    return phFromNet(g.E[c] + ex, g.V[c] + litres, g.beta[c]);
  }

  /**
   * What the indicators used on a cell say about its pH, as a range on the 0–14 scale.
   * Litmus and phenolphthalein give ranges (and are intersected when both were used);
   * universal indicator gives a number to within about one unit (Workbook).
   */
  readingRange(c: number): { lo: number; hi: number; exact?: number } | null {
    const g = this.grid;
    const k = g.know[c];
    const p = g.pH[c];
    if (k & KNOW_UNIVERSAL) return { lo: Math.max(0, p - 0.5), hi: Math.min(14, p + 0.5), exact: p };
    let lo = 0;
    let hi = 14;
    let any = false;
    if (k & KNOW_LITMUS) {
      any = true;
      const r = litmus(p);
      if (r === 'acid') hi = 4.5;
      else if (r === 'base') lo = 8.2;
      else {
        lo = 4.5;
        hi = 8.2;
      }
    }
    if (k & KNOW_PHENOL) {
      any = true;
      const r = phenolphthalein(p);
      if (r === 'colorless') hi = Math.min(hi, 8.2);
      else if (r === 'pale-pink') {
        lo = Math.max(lo, 8.2);
        hi = Math.min(hi, 10);
      } else lo = Math.max(lo, 10);
    }
    return any ? { lo, hi } : null;
  }

  renderGameToText(): string {
    const g = this.grid;
    const near: Array<Record<string, unknown>> = [];
    for (let c = 0; c < g.count; c++) {
      const [x, z] = g.center(c);
      if (Math.hypot(x - this.player.x, z - this.player.z) > 18) continue;
      if (g.inBand(c) && !this.spill.includes(c)) continue;
      near.push({ cell: c, x, z, pH: Math.round(g.pH[c] * 100) / 100, band: g.band(c), known: this.readingAt(c).text, cls: phClass(g.pH[c]) });
    }
    return JSON.stringify({
      note: 'world metres; x east, z south, y up; yaw 0 faces +z',
      mode: this.status,
      mission: { id: this.mission.id, num: this.mission.num, title: this.mission.title, t: Math.round(this.t * 10) / 10 },
      objective: this.objective(),
      tutorial: this.tutorialText(),
      hint: this.hint,
      failReason: this.failReason,
      stars: this.stars,
      player: { x: +this.player.x.toFixed(2), z: +this.player.z.toFixed(2), yaw: +this.player.yaw.toFixed(2), spraying: this.player.spraying },
      aim: { x: +this.aim.x.toFixed(2), z: +this.aim.z.toFixed(2), cell: this.aim.cell, reading: this.readingAt(this.aim.cell).text },
      tank: {
        valve: this.tank.valve,
        strength: this.tank.strength,
        tankPH: +this.tankPH().toFixed(1),
        acid: +this.tank.acid.toFixed(3),
        base: +this.tank.base.toFixed(3),
        water: +this.tank.water.toFixed(1),
        x10Unlocked: this.tank.strength10,
      },
      gadgets: this.gadgets,
      assets: this.assets.map((a) => ({ id: a.id, pH: +a.pH.toFixed(2), band: [a.lo, a.hi], health: Math.round(a.health) })),
      spill: this.spill.map((c) => ({ cell: c, pH: +g.pH[c].toFixed(2), known: this.readingAt(c).text })),
      outOfBand: this.contaminated().length,
      nearbyProblemCells: near.slice(0, 24),
      ledger: { acidIn: +g.ledger.acidIn.toFixed(4), baseIn: +g.ledger.baseIn.toFixed(4), salt: +g.ledger.salt.toFixed(4) },
      stats: { chemUsed: +this.stats.chem.toFixed(4), water: +this.stats.water.toFixed(1), refills: this.stats.refills },
      score: this.score,
      combo: this.combo,
      mistRecharge: +this.mistCharge.toFixed(2),
      unsurveyed: this.unsurveyed(),
      packetsInFlight: this.packets.length,
    });
  }
}
