// KiranaVaani — owner dashboard page.
// Today's orders, revenue, top sellers, low-stock alerts, restock signals
// and the voice-session history for the current shop (switch shops in the
// top bar). Demo data is seeded on first open; every real voice session you
// finish on the live counter is recorded here too.

import { LANGUAGES } from './src/catalog.js';
import { formatINR } from './src/billing.js';
import { shopCatalog } from './src/shops.js';
import { getSettings, getSessions } from './src/store.js';
import { summarizeSessions } from './src/dashboard.js';
import { loadSarvamKey, resolveVoiceEngine } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';
import { initShell, demoLink } from './src/shell.js';

const $ = (id) => document.getElementById(id);

const { shop } = initShell({ active: 'dashboard' });
const settings = getSettings(shop);

// Engine badge: same automatic resolution as the live counter.
const engine = resolveVoiceEngine({ apiKey: loadSarvamKey(), webSpeechSupported: webSpeechSupported() });
$('engineBadge').textContent = engine === 'sarvam'
  ? 'Sarvam voice'
  : engine === 'webspeech'
    ? 'Browser voice'
    : 'Text only';
const items = shopCatalog(shop);
const sessions = getSessions(shop.id);
const summary = summarizeSessions(sessions, items);

$('shopTitle').textContent = settings.shopName;
$('shopSub').textContent = `${shop.city}, ${shop.state}`;
$('counterDemoLink').href = demoLink(settings.defaultLang || shop.lang);

// ?demo=… on the dashboard: the demo lives on the counter — point at it.
const params = new URLSearchParams(window.location.search);
const demoLang = params.get('demo');
if (Object.hasOwn(LANGUAGES, demoLang)) {
  const banner = $('demoBanner');
  banner.hidden = false;
  $('demoBannerLink').href = demoLink(demoLang);
  $('demoBannerText').textContent = `A sample order is available in ${LANGUAGES[demoLang].english}.`;
}

$('statOrders').textContent = String(summary.orders);
$('statRevenue').textContent = formatINR(summary.revenue);
$('statAvgBill').textContent = formatINR(summary.avgBill);
$('statSessions').textContent = String(summary.sessions);

// Sessions by language — real data from today's sessions.
const splitBox = $('langSplit');
splitBox.innerHTML = '';
const byLang = Object.entries(summary.byLanguage || {}).sort((a, b) => b[1] - a[1]);
if (byLang.length === 0) {
  splitBox.innerHTML = '<span class="lang-chip">No voice sessions yet today</span>';
} else {
  for (const [lang, count] of byLang) {
    const chip = document.createElement('span');
    chip.className = 'lang-chip';
    const name = document.createElement('strong');
    name.textContent = LANGUAGES[lang] ? LANGUAGES[lang].english : lang;
    chip.append(name, document.createTextNode(` · ${count} session${count === 1 ? '' : 's'}`));
    splitBox.appendChild(chip);
  }
}

// ---------- top sellers ----------
const topBox = $('topSellers');
topBox.innerHTML = '';
if (summary.topSellers.length === 0) {
  topBox.innerHTML = '<p class="muted empty-note">No sales yet today.</p>';
} else {
  const max = summary.topSellers[0].qty || 1;
  for (const t of summary.topSellers) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const name = document.createElement('span');
    name.className = 'bar-name';
    name.textContent = t.name;
    const track = document.createElement('div');
    track.className = 'bar-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = `${(t.qty / max) * 100}%`;
    track.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'bar-val';
    val.textContent = `${t.qty} · ${formatINR(t.revenue)}`;
    row.append(name, track, val);
    topBox.appendChild(row);
  }
}

// ---------- low stock ----------
const lowBox = $('lowStock');
lowBox.innerHTML = '';
$('lowStockCount').textContent = `${summary.lowStock.length} items`;
if (summary.lowStock.length === 0) {
  lowBox.innerHTML = '<li class="muted empty-note">Everything is well stocked.</li>';
} else {
  for (const it of summary.lowStock) {
    const li = document.createElement('li');
    li.className = it.out ? 'alert-out' : 'alert-low';
    const main = document.createElement('span');
    main.textContent = it.name;
    const tag = document.createElement('span');
    tag.className = 'when';
    tag.textContent = it.out ? 'Out of stock' : `${it.stock} ${it.unit} left`;
    li.append(main, tag);
    lowBox.appendChild(li);
  }
}

// ---------- restock signals ----------
const sigBox = $('signalList');
sigBox.innerHTML = '';
if (summary.signals.length === 0) {
  sigBox.innerHTML = '<li class="muted empty-note">No out-of-stock requests today.</li>';
} else {
  for (const s of summary.signals) {
    const li = document.createElement('li');
    const when = new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const main = document.createElement('span');
    main.textContent = `${s.name} — asked ${s.requestedQty}, shelf had ${s.available} (${LANGUAGES[s.lang] ? LANGUAGES[s.lang].english : s.lang})`;
    const time = document.createElement('span');
    time.className = 'when';
    time.textContent = `Restock signal · ${when}`;
    li.append(main, time);
    sigBox.appendChild(li);
  }
}
$('signalCount').textContent = String(summary.signals.length);

// ---------- session history ----------
const histBox = $('sessionHistory');
histBox.innerHTML = '';
if (sessions.length === 0) {
  histBox.innerHTML = '<p class="muted empty-note">No voice sessions yet — open the live counter and take an order.</p>';
} else {
  const table = document.createElement('table');
  table.className = 'data-table';
  const head = table.createTHead().insertRow();
  for (const h of ['Time', 'Language', 'Items', 'Total', 'Transcript']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const s of sessions) {
    const tr = body.insertRow();
    const time = document.createElement('td');
    const date = new Date(s.startedAt);
    time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() !== new Date().toDateString()) time.textContent = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + time.textContent;
    const lang = document.createElement('td');
    lang.textContent = LANGUAGES[s.lang] ? LANGUAGES[s.lang].english : s.lang;
    const itemsCell = document.createElement('td');
    itemsCell.textContent = (s.items || []).map((i) => `${i.qty} ${i.name}`).join(', ') || '—';
    const total = document.createElement('td');
    total.textContent = formatINR(s.total || 0);
    const trans = document.createElement('td');
    const details = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = `${(s.turns || []).length} turns`;
    details.appendChild(sum);
    const list = document.createElement('div');
    list.className = 'mini-transcript';
    for (const t of s.turns || []) {
      const line = document.createElement('p');
      const who = document.createElement('strong');
      who.textContent = t.who === 'user' ? 'Customer: ' : 'Agent: ';
      const text = document.createElement('span');
      if (Object.hasOwn(LANGUAGES, t.lang)) text.lang = t.lang;
      text.textContent = t.text;
      line.append(who, text);
      list.appendChild(line);
    }
    details.appendChild(list);
    trans.appendChild(details);
    tr.append(time, lang, itemsCell, total, trans);
  }
  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-labelledby', 'historyTitle');
  scroller.appendChild(table);
  histBox.appendChild(scroller);
}
