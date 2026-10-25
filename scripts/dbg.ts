import { intended, run } from '../tests/strategies';
const o = run('m6-night', intended['m6-night']);
const g = o.game.grid;
for (const c of o.game.contaminated()) console.log(c, g.center(c), g.kind[c], g.pH[c].toFixed(2), 'E', g.E[c].toExponential(2), 'V', g.V[c].toFixed(1));
console.log('player', o.game.player);
