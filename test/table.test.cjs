const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox'],
  });
});
after(async () => { await browser?.close(); });

async function openTable(t) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 920 } });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  await page.addInitScript(() => { try { localStorage.removeItem('chipless'); } catch (e) {} });
  await page.goto(pathToFileURL(resolve(__dirname, '../index.html')).href);
  return page;
}

async function bet(page, amount) {
  await page.locator('#btns .b-raise').click();
  await page.locator('#ramt').fill(String(amount));
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
}

async function checkPot(page, total, detail = '') {
  assert.equal(await page.locator('#potval').textContent(), String(total));
  assert.equal(await page.locator('#potsub').textContent(), detail);
}

test('opening bet stays in one pot and returns on fold-out', async t => {
  const page = await openTable(t);
  await checkPot(page, 8);
  await bet(page, 8);
  await checkPot(page, 16);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Fold', exact: true }).click();
  await checkPot(page, 0);
  assert.deepEqual(await page.locator('.sstack').allTextContents(), ['998', '1006', '998', '998']);
  assert.match(await page.locator('#logfull').textContent(), /won 8.*everyone folded.*Uncalled 8 returned/s);
});

test('short all-in and a larger bet create a genuine side pot', async t => {
  const page = await openTable(t);
  const fold = page.getByRole('button', { name: 'Fold', exact: true });
  const call = page.locator('#btns .b-call');
  await bet(page, 988);
  await call.click();
  await fold.click();
  await fold.click();
  await page.getByRole('button', { name: 'Deal the flop' }).click();
  await call.click(); // Check, then the caller folds and carries 10 chips into hand 2.
  await fold.click();
  await page.getByRole('button', { name: 'Deal hand 2' }).click();

  await page.keyboard.press('a');
  await checkPot(page, 16);
  await bet(page, 18);
  await checkPot(page, 34, 'main 24  ·  side 10');
  await call.click();
  await checkPot(page, 52, 'main 32  ·  side 20');
  assert.equal(await page.locator('#seats .seat').count(), 4);
  await page.screenshot({ path: '/workspace/chipless-sidepot-preview.png' });

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await fold.click();
  await fold.click();
  await checkPot(page, 34, 'main 24  ·  side 10');
  await page.getByRole('button', { name: 'Pick the winner' }).click();
  await checkPot(page, 24);
  assert.equal(await page.locator('#award .potpick').count(), 1);
  assert.match(await page.locator('#lastlog').textContent(), /Uncalled 10 returned/);
  await page.locator('#award').getByRole('button', { name: 'Player 3', exact: true }).click();
  await page.getByRole('button', { name: 'Award 24' }).click();
  await checkPot(page, 0);
});
