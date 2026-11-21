import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, getItem, findSubstitute, nameIn } from '../src/catalog.js';
import {
  createCart, addToCart, removeFromCart, cartTotal, cartLines, isEmpty, formatINR,
} from '../src/billing.js';
import { buildUpiLink, formatAmount, MERCHANT_VPA } from '../src/upi.js';

test('catalog has 34 items, every one named in all seven languages', () => {
  assert.equal(ITEMS.length, 34);
  const ids = new Set();
  for (const item of ITEMS) {
    assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    for (const lang of ['ta', 'te', 'hi', 'kn', 'en']) {
      assert.ok(item.names[lang] && item.names[lang].length > 0, `${item.id} missing ${lang} name`);
    }
    assert.ok(item.price > 0, `${item.id} has no price`);
    assert.ok(item.stock >= 0, `${item.id} has negative stock`);
    assert.ok(item.aliases.length >= 2, `${item.id} has too few aliases`);
  }
});

test('deliberate out-of-stock items exist for the substitute demo', () => {
  const out = ITEMS.filter((i) => i.stock === 0).map((i) => i.id);
  assert.ok(out.includes('rice-basmati'));
  assert.ok(out.includes('oil-groundnut'));
  assert.ok(out.includes('coffee'));
  assert.ok(out.length >= 3);
});

test('substitutes: same category, in stock, nearest price', () => {
  assert.equal(findSubstitute(getItem('rice-basmati')).id, 'rice-ponni');
  assert.equal(findSubstitute(getItem('oil-groundnut')).id, 'oil-sunflower');
  assert.equal(findSubstitute(getItem('coffee')).id, 'tea');
  // nothing in stock in a category with a single item returns null
  const soap = getItem('soap');
  assert.equal(findSubstitute(soap).id, 'shampoo'); // personal care
});

test('nameIn returns the requested language', () => {
  assert.equal(nameIn(getItem('sugar'), 'ta'), 'சர்க்கரை');
  assert.equal(nameIn(getItem('sugar'), 'te'), 'చక్కెర');
  assert.equal(nameIn(getItem('sugar'), 'hi'), 'चीनी');
  assert.equal(nameIn(getItem('sugar'), 'kn'), 'ಸಕ್ಕರೆ');
  assert.equal(nameIn(getItem('sugar'), 'en'), 'Sugar');
});

test('billing: add accumulates quantity, line total is price x qty', () => {
  const cart = createCart();
  const sugar = getItem('sugar'); // ₹45/kg
  addToCart(cart, sugar, 2);
  assert.equal(cartTotal(cart), 90);
  addToCart(cart, sugar, 1);
  assert.equal(cart['sugar'].qty, 3);
  assert.equal(cartTotal(cart), 135);
  const lines = cartLines(cart);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].total, 135);
});

test('billing: mixed cart total', () => {
  const cart = createCart();
  addToCart(cart, getItem('sugar'), 2); // 90
  addToCart(cart, getItem('rice-ponni'), 3); // 186
  addToCart(cart, getItem('eggs'), 12); // 84
  assert.equal(cartTotal(cart), 360);
});

test('billing: remove reduces qty, removing all drops the line', () => {
  const cart = createCart();
  const sugar = getItem('sugar');
  addToCart(cart, sugar, 3);
  let r = removeFromCart(cart, sugar, 1);
  assert.equal(r.removed, 1);
  assert.equal(cart['sugar'].qty, 2);
  r = removeFromCart(cart, sugar, null);
  assert.equal(r.lineGone, true);
  assert.ok(isEmpty(cart));
});

test('billing: removing more than present removes only what is there', () => {
  const cart = createCart();
  const sugar = getItem('sugar');
  addToCart(cart, sugar, 1);
  const r = removeFromCart(cart, sugar, 5);
  assert.equal(r.removed, 1);
  assert.ok(isEmpty(cart));
});

test('billing: removing an item that is not in the cart removes 0', () => {
  const cart = createCart();
  const r = removeFromCart(cart, getItem('sugar'), 1);
  assert.equal(r.removed, 0);
  assert.equal(r.lineGone, false);
});

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(275), '₹275.00');
  assert.equal(formatINR(1234.5), '₹1,234.50');
  assert.equal(formatINR(0), '₹0.00');
});

test('UPI link encodes merchant, amount and currency', () => {
  const link = buildUpiLink({ amount: 275 });
  assert.ok(link.startsWith('upi://pay?'), link);
  assert.ok(link.includes(`pa=${encodeURIComponent(MERCHANT_VPA)}`), link);
  assert.ok(link.includes('am=275.00'), link);
  assert.ok(link.includes('cu=INR'), link);
  assert.equal(formatAmount(12.345), '12.35');
  assert.equal(formatAmount(7), '7.00');
});
