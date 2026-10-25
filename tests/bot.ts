// A scripted ranger that plays missions through the same inputs a player uses
// (stick, aim point, spray button, valve/strength keys, gadget throws). Used to prove each
// mission is solvable and that the advertised wrong approaches fail.

import { netForPH, Valve } from '../src/sim/chem';
import { Game, Gadget, Input, NO_INPUT } from '../src/sim/game';
import { KNOW_UNIVERSAL } from '../src/sim/world';

const DT = 1 / 60;

export class Bot {
  game: Game;
  input: Input = { ...NO_INPUT };
  constructor(game: Game) {
    this.game = game;
  }

  get done() {
    return this.game.status !== 'play';
  }

  tick(n = 1) {
    for (let i = 0; i < n && !this.done; i++) this.game.update(DT, this.input);
  }

  wait(seconds: number) {
    this.input.spray = false;
    this.input.moveX = 0;
    this.input.moveZ = 0;
    this.tick(Math.round(seconds / DT));
  }

  aimAt(x: number, z: number) {
    this.input.aimX = x;
    this.input.aimZ = z;
  }

  aimCell(c: number) {
    const [x, z] = this.game.grid.center(c);
    this.aimAt(x, z);
  }

  /** Walk (yaw 0: forward is +z, right is −x) until within `r` metres of x, z. */
  walkTo(x: number, z: number, r = 2, maxT = 40) {
    this.input.yaw = 0;
    this.input.spray = false;
    let t = 0;
    let stuck = 0;
    let last = [this.game.player.x, this.game.player.z];
    while (!this.done && t < maxT) {
      const p = this.game.player;
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < r) break;
      let mx = -dx / d;
      let mz = dz / d;
      if (stuck > 0) {
        // Side-step around an obstacle.
        const s = mx;
        mx = mz;
        mz = -s;
        stuck--;
      }
      this.input.moveX = mx;
      this.input.moveZ = mz;
      this.aimAt(x, z);
      this.tick(6);
      t += 6 * DT;
      if (Math.hypot(p.x - last[0], p.z - last[1]) < 0.05) stuck = 20;
      last = [p.x, p.z];
    }
    this.input.moveX = 0;
    this.input.moveZ = 0;
    this.tick(10);
  }

  /** Walk to within spray range of a cell. */
  approach(c: number, range = 9) {
    const [x, z] = this.game.grid.center(c);
    const p = this.game.player;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > range) this.walkTo(x, z, range - 1);
  }

  throw(kind: Gadget, c: number) {
    this.approach(c, 12);
    this.aimCell(c);
    this.tick(2);
    this.game.throwGadget(kind);
    this.wait(1.2);
  }

  /** Hold the spray for `seconds` (at least one puff). */
  spray(valve: Valve, seconds: number, strength: 1 | 10 = 1) {
    this.game.selectValve(valve);
    if (this.game.tank.strength !== strength) this.game.toggleStrength();
    this.input.spray = true;
    this.tick(Math.max(1, Math.round(seconds / DT)));
    this.input.spray = false;
    this.tick(1);
  }

  known(c: number) {
    return (this.game.grid.know[c] & KNOW_UNIVERSAL) !== 0;
  }

  /** Make sure a cell has been measured with universal indicator (the only way the bot reads pH). */
  measure(c: number) {
    if (this.known(c) || this.done) return;
    if (this.game.gadgets.mist <= 0) this.refill();
    if (this.game.gadgets.mist <= 0) return;
    this.throw('mist', c);
  }

  /** Mist every suspect cell not yet measured (nearest first), refilling mist at wagons. */
  surveyAll(maxT = 120) {
    const g = this.game.grid;
    const t0 = this.game.t;
    while (!this.done && this.game.unsurveyed() > 0 && this.game.t - t0 < maxT) {
      const p = this.game.player;
      let best = -1;
      let bd = Infinity;
      for (let c = 0; c < g.count; c++) {
        if (!g.suspect[c] || this.known(c)) continue;
        const [x, z] = g.center(c);
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best < 0) break;
      this.measure(best);
    }
  }

  /**
   * Titrate a cell toward a target pH with pulses: estimate the amount still needed,
   * spray most of it, wait for it to land, read again. Uses ×10 for big amounts if allowed.
   */
  titrate(c: number, lo: number, hi: number, maxT = 40, allowX10 = true) {
    const g = this.game.grid;
    const mid = (lo + hi) / 2;
    const t0 = this.game.t;
    while (!this.done && this.game.t - t0 < maxT) {
      this.measure(c);
      if (!this.known(c)) return false;
      const p = g.pH[c];
      if (p > lo + 0.1 && p < hi - 0.1) return true;
      this.approach(c);
      this.aimCell(c);
      const need = g.E[c] - netForPH(mid, g.V[c], g.beta[c]);
      const valve: Valve = need > 0 ? 'base' : 'acid';
      const big = Math.abs(need) > 0.03 && allowX10 && this.game.tank.strength10;
      const rate = big ? 0.08 : 0.008;
      const secs = (Math.abs(need) * (big ? 0.85 : 0.7)) / rate;
      if (this.game.tank[valve] < 0.02) this.refill();
      this.aimCell(c);
      this.spray(valve, Math.max(0.01, Math.min(secs, 4)), big ? 10 : 1);
      this.wait(0.7);
    }
    return g.pH[c] > lo && g.pH[c] < hi;
  }

  refill() {
    const p = this.game.player;
    let best = this.game.mission.wagons[0];
    let bd = Infinity;
    for (const w of this.game.mission.wagons) {
      const d = Math.hypot(w[0] - p.x, w[1] - p.z);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    this.walkTo(best[0], best[1], 2.5);
    this.wait(1.4);
  }

  /** Keep every listed cell in band until the mission ends or time runs out. */
  maintain(cellsIn: number[], maxT: number, allowX10 = true) {
    let cells = [...cellsIn];
    const g = this.game.grid;
    const t0 = this.game.t;
    while (!this.done && this.game.t - t0 < maxT) {
      // Measure first: the bot only judges cells it has misted.
      const unknown = cells.find((c) => !this.known(c));
      if (unknown !== undefined && (this.game.gadgets.mist > 0 || this.game.mission.wagons.length)) {
        this.measure(unknown);
        if (!this.known(unknown)) cells = cells.filter((c) => c !== unknown);
        continue;
      }
      let worst = -1;
      let wd = 0;
      for (const c of cells) {
        if (!this.known(c)) continue;
        const b = g.band(c);
        const d = g.pH[c] < b.lo + 0.05 ? b.lo + 0.05 - g.pH[c] : g.pH[c] > b.hi - 0.05 ? g.pH[c] - b.hi + 0.05 : 0;
        if (d > wd) {
          wd = d;
          worst = c;
        }
      }
      if (worst < 0) {
        this.wait(0.5);
        continue;
      }
      const b = g.band(worst);
      this.titrate(worst, b.lo, b.hi, 15, allowX10);
    }
  }
}
