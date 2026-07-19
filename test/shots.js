const { chromium } = require('playwright');
const APP = 'http://localhost:8080/index.html';
const MOCK_API = 'http://localhost:8788';

(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: scheme, deviceScaleFactor: 2 });
    await ctx.addInitScript(api => {
      localStorage.setItem('bt_apibase', api);
      localStorage.setItem('bt_skipped', '1');
      localStorage.setItem('bt_meta', JSON.stringify({ name: 'Theo', nameUpdatedAt: 1 }));
      const now = Date.now(), H = 3600e3;
      const ev = (type, side, ago) => ({ id: type + ago, type, side, ts: now - ago, updatedAt: 1, deleted: false });
      localStorage.setItem('bt_events', JSON.stringify([
        ev('feed', 'L', 2.2 * H), ev('pee', null, 2.0 * H), ev('poop', null, 5.1 * H),
        ev('feed', 'R', 5.3 * H), ev('feed', 'L', 8.4 * H), ev('pee', null, 8.2 * H),
        ev('feed', 'R', 11.6 * H), ev('poop', null, 11.4 * H), ev('feed', 'L', 26 * H),
        ev('pee', null, 25 * H), ev('feed', 'R', 29 * H), ev('poop', null, 28.5 * H),
        ev('feed', 'L', 32 * H), ev('pee', null, 31 * H), ev('feed', 'R', 50 * H),
        ev('poop', null, 49 * H), ev('feed', 'L', 54 * H), ev('pee', null, 53 * H),
      ]));
    }, MOCK_API);
    const p = await ctx.newPage();
    await p.goto(APP);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `shot-home-${scheme}.png` });
    await p.click('#btnFeed');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `shot-feed-${scheme}.png` });
    await p.click('#feedCancel');
    await p.click('.tab[data-page="log"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `shot-log-${scheme}.png` });
    await p.click('.tab[data-page="summary"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `shot-summary-${scheme}.png` });
    await p.click('.tab[data-page="settings"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `shot-settings-${scheme}.png` });
    await ctx.close();
  }
  await browser.close();
  console.log('shots done');
})();
