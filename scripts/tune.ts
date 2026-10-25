import { intended, constant, everythingTo7, run } from '../tests/strategies';
const which = process.argv[2];
for (const id of Object.keys(intended)) {
  if (which && !id.startsWith(which)) continue;
  const show = (name: string, o: ReturnType<typeof run>) => console.log(id.padEnd(14), name.padEnd(10), o.status, o.reason, 't=' + o.t, 'chem=' + o.chem, 'stars=' + o.stars, 'oob=' + o.outOfBand, JSON.stringify(o.assets));
  const t0 = Date.now();
  show('intended', run(id, intended[id]));
  if (process.argv[3] !== 'only') {
    show('base', run(id, constant('base')));
    show('acid', run(id, constant('acid')));
    show('water', run(id, constant('water', 4)));
    show('to7', run(id, everythingTo7));
  }
  console.log('  ms', Date.now() - t0);
}
if (process.argv[3] === 'blind') {
  const { blind } = await import('../tests/strategies');
  for (const id of ['m1-lemon', 'm2-creek', 'm3-quarry', 'm4-blueberry', 'm5-storm', 'm6-night']) {
    const o = run(id, blind);
    console.log('BLIND', id, o.status, o.reason, 't=' + o.t, 'oob=' + o.outOfBand, JSON.stringify(o.assets));
  }
}
