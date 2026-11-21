// Malayalam + Marathi support, and the v3 agent improvements.
// Seven languages end to end: catalogue, intent, replies, Sarvam register.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, LANGUAGES, nameIn } from '../src/catalog.js';
import { detectLanguage, parseIntent, normalizeText, UNIT_LABELS } from '../src/intent.js';
import { KiranaAgent } from '../src/agent.js';
import { VoiceSession, createDemoIO, runDemoTurns } from '../src/session.js';
import { SARVAM_CONFIG, detectRegister, buildSystemPrompt } from '../src/sarvam.js';

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test('catalogue: seven languages, every item named in Malayalam and Marathi', () => {
  assert.deepEqual(Object.keys(LANGUAGES), ['ta', 'te', 'hi', 'kn', 'en', 'ml', 'mr']);
  assert.equal(LANGUAGES.ml.code, 'ml-IN');
  assert.equal(LANGUAGES.mr.code, 'mr-IN');
  assert.equal(ITEMS.length, 34);
  for (const item of ITEMS) {
    assert.ok(item.names.ml && item.names.ml.length > 1, `${item.id} needs a Malayalam name`);
    assert.ok(item.names.mr && item.names.mr.length > 1, `${item.id} needs a Marathi name`);
    assert.ok(nameIn(item, 'ml') !== item.names.en, `${item.id} Malayalam name must differ from English`);
    assert.ok(nameIn(item, 'mr') !== item.names.en, `${item.id} Marathi name must differ from English`);
  }
  assert.equal(nameIn(ITEMS.find((i) => i.id === 'sugar'), 'ml'), 'പഞ്ചസാര');
  assert.equal(nameIn(ITEMS.find((i) => i.id === 'sugar'), 'mr'), 'साखर');
  assert.equal(nameIn(ITEMS.find((i) => i.id === 'rice-ponni'), 'ml'), 'പൊന്നി അരി');
  assert.equal(nameIn(ITEMS.find((i) => i.id === 'rice-ponni'), 'mr'), 'पोन्नी तांदूळ');
});

test('intent: Malayalam detection, native script + Latin + Indic digits', () => {
  assert.equal(detectLanguage('ആശിർവാദ് ആട്ട 5 കിലോ ഉണ്ടോ?'), 'ml');
  assert.equal(detectLanguage('പഞ്ചസാര 2 കിലോ'), 'ml');
  // A bare transliterated noun is ambiguous across Dravidian languages —
  // the session language disambiguates it; a grammar word pins it down.
  assert.equal(detectLanguage('panchasara 2 kilo', 'ml'), 'ml');
  assert.equal(detectLanguage('panchasara venam'), 'ml');
  assert.equal(detectLanguage('൨ കിലോ പഞ്ചസാര'), 'ml'); // Malayalam digits
  const parsed = parseIntent('൨ കിലോ പഞ്ചസാര');
  assert.equal(parsed.action, 'add');
  assert.equal(parsed.lang, 'ml');
  assert.equal(parsed.items[0].item.id, 'sugar');
  assert.equal(parsed.items[0].qty, 2);
  assert.equal(UNIT_LABELS.kg.ml, 'കിലോ');
  assert.equal(UNIT_LABELS.litre.ml, 'ലിറ്റർ');
  assert.equal(UNIT_LABELS.dozen.ml, 'ഡസൻ');
});

test('intent: Marathi vs Hindi — same script, told apart both ways', () => {
  // Marathi-only words win.
  assert.equal(detectLanguage('आशीर्वाद आटा 5 किलो पाहिजे'), 'mr');
  assert.equal(detectLanguage('२ किलो साखर'), 'mr');
  assert.equal(detectLanguage('बासमती तांदूळ 2 किलो'), 'mr');
  assert.equal(detectLanguage('sakhar 2 kg'), 'mr');
  assert.equal(detectLanguage('kiti'), 'mr');
  // Hindi-only words stay Hindi.
  assert.equal(detectLanguage('आशीर्वाद आटा 5 किलो चाहिए'), 'hi');
  assert.equal(detectLanguage('2 किलो चीनी'), 'hi');
  assert.equal(detectLanguage('बासमती चावल 2 किलो'), 'hi');
  // A bare shared word ("बिल") stays in the session language.
  assert.equal(detectLanguage('बिल', 'mr'), 'mr');
  assert.equal(detectLanguage('बिल', 'hi'), 'hi');
  const parsed = parseIntent('२ किलो साखर', 'mr');
  assert.equal(parsed.action, 'add');
  assert.equal(parsed.lang, 'mr');
  assert.equal(parsed.items[0].item.id, 'sugar');
  assert.equal(parsed.items[0].qty, 2);
  assert.equal(UNIT_LABELS.kg.mr, 'किलो');
  assert.equal(UNIT_LABELS.litre.mr, 'लिटर');
});

test('agent: Malayalam demo flow end to end, replies stay in Malayalam', () => {
  const agent = new KiranaAgent();
  let r = agent.process('ആശിർവാദ് ആട്ട 5 കിലോ ഉണ്ടോ?');
  assert.equal(r.lang, 'ml');
  assert.ok(r.reply.includes('ആശിർവാദ്'), r.reply);
  assert.equal(r.total, 275);

  r = agent.process('ബസ്മതി അരി 2 കിലോ');
  assert.ok(/സ്റ്റോക്കില്ല/.test(r.reply), r.reply);
  assert.ok(/പൊന്നി/.test(r.reply), r.reply);
  assert.equal(agent.total, 275); // not added until confirmed

  r = agent.process('ശരി');
  assert.equal(r.total, 399); // + 2 kg ponni @ 62

  r = agent.process('2 കിലോ പഞ്ചസാര');
  assert.equal(r.total, 489);
  r = agent.process('ബിൽ');
  assert.ok(r.reply.includes('₹489.00'), r.reply);
  assert.ok(r.upiLink.includes('am=489.00'), r.upiLink);
});

test('agent: Marathi demo flow end to end, replies stay in Marathi', () => {
  const agent = new KiranaAgent();
  let r = agent.process('आशीर्वाद आटा 5 किलो पाहिजे');
  assert.equal(r.lang, 'mr');
  assert.ok(r.reply.includes('आशीर्वाद'), r.reply);
  assert.equal(r.total, 275);

  r = agent.process('बासमती तांदूळ 2 किलो');
  assert.ok(/स्टॉकमध्ये नाही/.test(r.reply), r.reply);
  assert.ok(/पोन्नी/.test(r.reply), r.reply);

  r = agent.process('होय');
  assert.equal(r.total, 399);

  r = agent.process('2 किलो साखर');
  assert.equal(r.total, 489);
  r = agent.process('बिल', 'mr');
  assert.equal(r.lang, 'mr');
  assert.ok(r.reply.includes('₹489.00'), r.reply);
});

test('agent: confirmations vary — three adds do not repeat the same sentence', () => {
  const agent = new KiranaAgent();
  const replies = [
    agent.process('2 kg sugar').reply,
    agent.process('1 kg rice').reply,
    agent.process('1 dozen banana').reply,
  ];
  assert.equal(new Set(replies).size, 3, replies.join(' | '));
  // ...and the cycle comes back round on the fourth add (variant 0 again).
  const fourth = agent.process('1 kg onion').reply;
  assert.ok(/^Added 1 kg Onion — /.test(fourth), fourth);
});

test('agent: unclear speech — first miss asks once, second offers the typed box', () => {
  const agent = new KiranaAgent();
  const first = agent.process('asdf qwer zxcv');
  assert.equal(first.action, 'unknown');
  assert.ok(/did not catch/i.test(first.reply), first.reply);
  const second = agent.process('blorp glorp');
  assert.equal(second.action, 'unknown');
  assert.notEqual(second.reply, first.reply);
  assert.ok(/Type it in the box/i.test(second.reply), second.reply);
  // One understood turn resets the streak.
  agent.process('2 kg sugar');
  const third = agent.process('zztop');
  assert.ok(/did not catch/i.test(third.reply), third.reply);
  assert.ok(!/Type it in the box/i.test(third.reply));
});

test('agent: "same again" and "2 more" repeat the last order without re-asking', () => {
  const agent = new KiranaAgent();
  // Nothing to repeat yet.
  let r = agent.process('same again');
  assert.equal(r.action, 'repeat');
  assert.ok(/Nothing to repeat/i.test(r.reply), r.reply);
  assert.equal(agent.total, 0);

  agent.process('2 kg sugar'); // 90
  r = agent.process('same again');
  assert.equal(r.total, 180);
  assert.ok(/sugar/i.test(r.reply), r.reply);

  r = agent.process('2 more');
  assert.equal(r.total, 270); // +2 kg sugar again
  assert.ok(/sugar/i.test(r.reply), r.reply);

  // Works in Malayalam too.
  const ml = new KiranaAgent();
  ml.process('2 കിലോ പഞ്ചസാര');
  r = ml.process('വീണ്ടും');
  assert.equal(r.total, 180);
  assert.ok(/പഞ്ചസാര/.test(r.reply), r.reply);
});

test('agent: "vendu / nako" with no item declines the pending suggestion', () => {
  const agent = new KiranaAgent();
  agent.process('basmati rice 2 kg');
  assert.ok(agent.pendingSuggestion, 'suggestion should be pending');
  const r = agent.process('no');
  assert.equal(agent.pendingSuggestion, null);
  assert.equal(agent.total, 0);

  // Malayalam "വേണ്ട" (remove-word, no item) declines the same way.
  const ml = new KiranaAgent();
  ml.process('ബസ്മതി അരി 2 കിലോ');
  assert.ok(ml.pendingSuggestion);
  const r2 = ml.process('വേണ്ട');
  assert.equal(ml.pendingSuggestion, null);
  assert.equal(ml.total, 0);
  assert.ok(r2.reply.length > 0);
});

test('sarvam: Malayalam and Marathi codes, register and system prompt', () => {
  assert.equal(SARVAM_CONFIG.languages.ml, 'ml-IN');
  assert.equal(SARVAM_CONFIG.languages.mr, 'mr-IN');
  assert.equal(detectRegister('പഞ്ചസാര തരൂ', 'ml'), 'polite');
  assert.equal(detectRegister('പഞ്ചസാര തരു', 'ml'), 'plain');
  assert.equal(detectRegister('साखर द्या', 'mr'), 'polite');
  assert.equal(detectRegister('साखर दे', 'mr'), 'plain');
  assert.equal(detectRegister('sugar please', 'en'), 'polite');
  const mlPrompt = buildSystemPrompt({ shopName: 'Test', lang: 'ml', register: 'polite' });
  assert.ok(mlPrompt.includes('Malayalam'), mlPrompt);
  assert.ok(mlPrompt.includes('tharoo'), mlPrompt);
  const mrPrompt = buildSystemPrompt({ shopName: 'Test', lang: 'mr', register: 'polite' });
  assert.ok(mrPrompt.includes('Marathi'), mrPrompt);
  assert.ok(mrPrompt.includes('dya'), mrPrompt);
});

test('session: scripted Malayalam demo runs end to end through the machine', async () => {
  const agent = new KiranaAgent();
  const events = [];
  const session = new VoiceSession({
    agent,
    io: createDemoIO({ minMs: 5, maxMs: 10, charsPerMs: 1 }),
    lang: 'ml',
    onEvent: (e) => events.push(e),
  });
  await session.start();
  await runDemoTurns(session, [
    'ആശിർവാദ് ആട്ട 5 കിലോ ഉണ്ടോ?',
    'ബസ്മതി അരി 2 കിലോ',
    'ശരി',
    '2 കിലോ പഞ്ചസാര',
    'ബിൽ',
  ], { delay: 5 });
  await tick(120);
  assert.equal(agent.total, 489);
  assert.equal(agent.lines.length, 3);
  assert.equal(agent.signals.length, 1);
  const summary = await session.end();
  assert.equal(summary.total, 489);
  assert.equal(summary.userTurns, 5);
  assert.equal(summary.lang, 'ml');
});

test('session: scripted Marathi demo runs end to end through the machine', async () => {
  const agent = new KiranaAgent();
  const session = new VoiceSession({
    agent,
    io: createDemoIO({ minMs: 5, maxMs: 10, charsPerMs: 1 }),
    lang: 'mr',
  });
  await session.start();
  await runDemoTurns(session, [
    'आशीर्वाद आटा 5 किलो पाहिजे',
    'बासमती तांदूळ 2 किलो',
    'होय',
    '2 किलो साखर',
    'बिल',
  ], { delay: 5 });
  await tick(120);
  assert.equal(agent.total, 489);
  assert.equal(agent.lines.length, 3);
  const summary = await session.end();
  assert.equal(summary.total, 489);
  assert.equal(summary.userTurns, 5);
  assert.equal(summary.lang, 'mr');
});
