// Scripted strategies shared by the mission tests and the tuning script.

import { Game } from '../src/sim/game';
import { Kind } from '../src/sim/world';
import { Bot } from './bot';

export interface Outcome {
  status: string;
  reason: string;
  t: number;
  chem: number;
  stars: number;
  outOfBand: number;
  assets: Record<string, { pH: number; health: number }>;
  game: Game;
}

export function run(missionId: string, plan: (b: Bot, g: Game) => void, untilT = 300): Outcome {
  const game = new Game(missionId);
  const bot = new Bot(game);
  plan(bot, game);
  if ((plan as { finish?: boolean }).finish) {
    // Sign-off: measure every suspect cell, fix anything the survey reveals.
    for (let i = 0; i < 4 && !bot.done && game.t < untilT; i++) {
      bot.surveyAll();
      bot.maintain(problems(game), 30);
    }
  }
  while (!bot.done && game.t < untilT) bot.wait(0.5);
  const assets: Outcome['assets'] = {};
  for (const a of game.assets) assets[a.id] = { pH: +a.pH.toFixed(2), health: Math.round(a.health) };
  return {
    status: game.status,
    reason: game.failReason,
    t: +game.t.toFixed(1),
    chem: +game.stats.chem.toFixed(3),
    stars: game.stars,
    outOfBand: game.contaminated().length,
    assets,
    game,
  };
}

const cellsOf = (g: Game, k: Kind) => {
  const out: number[] = [];
  for (let c = 0; c < g.grid.count; c++) if (g.grid.kind[c] === k) out.push(c);
  return out;
};

/** Cells currently out of band in the mission area, worst first. */
export const problems = (g: Game) => g.contaminated();

// ---------- intended solutions ----------

export const intended: Record<string, (b: Bot, g: Game) => void> = {
  'm1-lemon': (b, g) => {
    b.throw('litmus', g.spill[0]);
    b.throw('mist', g.spill[0]);
    for (let pass = 0; pass < 4 && !b.done; pass++) {
      b.maintain(g.spill, 20);
      b.surveyAll();
    }
  },
  'm2-creek': (b, g) => {
    b.refill(); // ×10 concentrate at the wagon
    b.throw('mist', g.spill[0]);
    b.maintain(g.grid.creekCells, 70);
    b.maintain(g.spill.slice(4), 20);
    b.surveyAll();
    b.maintain(problems(g), 60);
  },
  'm3-quarry': (b, g) => {
    b.throw('phenol', g.grid.idx(11, 7));
    b.throw('phenol', g.grid.idx(14, 7));
    const pink = g.spill;
    b.maintain([...pink, g.grid.idx(9, 6)], 45);
    while (!b.done && g.t < 120) {
      b.surveyAll();
      b.maintain(problems(g), 5);
    }
  },
  'm4-blueberry': (b, g) => {
    const berries = cellsOf(g, Kind.Blueberry);
    b.throw('mist', berries[5]);
    b.maintain(berries, 60);
    const hive = g.spill.slice(berries.length, berries.length + 3);
    b.throw('mist', hive[0]);
    b.maintain(hive, 30);
    const school = g.spill.slice(berries.length + 3);
    b.throw('mist', school[0]);
    b.maintain(school, 30);
    while (!b.done && g.t < 200) {
      b.surveyAll();
      b.maintain(problems(g), 5);
    }
  },
  'm5-storm': (b, g) => {
    const hives = cellsOf(g, Kind.Hive);
    const school = cellsOf(g, Kind.School);
    b.throw('canister', hives[Math.floor(hives.length / 2)]);
    b.throw('canister', school[Math.floor(school.length / 2)]);
    b.maintain(g.spill, 40);
    while (!b.done && g.t < 160) {
      b.surveyAll();
      b.maintain(problems(g), 5);
    }
  },
  'm6-night': (b, g) => {
    // Triage: the acid next to the hives first, then the base slug in the creek, then the rest.
    b.maintain(g.spill.slice(4, 6), 30);
    b.maintain(g.grid.creekCells.slice(10, 30), 50);
    b.maintain(g.spill, 120);
    while (!b.done && g.t < 220) {
      b.surveyAll();
      b.maintain(problems(g), 5);
    }
  },
};

for (const k of Object.keys(intended)) (intended[k] as { finish?: boolean }).finish = true;

// ---------- wrong / constant strategies ----------

/** Spray `valve` on every spill cell for a while, ignoring what it is. */
export function constant(valve: 'acid' | 'base' | 'water', seconds = 3) {
  return (b: Bot, g: Game) => {
    for (let pass = 0; pass < 3 && !b.done; pass++) {
      for (const c of g.spill) {
        if (b.done) break;
        b.approach(c);
        b.aimCell(c);
        if (valve !== 'water' && g.tank[valve] < 0.02) b.refill();
        if (valve === 'water' && g.tank.water < 2) b.refill();
        b.aimCell(c);
        b.spray(valve, seconds);
      }
    }
  };
}

/**
 * An indicator-free ranger: never throws litmus, phenolphthalein or mist. Uses only what the
 * game shows on unmeasured ground — grey "suspect" patches and the neutralization heat (fizz) —
 * plus a learned rule of thumb: keep spraying while it fizzes, then add 8 small puffs.
 * Blueberries get a fixed dose of acid (the brief says they like acidic soil).
 */
export const blindWith = (berryDose: number) => (b: Bot, g: Game) => {
  const fizzAt = (from: number, c: number) =>
    g.fx.slice(from).some((e) => e.type === 'fizz' && g.grid.cellAt(e.x, e.z) === c);
  for (let pass = 0; pass < 3 && !b.done; pass++) {
    const cells: number[] = [];
    for (let c = 0; c < g.grid.count; c++) if (g.grid.suspect[c]) cells.push(c);
    for (const c of cells) {
      if (b.done) break;
      b.approach(c);
      b.aimCell(c);
      if (g.grid.band(c).hi < 7) {
        if (g.tank.acid < 0.02) b.refill();
        b.aimCell(c);
        if (pass === 0) b.spray('acid', berryDose);
        continue;
      }
      for (const valve of ['base', 'acid'] as const) {
        if (g.tank[valve] < 0.02) b.refill();
        b.aimCell(c);
        let mark = g.fx.length;
        b.spray(valve, 0.01);
        b.wait(0.8);
        if (!fizzAt(mark, c)) continue;
        for (let i = 0; i < 40 && !b.done; i++) {
          mark = g.fx.length;
          if (g.tank[valve] < 0.02) b.refill();
          b.aimCell(c);
          b.spray(valve, 0.3);
          b.wait(0.6);
          if (!fizzAt(mark, c)) break;
        }
        for (let k = 0; k < 8; k++) b.spray(valve, 0.01);
        b.wait(0.6);
        break;
      }
    }
  }
};

export const blind = blindWith(1.2);

/** Bring every out-of-band spill cell to pH 7 (6.6–7.4), whatever lives there. */
export const everythingTo7 = (b: Bot, g: Game) => {
  for (let pass = 0; pass < 3 && !b.done; pass++) for (const c of g.spill) b.titrate(c, 6.6, 7.4, 15);
};
