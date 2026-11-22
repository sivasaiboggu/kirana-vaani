// Receipt builder tests — the session summary reads like a shop receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KiranaAgent } from '../src/agent.js';
import { VoiceSession, createSilentIO } from '../src/session.js';
import { buildReceipt, formatDuration, RECEIPT_LABELS } from '../src/receipt.js';

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

function fakeSummary() {
  return {
    lang: 'en',
    startedAt: '2026-11-21T09:12:00.000Z',
    endedAt: '2026-11-21T09:13:05.000Z',
    durationMs: 65000,
    turns: 8,
    userTurns: 4,
    agentTurns: 4,
    bargeIns: 1,
    items: [
      { itemId: 'atta-aashirvaad', name: 'Aashirvaad Atta', qty: 5, unit: 'kg', price: 55, total: 275 },
      { itemId: 'rice-ponni', name: 'Ponni Rice', qty: 2, unit: 'kg', price: 62, total: 124 },
      { itemId: 'sugar', name: 'Sugar', qty: 2, unit: 'kg', price: 45, total: 90 },
    ],
    total: 489,
    signals: [{ itemId: 'rice-basmati', name: 'Basmati Rice' }],
  };
}

test('receipt: itemised lines, total and meta from a real summary', () => {
  const r = buildReceipt(fakeSummary(), { shopName: 'Sri Lakshmi Stores', lang: 'en' });
  assert.equal(r.title, 'Receipt');
  assert.equal(r.shopName, 'Sri Lakshmi Stores');
  assert.equal(r.lines.length, 3);
  assert.equal(r.lines[0].name, 'Aashirvaad Atta');
  assert.equal(r.lines[0].qtyText, '5 kg');
  assert.equal(r.lines[0].total, '₹275.00');
  assert.equal(r.total, '₹489.00');
  assert.equal(r.totalRaw, 489);
  assert.equal(r.meta.find((m) => m.key === 'Duration').value, '01:05');
  assert.equal(r.meta.find((m) => m.key === 'Turns').value, '8');
  assert.equal(r.meta.find((m) => m.key === 'Interruptions').value, '1');
  assert.deepEqual(r.signals, ['Basmati Rice']);
  assert.equal(r.thanks, 'Thank you — come again!');
});

test('receipt: labels and quantity text in all seven languages', () => {
  const langs = ['ta', 'te', 'hi', 'kn', 'en', 'ml', 'mr'];
  for (const lang of langs) {
    const labels = RECEIPT_LABELS[lang];
    assert.ok(labels && labels.receipt && labels.total && labels.thanks, `${lang} needs receipt labels`);
    const r = buildReceipt(fakeSummary(), { shopName: 'Test', lang });
    assert.equal(r.title, labels.receipt);
    assert.equal(r.thanks, labels.thanks);
    assert.equal(r.total, '₹489.00'); // amounts stay in INR formatting
    assert.ok(r.lines[0].qtyText.length > 0, `${lang} qty text`);
  }
  // Malayalam and Marathi quantity units are localised, not English.
  assert.equal(buildReceipt(fakeSummary(), { lang: 'ml' }).lines[0].qtyText, '5 കിലോ');
  assert.equal(buildReceipt(fakeSummary(), { lang: 'mr' }).lines[0].qtyText, '5 किलो');
});

test('receipt: empty session still reads cleanly', () => {
  const r = buildReceipt({
    lang: 'en', durationMs: 0, turns: 0, bargeIns: 0, items: [], total: 0, signals: [],
  }, { shopName: 'Test', lang: 'en' });
  assert.equal(r.lines.length, 0);
  assert.equal(r.total, '₹0.00');
  assert.equal(r.meta.find((m) => m.key === 'Duration').value, '00:00');
});

test('receipt: a live session summary becomes a receipt', async () => {
  const agent = new KiranaAgent();
  const session = new VoiceSession({ agent, io: createSilentIO(), lang: 'ta' });
  await session.start();
  session.receive('2 கிலோ சர்க்கரை');
  await tick(20);
  const summary = await session.end();
  const r = buildReceipt(summary, { shopName: 'Sri Lakshmi Stores', lang: summary.lang });
  assert.equal(r.total, '₹90.00');
  assert.equal(r.lines.length, 1);
  assert.equal(r.title, 'ரசீது');
});

test('receipt: item names are in the receipt language, not always English', () => {
  // A Tamil receipt used to list "Aashirvaad Atta" in English next to Tamil
  // quantities — the bill on a Tamil receipt names the item in Tamil.
  const expected = {
    ta: 'ஆசீர்வாத் ஆட்டா',
    te: 'ఆశీర్వాద్ గోధుమ పిండి',
    hi: 'आशीर्वाद आटा',
    kn: 'ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು',
    en: 'Aashirvaad Atta',
    ml: 'ആശിർവാദ് ആട്ട',
    mr: 'आशीर्वाद आटा',
  };
  for (const [lang, name] of Object.entries(expected)) {
    const r = buildReceipt(fakeSummary(), { shopName: 'Test', lang });
    assert.equal(r.lines[0].name, name, `${lang} receipt line should name the item in ${lang}`);
  }
  assert.equal(buildReceipt(fakeSummary(), { lang: 'ta' }).lines[1].name, 'பொன்னி அரிசி');
  assert.equal(buildReceipt(fakeSummary(), { lang: 'te' }).lines[2].name, 'చక్కెర');
  // Unknown item ids keep the stored name instead of going blank.
  const unknown = buildReceipt({
    ...fakeSummary(),
    items: [{ itemId: 'not-a-real-item', name: 'Mystery Item', qty: 1, unit: 'kg', price: 10, total: 10 }],
  }, { shopName: 'Test', lang: 'ta' });
  assert.equal(unknown.lines[0].name, 'Mystery Item');
});

test('formatDuration: mm:ss, zero-padded', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(5000), '00:05');
  assert.equal(formatDuration(65000), '01:05');
  assert.equal(formatDuration(600000), '10:00');
});
