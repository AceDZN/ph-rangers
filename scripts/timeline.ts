// Prints how a bot's intended run of a mission spends its time.
import { Game } from '../src/sim/game';
import { Bot } from '../tests/bot';
import { intended, problems } from '../tests/strategies';
const id = process.argv[2] ?? 'm2-creek';
const g = new Game(id);
const b = new Bot(g);
const origWait = b.wait.bind(b);
let walk = 0, spray = 0, waited = 0;
const ow = b.walkTo.bind(b);
b.walkTo = (x, z, r, m) => { const t0 = g.t; ow(x, z, r, m); walk += g.t - t0; };
const os = b.spray.bind(b);
b.spray = (v, s, st) => { const t0 = g.t; os(v, s, st); spray += g.t - t0; };
b.wait = (s) => { const t0 = g.t; origWait(s); waited += g.t - t0; };
let next = 10;
const og = g.update.bind(g);
g.update = (dt, inp) => {
  og(dt, inp);
  if (g.t >= next) {
    next += 10;
    const o = g.objectiveInfo();
    console.log(`t=${g.t.toFixed(0)} oob=${g.contaminated().length} measuredBad=${o.bad} unsurveyed=${o.unknown} assets=${g.assets.map((a) => `${a.id}:${a.pH.toFixed(2)}/${Math.round(a.health)}`).join(' ')} refills=${g.stats.refills}`);
  }
};
const plan = intended[id] as unknown as ((b: Bot, g: Game) => void) & { finish?: boolean };
plan(b, g);
for (let i = 0; i < 4 && !b.done && g.t < 300; i++) { b.surveyAll(); b.maintain(problems(g), 30); }
while (!b.done && g.t < 300) b.wait(0.5);
console.log(id, g.status, g.failReason, 't', g.t.toFixed(1), 'walk', walk.toFixed(0), 'spray', spray.toFixed(0), 'wait', waited.toFixed(0), 'mistThrows', g.events.filter((e) => e.action === 'mist').length);
