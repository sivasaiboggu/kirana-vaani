import { listShops, getShop } from './shops.js';
import { getCurrentShopId, setCurrentShopId, getSettings } from './store.js';

import { icon } from './icons.js';
import { initTheme } from './theme.js';

const NAV_LINKS = [
  { href: 'index.html', label: 'Home', key: 'home' },
  { href: 'counter.html', label: 'Voice counter', key: 'counter' },
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
  brand.innerHTML = `<span class="shell-mark" aria-hidden="true">${icon('brand')}</span><strong>KiranaVaani</strong>`;
  brand.setAttribute('aria-label', 'KiranaVaani home');

  const links = el('nav', 'shell-links');
  links.setAttribute('aria-label', 'Main navigation');
  for (const l of NAV_LINKS) {
    const a = el('a', `shell-link${l.key === active ? ' active' : ''}`, l.label);
    a.href = l.href;
    if (l.key === active) a.setAttribute('aria-current', 'page');
    links.appendChild(a);
  }

  const right = el('div', 'shell-right');
  const switcher = el('label', 'shop-switcher');
  switcher.appendChild(el('span', 'shop-switcher-label', 'Shop'));
  const select = document.createElement('select');
  select.id = 'shopSelect';
  select.setAttribute('aria-label', 'Switch shop');
  for (const s of listShops()) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = getSettings(s).shopName;
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
  const theme = el('button', 'theme-button');
  theme.type = 'button';
  initTheme(theme);
  right.append(switcher, badge, theme);

  bar.append(brand, links, right);
  host.replaceChildren(bar);
  if (import.meta.env?.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register(new URL('sw.js', document.baseURI))
        .catch(() => { /* online use remains available */ });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 2000 });
    else window.addEventListener('load', register, { once: true });
  }
  return { shop };
}

// Demo links route every page's demo to the live counter, same language.
export function demoLink(lang) {
  return `counter.html?demo=${lang}`;
}
