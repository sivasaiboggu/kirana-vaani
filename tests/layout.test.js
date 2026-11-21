// Layout regression test — every page must fit the viewport with no
// horizontal overflow, at desktop (1280px) and at a 390px phone width.
// Drives real headless Chrome over CDP (device metrics override gives a
// true 390px viewport — --window-size alone bottoms out at 500px) and
// reads the ?layoutcheck=1 report each page writes into its own DOM
// (see src/shell.js).
//
// This VM's Hatch Chrome needs a WebGL domain-policy file (contract +
// SHA-256) just to start, and it blocks DevTools-initiated navigation to
// http://127.0.0.1 — so pages load over file:// with
// --allow-file-access-from-files, launched with the first URL as a CLI
// argument (same recipe as EchoBack's tests/layout.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const CHROME = process.env.CHROME_BIN
  || ['/opt/meta-chromium/chrome', '/usr/bin/chromium-browser', 'google-chrome']
    .find((c) => c.startsWith('/') ? fs.existsSync(c) : true);
const DEBUG_PORT = 9223;

function chromeArgs(debugPort, firstUrl) {
  const policy = 'hatch-webgl-allowed-domains-v1\nexample.com\n';
  const file = path.join(os.tmpdir(), 'kirana-vaani-webgl-policy.txt');
  fs.writeFileSync(file, policy);
  const sha = createHash('sha256').update(policy).digest('hex');
  return [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files',
    `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'kirana-vaani-chrome-'))}`,
    `--hatch-webgl-allowed-domains-file=${file}`,
    `--hatch-webgl-allowed-domains-sha256=${sha}`,
    `--remote-debugging-port=${debugPort}`,
    '--window-size=1280,900',
    firstUrl,
  ];
}

const pageUrl = (page) => `file://${ROOT}/${page}`;

// ---------- tiny CDP client (built-in WebSocket, no deps) ----------

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }

  async call(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const done = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return done;
  }

  async waitForEvent(method, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
      const i = this.events.findIndex((e) => e.method === method);
      if (i >= 0) return this.events.splice(i, 1)[0];
      if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${method}`);
      await delay(100);
    }
  }

  async evaluate(expression) {
    const { result } = await this.call('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(`evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
    return result.value;
  }

  close() { try { this.ws.close(); } catch (err) { /* already closed */ } }
}

async function withBrowser(fn) {
  const chrome = spawn(CHROME, chromeArgs(DEBUG_PORT, pageUrl('index.html')));
  try {
    let wsUrl = null;
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const targets = await res.json();
        const page = targets.find((t) => t.type === 'page');
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch (err) { /* not up yet */ }
      await delay(200);
    }
    assert.ok(wsUrl, 'Chrome DevTools did not come up');
    const cdp = new Cdp(wsUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await fn(cdp);
    cdp.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function layoutReport(cdp, url, width, waitMs) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width, height: 844, deviceScaleFactor: 1, mobile: width < 600,
  });
  await cdp.call('Page.navigate', { url });
  await cdp.waitForEvent('Page.loadEventFired');
  await delay(waitMs);
  const raw = await cdp.evaluate(`(document.getElementById('layout-check') || {}).textContent || ''`);
  assert.ok(raw, `no layout-check report in ${url} (page may not have loaded)`);
  return JSON.parse(raw);
}

const PAGES = [
  'index.html',
  'dashboard.html',
  'settings.html',
  'counter.html?demo=ta&fast=1',
  'counter.html?demo=ml&fast=1',
];

test('no horizontal overflow at 390px (phone) on any page', { timeout: 240000 }, async () => {
  await withBrowser(async (cdp) => {
    for (const page of PAGES) {
      const sep = page.includes('?') ? '&' : '?';
      const waitMs = page.startsWith('counter') ? 7000 : 3500;
      const report = await layoutReport(cdp, pageUrl(`${page}${sep}layoutcheck=1`), 390, waitMs);
      assert.equal(report.vw, 390, page);
      assert.equal(report.overflow, false, `${page} overflows at 390px: ${JSON.stringify(report.offenders)}`);
    }
  });
});

test('no horizontal overflow at 1280px (desktop) on landing + dashboard', { timeout: 180000 }, async () => {
  await withBrowser(async (cdp) => {
    for (const page of ['index.html', 'dashboard.html']) {
      const report = await layoutReport(cdp, pageUrl(`${page}?layoutcheck=1`), 1280, 3500);
      assert.equal(report.overflow, false, `${page} overflows at 1280px: ${JSON.stringify(report.offenders)}`);
    }
  });
});
