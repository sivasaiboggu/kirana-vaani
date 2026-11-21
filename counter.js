// KiranaVaani — Live voice counter.
// The call-like voice session: start a session, talk, the agent listens,
// thinks, speaks, then listens again — no mic tap per turn. Barge-in works
// two ways: speak over the agent (echo-guarded), or hit Interrupt.
// Voice engine is automatic: Sarvam AI (Saaras -> sarvam-105b -> Bulbul)
// when a key is configured, otherwise the free Web Speech API. Typing always
// works and drives the same session machine. ?demo=ta|te|hi|kn|en runs a
// scripted order through the session (add &fast=1 for screenshots).

import { KiranaAgent } from './src/agent.js';
import { ITEMS, LANGUAGES, nameIn } from './src/catalog.js';
import { formatINR } from './src/billing.js';
import { detectLanguage } from './src/intent.js';
import { normalizeText } from './src/intent.js';
import { VoiceSession, createDemoIO, createSilentIO, runDemoTurns, STATE_LABELS } from './src/session.js';
import { getShop, shopCatalog } from './src/shops.js';
import { getCurrentShopId, getSettings, recordSession } from './src/store.js';
import { initShell, demoLink, runLayoutCheck } from './src/shell.js';
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
    voiceReady: '🎙 குரல் தயார் — தமிழில் பேசுங்கள்',
  },
  te: {
    chatTitle: 'దుకాణంతో మాట్లాడండి',
    placeholder: 'మీ ఆర్డర్ టైప్ చేయండి… ఉదా. ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు',
    chips: ['ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు', 'బాస్మతి బియ్యం 2 కిలోలు', 'బిల్లు'],
    greetWord: 'నమస్కారం',
    voiceReady: '🎙 వాయిస్ సిద్ధం — తెలుగులో మాట్లాడండి',
  },
  hi: {
    chatTitle: 'दुकान से बात कीजिए',
    placeholder: 'अपना ऑर्डर लिखिए… जैसे आशीर्वाद आटा 5 किलो',
    chips: ['आशीर्वाद आटा 5 किलो', 'बासमती चावल 2 किलो', 'बिल'],
    greetWord: 'नमस्ते',
    voiceReady: '🎙 आवाज़ तैयार है — हिन्दी में बोलिए',
  },
  kn: {
    chatTitle: 'ಅಂಗಡಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ',
    placeholder: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಟೈಪ್ ಮಾಡಿ… ಉದಾ. ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ',
    chips: ['ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ', 'ಬಾಸ್ಮತಿ ಅಕ್ಕಿ 2 ಕಿಲೋ', 'ಬಿಲ್'],
    greetWord: 'ನಮಸ್ಕಾರ',
    voiceReady: '🎙 ಧ್ವನಿ ಸಿದ್ಧ — ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
  },
  en: {
    chatTitle: 'Talk to the shop',
    placeholder: 'Type your order… e.g. Aashirvaad atta 5 kg',
    chips: ['Aashirvaad atta 5 kg', 'Basmati rice 2 kg', 'bill'],
    greetWord: 'hello',
    voiceReady: '🎙 Voice ready — speak in English',
  },
  ml: {
    chatTitle: 'കടയോട് സംസാരിക്കൂ',
    placeholder: 'ഓർഡർ ടൈപ്പ് ചെയ്യൂ… ഉദാ. ആശിർവാദ് ആട്ട 5 കിലോ',
    chips: ['ആശിർവാദ് ആട്ട 5 കിലോ', 'ബസ്മതി അരി 2 കിലോ', 'ബിൽ'],
    greetWord: 'നമസ്കാരം',
    voiceReady: '🎙 ശബ്ദം തയ്യാർ — മലയാളത്തിൽ സംസാരിക്കൂ',
  },
  mr: {
    chatTitle: 'दुकानाशी बोला',
    placeholder: 'तुमची ऑर्डर टाइप करा… उदा. आशीर्वाद आटा 5 किलो',
    chips: ['आशीर्वाद आटा 5 किलो', 'बासमती तांदूळ 2 किलो', 'बिल'],
    greetWord: 'नमस्कार',
    voiceReady: '🎙 आवाज तयार — मराठीत बोला',
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

const state = { lang: settings.defaultLang || shop.lang || 'ta', demoRunning: false };
let session = null;
let timerId = null;
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
    return 'Voice engine: Sarvam AI — Saaras STT · sarvam-105b · Bulbul TTS (key configured).';
  }
  if (activeEngine === 'webspeech') {
    return 'Voice engine: Web Speech API (free fallback). Add a Sarvam key in Settings for the premium Sarvam voice — Saaras, sarvam-105b and Bulbul.';
  }
  return 'Voice is not supported in this browser — type your order instead. (Chrome / Edge work best.)';
}

// One responder for the session: Sarvam when configured (with its own local
// fallback), otherwise the local rules engine directly.
async function respond(text, lang) {
  if (conversation) {
    const detected = detectLanguage(text, lang);
    conversation.lang = detected;
    const r = await conversation.reply(text);
    return { ...r, lang: r.lang || detected };
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
  div.appendChild(document.createTextNode(text));
  if (note) {
    const n = document.createElement('span');
    n.className = 'bubble-note';
    n.textContent = note;
    div.appendChild(n);
  }
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
  box.innerHTML = '';
  if (lines.length === 0) {
    box.innerHTML = '<p class="muted empty-note">Nothing yet — order something and it appears here.</p>';
  } else {
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'bill-row';
      const name = document.createElement('span');
      name.textContent = nameIn(line.item, state.lang);
      const qty = document.createElement('span');
      qty.className = 'qty';
      qty.textContent = `${line.qty} ${line.item.unit} × ${formatINR(line.item.price)}`;
      const amt = document.createElement('span');
      amt.className = 'amt';
      amt.textContent = formatINR(line.total);
      row.append(name, qty, amt);
      box.appendChild(row);
    }
  }
  $('billTotal').textContent = formatINR(agent.total);
  $('billCount').textContent = `${lines.length} item${lines.length === 1 ? '' : 's'}`;
  $('payBtn').disabled = agent.total <= 0;
}

function renderSignals() {
  const list = $('signalList');
  list.innerHTML = '';
  $('signalCount').textContent = String(agent.signals.length);
  if (agent.signals.length === 0) {
    list.innerHTML = '<li class="muted empty-note">Out-of-stock requests land here so the shop knows what to reorder.</li>';
    return;
  }
  for (const s of agent.signals.slice().reverse()) {
    const li = document.createElement('li');
    const when = new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = '';
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
  const grid = $('shelfGrid');
  grid.innerHTML = '';
  $('shelfCount').textContent = `${items.length} items`;
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'shelf-item';
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = nameIn(item, state.lang);
    const pr = document.createElement('span');
    pr.className = 'pr';
    pr.textContent = `${formatINR(item.price)} / ${item.unit}`;
    const badge = document.createElement('span');
    badge.className = `stock-badge ${item.stock === 0 ? 'out' : item.stock <= 8 ? 'low' : 'in'}`;
    badge.textContent = item.stock === 0 ? 'Out of stock' : item.stock <= 8 ? `Only ${item.stock} left` : `In stock · ${item.stock}`;
    div.append(nm, document.createElement('br'), pr, document.createElement('br'), badge);
    grid.appendChild(div);
  }
}

function showQR(upiLink) {
  if (!upiLink) { $('qrCard').hidden = true; return; }
  $('qrCard').hidden = false;
  $('upiLinkText').textContent = upiLink;
  if (typeof window.qrcode === 'function') {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(upiLink);
      qr.make();
      $('qrImg').src = qr.createDataURL(6, 8);
    } catch (e) {
      $('qrImg').alt = 'QR generation failed — use the UPI link below';
    }
  }
}

function renderLangUI() {
  const ui = UI[state.lang];
  $('chatTitle').textContent = ui.chatTitle;
  $('textInput').placeholder = ui.placeholder;
  const chips = $('chips');
  chips.innerHTML = '';
  for (const c of ui.chips) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = c;
    b.addEventListener('click', () => { $('textInput').value = c; handleTyped(c); });
    chips.appendChild(b);
  }
  document.querySelectorAll('.lang-pill').forEach((p) => {
    p.classList.toggle('active', p.dataset.lang === state.lang);
  });
  $('voiceStatus').textContent = session && session.active
    ? $('voiceStatus').textContent
    : engineNote();
  renderShelf();
}

function setStateUI(next) {
  $('stateBadge').textContent = STATE_LABELS[next] || next;
  $('stateBadge').className = `state-badge state-${next}`;
  $('callCard').dataset.state = next;
  $('waveBox').dataset.state = next;
  $('startBtn').disabled = !!session && session.active;
  $('endBtn').disabled = !session || !session.active;
  $('interruptBtn').disabled = !session || session.state !== 'speaking';
  if (next === 'listening') $('voiceStatus').textContent = '🎙 Listening… speak now.';
  if (next === 'thinking') $('voiceStatus').textContent = 'Thinking…';
  if (next === 'speaking') $('voiceStatus').textContent = 'Speaking… (speak over me to interrupt, or hit Interrupt)';
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
  return (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b));
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
    if (ev.result && ev.result.showQR && ev.result.upiLink) showQR(ev.result.upiLink);
    else if (agent.total <= 0) $('qrCard').hidden = true;
  }
  if (ev.type === 'barge-in') addSystemNote('— interrupted, listening again —');
  if (ev.type === 'listen-error') {
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
  });
  session = s;
  return s;
}

async function startVoiceSession(kind = 'voice') {
  if (session && session.active) return session;
  $('summaryCard').hidden = true;
  const s = newSession(kind);
  await s.start();
  startTimer();
  setStateUI('listening');
  // Greet through the session itself, so the first turn is a real turn.
  s.receive(UI[state.lang].greetWord);
  return s;
}

async function endSession() {
  if (!session || !session.active) return;
  stopTimer();
  await session.end();
}

function showSummary(summary) {
  stopTimer();
  const receipt = buildReceipt(summary, { shopName: settings.shopName, lang: summary.lang });
  const box = $('summaryBody');
  box.innerHTML = '';
  $('summaryCard').querySelector('h2').textContent = receipt.title;

  const head = document.createElement('div');
  head.className = 'receipt-head';
  const shop = document.createElement('strong');
  shop.textContent = receipt.shopName;
  const when = document.createElement('span');
  when.className = 'muted small';
  when.textContent = `${receipt.date} · ${receipt.time}`;
  head.append(shop, document.createElement('br'), when);
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
    sig.textContent = `Restock note: ${receipt.signals.join(', ')} was asked for but out of stock.`;
    box.appendChild(sig);
  }
  const thanks = document.createElement('p');
  thanks.className = 'receipt-thanks';
  thanks.textContent = receipt.thanks;
  box.appendChild(thanks);

  $('summaryCard').hidden = false;
  // Save to the shop's session history for the dashboard.
  recordSession(shop.id, {
    ...summary,
    turns: session ? session.transcript : [],
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
  });
  setStateUI('ended');
}

// Typed fallback — drives the SAME session machine. If no session is live
// yet, one starts in silent (text-only) mode.
function handleTyped(text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  if (!session || !session.active) {
    startVoiceSession('silent').then((s) => s.receive(clean));
  } else {
    session.receive(clean);
  }
  $('textInput').value = '';
  $('textInput').focus();
}

async function runDemo(lang, fast = false) {
  if (state.demoRunning) return;
  state.demoRunning = true;
  $('demoBtn').disabled = true;
  const s = await startVoiceSession('demo');
  await runDemoTurns(s, DEMOS[lang], { delay: fast ? 150 : 1100 });
  // Let the final reply (the bill) finish speaking, then end the session
  // so the summary appears and the session lands in the dashboard history.
  await new Promise((r) => setTimeout(r, fast ? 2600 : 3200));
  await endSession();
  state.demoRunning = false;
  $('demoBtn').disabled = false;
}

// ---------- boot ----------

function buildLangSwitch() {
  const wrap = $('langSwitch');
  for (const [code, meta] of Object.entries(LANGUAGES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-pill';
    b.dataset.lang = code;
    b.textContent = `${meta.label} · ${meta.english}`;
    b.addEventListener('click', () => {
      state.lang = code;
      if (session) session.lang = code;
      renderLangUI();
    });
    wrap.appendChild(b);
  }
}

$('shopTitle').textContent = settings.shopName;
$('shopSub').textContent = `${shop.city}, ${shop.state} · ${shop.tagline}`;
$('qrVpa').textContent = settings.vpa;
runLayoutCheck();
$('engineBadge').textContent = activeEngine === 'sarvam'
  ? '● Sarvam AI voice'
  : activeEngine === 'webspeech'
    ? '● Web Speech voice'
    : '● Text only';

buildLangSwitch();
renderLangUI();
renderBill();
renderSignals();
setStateUI('idle');

$('startBtn').addEventListener('click', () => startVoiceSession('voice'));
$('endBtn').addEventListener('click', endSession);
$('interruptBtn').addEventListener('click', () => { if (session) session.interrupt(); });
$('demoBtn').addEventListener('click', () => runDemo(state.lang, false));
$('newSessionBtn').addEventListener('click', () => { $('summaryCard').hidden = true; startVoiceSession('voice'); });
$('sendBtn').addEventListener('click', () => handleTyped($('textInput').value));
$('textInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleTyped(e.target.value);
});
$('payBtn').addEventListener('click', () => {
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
if (demoLang && DEMOS[demoLang]) {
  state.lang = demoLang;
  renderLangUI();
  setTimeout(() => runDemo(demoLang, params.get('fast') === '1'), 700);
}
