// An isolated Chromium context per viewport. Use the same runner for base and head.
// Usage: node scripts/shots.mjs <URL ending in /> <output directory> [light|dark]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [url, output, colorScheme = 'light'] = process.argv.slice(2);
if (!url || !output || !['light', 'dark'].includes(colorScheme)) {
  throw new Error('Usage: node scripts/shots.mjs <base URL> <output dir> [light|dark]');
}
const base = new URL(url.endsWith('/') ? url : url + '/');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox'],
});

try {
  await Promise.all([
    ['desktop', 1440, 1000],
    ['phone', 390, 844],
  ].map(async ([size, width, height]) => {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      colorScheme,
      reducedMotion: 'reduce',
      timezoneId: 'Asia/Kolkata',
    });
    try {
      const page = await context.newPage();
      const capture = async (name, target = page) => {
        await page.evaluate(() => document.fonts.ready);
        if (target !== page) {
          await target.scrollIntoViewIfNeeded();
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        await target.screenshot({
          path: path.join(output, `${name}-${size}.png`),
          animations: 'disabled',
          caret: 'hide',
        });
      };
      for (const [name, route, ready] of [
        ['home', 'index.html', '#heroTranscript .hero-line:nth-child(2)'],
        ['dashboard', 'dashboard.html', '#sessionHistory table'],
        ['settings', 'settings.html', '#shopName'],
      ]) {
        await page.goto(new URL(route, base).href);
        await page.locator(ready).first().waitFor();
        await capture(name);
      }

      await page.goto(new URL('counter.html?demo=ta&fast=1', base).href);
      await page.locator('#billTotal').filter({ hasText: '275.00' }).waitFor();
      await capture('counter');
      await page.locator('#summaryCard').waitFor({ timeout: 45000 });
      await capture('receipt', page.locator('#summaryCard'));
      await page.locator('#payBtn').click();
      await page.locator('#qrImg[src^="data:"]').waitFor();
      await capture('checkout', page.locator('#qrCard'));

      // Available on v2. Both revisions still run the identical capture path above.
      if (await page.locator('#khataBtn').count()) {
        await page.goto(new URL('counter.html', base).href);
        await page.getByRole('button', { name: 'English', exact: true }).click();
        await page.locator('#textInput').fill('2 kg sugar');
        await page.locator('#textInput').press('Enter');
        await page.getByRole('button', { name: 'Add to khata' }).click();
        await page.getByLabel('Customer name').fill('Lakshmi Rao');
        await page.getByRole('button', { name: 'Save credit bill' }).click();
        await page.getByRole('link', { name: 'Open khata' }).click();
        const account = page.locator('.khata-account').filter({ hasText: 'Lakshmi Rao' });
        await account.locator('summary').click();
        await account.getByLabel('Payment received (₹)').fill('25.50');
        await account.getByRole('button', { name: 'Record payment' }).click();
        await account.locator('summary').filter({ hasText: '₹70.50 due' }).waitFor();
        await capture('khata', page.locator('#khata'));
      }
    } finally {
      await context.close();
    }
  }));
} finally {
  await browser.close();
}
