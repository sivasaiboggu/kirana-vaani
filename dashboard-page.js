// KiranaVaani — owner dashboard page.
// Today's orders, revenue, top sellers, low-stock alerts, restock signals
// and the voice-session history for the current shop (switch shops in the
// top bar). Demo data is seeded on first open; every real voice session you
// finish on the live counter is recorded here too.

import { LANGUAGES, nameIn } from './src/catalog.js';
import { formatINR } from './src/billing.js';
import { getShop, shopCatalog } from './src/shops.js';
import { getCurrentShopId, getSettings, getSessions } from './src/store.js';
import { summarizeSessions } from './src/dashboard.js';
import { loadSarvamKey, resolveVoiceEngine } from './src/sarvam.js';
import { webSpeechSupported } from './src/voice.js';
import { initShell, demoLink, runLayoutCheck } from './src/shell.js';

const $ = (id) => document.getElementById(id);

const { shop } = initShell({ active: 'dashboard' });
const settings = getSettings(shop);
runLayoutCheck();

// Engine badge: same automatic resolution as the live counter.
const engine = resolveVoiceEngine({ apiKey: loadSarvamKey(), webSpeechSupported: webSpeechSupported() });
$('engineBadge').textContent = engine === 'sarvam'
  ? '● Sarvam AI voice'
  : engine === 'webspeech'
    ? '● Web Speech voice'
    : '● Text only';
const items = shopCatalog(shop);
const sessions = getSessions(shop.id);
const summary = summarizeSessions(sessions, items);

$('shopTitle').textContent = `${settings.shopName} — Dashboard`;
$('shopSub').textContent = `${shop.city}, ${shop.state} · ${shop.tagline}`;
$('counterLink').href = 'counter.html';
$('counterDemoLink').href = demoLink(settings.defaultLang || shop.lang);

// ?demo=… on the dashboard: the demo lives on the counter — point at it.
const params = new URLSearchParams(window.location.search);
const demoLang = params.get('demo');
if (demoLang && LANGUAGES[demoLang]) {
  const banner = $('demoBanner');
  banner.hidden = false;
  $('demoBannerLink').href = demoLink(demoLang);
  $('demoBannerText').textContent = `Demo order available in ${LANGUAGES[demoLang].english} — watch it run on the live voice counter.`;
}

// ---------- stats ----------
// Count-up animation (Magic UI number-ticker, plain JS): values tick up
// from 0 so the dashboard feels alive. Skipped under reduced motion.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, target, format) {
  if (reduceMotion) { el.textContent = format(target); return; }
  const start = performance.now();
  const dur = 650;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(target * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = format(target);
  };
  requestAnimationFrame(step);
}
function stat(id, value) { $(id).textContent = value; }
countUp($('statOrders'), summary.orders, (v) => String(Math.round(v)));
countUp($('statRevenue'), summary.revenue, (v) => formatINR(v));
countUp($('statAvgBill'), summary.avgBill, (v) => formatINR(v));
countUp($('statSessions'), summary.sessions, (v) => String(Math.round(v)));

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
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = `${Math.max(6, Math.round((t.qty / max) * 100))}%`;
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
if (summary.lowStock.length === 0) {
  lowBox.innerHTML = '<li class="muted empty-note">Everything is well stocked.</li>';
} else {
  for (const it of summary.lowStock) {
    const li = document.createElement('li');
    li.className = it.out ? 'alert-out' : 'alert-low';
    const main = document.createElement('span');
    main.textContent = `${it.name} — ${it.out ? 'out of stock' : `only ${it.stock} ${it.unit} left`}`;
    const tag = document.createElement('span');
    tag.className = 'when';
    tag.textContent = it.out ? 'Restock now' : 'Running low';
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
  const head = document.createElement('tr');
  for (const h of ['Time', 'Language', 'Items', 'Total', 'Transcript']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  table.appendChild(head);
  for (const s of sessions) {
    const tr = document.createElement('tr');
    const time = document.createElement('td');
    time.textContent = new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      line.innerHTML = '';
      const who = document.createElement('strong');
      who.textContent = t.who === 'user' ? 'Customer: ' : 'Agent: ';
      line.append(who, document.createTextNode(t.text));
      list.appendChild(line);
    }
    details.appendChild(list);
    trans.appendChild(details);
    tr.append(time, lang, itemsCell, total, trans);
    table.appendChild(tr);
  }
  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  scroller.appendChild(table);
  histBox.appendChild(scroller);
}
