import { intended, run } from '../tests/strategies';
const id = process.argv[2] ?? 'm2-creek';
const o = run(id, intended[id]);
const g = o.game.grid;
console.log(o.status, o.reason, o.t, JSON.stringify(o.assets));
for (const c of o.game.contaminated()) console.log(c, g.center(c), 'kind', g.kind[c], g.pH[c].toFixed(2), 'known', g.know[c], 'suspect', g.suspect[c]);
console.log('gadgets', o.game.gadgets, 'refills', o.game.stats.refills);
