import { Grid, Kind } from '../src/sim/world';
import { GALILEE, NIGHT } from '../src/sim/layout';
const ch: Record<number, string> = { [Kind.Soil]: '.', [Kind.Path]: '=', [Kind.Creek]: '~', [Kind.Pond]: 'O', [Kind.Blueberry]: 'b', [Kind.Hive]: 'h', [Kind.School]: 's', [Kind.Quarry]: 'q', [Kind.Orchard]: 'o' };
for (const L of [GALILEE, NIGHT]) {
  const g = new Grid(L);
  console.log(L.id, 'creek cells', g.creekCells.length, 'pond', g.pondCells.length);
  let hdr = '    '; for (let i = 0; i < g.n; i++) hdr += (i % 10); console.log(hdr);
  for (let j = 0; j < g.n; j++) { let row = String(j).padStart(3) + ' '; for (let i = 0; i < g.n; i++) row += ch[g.kind[g.idx(i, j)]]; console.log(row + '  h=' + g.h[g.idx(16, j)].toFixed(1)); }
}
