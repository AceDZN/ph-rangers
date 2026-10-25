// Captures real gameplay at the mockups' viewport through real keyboard/mouse input.
// Usage: node scripts/capture.mjs [url]   (dev server must be running)
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5197/?autopause=0';
const out = 'docs/captures';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'], headless: process.env.HEADED ? false : true });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(m.text()); console.log('console:', m.text()); } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__phr && document.getElementById('title').hidden === false, null, { timeout: 30000 });
await page.screenshot({ path: `${out}/00-title.png` });

const adv = (ms) => page.evaluate((m) => window.advanceTime(m), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function start(id, cellIndex, pitch = 0.45) {
  await page.evaluate(([id, ci, pitch]) => {
    const P = window.__phr;
    P.startMission(id);
    const g = P.game();
    const [x, z] = g.grid.center(g.spill[ci]);
    P.setCam(Math.atan2(x - g.player.x, z - g.player.z), pitch);
  }, [id, cellIndex, pitch]);
  await adv(200);
}
async function aimAtSpill(i, dx = 0, dz = 0) {
  const p = await page.evaluate(([i, dx, dz]) => {
    const g = window.__phr.game();
    const [x, z] = g.grid.center(g.spill[i]);
    return window.__phr.project(x + dx, z + dz);
  }, [i, dx, dz]);
  await page.mouse.move(p.x, p.y);
  await adv(50);
}
async function walk(ms) {
  await page.keyboard.down('KeyW');
  await adv(ms);
  await page.keyboard.up('KeyW');
  await adv(200);
}
async function key(k) {
  await page.keyboard.press(k);
  await adv(50);
}
async function spray(ms) {
  await page.keyboard.down('Space');
  await adv(ms);
  await page.keyboard.up('Space');
}

// 01 — first 30 s: litmus on the lemon puddle.
await start('m1-lemon', 0);
await walk(1000);
await aimAtSpill(0);
await key('KeyR');
await adv(1100);
await page.screenshot({ path: `${out}/01-first-30s.png` });

// 02 — core spray: mist then base on the pH 3 bank puddle in mission 2.
await start('m2-creek', 4, 0.5);
await aimAtSpill(4);
await key('KeyG');
await adv(1700);
await aimAtSpill(4);
await page.keyboard.down('Space');
await adv(2200);
await aimAtSpill(5);
await adv(900);
await page.screenshot({ path: `${out}/02-core-spray.png` });
await page.keyboard.up('Space');

// 03 — overshoot: keep spraying base past neutral.
await aimAtSpill(4);
await spray(3600);
await adv(150);
await page.screenshot({ path: `${out}/03-overshoot.png` });

// 04 — night transfer: mist near the hives and spray.
await start('m6-night', 4, 0.45);
await walk(900);
await aimAtSpill(4);
await key('KeyG');
await adv(1700);
await key('Digit2');
await aimAtSpill(4);
await page.keyboard.down('Space');
await adv(1200);
await page.screenshot({ path: `${out}/04-night.png` });
await page.keyboard.up('Space');

// 05 — mission 3: phenolphthalein reveals lime in pink.
await page.evaluate(() => {
  const P = window.__phr;
  P.startMission('m3-quarry');
  const g = P.game();
  const [x, z] = g.grid.center(g.grid.idx(12, 7));
  P.setCam(Math.atan2(x - g.player.x, z - g.player.z), 0.75);
});
await walk(700);
const pp = await page.evaluate(() => {
  const g = window.__phr.game();
  const [x, z] = g.grid.center(g.grid.idx(12, 7));
  return window.__phr.project(x, z);
});
await page.mouse.move(pp.x, pp.y);
await adv(50);
await key('KeyF');
await adv(1800);
await page.screenshot({ path: `${out}/05-phenol.png` });

// 06 — mobile width.
await page.setViewportSize({ width: 390, height: 844 });
await start('m1-lemon', 0, 0.5);
await adv(300);
await page.screenshot({ path: `${out}/06-mobile.png` });

const s = await state();
console.log(JSON.stringify({ errors, fps: s.fps, tripo: s.tripoModels, ranger: s.rangerTripo }));
await browser.close();
