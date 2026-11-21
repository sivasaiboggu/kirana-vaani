// Real Chrome renders for review: desktop 1280px + phone 390px.
// Run: node scripts/shots.mjs
// Writes screenshots/*.png. Modelled on the EchoBack recipe for this VM:
// Hatch Chrome needs a WebGL domain-policy file just to start, and it
// blocks DevTools-initiated navigation to http://127.0.0.1, so pages load
// over file:// with --allow-file-access-from-files, launched with the
// first URL as a CLI argument.
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
const DEBUG_PORT = 9226;

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

  close() { try { this.ws.close(); } catch (err) { /* already closed */ } }
}

// Demo sessions (&fast=1) take ~10s to run through and end with the
// receipt summary, so counter shots wait longer.
const SHOTS = [
  { name: 'landing.png', width: 1280, url: 'index.html', waitMs: 4000 },
  { name: 'landing-mobile.png', width: 390, url: 'index.html', waitMs: 4000 },
  { name: 'dashboard.png', width: 1280, url: 'dashboard.html', waitMs: 4000 },
  { name: 'session-ta.png', width: 1280, url: 'counter.html?demo=ta&fast=1', waitMs: 13000 },
  { name: 'session-te.png', width: 1280, url: 'counter.html?demo=te&fast=1', waitMs: 13000 },
  { name: 'session-ta-mobile.png', width: 390, url: 'counter.html?demo=ta&fast=1', waitMs: 13000 },
  { name: 'settings.png', width: 1280, url: 'settings.html', waitMs: 3500 },
];

async function main() {
  const first = SHOTS[0];
  const chrome = spawn(CHROME, chromeArgs(DEBUG_PORT, pageUrl(first.url)));
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
    if (!wsUrl) throw new Error('Chrome DevTools did not come up');
    const cdp = new Cdp(wsUrl);
    await cdp.call('Page.enable');
    for (const shot of SHOTS) {
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: shot.width, height: 844, deviceScaleFactor: 1, mobile: shot.width < 600,
      });
      await cdp.call('Page.navigate', { url: pageUrl(shot.url) });
      await cdp.waitForEvent('Page.loadEventFired');
      await delay(shot.waitMs);
      const { data } = await cdp.call('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
      });
      fs.writeFileSync(path.join(ROOT, 'screenshots', shot.name), Buffer.from(data, 'base64'));
      console.log('wrote', shot.name);
    }
    cdp.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
