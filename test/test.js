const { chromium } = require('playwright');

const APP = 'http://localhost:8080/index.html';
const MOCK_API = 'http://localhost:8788';
const TOKEN = 'ghp_testtoken1234567890123456789012345';

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  PASS', name); }
  else { failed++; console.log('  FAIL', name); }
}

(async () => {
  const browser = await chromium.launch();

  // ---------- Phone A ----------
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const A = await ctxA.newPage();
  A.on('pageerror', e => { failed++; console.log('  JS ERROR (A):', e.message); });
  await A.goto(APP);

  console.log('== first run wizard ==');
  ok(await A.locator('#wiz-intro').isVisible(), 'wizard shows on first run');

  // connect through wizard with mock API
  await A.evaluate(api => localStorage.setItem('bt_apibase', api), MOCK_API);
  await A.reload();
  await A.click('#wizConnect');
  await A.fill('#wizTokenInput', TOKEN);
  await A.click('#wizTokenGo');
  await A.waitForSelector('#wizard.show', { state: 'detached', timeout: 5000 }).catch(() => {});
  await A.waitForTimeout(800);
  ok(!(await A.locator('#wizard').evaluate(el => el.classList.contains('show'))), 'wizard closes after connect');
  const cfgA = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_cfg')));
  ok(cfgA && cfgA.gistId && cfgA.token === TOKEN, 'config saved with gist id');

  console.log('== quick logging ==');
  await A.click('#btnPee');
  await A.waitForTimeout(200);
  ok((await A.locator('#toastMsg').textContent()).includes('pee'), 'pee toast appears');
  await A.click('#btnPoop');
  await A.waitForTimeout(200);
  let evts = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')));
  ok(evts.filter(e => !e.deleted).length === 2, 'two events stored');

  // undo
  await A.click('#toastUndo');
  await A.waitForTimeout(200);
  evts = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')));
  ok(evts.filter(e => !e.deleted).length === 1, 'undo removes poop');
  ok(evts.filter(e => !e.deleted)[0].type === 'pee', 'remaining event is pee');

  console.log('== feed flow & side suggestion ==');
  await A.click('#btnFeed');
  ok(await A.locator('#feedSheet').isVisible(), 'feed sheet opens');
  // no previous feed -> default L, no suggestion hints
  ok((await A.locator('#hintL').textContent()) === '' && (await A.locator('#hintR').textContent()) === '', 'no suggestion on first feed');
  await A.click('#feedSideSeg button[data-side="R"]');
  await A.click('#feedSave');
  await A.waitForTimeout(300);
  ok((await A.locator('#lastFeedCard').textContent()).includes('Right'), 'home shows last feed side Right');
  ok((await A.locator('#lastFeedCard').textContent()).includes('Left side'), 'suggests Left next');

  await A.click('#btnFeed');
  ok((await A.locator('#hintL').textContent()) === 'suggested', 'L marked suggested');
  const selIsL = await A.locator('#feedSideSeg button[data-side="L"]').evaluate(el => el.classList.contains('sel'));
  ok(selIsL, 'L preselected (auto-alternate)');
  // override to same side (R) — the requested option
  await A.click('#feedSideSeg button[data-side="R"]');
  await A.click('#feedSave');
  await A.waitForTimeout(300);
  ok((await A.locator('#lastFeedCard').textContent()).includes('Left side'), 'after repeating R, still suggests Left');

  console.log('== edit & delete ==');
  await A.click('.tab[data-page="log"]');
  const rows = await A.locator('#page-log .evrow').count();
  ok(rows === 3, 'log shows 3 entries');
  await A.locator('#page-log .evrow').first().click();
  ok(await A.locator('#editSheet').isVisible(), 'edit sheet opens');
  await A.fill('#editTime', '2026-07-18T08:15');
  await A.click('#editSave');
  await A.waitForTimeout(300);
  ok((await A.locator('#page-log').textContent()).includes('July 18'), 'edited entry moved to July 18');
  // delete one
  A.once('dialog', d => d.accept());
  await A.locator('#page-log .evrow').last().click();
  await A.click('#editDelete');
  await A.waitForTimeout(300);
  ok((await A.locator('#page-log .evrow').count()) === 2, 'delete removes entry from log');

  console.log('== summary ==');
  await A.click('.tab[data-page="summary"]');
  const sumText = await A.locator('#page-summary').textContent();
  ok(sumText.includes('Last 24 hours'), 'summary has last-24h card');
  ok((await A.locator('#page-summary table.sum tr').count()) >= 2, 'summary table has day rows');

  console.log('== sync to gist ==');
  await A.evaluate(() => window.scrollTo(0, 0));
  await A.click('#syncChip');
  await A.waitForTimeout(1000);
  const gistList = await fetch(MOCK_API + '/gists', { headers: { Authorization: 'token ' + TOKEN } }).then(r => r.json());
  ok(gistList.length === 1, 'exactly one gist created');
  const doc = JSON.parse(gistList[0].files['babylog.json'].content);
  ok(doc.events.filter(e => !e.deleted).length === 2, 'gist holds 2 live events');
  ok(doc.events.some(e => e.deleted), 'tombstones synced too');

  // ---------- Phone B joins via share link ----------
  console.log('== phone B joins via share link ==');
  const payload = await A.evaluate(() => {
    const cfg = JSON.parse(localStorage.getItem('bt_cfg'));
    const meta = JSON.parse(localStorage.getItem('bt_meta'));
    return btoa(unescape(encodeURIComponent(JSON.stringify({ t: cfg.token, g: cfg.gistId, n: meta.name }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctxB.addInitScript(api => { try { localStorage.setItem('bt_apibase', api); } catch (e) {} }, MOCK_API);
  const B = await ctxB.newPage();
  B.on('pageerror', e => { failed++; console.log('  JS ERROR (B):', e.message); });
  await B.goto(APP + '#s=' + payload);
  await B.waitForTimeout(300);
  ok(await B.locator('#wiz-join').isVisible(), 'join screen appears from link');
  await B.click('#wizJoinGo');
  await B.waitForTimeout(1200);
  const evB = await B.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => !e.deleted).length);
  ok(evB === 2, 'phone B pulled the 2 shared events');

  // B logs a feed; A should see it after sync
  await B.click('#btnFeed');
  await B.click('#feedSave');
  await B.waitForTimeout(2500); // debounce 1.2s + write
  await A.click('#syncChip');
  await A.waitForTimeout(1200);
  const evA = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => !e.deleted).length);
  ok(evA === 3, 'phone A sees event logged on phone B');

  console.log('== import parser ==');
  await A.click('.tab[data-page="settings"]');
  await A.click('#setImport');
  await A.fill('#importText', [
    '2026-07-15 14:35 feed L',
    '2026-07-15 15:10 poop',
    '7/15 3:22 pm pee',
    '2026-07-15 21:05 feed R',
    'garbage line'
  ].join('\n'));
  await A.waitForTimeout(200);
  ok((await A.locator('#importPreview').textContent()).includes('4 entries'), 'import preview counts 4');
  await A.click('#importGo');
  await A.waitForTimeout(2500);
  const evA2 = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => !e.deleted).length);
  ok(evA2 === 7, 'import added 4 entries');

  // B pulls them
  await B.click('#syncChip');
  await B.waitForTimeout(1200);
  const evB2 = await B.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => !e.deleted).length);
  ok(evB2 === 7, 'phone B receives imported entries');

  console.log('== sleep tracking ==');
  await A.click('.tab[data-page="home"]');
  await A.click('#btnSleep');
  await A.waitForTimeout(300);
  ok((await A.locator('#btnSleep').textContent()).includes('Sleeping'), 'sleep button shows active state');
  let sleeps = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => e.type === 'sleep' && !e.deleted));
  ok(sleeps.length === 1 && sleeps[0].end == null, 'open sleep event stored');
  await A.waitForTimeout(2000); // let debounce push
  // cross-phone: B sees the ongoing sleep and ends it
  await B.click('#syncChip');
  await B.waitForTimeout(1200);
  await B.click('.tab[data-page="home"]');
  ok((await B.locator('#btnSleep').textContent()).includes('Sleeping'), 'phone B sees ongoing sleep');
  await B.click('#btnSleep');
  await B.waitForTimeout(2000);
  await A.click('#syncChip');
  await A.waitForTimeout(1200);
  ok((await A.locator('#btnSleep').textContent()).includes('Start sleep'), 'phone A sees sleep ended by B');
  sleeps = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => e.type === 'sleep' && !e.deleted));
  ok(sleeps.length === 1 && typeof sleeps[0].end === 'number', 'sleep has end timestamp after B stopped it');

  console.log('== sleep import + summary average ==');
  await A.click('.tab[data-page="settings"]');
  await A.click('#setImport');
  await A.fill('#importText', '2026-07-15 2:00pm sleep 3:00pm\n2026-07-15 4:00pm sleep 4:30pm\n2026-07-15 11:00pm sleep 1:00am');
  await A.waitForTimeout(200);
  ok((await A.locator('#importPreview').textContent()).includes('3 entries'), 'sleep import lines recognized');
  await A.click('#importGo');
  await A.waitForTimeout(400);
  const imported = await A.evaluate(() => JSON.parse(localStorage.getItem('bt_events')).filter(e => e.type === 'sleep' && e.ts < new Date(2026, 6, 16).getTime() && !e.deleted));
  ok(imported.length === 3, 'three sleeps imported for Jul 15');
  ok(imported.some(e => e.end - e.ts === 2 * 3600e3), 'overnight sleep (11pm-1am) spans 2h into next day');
  // avg for Jul 15: the 30m false start is below the 45m threshold, so (60 + 120) / 2 = 90min = 1h 30m
  await A.click('.tab[data-page="summary"]');
  const sumTxt = await A.locator('#page-summary').textContent();
  ok(sumTxt.includes('1h 30m'), 'daily average excludes <45m false starts (1h 30m, not 1h 10m)');
  ok(sumTxt.includes('avg sleep'), 'last-24h card includes avg sleep stat');
  ok(!/\bL\b.*\bR\b/.test(await A.locator('#page-summary table.sum tr').first().textContent()), 'L/R columns removed from summary table');

  console.log('== edit sleep entry ==');
  await A.click('.tab[data-page="log"]');
  const sleepRow = A.locator('#page-log .evrow', { hasText: 'Sleep · 30m' }).first();
  await sleepRow.click();
  ok(await A.locator('#editEndField').isVisible(), 'edit sheet shows end-time field for sleep');
  // invalid end before start rejected
  const startVal = await A.inputValue('#editTime');
  await A.fill('#editEndTime', '2026-07-15T13:00');
  await A.click('#editSave');
  await A.waitForTimeout(300);
  ok(await A.locator('#editSheet').isVisible(), 'invalid end time keeps sheet open');
  await A.fill('#editEndTime', '2026-07-15T16:45');
  await A.click('#editSave');
  await A.waitForTimeout(300);
  ok((await A.locator('#page-log').textContent()).includes('Sleep · 45m'), 'sleep duration updated to 45m after edit');

  console.log('== bad token handling ==');
  const ctxC = await browser.newContext();
  await ctxC.addInitScript(api => { try { localStorage.setItem('bt_apibase', api); } catch (e) {} }, MOCK_API);
  const C = await ctxC.newPage();
  await C.goto(APP);
  await C.click('#wizConnect');
  // mock accepts any 'token ghp_' auth, so simulate rejection with a garbage-prefix token:
  await C.fill('#wizTokenInput', 'zzz_notatoken_but_long_enough_12345');
  await C.click('#wizTokenGo');
  await C.waitForTimeout(800);
  ok(await C.locator('#wizErr').isVisible(), 'bad token shows an error');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
