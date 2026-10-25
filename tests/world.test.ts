import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { GALILEE, NIGHT } from '../src/sim/layout';
import { Grid, Kind } from '../src/sim/world';
import { Bot } from './bot';

function ledgerHolds(g: Grid) {
  let pos = 0;
  let neg = 0;
  for (let c = 0; c < g.count; c++) {
    if (g.E[c] > 0) pos += g.E[c];
    else neg -= g.E[c];
  }
  // Every mol of acid that came in is either still unreacted or became salt; same for base.
  expect(pos + g.ledger.salt).toBeCloseTo(g.ledger.acidIn, 9);
  expect(neg + g.ledger.salt).toBeCloseTo(g.ledger.baseIn, 9);
  expect(g.totalSalt()).toBeCloseTo(g.ledger.salt, 9);
}

describe('grid', () => {
  it('builds a connected creek that drains into the pond in both valleys', () => {
    for (const L of [GALILEE, NIGHT]) {
      const g = new Grid(L);
      expect(g.creekCells.length).toBeGreaterThan(30);
      expect(g.pondCells.length).toBeGreaterThan(15);
      for (let k = 0; k < g.creekCells.length - 1; k++) {
        const a = g.creekCells[k];
        const b = g.creekCells[k + 1];
        expect(g.down[a]).toBe(b);
        expect(g.neighbours(a)).toContain(b);
      }
      expect(g.kind[g.down[g.creekCells[g.creekCells.length - 1]]]).toBe(Kind.Pond);
    }
  });

  it('conserves acid/base amounts through spreading, flooding, creek flow and reactions', () => {
    const g = new Grid(GALILEE);
    g.setPH(g.idx(20, 13), 3);
    g.setPH(g.idx(21, 13), 11);
    for (const c of g.creekCells.slice(10, 14)) g.setPH(c, 2);
    g.addWeakBase(g.idx(10, 10), 0.05);
    for (let i = 0; i < 400; i++) {
      g.inject(g.idx(20, 13), 0, 0.04); // water flooding
      if (i % 3 === 0) g.inject(g.creekCells[12], -0.0008, 0.04);
      g.step(0.05, i * 0.05);
    }
    ledgerHolds(g);
    expect(g.ledger.salt).toBeGreaterThan(0);
  });

  it('water floods downhill and carries acid to neighbours instead of neutralizing it', () => {
    const g = new Grid(GALILEE);
    const c = g.idx(20, 13);
    g.setPH(c, 3);
    g.refreshPH(true);
    const before = g.pH[c];
    for (let i = 0; i < 200; i++) {
      g.inject(c, 0, 0.04); // 10 s of water spray at 0.8 L/s
      g.step(0.05, i * 0.05);
    }
    expect(g.pH[c]).toBeLessThan(before + 0.6); // barely moves
    expect(g.pH[c]).toBeLessThan(7);
    const acidicNeighbours = g.neighbours(c).filter((n) => g.pH[n] < 6).length;
    expect(acidicNeighbours).toBeGreaterThan(0);
    ledgerHolds(g);
  });

  it('a weak-base canister neutralizes slowly and never pushes pH above ~8.5', () => {
    const g = new Grid(GALILEE);
    const c = g.idx(20, 13);
    g.setPH(c, 3);
    g.addWeakBase(c, 0.2); // far more than needed
    g.step(0.05, 0);
    expect(g.pH[c]).toBeLessThan(4); // works slowly
    for (let i = 0; i < 1200; i++) g.step(0.05, i * 0.05);
    expect(g.pH[c]).toBeGreaterThan(7);
    expect(g.pH[c]).toBeLessThanOrEqual(8.51);
    expect(g.W[c]).toBeGreaterThan(0); // the rest stays undissolved
  });
});

describe('player and tank', () => {
  it('a single tap sprays one puff; holding ramps up to a continuous stream', () => {
    const game = new Game('m1-lemon');
    const bot = new Bot(game);
    bot.aimCell(game.spill[0]);
    bot.spray('base', 1 / 60);
    expect(game.stats.puffs).toBe(1);
    bot.spray('base', 1);
    // Half rate for the first 0.35 s, then 20 puffs/s.
    expect(game.stats.puffs).toBeGreaterThanOrEqual(16);
    expect(game.stats.puffs).toBeLessThanOrEqual(19);
  });

  it('the tank gauge shows the pH of the selected liquid', () => {
    const game = new Game('m5-storm');
    game.selectValve('base');
    expect(game.tankPH()).toBeCloseTo(12, 1);
    game.toggleStrength();
    expect(game.tankPH()).toBeCloseTo(13, 1);
    game.selectValve('acid');
    expect(game.tankPH()).toBeCloseTo(1, 1);
  });

  it('×10 concentrate is locked in mission 2 until the ranger refills at the wagon', () => {
    const game = new Game('m2-creek');
    expect(game.toggleStrength()).toBe(false);
    const bot = new Bot(game);
    bot.refill();
    expect(game.tank.strength10).toBe(true);
    expect(game.toggleStrength()).toBe(true);
  });

  it('indicators only reveal what they can: phenolphthalein shows no acids', () => {
    const game = new Game('m6-night');
    const bot = new Bot(game);
    const acid = game.spill[4];
    bot.throw('phenol', acid);
    expect(game.readingAt(acid).text).toContain('שקוף');
    bot.throw('litmus', acid);
    // Universal knowledge was never gained, so no number is shown.
    expect(game.readingAt(acid).kind).toBe('phenol');
  });

  it('exposes a text state and keeps learning events', () => {
    const game = new Game('m1-lemon');
    const s = JSON.parse(game.renderGameToText());
    expect(s.mission.id).toBe('m1-lemon');
    expect(s.spill.length).toBe(4);
    expect(game.events[0].action).toBe('start');
  });
});
