import test from 'node:test';
import assert from 'node:assert/strict';
import { KiranaAgent } from '../src/agent.js';
import { ITEMS } from '../src/catalog.js';

test('Tamil end-to-end: order atta, bill total is correct', () => {
  const agent = new KiranaAgent();
  const r = agent.process('ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?');
  assert.equal(r.lang, 'ta');
  assert.ok(r.reply.includes('ஆசீர்வாத்'), r.reply);
  assert.equal(r.total, 275); // 5 x ₹55
  assert.equal(r.lines.length, 1);
});

test('out of stock: basmati suggests ponni, yes adds it', () => {
  const agent = new KiranaAgent();
  const r1 = agent.process('basmati rice 2 kg');
  assert.ok(/out of stock/i.test(r1.reply), r1.reply);
  assert.ok(/ponni/i.test(r1.reply), r1.reply);
  assert.equal(agent.total, 0); // not added until confirmed
  assert.equal(agent.signals.length, 1);
  assert.equal(agent.signals[0].itemId, 'rice-basmati');
  assert.equal(agent.signals[0].requestedQty, 2);

  const r2 = agent.process('yes');
  assert.equal(agent.total, 124); // 2 x ₹62 ponni
  assert.ok(/ponni/i.test(r2.reply), r2.reply);
});

test('out of stock: no to a suggestion clears it', () => {
  const agent = new KiranaAgent();
  agent.process('groundnut oil 1 litre');
  assert.ok(agent.pendingSuggestion, 'suggestion should be pending');
  agent.process('no');
  assert.equal(agent.pendingSuggestion, null);
  assert.equal(agent.total, 0);
});

test('out of stock: coffee suggests tea powder', () => {
  const agent = new KiranaAgent();
  const r = agent.process('coffee powder 1 kg');
  assert.ok(/tea/i.test(r.reply), r.reply);
  agent.process('yes');
  assert.equal(agent.total, 460); // 1 kg tea powder
});

test('partial stock: asking for more than the shelf holds adds what is there', () => {
  const agent = new KiranaAgent();
  const r = agent.process('100 kg sugar');
  assert.equal(agent.total, 2250); // 50 kg x ₹45 (shelf holds 50)
  assert.ok(/50/.test(r.reply), r.reply);
  assert.equal(agent.signals.length, 1);
});

test('remove updates the running bill', () => {
  const agent = new KiranaAgent();
  agent.process('2 kg sugar');
  assert.equal(agent.total, 90);
  const r = agent.process('remove 1 kg sugar');
  assert.equal(agent.total, 45);
  assert.ok(/45/.test(r.reply), r.reply);
});

test('bill lists lines and total, and carries a UPI link', () => {
  const agent = new KiranaAgent();
  agent.process('2 kg sugar');
  agent.process('1 kg rice');
  const r = agent.process('bill');
  assert.ok(r.reply.includes('₹152.00'), r.reply); // 90 + 62
  assert.ok(r.upiLink.startsWith('upi://pay?'), r.upiLink);
  assert.ok(r.upiLink.includes('am=152.00'), r.upiLink);
  assert.equal(r.showQR, true);
});

test('checkout on an empty bill says so', () => {
  const agent = new KiranaAgent();
  const r = agent.process('pay');
  assert.equal(r.action, 'checkout');
  assert.equal(r.total, 0);
  assert.equal(r.upiLink, null);
});

test('checkout returns total and UPI link', () => {
  const agent = new KiranaAgent();
  agent.process('1 dozen banana');
  const r = agent.process('checkout');
  assert.equal(r.total, 60);
  assert.ok(r.upiLink.includes('am=60.00'), r.upiLink);
  assert.ok(/60/.test(r.reply), r.reply);
});

test('replies stay in the customer language: Telugu, Hindi, Kannada', () => {
  const te = new KiranaAgent();
  const rTe = te.process('పొన్ని బియ్యం 2 కిలోలు');
  assert.equal(rTe.lang, 'te');
  assert.ok(rTe.reply.includes('చేర్చాను'), rTe.reply);
  assert.equal(rTe.total, 124);

  const hi = new KiranaAgent();
  const rHi = hi.process('आशीर्वाद आटा 5 किलो');
  assert.equal(rHi.lang, 'hi');
  assert.ok(rHi.reply.includes('जोड़ दिया'), rHi.reply);
  assert.equal(rHi.total, 275);

  const kn = new KiranaAgent();
  const rKn = kn.process('ಪೊನ್ನಿ ಅಕ್ಕಿ 2 ಕಿಲೋ');
  assert.equal(rKn.lang, 'kn');
  assert.ok(rKn.reply.includes('ಸೇರಿಸಿದ್ದೇನೆ'), rKn.reply);
  assert.equal(rKn.total, 124);
});

test('greet and unknown do not touch the bill', () => {
  const agent = new KiranaAgent();
  const g = agent.process('vanakkam');
  assert.equal(g.action, 'greet');
  assert.ok(g.reply.length > 10);
  const u = agent.process('asdf qwer zxcv');
  assert.equal(u.action, 'unknown');
  assert.equal(agent.total, 0);
});

test('multi-item order in one sentence', () => {
  const agent = new KiranaAgent();
  const r = agent.process('2 kg rice and 1 kg sugar and 12 eggs');
  assert.equal(r.lines.length, 3);
  assert.equal(r.total, 124 + 45 + 84);
});

test('restock signals accumulate across the session', () => {
  const agent = new KiranaAgent();
  agent.process('basmati rice 1 kg');
  agent.process('coffee 1 kg');
  assert.equal(agent.signals.length, 2);
  assert.deepEqual(agent.signals.map((s) => s.itemId), ['rice-basmati', 'coffee']);
});

test('reset clears cart, signals and pending suggestion', () => {
  const agent = new KiranaAgent();
  agent.process('2 kg sugar');
  agent.process('basmati rice 1 kg');
  agent.reset();
  assert.equal(agent.total, 0);
  assert.equal(agent.signals.length, 0);
  assert.equal(agent.pendingSuggestion, null);
});

test('two out-of-stock offers in one turn: yes walks the queue in order', () => {
  const agent = new KiranaAgent();
  const r = agent.process('basmati rice 2 kg and groundnut oil 1 litre');
  // Both offers are spoken; the first one is on the table.
  assert.ok(/ponni/i.test(r.reply), r.reply);
  assert.ok(/sunflower/i.test(r.reply), r.reply);
  assert.equal(agent.pendingSuggestion.item.id, 'rice-ponni');
  assert.equal(agent.total, 0);

  const r1 = agent.process('yes');
  assert.equal(agent.total, 124); // 2 kg ponni first — not sunflower
  assert.ok(/ponni/i.test(r1.reply), r1.reply);
  // The second offer is presented right away, so the next yes is meaningful.
  assert.ok(/sunflower/i.test(r1.reply), r1.reply);
  assert.equal(agent.pendingSuggestion.item.id, 'oil-sunflower');

  const r2 = agent.process('yes');
  assert.equal(agent.total, 259); // 124 ponni + 135 sunflower
  assert.ok(/sunflower/i.test(r2.reply), r2.reply);
  assert.equal(agent.pendingSuggestion, null);
});

test('two out-of-stock offers in one turn: no declines one at a time', () => {
  const agent = new KiranaAgent();
  agent.process('basmati rice 2 kg and groundnut oil 1 litre');
  const r1 = agent.process('no');
  assert.ok(/sunflower/i.test(r1.reply), r1.reply); // next offer, not a plain "no problem"
  assert.equal(agent.pendingSuggestion.item.id, 'oil-sunflower');
  const r2 = agent.process('no');
  assert.ok(/no problem/i.test(r2.reply), r2.reply);
  assert.equal(agent.pendingSuggestion, null);
  assert.equal(agent.total, 0);
});

test('the shelf depletes as items are added, and remove puts stock back', () => {
  const agent = new KiranaAgent();
  agent.process('50 kg sugar'); // the whole shelf
  assert.equal(agent.byId.get('sugar').stock, 0);
  const r = agent.process('50 kg sugar');
  assert.ok(/out of stock/i.test(r.reply), r.reply); // nothing left to sell
  assert.equal(agent.total, 2250); // only the first 50 kg
  agent.process('remove 50 kg sugar');
  assert.equal(agent.byId.get('sugar').stock, 50);
  assert.equal(agent.total, 0);
});

test('repeat with more than the shelf holds says so, like a normal add', () => {
  const agent = new KiranaAgent();
  agent.process('40 kg sugar'); // 10 kg left on the shelf
  const r = agent.process('100 more');
  assert.ok(/only 10 kg/i.test(r.reply), r.reply);
  assert.equal(agent.total, 2250); // 40 + 10 kg, not 140
});

test('startNewSession: fresh bill, but signals and the depleted shelf stay', () => {
  const agent = new KiranaAgent();
  agent.process('2 kg sugar');
  agent.process('basmati rice 1 kg'); // restock signal
  agent.startNewSession();
  assert.equal(agent.total, 0);
  assert.equal(agent.lines.length, 0);
  assert.equal(agent.pendingSuggestion, null);
  assert.equal(agent.lastAdded, null);
  assert.equal(agent.signals.length, 1); // the shop still needs to restock basmati
  assert.equal(agent.byId.get('sugar').stock, 48); // the 2 kg really sold
});

test('reset restores the shelf; agents never mutate the shared catalogue', () => {
  const agent = new KiranaAgent();
  agent.process('50 kg sugar');
  assert.equal(agent.byId.get('sugar').stock, 0);
  agent.reset();
  assert.equal(agent.byId.get('sugar').stock, 50);
  const other = new KiranaAgent();
  assert.equal(other.byId.get('sugar').stock, 50); // a second agent starts full
  assert.equal(ITEMS.find((i) => i.id === 'sugar').stock, 50); // the shared catalogue is untouched
});
