// Renders the 1600×900 workbook poster (workbook/poster.jpg) from the current build, through real input.
// Usage: node scripts/poster.mjs [url]   (dev server must be running)
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5197/?autopause=0';
const browser = await chromium.launch({ headless: false, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(url);
await page.waitForFunction(() => window.__phr && document.getElementById('title').hidden === false, null, { timeout: 30000 });
await page.addStyleTag({ content: '#tutorial, #hintbox, .toast { display: none !important; }' });
const adv = (ms) => page.evaluate((m) => window.advanceTime(m), ms);
await page.evaluate(() => {
  const P = window.__phr;
  P.startMission('m1-lemon');
  const g = P.game();
  const [x, z] = g.grid.center(g.spill[1]);
  P.setCam(Math.atan2(x - g.player.x, z - g.player.z) + 0.25, 0.4);
});
await page.keyboard.down('KeyW');
await adv(900);
await page.keyboard.up('KeyW');
await adv(300);
const aim = async (i) => {
  const p = await page.evaluate((i) => {
    const g = window.__phr.game();
    const [x, z] = g.grid.center(g.spill[i]);
    return window.__phr.project(x, z);
  }, i);
  await page.mouse.move(p.x, p.y);
  await adv(60);
};
await aim(0);
await page.keyboard.press('KeyR');
await adv(1200);
await aim(2);
await page.keyboard.press('KeyG');
await adv(1700);
// Fix two patches (they bloom), then spray the third for the shot.
for (const i of [0, 2]) {
  await aim(i);
  await page.keyboard.press('Digit2');
  await page.keyboard.down('Space');
  await adv(6000);
  await page.keyboard.up('Space');
  await adv(600);
}
await aim(1);
await page.keyboard.down('Space');
await adv(1600);
await page.screenshot({ path: 'workbook/poster.jpg', type: 'jpeg', quality: 86 });
await page.keyboard.up('Space');
await browser.close();
console.log('wrote workbook/poster.jpg');
