// Multi-shop catalogues, session store and dashboard maths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/catalog.js';
import { SHOPS, getShop, listShops, shopCatalog } from '../src/shops.js';
import {
  buildSeedSessions, getSessions, recordSession, getSettings, saveSettings,
  getCurrentShopId, setCurrentShopId, __clearMemoryStore,
} from '../src/store.js';
import { summarizeSessions, topSellers, lowStockItems, todaysSessions } from '../src/dashboard.js';

test('three demo shops, each with its own language and VPA', () => {
  assert.equal(listShops().length, 3);
  assert.deepEqual(listShops().map((s) => s.id), ['sri-lakshmi', 'annapurna', 'sharma-general']);
  assert.equal(getShop('annapurna').lang, 'te');
  assert.equal(getShop('annapurna').city, 'Hyderabad');
  assert.equal(getShop('nope').id, 'sri-lakshmi'); // unknown id falls back to first shop
});

test('shop catalogues: overrides apply, demo flow stays intact in every shop', () => {
  for (const shop of SHOPS) {
    const items = shopCatalog(shop);
    assert.equal(items.length, 34);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    // The demo flow (atta -> basmati out -> ponni substitute -> sugar -> bill)
    // must work in every shop:
    assert.ok(byId['atta-aashirvaad'].stock > 0, `${shop.id}: atta in stock`);
    assert.equal(byId['rice-basmati'].stock, 0, `${shop.id}: basmati out of stock`);
    assert.ok(byId['rice-ponni'].stock > 0, `${shop.id}: ponni in stock (substitute)`);
    assert.ok(byId['sugar'].stock > 0, `${shop.id}: sugar in stock`);
    assert.equal(byId['oil-groundnut'].stock, 0, `${shop.id}: groundnut out`);
    assert.equal(byId['coffee'].stock, 0, `${shop.id}: coffee out`);
  }
  // Overrides differ per shop:
  assert.equal(shopCatalog(getShop('sri-lakshmi')).find((i) => i.id === 'sugar').price, 48);
  assert.equal(shopCatalog(getShop('annapurna')).find((i) => i.id === 'rice-ponni').stock, 4);
  assert.equal(shopCatalog(getShop('sharma-general')).find((i) => i.id === 'atta-aashirvaad').price, 58);
  // Base catalogue untouched by overrides:
  assert.equal(ITEMS.find((i) => i.id === 'sugar').price, 45);
});

test('seed sessions: totals match their line items, every shop', () => {
  for (const shop of SHOPS) {
    const seeds = buildSeedSessions(shop.id);
    assert.equal(seeds.length, 3, `${shop.id} has 3 seed sessions`);
    for (const s of seeds) {
      const sum = s.items.reduce((t, i) => t + i.total, 0);
      assert.equal(s.total, sum, `${s.id} total matches lines`);
      for (const it of s.items) {
        assert.equal(it.total, it.qty * it.price, `${s.id} ${it.itemId} line total`);
      }
      assert.ok(s.turns.length >= 2);
      assert.ok(new Date(s.startedAt).toDateString() === new Date().toDateString(), 'seed is dated today');
    }
  }
});

test('store: settings round-trip per shop, current shop switching', () => {
  __clearMemoryStore();
  assert.equal(getCurrentShopId(), 'sri-lakshmi');
  assert.equal(setCurrentShopId('annapurna'), true);
  assert.equal(getCurrentShopId(), 'annapurna');
  assert.equal(setCurrentShopId('nope'), false);
  assert.equal(getCurrentShopId(), 'annapurna');

  const shop = getShop('annapurna');
  const defaults = getSettings(shop);
  assert.equal(defaults.vpa, 'annapurna@okhdfcbank');
  assert.equal(defaults.defaultLang, 'te');
  assert.equal(defaults.voiceSpeed, 1.0);
  const saved = saveSettings('annapurna', { shopName: 'Annapurna Super Bazaar', voiceSpeed: 1.2 });
  assert.equal(saved.shopName, 'Annapurna Super Bazaar');
  assert.equal(saved.voiceSpeed, 1.2);
  assert.equal(saved.vpa, 'annapurna@okhdfcbank'); // untouched fields survive
  assert.equal(getSettings(shop).shopName, 'Annapurna Super Bazaar');
});

test('store: sessions seed on first read, recordSession prepends', () => {
  __clearMemoryStore();
  const first = getSessions('sharma-general');
  assert.equal(first.length, 3);
  const rec = recordSession('sharma-general', {
    lang: 'kn', total: 100,
    items: [{ itemId: 'sugar', name: 'Sugar', qty: 1, unit: 'kg', price: 45, total: 45 }],
    turns: [{ who: 'user', text: 'sugar 1 kg', lang: 'kn' }],
    signals: [],
  });
  assert.ok(rec.id.startsWith('session-'));
  const after = getSessions('sharma-general');
  assert.equal(after.length, 4);
  assert.equal(after[0].id, rec.id);
});

test('dashboard: summary maths over seed sessions', () => {
  const shop = getShop('sri-lakshmi');
  const items = shopCatalog(shop);
  const sessions = buildSeedSessions('sri-lakshmi');
  const s = summarizeSessions(sessions, items);
  assert.equal(s.orders, 3);
  assert.equal(s.revenue, 499 + 588 + 260);
  assert.equal(s.avgBill, Math.round(((499 + 588 + 260) / 3) * 100) / 100);
  assert.equal(s.sessions, 3);
  assert.equal(s.signals.length, 1); // basmati, session 2
  assert.equal(s.signals[0].name, 'Basmati Rice');
  // Top seller by quantity: eggs 12, atta 5 kg, ponni 4 kg.
  assert.equal(s.topSellers[0].itemId, 'eggs');
  assert.equal(s.topSellers[0].qty, 12);
  assert.equal(s.topSellers[1].itemId, 'atta-aashirvaad');
  assert.equal(s.topSellers[1].qty, 5);
  assert.equal(s.topSellers[2].itemId, 'rice-ponni');
  assert.equal(s.topSellers[2].qty, 4);
  // Low stock: ghee (3), cumin (2) and the three out-of-stock items.
  const low = s.lowStock.map((i) => i.id);
  assert.ok(low.includes('rice-basmati'));
  assert.ok(low.includes('ghee'));
  assert.ok(low.includes('cumin'));
  assert.equal(s.byLanguage.ta, 3);
});

test('dashboard: topSellers and lowStockItems are pure and sorted', () => {
  const sessions = [
    { items: [{ itemId: 'sugar', name: 'Sugar', qty: 3, total: 135 }, { itemId: 'milk', name: 'Milk', qty: 1, total: 58 }] },
    { items: [{ itemId: 'sugar', name: 'Sugar', qty: 2, total: 90 }] },
  ];
  const top = topSellers(sessions, 5);
  assert.equal(top[0].itemId, 'sugar');
  assert.equal(top[0].qty, 5);
  assert.equal(top[0].revenue, 225);
  assert.equal(top[1].itemId, 'milk');

  const low = lowStockItems(ITEMS, 8);
  assert.ok(low.every((i) => i.stock <= 8));
  assert.equal(low[0].stock, 0); // out-of-stock first
  assert.ok(low.some((i) => i.out));

  // Sessions from another day do not count as today.
  const old = [{ startedAt: '2020-01-01T10:00:00.000Z', total: 999, items: [] }];
  assert.equal(todaysSessions(old).length, 0);
  assert.equal(summarizeSessions(old, ITEMS).orders, 0);
  assert.equal(summarizeSessions([], ITEMS).revenue, 0);
});
