// Copy guard — the craft pass, enforced: no AI-slop clichés, no invented
// claims, no decorative symbols anywhere in user-facing copy, and no
// gradient/glass/shimmer tells left in the stylesheet.
// Scans the HTML pages and the JS that writes user-facing strings.
// Comment-only lines are skipped (developer notes may mention a pipeline
// with an arrow; the rendered page never does).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReceipt } from '../src/receipt.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

const BANNED_WORDS = [
  'seamless', 'supercharge', 'elevate', 'effortless', 'revolutionary',
  'ai-powered', 'welcome to the future', 'cutting-edge', 'game-changer',
  'game changer', 'next-gen', 'next gen', 'unlock the', 'delight',
  'magical', 'transform your', 'most popular', 'premium',
  'start free. pay when',
];

// Decorative symbols: play triangles, check marks, bullet dots used as
// status markers, arrows as text, and any emoji. (·, —, × and • are plain
// typography and stay allowed.)
const BANNED_SYMBOLS = ['▶', '►', '✓', '✔', '●', '○', '→', '←', '✨', '🚀', '🔥', '💡', '🎉', '⭐', '👋', '🎙', '📱', '💬', '🛒', '🪄', '⚡'];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function userFacingText(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (!file.endsWith('.js')) return raw;
  // Drop full-line comments; a // inside a string literal on a code line
  // survives, which is fine — the scan is about rendered strings.
  return raw.split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

function userFacingFiles() {
  const files = [];
  for (const name of fs.readdirSync(ROOT)) {
    if (name.endsWith('.html') || name.endsWith('.js')) files.push(name);
  }
  for (const name of fs.readdirSync(path.join(ROOT, 'src'))) {
    if (name.endsWith('.js')) files.push(`src/${name}`);
  }
  return files.sort();
}

test('no banned clichés or decorative symbols in user-facing copy', () => {
  for (const file of userFacingFiles()) {
    const text = userFacingText(file);
    const lower = text.toLowerCase();
    for (const word of BANNED_WORDS) {
      assert.ok(!lower.includes(word), `${file} still contains banned cliché: "${word}"`);
    }
    for (const sym of BANNED_SYMBOLS) {
      assert.ok(!text.includes(sym), `${file} still contains decorative symbol: "${sym}"`);
    }
    assert.ok(!EMOJI_RE.test(text), `${file} still contains an emoji or pictograph`);
  }
});

test('no gradient, glass or shimmer tells left in the stylesheet', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  for (const tell of ['linear-gradient', 'radial-gradient', 'backdrop-filter', 'shimmer']) {
    assert.ok(!css.includes(tell), `styles.css still contains "${tell}"`);
  }
});

test('design tokens: OKLCH colours with hex fallbacks, contrast table passes AA', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const palette = fs.readFileSync(path.join(ROOT, 'theme/tokens.css'), 'utf8');
  assert.ok(palette.includes('oklch('), 'theme should declare colours in OKLCH');
  assert.ok(!css.includes('transition: all'), 'styles.css still animates "all" — scope transitions to the property that changes');
  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8'));
  for (const [name, value] of Object.entries(tokens.color)) {
    assert.ok(value.hex && value.oklch, `tokens.json colour ${name} needs both hex and oklch`);
    assert.ok(/^oklch\(/.test(value.oklch), `tokens.json colour ${name} is not OKLCH`);
  }
  assert.ok(tokens.accent && tokens.accent.hex, 'tokens.json should name the one accent and why');
  assert.ok(tokens.contrast.length >= 10, 'tokens.json should carry a real contrast table');
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  for (const [rows, minimum] of [[tokens.contrast, 4.5], [tokens.nonTextContrast, 3]]) {
    for (const { foreground, background, pair, mode, ratio, aa } of rows) {
      const light = luminance(tokens.color[foreground].hex);
      const dark = luminance(tokens.color[background].hex);
      assert.equal(Number(((Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)).toFixed(2)), ratio, `${mode} ${pair}`);
      assert.ok(ratio >= minimum, `${mode} ${pair} falls below ${minimum}:1`);
      assert.equal(aa, 'pass');
    }
  }

});

test('landing states the real cost, not invented tiers', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('What it costs'), 'landing should have the honest cost section');
  assert.ok(!html.includes('Most popular'), 'landing still claims a "Most popular" tier');
  assert.ok(!html.includes('₹499') && !html.includes('₹1,499'), 'landing still shows invented prices');
  assert.ok(!html.includes('Kirana Pro') && !html.includes('Kirana Business'), 'landing still names invented tiers');
});

test('hero soundbox is labelled as a playback, never live', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'landing.js'), 'utf8');
  assert.ok(html.includes('Played back'), 'hero should say the session is played back');
  assert.ok(js.includes('Played back'), 'landing.js should label the playback');
  assert.ok(!html.includes('LIVE ·') && !js.includes('LIVE ·'), 'hero still claims the playback is live');
  assert.ok(!html.includes('live-dot') && !js.includes('live-dot'), 'blinking live dot still referenced');
});

test('receipt restock note is localised in all seven languages', () => {
  const summary = {
    lang: 'en', durationMs: 60000, turns: 6, bargeIns: 0,
    items: [], total: 0,
    signals: [{ itemId: 'rice-basmati', name: 'Basmati Rice' }],
  };
  for (const lang of ['en', 'ta', 'te', 'hi', 'kn', 'ml', 'mr']) {
    const r = buildReceipt(summary, { shopName: 'Test', lang });
    assert.ok(r.signalsNote.length > 0, `${lang} needs a restock note`);
    assert.ok(r.signalsNote.includes('Basmati Rice'), `${lang} restock note must name the item`);
    if (lang !== 'en') {
      assert.ok(!r.signalsNote.includes('Restock note'), `${lang} restock note leaked English`);
    }
  }
  const empty = buildReceipt({ ...summary, signals: [] }, { shopName: 'Test', lang: 'ta' });
  assert.equal(empty.signalsNote, '');
});
