// Sarvam AI integration for KiranaVaani — Saaras speech-to-text,
// sarvam-105b chat with tool calls, Bulbul text-to-speech. Built exactly
// like the winning hackathon entry in the LinkedIn post (Saaras → sarvam-105b
// → Bulbul), verified against Sarvam's public API docs (docs.sarvam.ai):
//
//   base  https://api.sarvam.ai
//   chat  POST /v1/chat/completions   OpenAI-compatible, Authorization: Bearer
//         model "sarvam-105b" (128k context, tool calling: yes)
//   stt   POST /speech-to-text        multipart/form-data, api-subscription-key
//         model "saaras:v3", language_code e.g. "ta-IN", returns { transcript }
//   tts   POST /text-to-speech        JSON, api-subscription-key
//         model "bulbul:v3", target_language_code, speaker, pace 0.5–2.0,
//         returns JSON with base64 audio in audios[]
//
// NO API KEY IS EVER HARDCODED OR INVENTED HERE. Without a key the app uses
// the free Web Speech API path automatically (see src/voice.js). With a key,
// Sarvam becomes the primary voice pipeline. No real Sarvam call is made in
// the test suite — the client takes an injectable fetch.

import { normalizeText, findItems } from './intent.js';
import { findSubstituteIn } from './catalog.js';

export const SARVAM_CONFIG = {
  baseUrl: 'https://api.sarvam.ai',
  models: { chat: 'sarvam-105b', stt: 'saaras:v3', tts: 'bulbul:v3' },
  endpoints: {
    chat: '/v1/chat/completions',
    stt: '/speech-to-text',
    tts: '/text-to-speech',
  },
  // BCP-47 codes Sarvam expects for the seven shop languages.
  languages: { ta: 'ta-IN', te: 'te-IN', hi: 'hi-IN', kn: 'kn-IN', en: 'en-IN', ml: 'ml-IN', mr: 'mr-IN' },
  // Bulbul v3 speaker (documented voice; change in Settings if wanted).
  defaultSpeaker: 'anushka',
  maxToolRounds: 3,
};

export class SarvamError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'SarvamError';
    this.status = status;
  }
}

// ---------- key loading: ONE place ----------
// Order: (1) window.SARVAM_API_KEY / window.SARVAM_CONFIG.apiKey — set by the
// optional sarvam.config.js file (for self-hosted deploys, gitignored);
// (2) localStorage "kirana.sarvam.key" — set from the Settings page.
// Nothing else. If neither is set, the result is null and the app falls back
// to the free Web Speech API.
export function loadSarvamKey({ windowObj = null, storage = null } = {}) {
  const win = windowObj || (typeof window !== 'undefined' ? window : {});
  const fromConfig = win.SARVAM_API_KEY
    || (win.SARVAM_CONFIG && win.SARVAM_CONFIG.apiKey);
  if (fromConfig && String(fromConfig).trim()) return String(fromConfig).trim();
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const v = store && store.getItem('kirana.sarvam.key');
    if (v && String(v).trim()) return String(v).trim();
  } catch (err) { /* storage unavailable — no key */ }
  return null;
}

export function sarvamConfigured(apiKey) {
  return Boolean(apiKey && String(apiKey).trim());
}

// Automatic, seamless engine choice: Sarvam when a key exists, otherwise
// the free Web Speech API, otherwise no voice (typed fallback only).
export function resolveVoiceEngine({ apiKey = null, webSpeechSupported = false } = {}) {
  if (sarvamConfigured(apiKey)) return 'sarvam';
  if (webSpeechSupported) return 'webspeech';
  return 'none';
}

// ---------- HTTP client (fetch is injectable for tests) ----------

export class SarvamClient {
  constructor({ apiKey, fetchImpl = null, config = SARVAM_CONFIG } = {}) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new SarvamError('No Sarvam API key configured — add one in Settings or sarvam.config.js');
    }
    const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new SarvamError('fetch is not available in this environment');
    this.apiKey = apiKey;
    this.fetch = f;
    this.config = config;
  }

  async _request(path, { method = 'POST', headers = {}, body = null } = {}) {
    let res;
    try {
      res = await this.fetch(`${this.config.baseUrl}${path}`, { method, headers, body });
    } catch (err) {
      throw new SarvamError(`Network error calling Sarvam ${path}: ${err.message}`);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = (j && j.error && j.error.message) || (j && j.message) || JSON.stringify(j);
      } catch (err) {
        try { detail = await res.text(); } catch (ignored) { /* keep empty */ }
      }
      throw new SarvamError(`Sarvam ${path} failed (${res.status}): ${detail || res.statusText || 'unknown error'}`, res.status);
    }
    return res;
  }

  // Saaras speech-to-text. `audio` is a Blob (webm/wav from MediaRecorder).
  async transcribe({ audio, languageCode, model = this.config.models.stt } = {}) {
    if (!audio) throw new SarvamError('transcribe needs an audio Blob');
    const form = new FormData();
    form.append('file', audio, 'voice.webm');
    form.append('model', model);
    form.append('language_code', languageCode);
    const res = await this._request(this.config.endpoints.stt, {
      headers: { 'api-subscription-key': this.apiKey },
      body: form,
    });
    const data = await res.json();
    if (!data || typeof data.transcript !== 'string') {
      throw new SarvamError('Sarvam STT returned no transcript');
    }
    return { transcript: data.transcript, languageCode: data.language_code || languageCode, raw: data };
  }

  // sarvam-105b chat completions (OpenAI-compatible). Returns the assistant
  // message: { role, content, tool_calls? }.
  async chat({ messages, tools = null, model = this.config.models.chat, temperature = 0.3 } = {}) {
    const body = { model, messages, temperature };
    if (tools) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const res = await this._request(this.config.endpoints.chat, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const message = data && data.choices && data.choices[0] && data.choices[0].message;
    if (!message) throw new SarvamError('Sarvam chat returned no message');
    return message;
  }

  // Bulbul text-to-speech. Returns base64 mp3 audio (audios[0]).
  async synthesize({ text, targetLanguageCode, speaker = this.config.defaultSpeaker, pace = 1.0, model = this.config.models.tts } = {}) {
    if (!text) throw new SarvamError('synthesize needs text');
    const res = await this._request(this.config.endpoints.tts, {
      headers: {
        'api-subscription-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        target_language_code: targetLanguageCode,
        speaker,
        pace,
        model,
        output_audio_codec: 'mp3',
      }),
    });
    const data = await res.json();
    const audio = data && data.audios && data.audios[0];
    if (!audio) throw new SarvamError('Sarvam TTS returned no audio');
    return { audioBase64: audio, codec: 'mp3', raw: data };
  }
}

// ---------- shop tools (same tools the local agent logic uses) ----------

export const SHOP_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description: 'Check whether a kirana item is in stock, how much is on the shelf, and its price. Always call this before confirming any order.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Item name in any of the seven languages, e.g. "basmati rice" or "பாஸ்மதி அரிசி"' },
          quantity: { type: 'number', description: 'Quantity the customer asked for, in the item unit' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_substitute',
      description: 'Find a substitute for an out-of-stock item: same category, in stock, nearest price. Call it when check_stock says the item is out.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'The out-of-stock item name' },
          quantity: { type: 'number', description: 'Quantity the customer asked for' },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_bill',
      description: 'Add an item to, or remove an item from, the running bill. Only call it after check_stock — never add an item that is out of stock.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove'], description: 'add or remove' },
          item: { type: 'string', description: 'Item name in any of the seven languages' },
          quantity: { type: 'number', description: 'Quantity in the item unit (default 1)' },
        },
        required: ['action', 'item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_qr',
      description: 'Generate the UPI payment QR for the current bill total. Call it when the customer asks for the bill or wants to pay.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Resolve a free-text item name (any language) to this shop's item object.
function resolveItemName(agent, name) {
  const matches = findItems(normalizeText(String(name || '')));
  if (!matches.length) return null;
  const id = matches[0].item.id;
  const shopItems = agent.items || [];
  return shopItems.find((i) => i.id === id) || matches[0].item;
}

// Execute one tool call against the live shop agent. Returns a plain JSON
// object (never throws for bad input — the model gets an error object it can
// recover from). update_bill reuses agent.process itself, so the stock /
// substitute / billing behaviour is identical to the typed path.
export function executeToolCall(agent, call) {
  const name = call && call.function && call.function.name;
  let args = {};
  try {
    args = JSON.parse((call && call.function && call.function.arguments) || '{}');
  } catch (err) {
    return { error: 'bad_arguments', message: 'Tool arguments were not valid JSON.' };
  }
  try {
    switch (name) {
      case 'check_stock': {
        const item = resolveItemName(agent, args.item);
        if (!item) return { error: 'item_not_found', item: args.item };
        return {
          item: item.names.en, inStock: item.stock > 0, available: item.stock,
          unit: item.unit, price: item.price, currency: 'INR',
        };
      }
      case 'suggest_substitute': {
        const item = resolveItemName(agent, args.item);
        if (!item) return { error: 'item_not_found', item: args.item };
        const sub = findSubstituteIn(item, agent.items);
        if (!sub) return { substitute: null, note: 'No substitute is available for this item.' };
        return {
          substitute: { name: sub.names.en, price: sub.price, unit: sub.unit, inStock: sub.stock > 0 },
          quantity: args.quantity ?? 1,
        };
      }
      case 'update_bill': {
        const item = resolveItemName(agent, args.item);
        if (!item) return { error: 'item_not_found', item: args.item };
        const qty = Number(args.quantity) || 1;
        const cmd = args.action === 'remove'
          ? `remove ${qty} ${item.names.en}`
          : `${qty} ${item.names.en}`;
        const result = agent.process(cmd, 'en');
        return {
          action: args.action, item: item.names.en, quantity: qty,
          billTotal: result.total,
          lines: result.lines.map((l) => ({ name: l.item.names.en, qty: l.qty, unit: l.item.unit, total: l.total })),
          suggestionPending: Boolean(agent.pendingSuggestion),
          note: result.reply,
        };
      }
      case 'generate_qr': {
        if (agent.total <= 0) {
          return { upiLink: null, amount: 0, note: 'The bill is empty — nothing to pay yet.' };
        }
        return {
          upiLink: agent.upiLink(), amount: agent.total, currency: 'INR',
          note: 'Show this UPI QR to the customer so they can scan and pay.',
        };
      }
      default:
        return { error: 'unknown_tool', tool: name };
    }
  } catch (err) {
    return { error: 'tool_failed', tool: name, message: String((err && err.message) || err) };
  }
}

// ---------- politeness register ----------
// Tamil (and the other languages) carry respect in the verb: "kudunga" is
// respectful, "kudu" is plain. The agent mirrors the register the customer
// uses — this was the winning project's own takeaway in the LinkedIn post.
// Heuristic on marker words; "neutral" when nothing is marked.
const REGISTER_MARKERS = {
  polite: {
    ta: ['kudunga', 'kodunga', 'குடுங்க', 'கொடுங்க', 'சொல்லுங்க'],
    te: ['ivvandi', 'cheppandi', 'ఇవ్వండి'],
    hi: ['dijiye', 'deejiye', 'बताइए', 'दीजिए'],
    kn: ['kodi', 'kodiri', 'ಕೊಡಿ'],
    en: ['please'],
    ml: ['tharoo', 'തരൂ', 'തരുമോ', 'പറയൂ'],
    mr: ['dya', 'द्या', 'सांगा'],
  },
  plain: {
    ta: ['kudu', 'kodu', 'குடு', 'கொடு'],
    te: ['ivvu', 'ఇవ్వు'],
    hi: ['do', 'दो'],
    kn: ['kodu', 'ಕೊಡು'],
    en: [],
    ml: ['tharu', 'തരു'],
    mr: ['de', 'दे'],
  },
};

export function detectRegister(text, lang = 'en') {
  const hay = ` ${normalizeText(text)} `;
  const polite = REGISTER_MARKERS.polite[lang] || [];
  const plain = REGISTER_MARKERS.plain[lang] || [];
  // Polite first: polite markers contain plain ones as substrings
  // ("kudunga" contains "kudu"), so word-boundary matching matters.
  if (polite.some((w) => hay.includes(` ${normalizeText(w)} `))) return 'polite';
  if (plain.some((w) => hay.includes(` ${normalizeText(w)} `))) return 'plain';
  return 'neutral';
}

const LANG_NAMES = { ta: 'Tamil', te: 'Telugu', hi: 'Hindi', kn: 'Kannada', en: 'English', ml: 'Malayalam', mr: 'Marathi' };

const REGISTER_EXAMPLES = {
  ta: '"kudunga"-style forms, never the plain "kudu" form',
  te: '"ivvandi"-style forms, never the plain "ivvu" form',
  hi: '"dijiye"-style forms, never the plain "do" form',
  kn: '"kodi"-style forms, never the plain "kodu" form',
  ml: '"tharoo"-style forms, never the plain "tharu" form',
  mr: '"dya"-style forms, never the plain "de" form',
  en: 'polite "please"-style forms',
};

export function buildSystemPrompt({ shopName, lang, register }) {
  const langName = LANG_NAMES[lang] || 'English';
  const registerLine = register === 'polite'
    ? `The customer is speaking respectfully — reply in the same respectful register (for example ${REGISTER_EXAMPLES[lang] || REGISTER_EXAMPLES.en}). Politeness is part of the product.`
    : register === 'plain'
      ? 'The customer is speaking plainly and casually — reply in the same plain, friendly register.'
      : 'Reply in a warm, polite register.';
  return [
    `You are the voice agent at ${shopName}, a kirana shop in India. The customer is speaking ${langName} — reply ONLY in ${langName} (Tanglish/Tinglish code-mix is fine when the customer mixes languages). Keep every reply to one or two short sentences: it will be spoken aloud.`,
    registerLine,
    'You have tools: check_stock (always check before confirming an order), suggest_substitute (when an item is out of stock), update_bill (add or remove items only after checking stock), generate_qr (when the customer asks for the bill or wants to pay). Never invent a price, stock level or item — use the tools. If a tool fails, say so plainly and offer to take the order by typing. Never claim a payment went through — the QR is only a payment request the customer scans with their own UPI app.',
  ].join('\n');
}

// ---------- conversation: sarvam-105b with tool calls, local fallback ----------

export class SarvamConversation {
  constructor({ client, agent, shopName = 'KiranaVaani', lang = 'en', historyLimit = 8 } = {}) {
    if (!client) throw new SarvamError('SarvamConversation needs a SarvamClient');
    if (!agent) throw new SarvamError('SarvamConversation needs a KiranaAgent');
    this.client = client;
    this.agent = agent;
    this.shopName = shopName;
    this.lang = lang;
    this.history = [];
    this.historyLimit = historyLimit;
  }

  // One customer turn -> { reply, lang, action, toolCalls, fallback, ... }
  // The return shape matches KiranaAgent.process so the voice session can
  // use it interchangeably. On ANY Sarvam failure the local rules engine
  // answers instead — the shop never goes silent.
  async reply(userText) {
    const register = detectRegister(userText, this.lang);
    const messages = [
      { role: 'system', content: buildSystemPrompt({ shopName: this.shopName, lang: this.lang, register }) },
      ...this.history.slice(-this.historyLimit),
      { role: 'user', content: userText },
    ];
    const toolCalls = [];
    try {
      let message = await this.client.chat({ messages, tools: SHOP_TOOLS });
      for (let round = 0; round < SARVAM_CONFIG.maxToolRounds && message && message.tool_calls && message.tool_calls.length; round++) {
        messages.push(message);
        for (const call of message.tool_calls) {
          const result = executeToolCall(this.agent, call);
          toolCalls.push({ name: call.function && call.function.name, args: call.function && call.function.arguments, result });
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
        message = await this.client.chat({ messages, tools: SHOP_TOOLS });
      }
      const replyText = (message && message.content ? String(message.content) : '').trim();
      if (!replyText) throw new SarvamError('Sarvam chat returned an empty reply');
      this.history.push({ role: 'user', content: userText });
      this.history.push({ role: 'assistant', content: replyText });
      return this._result(replyText, toolCalls, false, null);
    } catch (err) {
      // Fallback — and it must NOT double-bill: if tools already ran, the
      // cart already changed, so just read the bill instead of re-processing
      // the utterance.
      const local = toolCalls.length > 0
        ? this.agent.process('bill', this.lang)
        : this.agent.process(userText, this.lang);
      const out = this._result(local.reply, toolCalls, true, String((err && err.message) || err));
      out.lang = local.lang || this.lang;
      out.action = local.action || 'sarvam';
      return out;
    }
  }

  _result(reply, toolCalls, fallback, fallbackError) {
    const qrCalled = toolCalls.some((t) => t.name === 'generate_qr');
    return {
      reply,
      lang: this.lang,
      action: 'sarvam',
      lines: this.agent.lines,
      total: this.agent.total,
      upiLink: this.agent.upiLink(),
      showQR: qrCalled && this.agent.total > 0,
      suggestion: this.agent.pendingSuggestion || null,
      toolCalls,
      fallback,
      fallbackError,
    };
  }
}
