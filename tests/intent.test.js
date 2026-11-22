import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, detectLanguage, normalizeText, findNumbers } from '../src/intent.js';

function itemIds(result) {
  return result.items.map((i) => i.item.id);
}

test('Tamil (native script): "Aashirvaad atta 5 kg irukka?"', () => {
  const r = parseIntent('ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'ta');
  assert.deepEqual(itemIds(r), ['atta-aashirvaad']);
  assert.equal(r.items[0].qty, 5);
  assert.equal(r.items[0].unit, 'kg');
});

test('Tamil (Tanglish): "aashirvaad atta 5 kg irukka"', () => {
  const r = parseIntent('aashirvaad atta 5 kg irukka');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'ta');
  assert.deepEqual(itemIds(r), ['atta-aashirvaad']);
  assert.equal(r.items[0].qty, 5);
});

test('Telugu (native script): "Ponni biyyam 2 kilo"', () => {
  const r = parseIntent('పొన్ని బియ్యం 2 కిలోలు');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'te');
  assert.deepEqual(itemIds(r), ['rice-ponni']);
  assert.equal(r.items[0].qty, 2);
});

test('Telugu (transliteration, UI hint te): "ponni biyyam 2 kilo"', () => {
  const r = parseIntent('ponni biyyam 2 kilo', 'te');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'te');
  assert.deepEqual(itemIds(r), ['rice-ponni']);
  assert.equal(r.items[0].qty, 2);
});

test('Hindi (Devanagari): "Aashirvaad atta 5 kilo"', () => {
  const r = parseIntent('आशीर्वाद आटा 5 किलो');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'hi');
  assert.deepEqual(itemIds(r), ['atta-aashirvaad']);
  assert.equal(r.items[0].qty, 5);
});

test('Hindi (Hinglish): "aashirvaad aata 5 kilo chahiye"', () => {
  const r = parseIntent('aashirvaad aata 5 kilo chahiye');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'hi');
  assert.deepEqual(itemIds(r), ['atta-aashirvaad']);
  assert.equal(r.items[0].qty, 5);
});

test('Kannada (native script): "Ponni akki 2 kilo"', () => {
  const r = parseIntent('ಪೊನ್ನಿ ಅಕ್ಕಿ 2 ಕಿಲೋ');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'kn');
  assert.deepEqual(itemIds(r), ['rice-ponni']);
  assert.equal(r.items[0].qty, 2);
});

test('Kannada (transliteration): "ponni akki 2 kilo beku"', () => {
  const r = parseIntent('ponni akki 2 kilo beku');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'kn');
  assert.deepEqual(itemIds(r), ['rice-ponni']);
  assert.equal(r.items[0].qty, 2);
});

test('English: "2 kg ponni rice please"', () => {
  const r = parseIntent('2 kg ponni rice please');
  assert.equal(r.action, 'add');
  assert.equal(r.lang, 'en');
  assert.deepEqual(itemIds(r), ['rice-ponni']);
  assert.equal(r.items[0].qty, 2);
});

test('number words in four languages', () => {
  assert.equal(parseIntent('two kg sugar').items[0].qty, 2);
  assert.equal(parseIntent('rendu kilo arisi').items[0].qty, 2);
  assert.equal(parseIntent('do kilo chawal').items[0].qty, 2);
  assert.equal(parseIntent('ondu kilo akki').items[0].qty, 1);
  assert.equal(parseIntent('half kg sugar').items[0].qty, 0.5);
  assert.equal(parseIntent('அரை கிலோ சர்க்கரை').items[0].qty, 0.5);
});

test('Indic digits normalise to ASCII', () => {
  assert.equal(normalizeText('௫ கிலோ'), '5 கிலோ');
  assert.equal(normalizeText('५ किलो'), '5 किलो');
  assert.equal(parseIntent('௫ கிலோ அரிசி').items[0].qty, 5);
  assert.equal(parseIntent('५ किलो आटा').items[0].qty, 5);
});

test('grams convert to kg, dozen converts for pieces', () => {
  const g = parseIntent('500 gram sugar');
  assert.equal(g.items[0].qty, 0.5);
  assert.equal(g.items[0].unit, 'kg');
  const d = parseIntent('2 dozen banana');
  assert.equal(d.items[0].qty, 2);
  assert.equal(d.items[0].unit, 'dozen');
  const e = parseIntent('1 dozen eggs');
  assert.equal(e.items[0].qty, 12);
  assert.equal(e.items[0].unit, 'piece');
});

test('longest match wins: basmati rice does not also match plain rice', () => {
  const r = parseIntent('basmati rice 2 kg');
  assert.deepEqual(itemIds(r), ['rice-basmati']);
});

test('quantities attach to the item they sit next to, not the nearest centre', () => {
  // Regression: "basmati rice 2 kg and groundnut oil 1 litre" used to order
  // groundnut oil as 2 litres, because the 2 sat nearer the middle of
  // "groundnut oil" than the 1 did.
  const r = parseIntent('basmati rice 2 kg and groundnut oil 1 litre');
  assert.deepEqual(itemIds(r), ['rice-basmati', 'oil-groundnut']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[1].qty, 1);
  assert.equal(r.items[1].unit, 'litre');
});

test('repeated number words look at their own following unit', () => {
  const r = parseIntent('two kg rice and two dozen eggs');
  assert.deepEqual(itemIds(r), ['rice-ponni', 'eggs']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[0].unit, 'kg');
  assert.equal(r.items[1].qty, 24);
  assert.equal(r.items[1].unit, 'piece');
});

test('multiple items get their own nearest quantity', () => {
  const r = parseIntent('2 kg rice and 1 kg sugar');
  assert.deepEqual(itemIds(r), ['rice-ponni', 'sugar']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[1].qty, 1);
});

test('no quantity defaults to 1', () => {
  const r = parseIntent('sugar');
  assert.equal(r.items[0].qty, 1);
});

test('remove intent in English and Tamil', () => {
  const r1 = parseIntent('remove 1 kg sugar');
  assert.equal(r1.action, 'remove');
  assert.deepEqual(itemIds(r1), ['sugar']);
  const r2 = parseIntent('சர்க்கரை வேண்டாம்');
  assert.equal(r2.action, 'remove');
  assert.equal(r2.lang, 'ta');
  assert.deepEqual(itemIds(r2), ['sugar']);
});

test('bill and checkout intents', () => {
  assert.equal(parseIntent('bill please').action, 'bill');
  assert.equal(parseIntent('மொத்தம் எவ்வளவு').action, 'bill');
  assert.equal(parseIntent('பில்').action, 'bill');
  assert.equal(parseIntent('బిల్లు').action, 'bill');
  assert.equal(parseIntent('बिल').action, 'bill');
  assert.equal(parseIntent('ಬಿಲ್').action, 'bill');
  assert.equal(parseIntent('pay').action, 'checkout');
  assert.equal(parseIntent('show me the UPI QR').action, 'checkout');
});

test('yes / no / greet in several languages', () => {
  assert.equal(parseIntent('sari').action, 'yes');
  assert.equal(parseIntent('haan').action, 'yes');
  assert.equal(parseIntent('illa').action, 'no');
  assert.equal(parseIntent('vanakkam').action, 'greet');
  assert.equal(parseIntent('namaste').action, 'greet');
});

test('unknown input stays unknown', () => {
  assert.equal(parseIntent('blah blah nothing').action, 'unknown');
  assert.equal(parseIntent('').action, 'unknown');
});

test('language detection by script', () => {
  assert.equal(detectLanguage('என்ன விலை'), 'ta');
  assert.equal(detectLanguage('ఏమి ధర'), 'te');
  assert.equal(detectLanguage('क्या दाम है'), 'hi');
  assert.equal(detectLanguage('ಎಷ್ಟು ಬೆಲೆ'), 'kn');
  assert.equal(detectLanguage('what is the price', 'en'), 'en');
});

test('findNumbers finds digits with units', () => {
  const nums = findNumbers(normalizeText('2 kg rice and 500 g sugar'));
  assert.equal(nums.length, 2);
  assert.equal(nums[0].value, 2);
  assert.equal(nums[0].unit, 'kg');
  assert.equal(nums[0].end, 4); // end of "2 kg"
  assert.equal(nums[1].value, 500);
  assert.equal(nums[1].unit, 'g');
  assert.equal(nums[1].end, 19); // end of "500 g" at index 14
});
