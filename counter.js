// KiranaVaani — Live voice counter.
// The call-like voice session: start a session, talk, the agent listens,
// thinks, speaks, then listens again — no mic tap per turn. Barge-in works
// two ways: speak over the agent (echo-guarded), or hit Interrupt.
// Voice engine is automatic: Sarvam AI (Saaras -> sarvam-105b -> Bulbul)
// when a key is configured, otherwise the free Web Speech API. Typing always
// works and drives the same session machine. ?demo=ta|te|hi|kn|en runs a
// scripted order through the session (add &fast=1 for screenshots).

import { KiranaAgent } from './src/agent.js';
import { LANGUAGES, nameIn } from './src/catalog.js';
import { formatINR, round2 } from './src/billing.js';
import { detectLanguage, normalizeText } from './src/intent.js';
import { VoiceSession, createDemoIO, createSilentIO, runDemoTurns, STATE_LABELS } from './src/session.js';
import { shopCatalog } from './src/shops.js';
import { getSettings, makeSessionRecord, recordSession } from './src/store.js';
import { getKhataAccounts, postKhataBill } from './src/khata.js';
import { icon } from './src/icons.js';
import { initShell } from './src/shell.js';
import { SarvamClient, SarvamConversation, loadSarvamKey, resolveVoiceEngine } from './src/sarvam.js';
import { buildReceipt } from './src/receipt.js';
import { WebSpeechIO, SarvamIO, webSpeechSupported } from './src/voice.js';

const $ = (id) => document.getElementById(id);

const UI = {
  ta: {
    chatTitle: 'கடையோடு பேசுங்கள்',
    placeholder: 'ஆர்டர் செய்யுங்கள்… எ.கா. ஆசீர்வாத் ஆட்டா 5 கிலோ',
    chips: ['ஆசீர்வாத் ஆட்டா 5 கிலோ', 'பாஸ்மதி அரிசி 2 கிலோ', 'பில்'],
    greetWord: 'வணக்கம்',
    voiceReady: 'குரல் தயார் — தமிழில் பேசுங்கள்',
  },
  te: {
    chatTitle: 'దుకాణంతో మాట్లాడండి',
    placeholder: 'మీ ఆర్డర్ టైప్ చేయండి… ఉదా. ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు',
    chips: ['ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు', 'బాస్మతి బియ్యం 2 కిలోలు', 'బిల్లు'],
    greetWord: 'నమస్కారం',
    voiceReady: 'వాయిస్ సిద్ధం — తెలుగులో మాట్లాడండి',
  },
  hi: {
    chatTitle: 'दुकान से बात कीजिए',
    placeholder: 'अपना ऑर्डर लिखिए… जैसे आशीर्वाद आटा 5 किलो',
    chips: ['आशीर्वाद आटा 5 किलो', 'बासमती चावल 2 किलो', 'बिल'],
    greetWord: 'नमस्ते',
    voiceReady: 'आवाज़ तैयार है — हिन्दी में बोलिए',
  },
  kn: {
    chatTitle: 'ಅಂಗಡಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ',
    placeholder: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಟೈಪ್ ಮಾಡಿ… ಉದಾ. ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ',
    chips: ['ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ', 'ಬಾಸ್ಮತಿ ಅಕ್ಕಿ 2 ಕಿಲೋ', 'ಬಿಲ್'],
    greetWord: 'ನಮಸ್ಕಾರ',
    voiceReady: 'ಧ್ವನಿ ಸಿದ್ಧ — ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
  },
  en: {
    chatTitle: 'Talk to the shop',
    placeholder: 'Type your order… e.g. Aashirvaad atta 5 kg',
    chips: ['Aashirvaad atta 5 kg', 'Basmati rice 2 kg', 'bill'],
    greetWord: 'hello',
    voiceReady: 'Voice ready — speak in English',
  },
  ml: {
    chatTitle: 'കടയോട് സംസാരിക്കൂ',
    placeholder: 'ഓർഡർ ടൈപ്പ് ചെയ്യൂ… ഉദാ. ആശിർവാദ് ആട്ട 5 കിലോ',
    chips: ['ആശിർവാദ് ആട്ട 5 കിലോ', 'ബസ്മതി അരി 2 കിലോ', 'ബിൽ'],
    greetWord: 'നമസ്കാരം',
    voiceReady: 'ശബ്ദം തയ്യാർ — മലയാളത്തിൽ സംസാരിക്കൂ',
  },
  mr: {
    chatTitle: 'दुकानाशी बोला',
    placeholder: 'तुमची ऑर्डर टाइप करा… उदा. आशीर्वाद आटा 5 किलो',
    chips: ['आशीर्वाद आटा 5 किलो', 'बासमती तांदूळ 2 किलो', 'बिल'],
    greetWord: 'नमस्कार',
    voiceReady: 'आवाज तयार — मराठीत बोला',
  },
};

// Scripted demo orders — one per language. The basmati step is deliberate:
// it is out of stock, so the demo shows the substitute suggestion + yes flow.
const DEMOS = {
  ta: ['ஆசீர்வாத் ஆட்டா 5 கிலோ இருக்கா?', 'பாஸ்மதி அரிசி 2 கிலோ', 'சரி', '2 கிலோ சர்க்கரை', 'பில்'],
  te: ['ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు', 'బాస్మతి బియ్యం 2 కిలోలు', 'సరే', '2 కిలోల చక్కెర', 'బిల్లు'],
  hi: ['आशीर्वाद आटा 5 किलो', 'बासमती चावल 2 किलो', 'हाँ', '2 किलो चीनी', 'बिल'],
  kn: ['ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ', 'ಬಾಸ್ಮತಿ ಅಕ್ಕಿ 2 ಕಿಲೋ', 'ಹೌದು', '2 ಕಿಲೋ ಸಕ್ಕರೆ', 'ಬಿಲ್'],
  en: ['Aashirvaad atta 5 kg please', 'Basmati rice 2 kg', 'yes', '2 kg sugar', 'bill'],
  ml: ['ആശിർവാദ് ആട്ട 5 കിലോ ഉണ്ടോ?', 'ബസ്മതി അരി 2 കിലോ', 'ശരി', '2 കിലോ പഞ്ചസാര', 'ബിൽ'],
  mr: ['आशीर्वाद आटा 5 किलो पाहिजे', 'बासमती तांदूळ 2 किलो', 'होय', '2 किलो साखर', 'बिल'],
};

const { shop } = initShell({ active: 'counter' });
const settings = getSettings(shop);
const items = shopCatalog(shop);
const agent = new KiranaAgent({ items, vpa: settings.vpa, merchantName: settings.shopName });

const state = { lang: settings.defaultLang || shop.lang || 'ta', demoRunning: false, savingCredit: false, voiceDraft: false };
let sessionRecordId;
let creditEntry;
let sessionKind;
let textBeforeVoiceDraft = '';
let session = null;
let timerId = null;
let qrTotal = null;
let qrRequest = 0;
let lastAgentReply = '';
let sarvamClient = null;
let conversation = null;

// ---------- voice engine (automatic) ----------

const sarvamKey = loadSarvamKey();
const engine = resolveVoiceEngine({ apiKey: sarvamKey, webSpeechSupported: webSpeechSupported() });
if (engine === 'sarvam') {
  try {
    sarvamClient = new SarvamClient({ apiKey: sarvamKey });
    conversation = new SarvamConversation({ client: sarvamClient, agent, shopName: settings.shopName, lang: state.lang });
  } catch (err) {
    // Key present but unusable — fall through to the free engine below.
    sarvamClient = null;
    conversation = null;
  }
}
const activeEngine = conversation ? 'sarvam' : (engine === 'webspeech' ? 'webspeech' : 'none');

function engineNote() {
  if (activeEngine === 'sarvam') {
    return 'Sarvam voice is ready. You can also type below.';
  }
  if (activeEngine === 'webspeech') {
    return 'Start a voice session or type an order below.';
  }
  return 'Voice is unavailable in this browser. Type an order below.';
}

// One responder for the session: Sarvam when configured (with its own local
// fallback), otherwise the local rules engine directly.
async function respond(text, lang, isCurrent) {
  if (conversation) {
    const detected = detectLanguage(text, lang);
    conversation.lang = detected;
    const r = await conversation.reply(text, isCurrent);
    return r && { ...r, lang: r.lang || detected };
  }
  return agent.process(text, lang);
}

// ---------- rendering ----------

function addBubble(who, text, lang, note) {
  const div = document.createElement('div');
  div.className = `bubble ${who}`;
  const label = document.createElement('span');
  label.className = 'who';
  label.textContent = who === 'user'
    ? `You · ${LANGUAGES[lang] ? LANGUAGES[lang].english : lang}`
    : `${settings.shopName} · ${LANGUAGES[lang] ? LANGUAGES[lang].english : lang}`;
  div.appendChild(label);
  const message = document.createElement('p');
  if (Object.hasOwn(LANGUAGES, lang)) message.lang = lang;
  message.textContent = text;
  div.appendChild(message);
  if (note) {
    const n = document.createElement('span');
    n.className = 'bubble-note';
    n.textContent = note;
    div.appendChild(n);
  }
  if ($('transcriptEmpty')) $('transcriptEmpty').remove();
  $('transcript').appendChild(div);
  $('transcript').scrollTop = $('transcript').scrollHeight;
}

function addSystemNote(text) {
  const div = document.createElement('div');
  div.className = 'system-note';
  div.textContent = text;
  $('transcript').appendChild(div);
  $('transcript').scrollTop = $('transcript').scrollHeight;
}

function renderBill() {
  const lines = agent.lines;
  const box = $('billLines');
  const previous = new Map([...box.querySelectorAll('.bill-row')].map((row) => [row.dataset.item, row]));
  const fragment = document.createDocumentFragment();
  if (lines.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted empty-note';
    empty.textContent = 'Choose something from the shelf, or speak or type an order.';
    fragment.append(empty);
  }
  for (const line of lines) {
    const itemName = nameIn(line.item, state.lang);
    const row = document.createElement('div');
    row.className = `bill-row${previous.has(line.item.id) ? '' : ' bill-row-new'}`;
    row.dataset.item = line.item.id;
    const name = document.createElement('strong');
    name.lang = state.lang;
    name.textContent = itemName;
    const amount = document.createElement('span');
    amount.className = 'amt';
    amount.textContent = formatINR(line.total);
    const unit = document.createElement('span');
    unit.className = 'qty';
    unit.textContent = `${line.qty} ${line.item.unit} × ${formatINR(line.item.price)}`;
    row.append(name, amount, unit);
    if (session?.active) {
      const form = document.createElement('form');
      form.className = 'quantity-form';
      form.dataset.item = line.item.id;
      form.noValidate = true;
      const input = document.createElement('input');
      input.name = 'quantity';
      input.value = line.qty;
      input.inputMode = 'decimal';
      input.setAttribute('aria-label', `Quantity for ${itemName}`);
      const update = document.createElement('button');
      update.className = 'btn ghost';
      update.textContent = 'Set';
      update.setAttribute('aria-label', `Set quantity for ${itemName}`);
      const remove = document.createElement('button');
      remove.className = 'btn quiet';
      remove.type = 'button';
      remove.dataset.remove = line.item.id;
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${itemName}`);
      form.append(input, update, remove);
      row.append(form);
    }
    fragment.append(row);
  }
  const focus = document.activeElement?.closest('.quantity-form');
  const focusItem = focus?.dataset.item;
  const focusName = document.activeElement?.name;
  box.replaceChildren(fragment);
  if (focusItem) {
    const form = [...box.querySelectorAll('.quantity-form')].find((entry) => entry.dataset.item === focusItem);
    (form?.querySelector(focusName === 'quantity' ? 'input' : 'button') || $('currentBill')).focus({ preventScroll: true });
  }
  const total = formatINR(agent.total);
  if ($('billTotal').textContent !== total) {
    $('billTotal').textContent = total;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('billTotal').animate([{ transform: 'translateY(4px)', opacity: .55 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 200, easing: 'ease-out' });
    }
  }
  if (qrTotal !== agent.total) $('qrCard').hidden = true;
  $('billCount').textContent = `${lines.length} item${lines.length === 1 ? '' : 's'}`;
  setBillControls();
}

function setBillControls() {
  $('payBtn').disabled = agent.total <= 0 || state.savingCredit || !!creditEntry;
  $('khataBtn').disabled = agent.total <= 0 || !session?.canFinish || sessionKind === 'demo' || state.savingCredit;
}

function renderSignals() {
  const list = $('signalList');
  list.innerHTML = '';
  $('signalCount').textContent = String(agent.signals.length);
  if (agent.signals.length === 0) {
    list.innerHTML = '<li class="muted empty-note">No out-of-stock requests at this counter.</li>';
    return;
  }
  for (const s of agent.signals.slice().reverse()) {
    const li = document.createElement('li');
    const when = new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const main = document.createElement('span');
    main.textContent = `${s.name} — asked ${s.requestedQty}, shelf had ${s.available} (${LANGUAGES[s.lang].english})`;
    const time = document.createElement('span');
    time.className = 'when';
    time.textContent = `Restock signal · ${when}`;
    li.append(main, time);
    list.appendChild(li);
  }
}

function renderShelf() {
  // Stock comes from the agent's shelf (it depletes as items are added),
  // not the static catalogue — the agent clones the shelf per session, so
  // the catalogue itself is never mutated.
  const grid = $('shelfGrid');
  const query = normalizeText($('shelfSearch').value);
  const matches = query ? agent.items.filter((item) =>
    [...Object.values(item.names), ...item.aliases].some((name) => normalizeText(name).includes(query))) : agent.items;
  $('shelfCount').textContent = `${matches.length} item${matches.length === 1 ? '' : 's'}`;
  const entries = document.createDocumentFragment();
  if (matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No items match. Try another name.';
    entries.append(empty);
  }
  for (const item of matches) {
    const div = document.createElement('div');
    div.className = 'shelf-item';
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.lang = state.lang;
    nm.textContent = nameIn(item, state.lang);
    const pr = document.createElement('span');
    pr.className = 'pr';
    pr.textContent = `${formatINR(item.price)} / ${item.unit}`;
    const badge = document.createElement('span');
    badge.className = `stock-badge ${item.stock === 0 ? 'out' : item.stock <= 8 ? 'low' : 'in'}`;
    badge.textContent = item.stock === 0 ? 'Out of stock' : item.stock <= 8 ? `Only ${item.stock} left` : `In stock · ${item.stock}`;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn ghost shelf-add';
    add.dataset.add = item.id;
    add.disabled = item.stock <= 0;
    add.textContent = '+ Add';
    add.setAttribute('aria-label', `Add ${nm.textContent}`);
    div.append(nm, pr, badge, add);
    entries.appendChild(div);
  }
  const focusedItem = document.activeElement?.dataset.add;
  grid.replaceChildren(entries);
  if (focusedItem) {
    const button = [...grid.querySelectorAll('button')].find((entry) => entry.dataset.add === focusedItem && !entry.disabled);
    (button || $('shelfSearch')).focus({ preventScroll: true });
  }
}

async function showQR(upiLink) {
  const request = ++qrRequest;
  if (!upiLink) { $('qrCard').hidden = true; return; }
  qrTotal = agent.total;
  $('qrCard').hidden = false;
  $('upiLinkText').href = upiLink;
  $('qrImg').alt = 'UPI QR code for this bill';
  $('qrImg').removeAttribute('src');
  try {
    const { default: qrcode } = await import('./vendor/qrcode.js');
    if (request !== qrRequest || $('qrCard').hidden) return;
    const qr = qrcode(0, 'M');
    qr.addData(upiLink);
    qr.make();
    $('qrImg').src = qr.createDataURL(6, 8);
  } catch {
    if (request === qrRequest) $('qrImg').alt = 'QR generation failed. Use the UPI link below.';
  }
}

function renderLangUI() {
  const ui = UI[state.lang];
  $('chatTitle').textContent = ui.chatTitle;
  $('chatTitle').lang = state.lang;
  $('textInput').placeholder = ui.placeholder;
  $('textInput').lang = state.lang;
  const chips = $('chips');
  chips.innerHTML = '';
  for (const c of ui.chips) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.lang = state.lang;
    b.textContent = c;
    b.addEventListener('click', () => { $('textInput').value = c; handleTyped(c); });
    chips.appendChild(b);
  }
  document.querySelectorAll('.lang-pill').forEach((p) => {
    p.setAttribute('aria-pressed', String(p.dataset.lang === state.lang));
  });
  $('voiceStatus').textContent = session && session.active
    ? $('voiceStatus').textContent
    : engineNote();
  renderBill();
  renderShelf();
}

function setStateUI(next) {
  $('stateBadge').textContent = STATE_LABELS[next] || next;
  $('stateBadge').className = `state-badge state-${next}`;
  $('callCard').dataset.state = next;
  $('waveBox').dataset.state = next;
  $('startBtn').disabled = activeEngine === 'none' || (session?.active && sessionKind !== 'silent');
  $('reviewVoice').disabled = activeEngine === 'none' || sessionKind === 'demo';
  $('demoBtn').disabled = !!session?.active || state.demoRunning;
  $('endBtn').disabled = !session?.active || state.savingCredit || !$('creditForm').hidden;
  setBillControls();
  $('interruptBtn').disabled = !session || session.state !== 'speaking';
  if (next === 'listening') {
    const message = state.voiceDraft ? 'Microphone paused while you review the order.'
      : !$('creditForm').hidden && sessionKind === 'voice' ? 'Microphone paused while you save the bill.'
      : sessionKind === 'voice' ? 'Listening — speak now.'
      : sessionKind === 'demo' ? 'Playing the sample order.' : 'Ready for the next item.';
    $('voiceStatus').textContent = message;
  }
  if (next === 'thinking') $('voiceStatus').textContent = 'Thinking…';
  if (next === 'speaking') $('voiceStatus').textContent = 'Speaking. You can speak over the reply or choose Interrupt.';
  if (next === 'ended') $('voiceStatus').textContent = engineNote();
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (session) $('sessionTimer').textContent = fmtElapsed(session.elapsedMs);
  }, 500);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

// ---------- session ----------

// Echo guard for the live mic: the microphone can pick up the agent's own
// spoken reply through the speaker. A transcript that is (near-)identical to
// what the agent just said is almost certainly echo, not the customer.
function isEcho(text) {
  if (!lastAgentReply) return false;
  const a = normalizeText(text);
  const b = normalizeText(lastAgentReply);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 24 && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= .8 && (a.includes(b) || b.includes(a)));
}

function wrapGuarded(io) {
  return {
    listen: async () => {
      const t = await io.listen();
      if (t && isEcho(t)) return null;
      return t;
    },
    speak: (text, lang) => io.speak(text, lang),
    stopListening: () => { if (io.stopListening) io.stopListening(); },
  };
}

function buildIO(kind) {
  if (kind === 'demo') return createDemoIO();
  if (kind === 'silent') return createSilentIO();
  if (activeEngine === 'sarvam' && sarvamClient) {
    return wrapGuarded(new SarvamIO({ client: sarvamClient, lang: state.lang, pace: settings.voiceSpeed || 1.0 }));
  }
  if (activeEngine === 'webspeech') {
    return wrapGuarded(new WebSpeechIO({ lang: state.lang, rate: settings.voiceSpeed || 1.0 }));
  }
  return createSilentIO();
}

function onSessionEvent(ev) {
  if (ev.type === 'state') setStateUI(ev.state);
  if (ev.type === 'user-turn') addBubble('user', ev.turn.text, ev.turn.lang);
  if (ev.type === 'agent-turn') {
    lastAgentReply = ev.turn.text;
    addBubble('agent', ev.turn.text, ev.turn.lang, ev.result && ev.result.fallback ? 'answered locally — Sarvam was unavailable' : null);
    renderBill();
    renderSignals();
    renderShelf();
    if (ev.result && ev.result.showQR && ev.result.upiLink) showQR(ev.result.upiLink);
    else if (agent.total <= 0) $('qrCard').hidden = true;
  }
  if (ev.type === 'voice-draft') showVoiceDraft(ev.text);
  if (ev.type === 'barge-in') addSystemNote('— interrupted, listening again —');
  if (ev.type === 'listen-error') {
    if (ev.voiceUnavailable && sessionKind === 'voice') {
      sessionKind = 'silent';
      session.changeIO(buildIO('silent'));
      session.resumeVoice();
      setStateUI(session.state);
    }
    $('voiceStatus').textContent = `Voice error: ${ev.error} — typing still works.`;
  }
  if (ev.type === 'summary') showSummary(ev.summary);
}

function newSession(kind) {
  const io = buildIO(kind);
  const s = new VoiceSession({
    agent,
    io,
    lang: state.lang,
    respond,
    onEvent: onSessionEvent,
    shouldReviewVoice: () => sessionKind === 'voice' && $('reviewVoice').checked,
  });
  session = s;
  return s;
}

async function startVoiceSession(kind = 'voice') {
  if (session && session.active) return session;
  // A new session is a new customer: the previous bill must not carry over
  // (the old code never reset the agent, so session 2's bill and receipt
  // still contained session 1's items). Restock signals and the depleted
  // shelf stay — the shop really did sell those goods.
  sessionKind = kind;
  lastAgentReply = '';
  sessionRecordId = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
  creditEntry = null;
  clearVoiceDraft();
  closeCreditForm();
  $('billNotice').textContent = '';
  if (conversation) conversation.history.length = 0;
  agent.startNewSession();
  renderBill();
  renderSignals();
  renderShelf();
  $('qrCard').hidden = true;
  $('summaryCard').hidden = true;
  $('receiptLink').hidden = true;
  const empty = document.createElement('p');
  empty.id = 'transcriptEmpty';
  empty.className = 'muted empty-note';
  empty.textContent = 'Speak, type or choose an item from the shelf to start a bill.';
  $('transcript').replaceChildren(empty);
  const s = newSession(kind);
  await s.start();
  startTimer();
  setStateUI('listening');
  // Greet through the session itself, so the first turn is a real turn.
  if (kind !== 'silent') s.receive(UI[state.lang].greetWord);
  return s;
}

async function endSession() {
  if (!session?.active || state.savingCredit) return;
  clearVoiceDraft();
  stopTimer();
  await session.end();
}

function showSummary(summary) {
  stopTimer();
  const receipt = buildReceipt(summary, { shopName: settings.shopName, lang: summary.lang });
  const box = $('summaryBody');
  box.innerHTML = '';
  $('summaryCard').querySelector('h2').textContent = receipt.title;
  $('summaryCard').querySelector('h2').lang = summary.lang;
  box.lang = summary.lang;

  const head = document.createElement('div');
  head.className = 'receipt-head';
  const shopName = document.createElement('strong');
  shopName.textContent = receipt.shopName;
  const when = document.createElement('span');
  when.className = 'muted small';
  when.textContent = `${receipt.date} · ${receipt.time}`;
  head.append(shopName, document.createElement('br'), when);
  box.appendChild(head);

  if (receipt.lines.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted empty-note';
    empty.textContent = 'No items in this session.';
    box.appendChild(empty);
  } else {
    const lines = document.createElement('div');
    lines.className = 'receipt-lines';
    for (const line of receipt.lines) {
      const row = document.createElement('div');
      row.className = 'receipt-row';
      const name = document.createElement('span');
      name.textContent = `${line.name} · ${line.qtyText}`;
      const amt = document.createElement('span');
      amt.className = 'amt';
      amt.textContent = line.total;
      row.append(name, amt);
      lines.appendChild(row);
    }
    box.appendChild(lines);
  }

  const totalRow = document.createElement('div');
  totalRow.className = 'receipt-total';
  const totalLabel = document.createElement('span');
  totalLabel.textContent = receipt.totalLabel;
  const totalVal = document.createElement('strong');
  totalVal.textContent = receipt.total;
  totalRow.append(totalLabel, totalVal);
  box.appendChild(totalRow);

  const meta = document.createElement('div');
  meta.className = 'receipt-meta';
  meta.textContent = receipt.meta.map((m) => `${m.key}: ${m.value}`).join(' · ');
  box.appendChild(meta);
  if (receipt.signals.length > 0) {
    const sig = document.createElement('p');
    sig.className = 'muted small receipt-signals';
    sig.textContent = receipt.signalsNote;
    box.appendChild(sig);
  }
  const thanks = document.createElement('p');
  thanks.className = 'receipt-thanks';
  thanks.textContent = receipt.thanks;
  box.appendChild(thanks);

  $('summaryCard').hidden = false;
  $('receiptLink').hidden = false;
  if (creditEntry) {
    const saved = document.createElement('p');
    saved.className = 'receipt-credit';
    saved.append(`On khata for ${creditEntry.customer}. `);
    const link = document.createElement('a');
    link.href = 'dashboard.html#khata';
    link.textContent = 'Open khata';
    saved.append(link);
    box.appendChild(saved);
  } else if (!recordSession(shop.id, { ...summary, id: sessionRecordId, turns: session.transcript })) {
    $('billNotice').textContent = 'This browser could not save the receipt to the dashboard.';
  }
  renderBill();
  setStateUI('ended');
}

// Typed fallback — drives the SAME session machine. If no session is live
// yet, one starts in silent (text-only) mode.
function handleTyped(text) {
  const clean = String(text || '').trim();
  if (!clean || state.savingCredit || !$('creditForm').hidden) return;
  const previousText = state.voiceDraft ? textBeforeVoiceDraft : '';
  if (state.voiceDraft) dismissVoiceDraft();
  $('billNotice').textContent = '';
  if (!session || !session.active) {
    startVoiceSession('silent').then((s) => s.receive(clean));
  } else {
    session.receive(clean);
  }
  $('textInput').value = previousText;
  $('textInput').focus();
}

async function runDemo(lang, fast = false) {
  if (state.demoRunning || session?.active) return;
  state.demoRunning = true;
  $('demoBtn').disabled = true;
  const s = await startVoiceSession('demo');
  await runDemoTurns(s, DEMOS[lang], { delay: fast ? 150 : 1100 });
  // Let the final reply (the bill) finish speaking, then end the session
  // so the summary appears and the session lands in the dashboard history.
  // The bill reply is the longest one the demo speaks (~2.6 s in demo IO),
  // so the wait has to clear that, not just the inter-turn pause.
  await new Promise((r) => setTimeout(r, fast ? 3400 : 3600));
  if (session === s) await endSession();
  state.demoRunning = false;
  $('demoBtn').disabled = false;
}

function showVoiceDraft(text) {
  state.voiceDraft = true;
  textBeforeVoiceDraft = $('textInput').value;
  $('voiceDraft').hidden = false;
  setStateUI(session.state);
  $('textInput').value = text;
  $('textInput').focus();
}

function clearVoiceDraft() {
  if (state.voiceDraft) $('textInput').value = textBeforeVoiceDraft;
  textBeforeVoiceDraft = '';
  state.voiceDraft = false;
  $('voiceDraft').hidden = true;
}

function dismissVoiceDraft() {
  clearVoiceDraft();
  if ($('creditForm').hidden) session?.resumeVoice();
  if (session) setStateUI(session.state);
}

function closeCreditForm() {
  $('creditForm').hidden = true;
  $('khataBtn').setAttribute('aria-expanded', 'false');
  if (!state.voiceDraft) session?.resumeVoice();
  if (session) setStateUI(session.state);
}

$('discardDraft').addEventListener('click', () => {
  dismissVoiceDraft();
  $('textInput').focus();
});
$('khataBtn').addEventListener('click', () => {
  if (!session?.canFinish) return;
  $('qrCard').hidden = true;
  $('creditForm').hidden = false;
  $('khataBtn').setAttribute('aria-expanded', 'true');
  $('creditCustomers').replaceChildren(...getKhataAccounts(shop.id).map(({ customer }) => new Option(customer)));
  session.pauseVoice();
  setStateUI(session.state);
  $('creditName').focus();
});
$('cancelCredit').addEventListener('click', () => {
  closeCreditForm();
  $('khataBtn').focus();
});
$('creditForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.savingCredit || !session?.canFinish) return;
  state.savingCredit = true;
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  $('cancelCredit').disabled = true;
  setStateUI(session.state);
  try {
    const summary = session.summary();
    const bill = makeSessionRecord(shop.id, {
      ...summary, id: sessionRecordId, endedAt: new Date().toISOString(), turns: session.transcript,
    });
    creditEntry = await postKhataBill(shop.id, $('creditName').value, bill);
    $('creditForm').reset();
    clearVoiceDraft();
    await session.end();
    $('summaryCard').focus();
    $('billNotice').textContent = `Saved to khata for ${creditEntry.customer}.`;
  } catch (error) {
    $('billNotice').textContent = error.message;
  } finally {
    state.savingCredit = false;
    if (submit) submit.disabled = false;
    $('cancelCredit').disabled = false;
    if (creditEntry) closeCreditForm();
    setStateUI(session.state);
  }
});

async function editQuantity(id, quantity, { add = false } = {}) {
  if (state.savingCredit || !$('creditForm').hidden) return;
  if (session?.active && !session.canFinish) {
    $('billNotice').textContent = 'Wait for the current order to finish before changing the bill.';
    return;
  }
  if (!session?.active) await startVoiceSession('silent');
  const current = agent.lines.find(({ item }) => item.id === id)?.qty || 0;
  const item = agent.byId.get(id);
  try {
    agent.setQuantity(id, add ? round2(current + Math.min(1, item.stock)) : quantity);
    $('billNotice').textContent = `${item.names.en} ${Number(quantity) === 0 && !add ? 'removed from' : 'updated on'} the bill.`;
    session.interrupt();
    renderBill();
    renderShelf();
  } catch (error) {
    $('billNotice').textContent = error.message;
  }
}

$('shelfGrid').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-add]');
  if (button) editQuantity(button.dataset.add, null, { add: true });
});
$('billLines').addEventListener('submit', (event) => {
  event.preventDefault();
  editQuantity(event.target.dataset.item, event.target.elements.quantity.value);
});
$('billLines').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-remove]');
  if (button) editQuantity(button.dataset.remove, 0);
});

// ---------- boot ----------

$('langSwitch').addEventListener('click', (event) => {
  const lang = event.target.closest('button')?.dataset.lang;
  if (!Object.hasOwn(UI, lang)) return;
  state.lang = lang;
  if (session) {
    session.lang = lang;
    if (session.active && sessionKind === 'voice') session.changeIO(buildIO('voice'));
  }
  renderLangUI();
});

$('shopTitle').textContent = settings.shopName;
$('shopSub').textContent = `${shop.city}, ${shop.state}`;
$('qrVpa').textContent = settings.vpa;
$('engineBadge').textContent = activeEngine === 'sarvam'
  ? 'Sarvam voice'
  : activeEngine === 'webspeech'
    ? 'Browser voice'
    : 'Text only';

renderLangUI();
$('shelfSearch').addEventListener('input', renderShelf);
$('shelfSearchForm').addEventListener('submit', (event) => event.preventDefault());
renderSignals();
setStateUI('idle');

$('startBtn').insertAdjacentHTML('afterbegin', icon('mic'));
$('startBtn').addEventListener('click', () => {
  if (sessionKind === 'silent' && session?.active) {
    sessionKind = 'voice';
    session.changeIO(buildIO('voice'));
    setStateUI(session.state);
  } else startVoiceSession('voice');
});
$('endBtn').addEventListener('click', endSession);
$('interruptBtn').addEventListener('click', () => { if (session) session.interrupt(); });
$('demoBtn').addEventListener('click', () => runDemo(state.lang, false));
$('newSessionBtn').addEventListener('click', () => { startVoiceSession('silent'); $('textInput').focus(); });
$('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  handleTyped($('textInput').value);
});
$('payBtn').addEventListener('click', () => {
  if (!$('creditForm').hidden || state.savingCredit) return;
  if (session && session.active) session.receive('pay');
  else {
    const r = agent.process('pay', state.lang);
    addBubble('agent', r.reply, r.lang);
    if (r.showQR && r.upiLink) showQR(r.upiLink);
    renderBill();
  }
});

// ?demo=ta|te|hi|kn|en — auto-run a scripted order through the live session
// (&fast=1 shortens the pauses, for screenshots).
const params = new URLSearchParams(window.location.search);
const demoLang = params.get('demo');
if (Object.hasOwn(DEMOS, demoLang)) {
  state.lang = demoLang;
  renderLangUI();
  setTimeout(() => runDemo(demoLang, params.get('fast') === '1'), 700);
}
