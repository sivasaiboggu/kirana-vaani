// Shared app shell for the KiranaVaani SaaS pages (counter, dashboard,
// settings): top navigation, shop switcher and engine badge. The landing
// page has its own marketing header and does not use this shell.

import { listShops, getShop } from './shops.js';
import { getCurrentShopId, setCurrentShopId } from './store.js';

const NAV_LINKS = [
  { href: 'index.html', label: 'Home', key: 'home' },
  { href: 'counter.html', label: 'Live voice counter', key: 'counter' },
  { href: 'dashboard.html', label: 'Dashboard', key: 'dashboard' },
  { href: 'settings.html', label: 'Settings', key: 'settings' },
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

// Renders the shell into #appNav. Returns { shop } for the page to use.
export function initShell({ active = '' } = {}) {
  const host = document.getElementById('appNav');
  if (!host) return { shop: getShop(getCurrentShopId()) };
  host.innerHTML = '';
  const shop = getShop(getCurrentShopId());

  const bar = el('div', 'shell-bar');
  const brand = el('a', 'shell-brand', '');
  brand.href = 'index.html';
  const mark = el('span', 'shell-mark', '');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1.5 13.5a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>';
  const brandText = el('span', 'shell-brand-text');
  brandText.append(el('strong', '', 'KiranaVaani'), el('span', 'shell-brand-sub', ` · ${shop.name}`));
  brand.append(mark, brandText);

  const links = el('nav', 'shell-links');
  for (const l of NAV_LINKS) {
    const a = el('a', `shell-link${l.key === active ? ' active' : ''}`, l.label);
    a.href = l.href;
    links.appendChild(a);
  }

  const right = el('div', 'shell-right');
  const switcher = el('label', 'shop-switcher');
  switcher.appendChild(el('span', 'shop-switcher-label', 'Shop'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Switch shop');
  for (const s of listShops()) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} — ${s.city}`;
    if (s.id === shop.id) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    if (setCurrentShopId(select.value)) window.location.reload();
  });
  switcher.appendChild(select);
  const badge = el('span', 'engine-badge', 'Voice: …');
  badge.id = 'engineBadge';
  badge.title = 'Which voice engine is active for the live counter';
  right.append(switcher, badge);

  bar.append(brand, links, right);
  host.appendChild(bar);
  return { shop };
}

// Demo links route every page's demo to the live counter, same language.
export function demoLink(lang) {
  return `counter.html?demo=${lang}`;
}

// ?layoutcheck=1 — write horizontal-overflow info into the DOM so the
// automated layout test (tests/layout.test.js) can read it from a plain
// headless dump. Elements inside a horizontally scrollable container are
// legitimate, so they are skipped. Only runs when the query param is set.
export function runLayoutCheck() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layoutcheck') !== '1') return;
  const report = () => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    const seen = new Set();
    for (const node of document.querySelectorAll('body *')) {
      const rect = node.getBoundingClientRect();
      if (rect.right <= vw + 1 || rect.width <= 0) continue;
      // Skip anything inside a container that scrolls horizontally on purpose.
      let ancestor = node.parentElement;
      let scrollable = false;
      while (ancestor) {
        const ox = getComputedStyle(ancestor).overflowX;
        if (ox === 'auto' || ox === 'scroll') { scrollable = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (scrollable) continue;
      const key = `${node.tagName}.${(node.getAttribute('class') || '').split(' ')[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offenders.push({ el: key, right: Math.round(rect.right), vw });
      if (offenders.length >= 10) break;
    }
    let host = document.getElementById('layout-check');
    if (!host) {
      host = document.createElement('div');
      host.id = 'layout-check';
      document.body.appendChild(host);
    }
    host.textContent = JSON.stringify({ vw, overflow: offenders.length > 0, offenders });
  };
  window.addEventListener('load', () => setTimeout(report, 900));
  setTimeout(report, 1600);
}
