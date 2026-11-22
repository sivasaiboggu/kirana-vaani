// Sarvam AI integration tests — mocked HTTP only.
// No real key, no real network calls. The mock fetch records every request
// so the tests assert the exact endpoint, auth header, model and payload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KiranaAgent } from '../src/agent.js';
import {
  SARVAM_CONFIG, SarvamError, SarvamClient, SarvamConversation,
  SHOP_TOOLS, executeToolCall, detectRegister, buildSystemPrompt,
  loadSarvamKey, sarvamConfigured, resolveVoiceEngine,
} from '../src/sarvam.js';

const KEY = 'test-key-not-real';

// Minimal fetch mock: routes by URL substring, records every call.
function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    const route = routes.find(([sub]) => url.includes(sub));
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    const [, res] = route;
    if (res instanceof Error) throw res;
    return {
      ok: res.ok !== false,
      status: res.status || 200,
      statusText: res.statusText || 'OK',
      json: async () => res.json,
      text: async () => JSON.stringify(res.json ?? {}),
    };
  };
  return { fetchImpl, calls };
}

function chatMessage(content, toolCalls = null) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

test('config: verified endpoints and models (docs.sarvam.ai)', () => {
  assert.equal(SARVAM_CONFIG.baseUrl, 'https://api.sarvam.ai');
  assert.equal(SARVAM_CONFIG.endpoints.chat, '/v1/chat/completions');
  assert.equal(SARVAM_CONFIG.endpoints.stt, '/speech-to-text');
  assert.equal(SARVAM_CONFIG.endpoints.tts, '/text-to-speech');
  assert.equal(SARVAM_CONFIG.models.chat, 'sarvam-105b');
  assert.equal(SARVAM_CONFIG.models.stt, 'saaras:v3');
  assert.equal(SARVAM_CONFIG.models.tts, 'bulbul:v3');
  assert.equal(SARVAM_CONFIG.languages.ta, 'ta-IN');
  assert.equal(SARVAM_CONFIG.languages.te, 'te-IN');
  assert.equal(SARVAM_CONFIG.languages.hi, 'hi-IN');
  assert.equal(SARVAM_CONFIG.languages.kn, 'kn-IN');
  assert.equal(SARVAM_CONFIG.languages.en, 'en-IN');
});

test('key loading: config file first, then storage, never a hardcoded key', () => {
  const storage = { getItem: () => 'stored-key', setItem: () => {} };
  assert.equal(loadSarvamKey({ windowObj: { SARVAM_API_KEY: 'cfg-key' }, storage }), 'cfg-key');
  assert.equal(loadSarvamKey({ windowObj: {}, storage }), 'stored-key');
  assert.equal(loadSarvamKey({ windowObj: {}, storage: { getItem: () => JSON.stringify('saved-key') } }), 'saved-key');
  assert.equal(loadSarvamKey({ windowObj: {}, storage: { getItem: () => null } }), null);
  assert.equal(loadSarvamKey({ windowObj: {} }), null);
  assert.equal(sarvamConfigured(KEY), true);
  assert.equal(sarvamConfigured(''), false);
  assert.equal(sarvamConfigured(null), false);
  // Engine choice is automatic and seamless.
  assert.equal(resolveVoiceEngine({ apiKey: KEY, webSpeechSupported: true }), 'sarvam');
  assert.equal(resolveVoiceEngine({ apiKey: null, webSpeechSupported: true }), 'webspeech');
  assert.equal(resolveVoiceEngine({ apiKey: null, webSpeechSupported: false }), 'none');
  // Client refuses to construct without a key.
  assert.throws(() => new SarvamClient({ apiKey: '' }), SarvamError);
});

test('chat: Bearer auth, sarvam-105b, tools attached', async () => {
  const { fetchImpl, calls } = mockFetch([
    ['/v1/chat/completions', { json: chatMessage('Hello!') }],
  ]);
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  const msg = await client.chat({ messages: [{ role: 'user', content: 'hi' }], tools: SHOP_TOOLS });
  assert.equal(msg.content, 'Hello!');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.sarvam.ai/v1/chat/completions');
  assert.equal(calls[0].opts.headers.Authorization, `Bearer ${KEY}`);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.model, 'sarvam-105b');
  assert.equal(body.tools.length, 4);
  assert.deepEqual(body.tools.map((t) => t.function.name), ['check_stock', 'suggest_substitute', 'update_bill', 'generate_qr']);
  assert.equal(body.tool_choice, 'auto');
});

test('chat: HTTP errors become SarvamError with the status', async () => {
  const { fetchImpl } = mockFetch([
    ['/v1/chat/completions', { ok: false, status: 401, json: { error: { message: 'Invalid API key' } } }],
  ]);
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  await assert.rejects(
    () => client.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    (e) => e instanceof SarvamError && e.status === 401 && /Invalid API key/.test(e.message),
  );
});

test('stt: multipart upload, api-subscription-key header, saaras:v3', async () => {
  const { fetchImpl, calls } = mockFetch([
    ['/speech-to-text', { json: { transcript: 'ஆசீர்வாத் ஆட்டா 5 கிலோ', language_code: 'ta-IN' } }],
  ]);
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  const blob = new Blob(['fake-audio'], { type: 'audio/webm' });
  const out = await client.transcribe({ audio: blob, languageCode: 'ta-IN' });
  assert.equal(out.transcript, 'ஆசீர்வாத் ஆட்டா 5 கிலோ');
  assert.equal(calls[0].url, 'https://api.sarvam.ai/speech-to-text');
  assert.equal(calls[0].opts.headers['api-subscription-key'], KEY);
  const form = calls[0].opts.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.get('model'), 'saaras:v3');
  assert.equal(form.get('language_code'), 'ta-IN');
  assert.ok(form.get('file') instanceof Blob);
});

test('tts: JSON body, target language, bulbul:v3, base64 audio back', async () => {
  const { fetchImpl, calls } = mockFetch([
    ['/text-to-speech', { json: { audios: ['QUJD'] } }],
  ]);
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  const out = await client.synthesize({ text: 'வணக்கம்', targetLanguageCode: 'ta-IN', pace: 1.2 });
  assert.equal(out.audioBase64, 'QUJD');
  assert.equal(out.codec, 'mp3');
  assert.equal(calls[0].opts.headers['api-subscription-key'], KEY);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.model, 'bulbul:v3');
  assert.equal(body.target_language_code, 'ta-IN');
  assert.equal(body.text, 'வணக்கம்');
  assert.equal(body.pace, 1.2);
  assert.equal(body.output_audio_codec, 'mp3');
});

test('tools: check_stock / suggest_substitute / update_bill / generate_qr run on the live agent', () => {
  const agent = new KiranaAgent();
  const stock = executeToolCall(agent, { function: { name: 'check_stock', arguments: JSON.stringify({ item: 'basmati rice', quantity: 2 }) } });
  assert.equal(stock.inStock, false);
  assert.equal(stock.available, 0);
  assert.equal(stock.price, 110);

  const sub = executeToolCall(agent, { function: { name: 'suggest_substitute', arguments: JSON.stringify({ item: 'basmati rice', quantity: 2 }) } });
  assert.equal(sub.substitute.name, 'Ponni Rice');

  const upd = executeToolCall(agent, { function: { name: 'update_bill', arguments: JSON.stringify({ action: 'add', item: 'sugar', quantity: 2 }) } });
  assert.equal(upd.billTotal, 90);
  assert.equal(upd.lines.length, 1);

  const qr = executeToolCall(agent, { function: { name: 'generate_qr', arguments: '{}' } });
  assert.ok(qr.upiLink.startsWith('upi://pay?'));
  assert.ok(qr.upiLink.includes('am=90.00'));

  // Unknown tools and bad items fail soft — the model gets an error object.
  assert.equal(executeToolCall(agent, { function: { name: 'fly_to_moon', arguments: '{}' } }).error, 'unknown_tool');
  assert.equal(executeToolCall(agent, { function: { name: 'check_stock', arguments: '{"item":"unobtainium"}' } }).error, 'item_not_found');
  assert.equal(executeToolCall(agent, { function: { name: 'check_stock', arguments: 'not-json' } }).error, 'bad_arguments');
});

test('tools: update_bill in Tamil works through the same agent logic', () => {
  const agent = new KiranaAgent();
  const out = executeToolCall(agent, { function: { name: 'update_bill', arguments: JSON.stringify({ action: 'add', item: 'பாஸ்மதி அரிசி', quantity: 2 }) } });
  assert.equal(out.billTotal, 0); // out of stock — nothing added
  assert.equal(out.suggestionPending, true);
  assert.equal(agent.signals.length, 1);
});

test('conversation: tool-call round trip in Tamil, then a spoken reply', async () => {
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    n += 1;
    const body = n === 1
      ? chatMessage('', [
        { id: 'call-1', type: 'function', function: { name: 'check_stock', arguments: JSON.stringify({ item: 'basmati rice', quantity: 2 }) } },
      ])
      : chatMessage('பாஸ்மதி அரிசி ஸ்டாக் இல்லை. பொன்னி அரிசி சேர்க்கவா?');
    return { ok: true, status: 200, json: async () => body, text: async () => '' };
  };
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  const agent = new KiranaAgent();
  const conv = new SarvamConversation({ client, agent, shopName: 'Sri Lakshmi Stores', lang: 'ta' });
  const out = await conv.reply('பாஸ்மதி அரிசி 2 கிலோ');
  assert.equal(out.fallback, false);
  assert.equal(out.toolCalls.length, 1);
  assert.equal(out.toolCalls[0].name, 'check_stock');
  assert.equal(out.toolCalls[0].result.inStock, false);
  assert.ok(/பொன்னி/.test(out.reply), out.reply);
  // The tool message went back to the model with its result.
  assert.equal(calls.length, 2);
  const secondBody = JSON.parse(calls[1].opts.body);
  assert.ok(secondBody.messages.some((m) => m.role === 'tool' && JSON.parse(m.content).inStock === false));
});

test('conversation: chat failure falls back to the local engine (no double-billing)', async () => {
  const { fetchImpl } = mockFetch([
    ['/v1/chat/completions', { ok: false, status: 500, json: { error: { message: 'boom' } } }],
  ]);
  const client = new SarvamClient({ apiKey: KEY, fetchImpl });
  const agent = new KiranaAgent();
  const conv = new SarvamConversation({ client, agent, lang: 'en' });
  const out = await conv.reply('2 kg sugar');
  assert.equal(out.fallback, true);
  assert.equal(agent.total, 90);
  assert.ok(/sugar/i.test(out.reply));

  // And when tools already ran before the failure, the fallback must NOT
  // re-process the utterance (that would add the item twice).
  let n = 0;
  const flaky = async (url, opts) => {
    n += 1;
    if (n === 1) {
      return {
        ok: true, status: 200,
        json: async () => chatMessage('', [
          { id: 'call-1', type: 'function', function: { name: 'update_bill', arguments: JSON.stringify({ action: 'add', item: 'sugar', quantity: 2 }) } },
        ]),
        text: async () => '',
      };
    }
    return { ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }), text: async () => '' };
  };
  const client2 = new SarvamClient({ apiKey: KEY, fetchImpl: flaky });
  const agent2 = new KiranaAgent();
  const conv2 = new SarvamConversation({ client: client2, agent: agent2, lang: 'en' });
  const out2 = await conv2.reply('2 kg sugar');
  assert.equal(out2.fallback, true);
  assert.equal(out2.toolCalls.length, 1);
  assert.equal(agent2.total, 90); // added once by the tool, not twice
});

test('politeness register: kudunga vs kudu (and friends) in all seven languages', () => {
  assert.equal(detectRegister('atta 5 kg kudunga', 'ta'), 'polite');
  assert.equal(detectRegister('atta 5 kg kudu', 'ta'), 'plain');
  assert.equal(detectRegister('ஆட்டா குடுங்க', 'ta'), 'polite');
  assert.equal(detectRegister('biyyam ivvandi', 'te'), 'polite');
  assert.equal(detectRegister('biyyam ivvu', 'te'), 'plain');
  assert.equal(detectRegister('aata dijiye', 'hi'), 'polite');
  assert.equal(detectRegister('aata do', 'hi'), 'plain');
  assert.equal(detectRegister('akki kodi', 'kn'), 'polite');
  assert.equal(detectRegister('akki kodu', 'kn'), 'plain');
  assert.equal(detectRegister('please add 2 kg sugar', 'en'), 'polite');
  assert.equal(detectRegister('2 kg sugar', 'en'), 'neutral');
  assert.equal(detectRegister('2 kg sugar', 'ta'), 'neutral');
  // The system prompt carries the register into the model call.
  const prompt = buildSystemPrompt({ shopName: 'Test Shop', lang: 'ta', register: 'polite' });
  assert.ok(/kudunga/.test(prompt));
  assert.ok(/Tamil/.test(prompt));
  assert.ok(/never invent a price/i.test(prompt));
});
