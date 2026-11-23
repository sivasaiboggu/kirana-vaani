// Persistence for KiranaVaani: shop settings, voice-session history and
// the Sarvam API key. Browser storage is localStorage; in Node (tests) an
// in-memory map stands in, so the same module is importable everywhere.
// Nothing here ever leaves the device — there is no server.

import { SHOPS } from './shops.js';

const memory = new Map();

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (err) {
    return false;
  }
}

export function storeGet(key, fallback = null) {
  try {
    if (storageAvailable()) {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }
    return memory.has(key) ? memory.get(key) : fallback;
  } catch (err) {
    return fallback;
  }
}

export function storeSet(key, value) {
  try {
    if (storageAvailable()) localStorage.setItem(key, JSON.stringify(value));
    else memory.set(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

export function storeRemove(key) {
  try {
    if (storageAvailable()) localStorage.removeItem(key);
    else memory.delete(key);
    return true;
  } catch (err) {
    return false;
  }
}

// Test helper: wipe the in-memory store (used by the test suite).
export function __clearMemoryStore() {
  memory.clear();
}

export const KEYS = {
  currentShop: 'kirana.currentShop',
  settings: (shopId) => `kirana.settings.${shopId}`,
  sessions: (shopId) => `kirana.sessions.${shopId}`,
  sarvamKey: 'kirana.sarvam.key',
};

// ---------- current shop ----------

export function getCurrentShopId() {
  const id = storeGet(KEYS.currentShop, SHOPS[0].id);
  return SHOPS.some((s) => s.id === id) ? id : SHOPS[0].id;
}

export function setCurrentShopId(id) {
  if (!SHOPS.some((s) => s.id === id)) return false;
  storeSet(KEYS.currentShop, id);
  return true;
}

// ---------- shop settings ----------

export function defaultSettings(shop) {
  return {
    shopName: shop.name,
    vpa: shop.vpa,
    defaultLang: shop.lang,
    voiceSpeed: 1.0,
  };
}

export function getSettings(shop) {
  const stored = storeGet(KEYS.settings(shop.id), {}) || {};
  return { ...defaultSettings(shop), ...stored };
}

export function saveSettings(shopId, patch) {
  const shop = SHOPS.find((s) => s.id === shopId) || SHOPS[0];
  const next = { ...getSettings(shop), ...patch };
  return storeSet(KEYS.settings(shop.id), next) ? next : null;
}

// ---------- Sarvam API key (browser only, never in the repo) ----------

export function getSarvamKey() {
  const v = storeGet(KEYS.sarvamKey, null);
  return v && String(v).trim() ? String(v).trim() : null;
}

export function setSarvamKey(key) {
  if (!key || !String(key).trim()) {
    storeRemove(KEYS.sarvamKey);
    return null;
  }
  storeSet(KEYS.sarvamKey, String(key).trim());
  return String(key).trim();
}

// ---------- voice-session history ----------

function todayAt(hour, minute, now = new Date()) {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function isoPlus(iso, ms) {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

// Seeded demo sessions so the dashboard shows real-looking life on first
// open. Content is fixed; only the date is "today". Totals are hand-checked
// against the per-shop prices in shops.js.
export function buildSeedSessions(shopId, now = new Date()) {
  const seeds = {
    'sri-lakshmi': [
      {
        id: 'seed-sri-lakshmi-1', shopId, lang: 'ta',
        startedAt: todayAt(9, 12, now), endedAt: isoPlus(todayAt(9, 12, now), 54000), durationMs: 54000,
        turns: [
          { who: 'user', text: 'ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?', lang: 'ta' },
          { who: 'agent', text: '5 கிலோ ஆசீர்வாத் ஆட்டா சேர்த்தாச்சு — ₹275.00. இதுவரை பில்: ₹275.00.', lang: 'ta' },
          { who: 'user', text: 'பொன்னி அரிசி 2 கிலோ', lang: 'ta' },
          { who: 'agent', text: '2 கிலோ பொன்னி அரிசி சேர்த்தாச்சு — ₹128.00. இதுவரை பில்: ₹403.00.', lang: 'ta' },
          { who: 'user', text: 'சர்க்கரை 2 கிலோ', lang: 'ta' },
          { who: 'agent', text: '2 கிலோ சர்க்கரை சேர்த்தாச்சு — ₹96.00. இதுவரை பில்: ₹499.00.', lang: 'ta' },
          { who: 'user', text: 'பில்', lang: 'ta' },
          { who: 'agent', text: 'உங்க பில்:\n• ஆசீர்வாத் ஆட்டா — 5 கிலோ × ₹55.00 = ₹275.00\n• பொன்னி அரிசி — 2 கிலோ × ₹64.00 = ₹128.00\n• சர்க்கரை — 2 கிலோ × ₹48.00 = ₹96.00\nமொத்தம்: ₹499.00. பணம் கட்ட "pay"னு சொல்லுங்க — UPI QR காட்டுறேன்.', lang: 'ta' },
        ],
        items: [
          { itemId: 'atta-aashirvaad', name: 'Aashirvaad Atta', qty: 5, unit: 'kg', price: 55, total: 275 },
          { itemId: 'rice-ponni', name: 'Ponni Rice', qty: 2, unit: 'kg', price: 64, total: 128 },
          { itemId: 'sugar', name: 'Sugar', qty: 2, unit: 'kg', price: 48, total: 96 },
        ],
        total: 499, bargeIns: 0, signals: [],
      },
      {
        id: 'seed-sri-lakshmi-2', shopId, lang: 'ta',
        startedAt: todayAt(11, 40, now), endedAt: isoPlus(todayAt(11, 40, now), 42000), durationMs: 42000,
        turns: [
          { who: 'user', text: 'பாஸ்மதி அரிசி 2 கிலோ', lang: 'ta' },
          { who: 'agent', text: 'பாஸ்மதி அரிசி ஸ்டாக் இல்லை. அதுக்கு பதிலா பொன்னி அரிசி சேர்க்கவா? (₹64.00 / கிலோ) சரின்னு சொல்லுங்க.', lang: 'ta' },
          { who: 'user', text: 'சரி', lang: 'ta' },
          { who: 'agent', text: 'சரி — 2 கிலோ பொன்னி அரிசி சேர்த்துட்டேன். இப்ப பில்: ₹128.00.', lang: 'ta' },
          { who: 'user', text: 'டீ தூள் 1 கிலோ', lang: 'ta' },
          { who: 'agent', text: '1 கிலோ டீ தூள் சேர்த்தாச்சு — ₹460.00. இதுவரை பில்: ₹588.00.', lang: 'ta' },
        ],
        items: [
          { itemId: 'rice-ponni', name: 'Ponni Rice', qty: 2, unit: 'kg', price: 64, total: 128 },
          { itemId: 'tea', name: 'Tea Powder', qty: 1, unit: 'kg', price: 460, total: 460 },
        ],
        total: 588, bargeIns: 0,
        signals: [{ itemId: 'rice-basmati', name: 'Basmati Rice', requestedQty: 2, available: 0, lang: 'ta' }],
      },
      {
        id: 'seed-sri-lakshmi-3', shopId, lang: 'ta',
        startedAt: todayAt(17, 5, now), endedAt: isoPlus(todayAt(17, 5, now), 38000), durationMs: 38000,
        turns: [
          { who: 'user', text: 'பால் 2 லிட்டர்', lang: 'ta' },
          { who: 'agent', text: '2 லிட்டர் பால் சேர்த்தாச்சு — ₹116.00. இதுவரை பில்: ₹116.00.', lang: 'ta' },
          { who: 'user', text: '1 டஜன் முட்டை', lang: 'ta' },
          { who: 'agent', text: '12 பீஸ் முட்டை சேர்த்தாச்சு — ₹84.00. இதுவரை பில்: ₹200.00.', lang: 'ta' },
          { who: 'user', text: '1 டஜன் வாழைப்பழம்', lang: 'ta' },
          { who: 'agent', text: '1 டஜன் வாழைப்பழம் சேர்த்தாச்சு — ₹60.00. இதுவரை பில்: ₹260.00.', lang: 'ta' },
        ],
        items: [
          { itemId: 'milk', name: 'Milk', qty: 2, unit: 'litre', price: 58, total: 116 },
          { itemId: 'eggs', name: 'Eggs', qty: 12, unit: 'piece', price: 7, total: 84 },
          { itemId: 'banana', name: 'Banana', qty: 1, unit: 'dozen', price: 60, total: 60 },
        ],
        total: 260, bargeIns: 1, signals: [],
      },
    ],
    'annapurna': [
      {
        id: 'seed-annapurna-1', shopId, lang: 'te',
        startedAt: todayAt(8, 45, now), endedAt: isoPlus(todayAt(8, 45, now), 47000), durationMs: 47000,
        turns: [
          { who: 'user', text: 'పొన్ని బియ్యం 2 కిలోలు', lang: 'te' },
          { who: 'agent', text: '2 కిలోలు పొన్ని బియ్యం చేర్చాను — ₹120.00. ఇప్పటివరకు బిల్లు: ₹120.00.', lang: 'te' },
          { who: 'user', text: 'కందిపప్పు 1 కిలో', lang: 'te' },
          { who: 'agent', text: '1 కిలో కందిపప్పు చేర్చాను — ₹165.00. ఇప్పటివరకు బిల్లు: ₹285.00.', lang: 'te' },
        ],
        items: [
          { itemId: 'rice-ponni', name: 'Ponni Rice', qty: 2, unit: 'kg', price: 60, total: 120 },
          { itemId: 'dal-toor', name: 'Toor Dal', qty: 1, unit: 'kg', price: 165, total: 165 },
        ],
        total: 285, bargeIns: 0, signals: [],
      },
      {
        id: 'seed-annapurna-2', shopId, lang: 'te',
        startedAt: todayAt(13, 20, now), endedAt: isoPlus(todayAt(13, 20, now), 39000), durationMs: 39000,
        turns: [
          { who: 'user', text: 'వేరుశనగ నూనె 1 లీటరు', lang: 'te' },
          { who: 'agent', text: 'వేరుశనగ నూనె స్టాక్ లేదు. దానికి బదులు సన్‌ఫ్లవర్ నూనె చేర్చమంటారా? (₹135.00 / లీటరు) సరే అని చెప్పండి.', lang: 'te' },
          { who: 'user', text: 'సరే', lang: 'te' },
          { who: 'agent', text: 'సరే — 1 లీటరు సన్‌ఫ్లవర్ నూనె చేర్చాను. ఇప్పుడు బిల్లు: ₹135.00.', lang: 'te' },
        ],
        items: [
          { itemId: 'oil-sunflower', name: 'Sunflower Oil', qty: 1, unit: 'litre', price: 135, total: 135 },
        ],
        total: 135, bargeIns: 0,
        signals: [{ itemId: 'oil-groundnut', name: 'Groundnut Oil', requestedQty: 1, available: 0, lang: 'te' }],
      },
      {
        id: 'seed-annapurna-3', shopId, lang: 'te',
        startedAt: todayAt(18, 30, now), endedAt: isoPlus(todayAt(18, 30, now), 33000), durationMs: 33000,
        turns: [
          { who: 'user', text: 'చక్కెర 3 కిలోలు', lang: 'te' },
          { who: 'agent', text: '3 కిలోలు చక్కెర చేర్చాను — ₹135.00. ఇప్పటివరకు బిల్లు: ₹135.00.', lang: 'te' },
          { who: 'user', text: 'ఉల్లిపాయ 2 కిలోలు', lang: 'te' },
          { who: 'agent', text: '2 కిలోలు ఉల్లిపాయ చేర్చాను — ₹80.00. ఇప్పటివరకు బిల్లు: ₹215.00.', lang: 'te' },
        ],
        items: [
          { itemId: 'sugar', name: 'Sugar', qty: 3, unit: 'kg', price: 45, total: 135 },
          { itemId: 'onion', name: 'Onion', qty: 2, unit: 'kg', price: 40, total: 80 },
        ],
        total: 215, bargeIns: 0, signals: [],
      },
    ],
    'sharma-general': [
      {
        id: 'seed-sharma-general-1', shopId, lang: 'kn',
        startedAt: todayAt(10, 5, now), endedAt: isoPlus(todayAt(10, 5, now), 44000), durationMs: 44000,
        turns: [
          { who: 'user', text: 'ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ', lang: 'kn' },
          { who: 'agent', text: '5 ಕಿಲೋ ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು ಸೇರಿಸಿದ್ದೇನೆ — ₹290.00. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್: ₹290.00.', lang: 'kn' },
          { who: 'user', text: 'ರವೆ 2 ಕಿಲೋ', lang: 'kn' },
          { who: 'agent', text: '2 ಕಿಲೋ ರವೆ ಸೇರಿಸಿದ್ದೇನೆ — ₹96.00. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್: ₹386.00.', lang: 'kn' },
        ],
        items: [
          { itemId: 'atta-aashirvaad', name: 'Aashirvaad Atta', qty: 5, unit: 'kg', price: 58, total: 290 },
          { itemId: 'rava', name: 'Rava (Semolina)', qty: 2, unit: 'kg', price: 48, total: 96 },
        ],
        total: 386, bargeIns: 0, signals: [],
      },
      {
        id: 'seed-sharma-general-2', shopId, lang: 'kn',
        startedAt: todayAt(14, 50, now), endedAt: isoPlus(todayAt(14, 50, now), 36000), durationMs: 36000,
        turns: [
          { who: 'user', text: 'ಕಾಫಿ ಪುಡಿ 1 ಕಿಲೋ', lang: 'kn' },
          { who: 'agent', text: 'ಕಾಫಿ ಪುಡಿ ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ. ಅದರ ಬದಲು ಚಹಾ ಪುಡಿ ಸೇರಿಸಲೇ? (₹460.00 / ಕಿಲೋ) ಹೌದು ಅನ್ನಿ.', lang: 'kn' },
          { who: 'user', text: 'ಹೌದು', lang: 'kn' },
          { who: 'agent', text: 'ಸರಿ — 1 ಕಿಲೋ ಚಹಾ ಪುಡಿ ಸೇರಿಸಿದ್ದೇನೆ. ಈಗಿನ ಬಿಲ್: ₹460.00.', lang: 'kn' },
        ],
        items: [
          { itemId: 'tea', name: 'Tea Powder', qty: 1, unit: 'kg', price: 460, total: 460 },
        ],
        total: 460, bargeIns: 0,
        signals: [{ itemId: 'coffee', name: 'Coffee Powder', requestedQty: 1, available: 0, lang: 'kn' }],
      },
      {
        id: 'seed-sharma-general-3', shopId, lang: 'kn',
        startedAt: todayAt(19, 15, now), endedAt: isoPlus(todayAt(19, 15, now), 31000), durationMs: 31000,
        turns: [
          { who: 'user', text: 'ಮೊಸರು 2 ಪ್ಯಾಕೆಟ್', lang: 'kn' },
          { who: 'agent', text: '2 ಪ್ಯಾಕೆಟ್ ಮೊಸರು ಸೇರಿಸಿದ್ದೇನೆ — ₹70.00. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್: ₹70.00.', lang: 'kn' },
          { who: 'user', text: 'ಬ್ರೆಡ್ 1 ಪ್ಯಾಕೆಟ್', lang: 'kn' },
          { who: 'agent', text: '1 ಪ್ಯಾಕೆಟ್ ಬ್ರೆಡ್ ಸೇರಿಸಿದ್ದೇನೆ — ₹48.00. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್: ₹118.00.', lang: 'kn' },
        ],
        items: [
          { itemId: 'curd', name: 'Curd', qty: 2, unit: 'packet', price: 35, total: 70 },
          { itemId: 'bread', name: 'Milk Bread', qty: 1, unit: 'packet', price: 48, total: 48 },
        ],
        total: 118, bargeIns: 0, signals: [],
      },
    ],
  };
  return seeds[shopId] || [];
}

export function getSessions(shopId) {
  const stored = storeGet(KEYS.sessions(shopId), null);
  if (Array.isArray(stored)) return stored;
  const seeds = buildSeedSessions(shopId);
  storeSet(KEYS.sessions(shopId), seeds);
  return seeds;
}

export function makeSessionRecord(shopId, record) {
  return {
    id: record.id || `session-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    shopId,
    lang: record.lang || 'en',
    startedAt: record.startedAt || new Date().toISOString(),
    endedAt: record.endedAt || new Date().toISOString(),
    durationMs: record.durationMs || 0,
    turns: record.turns || record.transcript || [],
    items: record.items || [],
    total: record.total || 0,
    bargeIns: record.bargeIns || 0,
    signals: record.signals || [],
  };
}

export function recordSession(shopId, record) {
  const sessions = getSessions(shopId);
  const entry = makeSessionRecord(shopId, record);
  const previous = sessions.find(({ id }) => id === entry.id);
  if (previous) return previous;
  return storeSet(KEYS.sessions(shopId), [entry, ...sessions].slice(0, 50)) ? entry : null;
}
