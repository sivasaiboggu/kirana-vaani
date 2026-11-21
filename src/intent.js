// Multilingual intent parsing for KiranaVaani.
// Understands Tamil, Telugu, Hindi, Kannada and English — in native script
// (what SpeechRecognition returns for ta-IN / te-IN / hi-IN / kn-IN) and in
// Latin transliteration (Tanglish / Hinglish / typed input).
// Parses: action (add / remove / bill / checkout / greet / yes / no),
// item mentions (longest-match, span-claimed so "basmati rice" never also
// matches "rice"), and quantities (digits incl. Indic digits, number words,
// g->kg and ml->litre conversion, dozen handling).

import { ITEMS } from './catalog.js';

// ---------- text normalisation ----------

const INDIC_DIGIT_MAP = {};
// Tamil ௦-௯ (U+0BE6), Telugu ౦-౯ (U+0C66), Devanagari ०-९ (U+0966, Hindi
// and Marathi share it), Kannada ೦-೯ (U+0CE6), Malayalam ൦-൯ (U+0D66)
for (const base of [0x0be6, 0x0c66, 0x0966, 0x0ce6, 0x0d66]) {
  for (let d = 0; d <= 9; d++) INDIC_DIGIT_MAP[String.fromCodePoint(base + d)] = String(d);
}

export function normalizeText(raw) {
  let out = '';
  for (const ch of String(raw)) {
    if (INDIC_DIGIT_MAP[ch] !== undefined) out += INDIC_DIGIT_MAP[ch];
    else if (/[\p{L}\p{M}\p{N}]/u.test(ch)) out += ch.toLowerCase();
    else out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

function padded(text) {
  return ` ${text} `;
}

// ---------- language detection ----------

const SCRIPT_RANGES = {
  ta: /[\u0B80-\u0BFF]/g,
  te: /[\u0C00-\u0C7F]/g,
  hi: /[\u0900-\u097F]/g,
  kn: /[\u0C80-\u0CFF]/g,
  ml: /[\u0D00-\u0D7F]/g,
};

// Marathi and Hindi share the Devanagari script, so script alone cannot tell
// them apart. These Marathi-only words (native + Latin) are checked first,
// before any script-range counting, and win over Hindi.
const MARATHI_MARKERS = [
  'पाहिजे', 'द्या', 'किती', 'होय', 'मला', 'बरं', 'घ्या', 'नको', 'धन्यवाद',
  'पुन्हा', 'काढा', 'आहे', 'हवं', 'हवा',
  'pahije', 'dya', 'kiti', 'hoy', 'mala', 'ghya', 'nako', 'dhanyavad',
  'punha', 'bara',
  // Marathi-only item words (Hindi uses different words for these).
  'साखर', 'तांदूळ', 'डाळ', 'मीठ', 'तूप', 'कांदा', 'बटाटा', 'केळी', 'पोहे',
  'हळद', 'मोहरी', 'जिरे', 'धणे', 'मिरची', 'चहा', 'अंडी', 'साबण', 'बिस्किटे',
  'sakhar', 'tandul', 'meeth', 'toop', 'kanda', 'batata', 'keli',
  'pohe', 'halad', 'mohari', 'jire', 'dhane', 'mirchi', 'chaha', 'andi',
  'saban', 'biskite',
];

// Hindi-only words — used the other way round: Devanagari text with no
// Hindi evidence and a Marathi session hint stays Marathi, so a bare shared
// word like "बिल" does not flip a Marathi conversation to Hindi.
const HINDI_MARKERS = [
  'चाहिए', 'कितना', 'हाँ', 'नहीं', 'चीनी', 'चावल', 'दाल', 'नमक', 'प्याज़',
  'आलू', 'केला', 'बताइए', 'दीजिए', 'कुल',
  'chahiye', 'kitna', 'haan', 'nahi', 'cheeni', 'chawal', 'namak', 'pyaaz',
  'aalu', 'kela', 'kul', 'lijiye',
];

const TRANSLIT_HINTS = {
  ta: ['irukka', 'irukku', 'venum', 'vendum', 'kudu', 'kodunga', 'evlo', 'enna', 'seri', 'paravala', 'mottum'],
  te: ['undi', 'undha', 'kavali', 'ivvandi', 'entha', 'em', 'sare', 'mottam', 'cheyandi', 'ledu'],
  hi: ['chahiye', 'kitna', 'hai', 'do', 'haan', 'nahi', 'kul', 'bhaiya', 'de', 'lijiye'],
  kn: ['ide', 'beku', 'kodi', 'eshtu', 'haudu', 'illa', 'beda', 'ottu', 'maadi'],
  ml: ['undu', 'venam', 'tharoo', 'tharu', 'ethra', 'sheri', 'mottum', 'illa', 'venda', 'veendum'],
  mr: ['pahije', 'dya', 'kiti', 'hoy', 'mala', 'ghya', 'nako', 'punha'],
};

export function detectLanguage(raw, hint = 'en') {
  const text = String(raw);
  const norm = padded(normalizeText(text));
  if (MARATHI_MARKERS.some((w) => norm.includes(` ${normalizeText(w)} `))) return 'mr';
  let best = null;
  let bestCount = 0;
  for (const [lang, re] of Object.entries(SCRIPT_RANGES)) {
    const count = (text.match(re) || []).length;
    if (count > bestCount) { best = lang; bestCount = count; }
  }
  // Devanagari is shared by Hindi and Marathi: without Hindi-only evidence,
  // a Marathi session hint wins, so shared words like "बिल" stay Marathi.
  if (best === 'hi' && hint === 'mr'
    && !HINDI_MARKERS.some((w) => norm.includes(` ${normalizeText(w)} `))) return 'mr';
  if (best) return best;
  for (const [lang, words] of Object.entries(TRANSLIT_HINTS)) {
    if (words.some((w) => norm.includes(` ${w} `))) return lang;
  }
  return hint;
}

// ---------- numbers & units ----------

export const NUMBER_WORDS = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
  // Tamil (native + Latin)
  'ஒன்று': 1, 'ஒரு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3, 'நான்கு': 4, 'நாலு': 4,
  'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10, 'அரை': 0.5,
  onnu: 1, oru: 1, rendu: 2, moonu: 3, naalu: 4, anchu: 5, aaru: 6, ezhu: 7, ettu: 8, onbadhu: 9, pathu: 10, arai: 0.5,
  // Telugu (native + Latin)
  'ఒకటి': 1, 'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10, 'సగం': 0.5,
  okati: 1, oka: 1, moodu: 3, naalugu: 4, aidu: 5, edu: 7, enimidi: 8, tommidi: 9, padi: 10, sagam: 0.5,
  // Hindi (native + Latin)
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'आधा': 0.5,
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5, chhah: 6, saat: 7, aath: 8, nau: 9, das: 10, aadha: 0.5,
  // Kannada (native + Latin)
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5, 'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10, 'ಅರ್ಧ': 0.5,
  ondu: 1, eradu: 2, mooru: 3, naalku: 4, elu: 7, entu: 8, ombathu: 9, hattu: 10, ardha: 0.5,
  // Malayalam (native + Latin)
  'ഒന്ന്': 1, 'ഒരു': 1, 'രണ്ട്': 2, 'മൂന്ന്': 3, 'നാല്': 4, 'അഞ്ച്': 5, 'ആറ്': 6, 'ഏഴ്': 7, 'എട്ട്': 8, 'ഒമ്പത്': 9, 'പത്ത്': 10, 'അര': 0.5,
  onnu: 1, oru: 1, randu: 2, moonnu: 3, naalu: 4, anchu: 5, aaru: 6, ezhu: 7, ettu: 8, ompathu: 9, pathu: 10, ara: 0.5,
  // Marathi (native + Latin). 'एक' is shared with Hindi — same value, so no conflict.
  'एक': 1, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पाच': 5, 'सहा': 6, 'सात': 7, 'आठ': 8, 'नऊ': 9, 'दहा': 10, 'अर्धा': 0.5,
  don: 2, sahaa: 6, daha: 10,
};

export const UNIT_WORDS = {
  kg: ['kg', 'kilo', 'kilogram', 'kilograms', 'கிலோ', 'కిలో', 'किलो', 'ಕಿಲೋ', 'കിലോ', 'किलो'],
  g: ['g', 'gram', 'grams', 'கிராம்', 'கிராம', 'గ్రాము', 'ग्राम', 'ಗ್ರಾಮ್', 'ഗ്രാം', 'ग्रॅम'],
  litre: ['litre', 'liter', 'litres', 'liters', 'லிட்டர்', 'లీటరు', 'लीटर', 'ಲೀಟರ್', 'ലിറ്റർ', 'लिटर'],
  ml: ['ml', 'மில்லி', 'మిల్లీ', 'मिली', 'ಮಿಲಿ', 'മില്ലി', 'मिली'],
  packet: ['packet', 'pack', 'packets', 'பாக்கெட்', 'ప్యాకెట్', 'पैकेट', 'ಪ್ಯಾಕೆಟ್', 'പാക്കറ്റ്', 'पॅकेट'],
  piece: ['piece', 'pieces', 'பீஸ்', 'పీస్', 'पीस', 'ಪೀಸ್', 'പീസ്', 'पीस'],
  dozen: ['dozen', 'டஜன்', 'డజను', 'दर्जन', 'ಡಜನ್', 'ഡസൻ', 'डझन'],
};

// word -> canonical unit (for token scanning)
const UNIT_LOOKUP = {};
for (const [unit, words] of Object.entries(UNIT_WORDS)) {
  for (const w of words) UNIT_LOOKUP[w] = unit;
}

export const UNIT_LABELS = {
  kg: { ta: 'கிலோ', te: 'కిలో', hi: 'किलो', kn: 'ಕಿಲೋ', en: 'kg', ml: 'കിലോ', mr: 'किलो' },
  litre: { ta: 'லிட்டர்', te: 'లీటరు', hi: 'लीटर', kn: 'ಲೀಟರ್', en: 'litre', ml: 'ലിറ്റർ', mr: 'लिटर' },
  packet: { ta: 'பாக்கெட்', te: 'ప్యాకెట్', hi: 'पैकेट', kn: 'ಪ್ಯಾಕೆಟ್', en: 'packet', ml: 'പാക്കറ്റ്', mr: 'पॅकेट' },
  piece: { ta: '', te: '', hi: '', kn: '', en: 'piece', ml: '', mr: '' },
  dozen: { ta: 'டஜன்', te: 'డజను', hi: 'दर्जन', kn: 'ಡಜನ್', en: 'dozen', ml: 'ഡസൻ', mr: 'डझन' },
};

// Find every number occurrence in normalised text: { value, unit|null, index }
export function findNumbers(norm) {
  const found = [];
  const unitAlt = Object.values(UNIT_WORDS).flat().sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitAlt})?`, 'gu');
  for (const m of norm.matchAll(re)) {
    // single-letter units (g, l) only count when not glued to another word
    if (m[2] && (m[2] === 'g' || m[2] === 'l')) {
      const after = norm[m.index + m[0].length];
      if (after && /[\p{L}]/u.test(after)) continue;
    }
    found.push({ value: parseFloat(m[1]), unit: m[2] ? UNIT_LOOKUP[m[2]] : null, index: m.index });
  }
  // number words: token scan
  const tokens = norm.split(' ');
  let pos = 0;
  for (const tok of tokens) {
    if (NUMBER_WORDS[tok] !== undefined && !found.some((f) => Math.abs(f.index - pos) < 2)) {
      let unit = null;
      const next = tokens[tokens.indexOf(tok) + 1];
      if (next && UNIT_LOOKUP[next]) unit = UNIT_LOOKUP[next];
      found.push({ value: NUMBER_WORDS[tok], unit, index: pos });
    }
    pos += tok.length + 1;
  }
  return found.sort((a, b) => a.index - b.index);
}

// Convert a parsed (value, unit) into the item's own unit.
function toItemUnit(value, unit, item) {
  if (!unit) return { qty: value, unit: item.unit };
  if (unit === 'g' && item.unit === 'kg') return { qty: value / 1000, unit: 'kg' };
  if (unit === 'ml' && item.unit === 'litre') return { qty: value / 1000, unit: 'litre' };
  if (unit === 'dozen' && item.unit === 'piece') return { qty: value * 12, unit: 'piece' };
  if (unit === 'dozen' && item.unit === 'dozen') return { qty: value, unit: 'dozen' };
  if (unit === item.unit) return { qty: value, unit };
  // unit mismatches the item (e.g. "2 packets of rice") — keep the number, use item unit
  return { qty: value, unit: item.unit };
}

// ---------- item matching (longest match wins, spans claimed once) ----------

function buildTerms() {
  const terms = [];
  for (const item of ITEMS) {
    const seen = new Set();
    for (const name of Object.values(item.names)) {
      const n = normalizeText(name);
      if (n && !seen.has(n)) { seen.add(n); terms.push({ term: n, item }); }
    }
    for (const alias of item.aliases) {
      const n = normalizeText(alias);
      if (n && !seen.has(n)) { seen.add(n); terms.push({ term: n, item }); }
    }
  }
  // longest first so "basmati rice" claims its span before "rice" can
  terms.sort((a, b) => b.term.length - a.term.length);
  return terms;
}

const TERMS = buildTerms();

export function findItems(norm) {
  const claimed = []; // [start, end) ranges already taken
  const matches = [];
  const hay = padded(norm);
  for (const { term, item } of TERMS) {
    const needle = ` ${term} `;
    let from = 0;
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at === -1) break;
      const start = at; // index in padded text
      const end = at + needle.length;
      const overlap = claimed.some(([s, e]) => start < e && end > s);
      if (!overlap) {
        claimed.push([start, end]);
        matches.push({ item, term, index: start });
      }
      from = at + 1;
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

// ---------- intent ----------

const KEYWORDS = {
  checkout: ['checkout', 'pay', 'upi', 'qr', 'பணம் செலுத்த', 'செலுத்து', 'చెల్లించు', 'भुगतान', 'ಪಾವತಿ', 'pay pannunga', 'pay cheyandi', 'pay maadi', 'பில் கட்ட', 'బిల్లు కట్టు', 'बिल भर', 'പണം അടയ്ക്കൂ', 'അടയ്ക്കൂ', 'पैसे भरा', 'भरा', 'pay cheyyu', 'pay kara'],
  bill: ['bill', 'total', 'பில்', 'బిల్లు', 'बिल', 'ಬಿಲ್', 'மொத்தம்', 'மொத்த', 'మొత్తం', 'कुल', 'ಒಟ್ಟು', 'mottum', 'mottam', 'kul', 'ottu', 'how much', 'evlo', 'entha', 'kitna', 'eshtu', 'எவ்வளவு', 'ఎంత', 'कितना', 'ಎಷ್ಟು', 'ബിൽ', 'മൊത്തം', 'എത്ര', 'एकूण', 'किती', 'ethra'],
  remove: ['remove', 'வேண்டாம்', 'వద్దు', 'नहीं चाहिए', 'ಬೇಡ', 'venam', 'vaddu', 'beda', 'cancel', 'நீக்கு', 'తీసేయి', 'हटाओ', 'ತೆಗೆ', 'വേണ്ട', 'നീക്കൂ', 'नको', 'काढा'],
  yes: ['yes', 'ok', 'okay', 'சரி', 'సరే', 'हाँ', 'ಹೌದು', 'sari', 'seri', 'haan', 'haudu', 'paravala', 'சரிங்க', 'ശരി', 'അതെ', 'sheri', 'होय', 'बरोबर', 'hoy'],
  no: ['no', 'இல்லை', 'లేదు', 'नहीं', 'ಇಲ್ಲ', 'illa', 'ledu', 'nahi', 'ഇല്ല', 'नाही', 'nako'],
  greet: ['vanakkam', 'namaste', 'namaskaram', 'namaskara', 'hello', 'hi', 'வணக்கம்', 'నమస్కారం', 'नमस्ते', 'ನಮಸ್ಕಾರ', 'നമസ്കാരം', 'नमस्कार', 'namaskaram'],
  // "The same again" / "2 more" — no item named, so the agent re-adds the
  // last thing the customer ordered. Checked only after item matching.
  repeat: ['same again', 'same as before', 'repeat that', 'one more', 'more of that', 'more',
    'மீண்டும்', 'அதே', 'மறுபடியும்', 'meendum', 'adhe', 'இன்னும்',
    'మళ్లీ', 'అదే', 'mallee', 'ఇంకా',
    'फिर से', 'वही', 'phir se', 'wahi', 'और',
    'ಮತ್ತೆ', 'ಅದೇ', 'matte', 'ಇನ್ನೂ',
    'വീണ്ടും', 'അതേ', 'veendum', 'athe', 'ഇനിയും',
    'पुन्हा', 'तेच', 'punha', 'tech', 'आणखी'],
};

function hasKeyword(norm, action) {
  const hay = padded(norm);
  return KEYWORDS[action].some((kw) => hay.includes(` ${normalizeText(kw)} `));
}

function nearestNumber(numbers, index) {
  if (numbers.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const n of numbers) {
    const d = Math.abs(n.index - index);
    if (d < bestDist) { best = n; bestDist = d; }
  }
  return best;
}

export function parseIntent(raw, hintLang = 'en') {
  const norm = normalizeText(raw);
  const lang = detectLanguage(raw, hintLang);
  if (!norm) return { action: 'unknown', lang, items: [], raw };

  if (hasKeyword(norm, 'checkout')) return { action: 'checkout', lang, items: [], raw };
  if (hasKeyword(norm, 'bill')) return { action: 'bill', lang, items: [], raw };
  if (hasKeyword(norm, 'remove')) {
    const matches = findItems(norm);
    const numbers = findNumbers(norm);
    return { action: 'remove', lang, items: withQuantities(matches, numbers), raw };
  }
  if (hasKeyword(norm, 'yes')) return { action: 'yes', lang, items: [], raw };
  if (hasKeyword(norm, 'no')) return { action: 'no', lang, items: [], raw };
  if (hasKeyword(norm, 'greet')) return { action: 'greet', lang, items: [], raw };

  const matches = findItems(norm);
  if (matches.length === 0) {
    // "Same again" / "2 more" with no item named — repeat the last order.
    if (hasKeyword(norm, 'repeat')) {
      const numbers = findNumbers(norm);
      const qty = numbers.length > 0 ? numbers[0].value : null;
      return { action: 'repeat', lang, items: [], repeatQty: qty, raw };
    }
    return { action: 'unknown', lang, items: [], raw };
  }
  const numbers = findNumbers(norm);
  return { action: 'add', lang, items: withQuantities(matches, numbers), raw };
}

function withQuantities(matches, numbers) {
  return matches.map(({ item, index }) => {
    const n = nearestNumber(numbers, index);
    if (!n) return { item, qty: 1, unit: item.unit };
    const converted = toItemUnit(n.value, n.unit, item);
    return { item, qty: converted.qty, unit: converted.unit };
  });
}
