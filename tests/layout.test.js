import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { preview } from 'vite';

let browser;
let server;
let base;

before(async () => {
  server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  base = new URL(server.config.base, `http://127.0.0.1:${server.httpServer.address().port}`);
  const executablePath = process.env.CHROME_BIN ||
    (await access('/usr/bin/chromium').then(() => '/usr/bin/chromium', () => undefined));
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

const pages = [
  ['index.html', '#heroTranscript .hero-line'],
  ['dashboard.html', '#sessionHistory table'],
  ['counter.html', '#langSwitch .lang-pill[aria-pressed]'],
  ['settings.html', '#shopLang option'],
  ['privacy.html', '.legal h1'],
  ['404.html', '.error-page h1'],
  ['500.html', '.error-page h1'],
];

async function visit(page, route, ready) {
  const response = await page.goto(new URL(route, base).href);
  assert.equal(response.status(), 200, route);
  await page.locator(ready).first().waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
}

test('built pages fit 320, 390, 768, 1280 and 1440px in light and dark', { timeout: 60000 }, async () => {
  const cases = [320, 390, 768, 1280, 1440].flatMap((width) => ['light', 'dark'].map((theme) => [width, theme]));
  for (const [width, colorScheme] of cases) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, colorScheme });
    try {
      for (const [route, ready] of pages) {
        await visit(page, route, ready);
        const size = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.equal(size.viewport, width, route);
        assert.equal(size.content, width, `${route} at ${width}px in ${colorScheme}`);
      }
      await visit(page, 'counter.html?demo=ml&fast=1', '#transcript .bubble.agent');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    } finally {
      await page.context().close();
    }
  }
});

test('axe finds no WCAG 2.2 AA violations on the main pages in either mode', { timeout: 60000 }, async () => {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme });
    const page = await context.newPage();
    try {
      for (const [route, ready] of pages) {
        await visit(page, route, ready);
        const { violations } = await new AxeBuilder({ page }).withTags([
          'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa',
        ]).analyze();
        assert.deepEqual(violations.map(({ id, nodes }) => ({
          id, targets: nodes.map(({ target }) => target),
        })), [], `${route} in ${colorScheme}`);
      }
    } finally {
      await page.context().close();
    }
  }
});

test('typed counter, UPI, receipt, restock and dashboard share one session', { timeout: 45000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    await visit(page, 'counter.html', '#langSwitch .lang-pill[aria-pressed]');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const input = page.locator('#textInput');
    const send = async (order, expected) => {
      await input.fill(order);
      await input.press('Enter');
      await page.locator('#transcript .bubble.agent').filter({ hasText: expected }).last().waitFor();
    };
    await send('Aashirvaad atta 5 kg', '₹275.00');
    await send('Basmati rice 2 kg', 'Ponni');
    await send('yes', '₹403.00');
    await page.locator('#payBtn').click();
    await page.locator('#qrImg[src^="data:"]').waitFor();
    const link = new URL(await page.locator('#upiLinkText').getAttribute('href'));
    assert.equal(link.protocol, 'upi:');
    assert.equal(link.searchParams.get('am'), '403.00');
    await send('2 kg sugar', '₹499.00');
    assert.equal(await page.locator('#qrCard').isVisible(), false);
    await page.locator('#payBtn').click();
    await page.locator('#qrImg[src^="data:"]').waitFor();
    const updatedLink = new URL(await page.locator('#upiLinkText').getAttribute('href'));
    assert.equal(updatedLink.searchParams.get('am'), '499.00');
    await page.getByRole('button', { name: 'End session' }).click();
    await page.locator('#summaryCard').waitFor();
    assert.match(await page.locator('#summaryCard').innerText(), /Receipt[\s\S]+₹499\.00/);
    await visit(page, 'dashboard.html', '#sessionHistory table');
    assert.match(await page.locator('#sessionHistory tbody tr').first().innerText(), /English[\s\S]+₹499\.00/);
    await page.locator('#sessionHistory details summary').first().click();
    await page.locator('#sessionHistory details[open] .mini-transcript').filter({ hasText: 'Basmati rice' }).waitFor();
    assert.match(await page.locator('#signalList').innerText(), /Basmati Rice/);
  } finally {
    await page.context().close();
  }
});

test('validates and saves settings per shop, and keeps theme on navigation', { timeout: 30000 }, async () => {
  const page = await browser.newPage({ colorScheme: 'light' });
  try {
    await visit(page, 'settings.html', '#shopLang option');
    const vpa = page.locator('#shopVpa');
    await vpa.fill('incorrect');
    await page.getByRole('button', { name: 'Save shop details' }).click();
    assert.equal(await vpa.getAttribute('aria-invalid'), 'true');
    assert.equal(await vpa.evaluate((node) => node === document.activeElement), true);
    await vpa.fill('testshop@testbank');
    await page.locator('#shopName').fill('Edited Shop');
    await page.getByRole('button', { name: 'Save shop details' }).click();
    assert.equal(await page.locator('#shopSaved').textContent(), 'Shop details saved.');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.locator('#shopTitle').filter({ hasText: 'Edited Shop' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByLabel('Switch shop').selectOption('annapurna');
    await page.locator('#shopTitle').filter({ hasText: 'Annapurna' }).waitFor();

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('#shopLang option').first().waitFor({ state: 'attached' });
    assert.notEqual(await vpa.inputValue(), 'testshop@testbank');
    await page.locator('#sarvamKey').fill('test-token');
    await page.getByRole('button', { name: 'Save key' }).click();
    assert.match(await page.locator('#engineStatus').textContent(), /Sarvam voice/);
    await page.getByRole('button', { name: 'Remove key' }).click();
    assert.match(await page.locator('#keyState').textContent(), /No key saved/);
  } finally {
    await page.context().close();
  }
});

test('the installed shell opens typed counter and dashboard offline', { timeout: 30000 }, async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await visit(page, 'index.html', '#heroTranscript .hero-line');
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', undefined, { timeout: 10000 });
    await context.setOffline(true);
    await visit(page, 'counter.html', '#langSwitch .lang-pill[aria-pressed]');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.locator('#textInput').fill('Aashirvaad atta 5 kg');
    await page.locator('#textInput').press('Enter');
    await page.locator('#billTotal').filter({ hasText: '275.00' }).waitFor();
    await visit(page, 'dashboard.html', '#sessionHistory table');
  } finally {
    await context.close();
  }
});


test('shelf and bill edits carry through a saved khata bill and partial repayment', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await visit(page, 'counter.html', '#langSwitch .lang-pill[aria-pressed]');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Find an item' }).fill('sugar');
    await page.getByRole('button', { name: 'Add Sugar', exact: true }).click();
    await page.locator('#billTotal').filter({ hasText: '48.00' }).waitFor();
    await page.getByRole('button', { name: 'Pay with UPI' }).click();
    await page.locator('#qrImg[src^="data:"]').waitFor();
    await page.getByRole('textbox', { name: 'Quantity for Sugar' }).fill('2.5');
    await page.getByRole('button', { name: 'Set quantity for Sugar' }).click();
    await page.locator('#billTotal').filter({ hasText: '120.00' }).waitFor();
    assert.equal(await page.locator('#qrCard').isVisible(), false);
    await page.getByRole('button', { name: 'Add to khata' }).click();
    await page.getByLabel('Customer name').fill('Lakshmi Rao');
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id), []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await page.getByRole('button', { name: 'Save credit bill' }).click();
    await page.getByRole('link', { name: 'Open khata' }).click();
    const customer = page.locator('.khata-account').filter({ hasText: 'Lakshmi Rao' });
    await customer.locator('summary').click();
    const payment = customer.getByLabel('Payment received (₹)');
    await payment.fill('121');
    await customer.getByRole('button', { name: 'Record payment' }).click();
    await customer.getByRole('alert').filter({ hasText: 'exceeds' }).waitFor();
    await payment.fill('45.50');
    await customer.getByRole('button', { name: 'Record payment' }).click();
    await customer.locator('summary').filter({ hasText: '₹74.50 due' }).waitFor();
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id), []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await page.reload();
    await customer.locator('summary').filter({ hasText: '₹74.50 due' }).click();
    assert.match(await customer.innerText(), /Payment received\s+₹45\.50[\s\S]+Credit bill\s+₹120\.00/);
    assert.match(await page.locator('#sessionHistory tbody tr').first().innerText(), /2.5 Sugar[\s\S]+₹120\.00/);
    await page.getByLabel('Switch shop').selectOption('annapurna');
    await page.getByText('No credit bills yet.', { exact: false }).waitFor();
  } finally {
    await page.context().close();
  }
});

test('voice review can edit or discard recognition without changing the running bill', { timeout: 30000 }, async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.addInitScript(() => {
      window.SpeechRecognition = class {
        start() { window.mockRecognition = this; }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        speak: (utterance) => setTimeout(() => utterance.onend?.(), 0), cancel() {},
      } });
    });
    await visit(page, 'counter.html', '#langSwitch .lang-pill[aria-pressed]');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const input = page.locator('#textInput');
    await input.fill('1 kg sugar');
    await input.press('Enter');
    await page.locator('#billTotal').filter({ hasText: '48.00' }).waitFor();
    await page.getByLabel('Review what the mic heard', { exact: false }).check();
    await page.getByRole('button', { name: 'Start voice session' }).click();
    await page.waitForFunction(() => window.mockRecognition);
    const say = async (text) => {
      await page.evaluate((transcript) => window.mockRecognition.onresult({ results: [[{ transcript }]] }), text);
      await page.locator('#voiceDraft').waitFor();
    };
    await say('7 kg sugar');
    assert.equal(await input.inputValue(), '7 kg sugar');
    assert.equal(await page.locator('#billTotal').textContent(), '₹48.00');
    await input.fill('2 kg sugar');
    await input.press('Enter');
    await page.locator('#billTotal').filter({ hasText: '144.00' }).waitFor();
    await say('5 kg sugar');
    await page.getByRole('button', { name: 'Discard' }).click();
    assert.equal(await page.locator('#billTotal').textContent(), '₹144.00');
    assert.equal(await page.locator('#voiceDraft').isVisible(), false);
    await page.getByRole('button', { name: 'End session' }).click();
    await page.locator('#summaryCard').waitFor();
  } finally {
    await page.context().close();
  }
});
