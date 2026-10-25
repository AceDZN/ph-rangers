import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { MISSIONS } from '../src/sim/missions';
import { Bot } from './bot';
import { blind, blindWith, constant, everythingTo7, intended, run } from './strategies';

describe('every mission is solvable by its intended approach', () => {
  for (const m of MISSIONS) {
    it(`${m.num}. ${m.id}`, () => {
      const o = run(m.id, intended[m.id]);
      expect(o.status, `${o.reason} ${JSON.stringify(o.assets)} oob=${o.outOfBand}`).toBe('won');
      expect(o.stars).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('mission 1 — lemon spill', () => {
  it('water alone barely moves the acid and floods it along the path', () => {
    const o = run('m1-lemon', constant('water', 4), 90);
    expect(o.status).toBe('play');
    const g = o.game;
    expect(g.grid.zonePH(g.spill)).toBeLessThan(5);
    expect(o.outOfBand).toBeGreaterThan(g.spill.length); // spread to more cells
  });

  it('overshooting with base turns the puddle basic, and it is fixable with acid', () => {
    const game = new Game('m1-lemon');
    const bot = new Bot(game);
    const c = game.spill[0];
    bot.approach(c);
    bot.aimCell(c);
    bot.spray('base', 6); // about twice what this patch needs
    bot.wait(1);
    expect(game.grid.pH[c]).toBeGreaterThan(9.5);
    expect(game.events.some((e) => e.action === 'overshoot')).toBe(true);
    bot.titrate(c, 6, 8);
    expect(game.grid.pH[c]).toBeGreaterThan(6);
    expect(game.grid.pH[c]).toBeLessThan(8);
  });
});

describe('mission 2 — the ×10 rule through play', () => {
  it('the same 3 s of ×1 base fixes the pH 3 puddle but removes under 10% of the pH 2 creek wave', () => {
    const game = new Game('m2-creek');
    const bot = new Bot(game);
    const bank = game.spill[4];
    const creek = game.spill[1];
    bot.approach(bank);
    bot.aimCell(bank);
    bot.spray('base', 3);
    bot.wait(0.8);
    expect(game.grid.pH[bank]).toBeGreaterThan(5.5);
    // The creek flows, so judge the whole acid wave (creek + pond), not one cell.
    const g = game.grid;
    const waveAcid = () => [...g.creekCells, ...g.pondCells].reduce((sum, c) => sum + g.E[c], 0);
    const before = waveAcid();
    bot.approach(creek);
    bot.aimCell(creek);
    bot.spray('base', 3);
    bot.wait(0.8);
    const removed = (before - waveAcid()) / before;
    expect(removed).toBeGreaterThan(0);
    expect(removed).toBeLessThan(0.1); // the same spray that fixed the puddle removes < 10% of the pH 2 wave
  });

  it('×1 base only or water only never wins (acid reaches the fish); too much base kills them', () => {
    const x1 = run('m2-creek', constant('base'));
    expect(x1.status).not.toBe('won'); // ×1 alone cannot keep up with pH 2
    expect(x1.game.assets[0].pH).toBeLessThan(6.8); // and the acid reaches the fish pond
    expect(run('m2-creek', constant('water', 4)).status).not.toBe('won');
    const flood = run('m2-creek', (b, g) => {
      b.refill();
      for (let i = 0; i < 9; i++) {
        for (const c of g.grid.creekCells.slice(24, 30)) {
          b.approach(c);
          b.aimCell(c);
          b.spray('base', 2.5, 10);
        }
        b.refill();
      }
    });
    expect(flood.reason).toBe('pond-base');
  });
});

describe('mission 3 — hidden lime dust', () => {
  it('phenolphthalein turns pink only on the basic lime cells, not on neutral dust', () => {
    const game = new Game('m3-quarry');
    const bot = new Bot(game);
    bot.throw('phenol', game.grid.idx(11, 7));
    bot.throw('phenol', game.grid.idx(14, 7));
    const lime = game.spill.filter((c) => game.grid.pH[c] > 9);
    const pinkLime = lime.filter((c) => game.readingAt(c).text.includes('ורוד')).length;
    const pinkDecoys = game.decoys.filter((c) => game.readingAt(c).text.includes('ורוד')).length;
    expect(pinkLime).toBe(lime.length);
    // The acidic fertilizer stays colourless — phenolphthalein never shows acids.
    const fert = game.spill.find((c) => game.grid.pH[c] < 5)!;
    expect(game.readingAt(fert).text).toContain('שקוף');
    expect(pinkDecoys).toBe(0);
  });

  it('spraying acid on every pale patch (lime and plain dust) makes the clean patches acidic', () => {
    const o = run(
      'm3-quarry',
      (b, g) => {
        for (const c of [...g.spill, ...g.decoys]) {
          b.approach(c);
          b.aimCell(c);
          b.spray('acid', 3);
        }
      },
      90,
    );
    expect(o.status).not.toBe('won');
    expect(o.game.decoys.filter((c) => o.game.grid.pH[c] < 6).length).toBeGreaterThan(3);
  });

  it('spraying base on lime kills the olives; water only spreads the lime', () => {
    expect(run('m3-quarry', constant('base')).reason).toBe('olives-base');
    const w = run('m3-quarry', constant('water', 4));
    expect(w.status).not.toBe('won');
    expect(w.outOfBand).toBeGreaterThan(5); // water only spread the lime around
  });
});

describe('mission 4 — different targets', () => {
  it('bringing everything to pH 7 fails the blueberries', () => {
    expect(run('m4-blueberry', everythingTo7).reason).toBe('berries-base');
  });
  it('constant base / acid / water fail', () => {
    expect(run('m4-blueberry', constant('base')).status).toBe('failed');
    expect(run('m4-blueberry', constant('acid')).status).toBe('failed');
    expect(run('m4-blueberry', constant('water', 4)).status).toBe('failed');
  });
});

describe('mission 5 — storm front', () => {
  it('doing nothing loses an asset to the acid rain', () => {
    expect(run('m5-storm', () => {}).status).toBe('failed');
  });
});

describe('indicators are required', () => {
  it('an indicator-free ranger (heat probing + any fixed blueberry dose) cannot win the transfer', () => {
    for (const dose of [0.45, 0.6, 0.8, 1.0, 1.2]) {
      const o = run('m6-night', blindWith(dose));
      expect(o.status, `dose ${dose}: ${o.reason} oob=${o.outOfBand}`).not.toBe('won');
    }
  });

  it('no mission can be won without measuring the suspect ground', () => {
    expect(run('m3-quarry', blind).status).not.toBe('won');
    expect(run('m1-lemon', blind).status).not.toBe('won');
  });
});

describe('mission 6 — transfer (no hints)', () => {
  it('has no hints', () => {
    const g = new Game('m6-night');
    g.useHint();
    expect(g.hintsUsed).toBe(0);
  });
  it('every constant strategy fails: always base, always acid, always water, always to 7', () => {
    for (const plan of [constant('base'), constant('acid'), constant('water', 4), everythingTo7]) {
      expect(run('m6-night', plan).status).not.toBe('won');
    }
  });
});
