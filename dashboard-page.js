// KiranaVaani — owner dashboard page.
// Today's orders, revenue, top sellers, low-stock alerts, restock signals
// and the voice-session history for the current shop (switch shops in the
// top bar). Demo data is seeded on first open; every real voice session you
// finish on the live counter is recorded here too.

import { LANGUAGES } from './src/catalog.js';
import { formatINR, round2 } from './src/billing.js';
import { shopCatalog } from './src/shops.js';
import { getSettings, getSessions } from './src/store.js';
import { getKhataAccounts, getKhataEntries, khataKey, postKhataRepayment } from './src/khata.js';
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
const sessions = [...getKhataEntries(shop.id).filter(({ kind }) => kind === 'bill').map(({ bill }) => bill), ...getSessions(shop.id)];
sessions.sort((a, b) => {
  const sampleOrder = Number(a.id.startsWith('seed-')) - Number(b.id.startsWith('seed-'));
  return sampleOrder || Date.parse(b.endedAt) - Date.parse(a.endedAt);
});
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
    fill.style.setProperty('--progress', t.qty / max);
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
    const date = new Date(s.endedAt || s.startedAt);
    time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() !== new Date().toDateString()) time.textContent = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + time.textContent;
    const lang = document.createElement('td');
    lang.textContent = LANGUAGES[s.lang] ? LANGUAGES[s.lang].english : s.lang;
    const itemsCell = document.createElement('td');
    itemsCell.textContent = (s.items || []).map((i) => `${i.qty} ${i.name}`).join(', ') || '—';
    const total = document.createElement('td');
    total.textContent = formatINR(s.total || 0);
    if (s.id.startsWith('seed-')) time.append(element('small', 'sample-tag', 'Sample'));
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

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const moneyDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function renderKhata(openAccount) {
  const accounts = getKhataAccounts(shop.id);
  $('khataTotal').textContent = formatINR(round2(accounts.reduce((sum, account) => sum + account.balance, 0)));
  const box = $('khataAccounts');
  const open = new Set([...box.querySelectorAll('details[open]')].map(({ dataset }) => dataset.customer));
  box.replaceChildren();
  if (!accounts.length) {
    const empty = element('p', 'muted', 'No credit bills yet. Use Add to khata on a bill at the counter.');
    const link = element('a', 'text-link', 'Go to the counter');
    link.href = 'counter.html';
    box.append(empty, link);
  }
  for (const account of accounts) {
    const details = element('details', 'khata-account');
    details.dataset.customer = account.customerId;
    details.open = open.has(account.customerId) || account.customerId === openAccount;
    const heading = element('summary');
    const balance = account.balance > 0 ? `${formatINR(account.balance)} due` : 'Settled';
    heading.append(element('strong', '', account.customer), element('span', 'khata-balance', balance));
    details.append(heading);
    const history = element('ol', 'khata-history');
    for (const { kind, at, bill, amount } of account.entries) {
      const line = element('li');
      const label = kind === 'bill' ? 'Credit bill' : 'Payment received';
      const when = element('time', 'muted small', moneyDate.format(new Date(at)));
      when.dateTime = at;
      line.append(when, element('span', '', label), element('strong', '', formatINR(bill?.total ?? amount)));
      history.append(line);
    }
    details.append(history);
    if (account.balance > 0) details.append(repaymentForm(account));
    box.append(details);
    if (account.customerId === openAccount) heading.focus({ preventScroll: true });
  }
}

function repaymentForm(account) {
  const form = element('form', 'repayment-form');
  const label = element('label', '', 'Payment received (₹)');
  const input = element('input');
  input.inputMode = 'decimal';
  input.required = true;
  label.append(input);
  const submit = element('button', 'btn primary', 'Record payment');
  const error = element('p', 'field-error small');
  error.id = `payment-error-${encodeURIComponent(account.customerId)}`;
  error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', error.id);
  form.append(label, submit, error);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    try {
      const entry = await postKhataRepayment(shop.id, account.customerId, input.value);
      $('khataStatus').textContent = `Recorded ${formatINR(entry.amount)} from ${entry.customer}.`;
      renderKhata(account.customerId);
    } catch (err) {
      input.setAttribute('aria-invalid', 'true');
      error.textContent = err.message;
      input.focus();
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

renderKhata();
window.addEventListener('storage', (event) => {
  if (event.key === khataKey(shop.id)) renderKhata();
});
