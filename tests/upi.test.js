// UPI link tests — the QR encodes this link, so the link itself is verified
// by building it and parsing it back: the merchant, the amount, the currency
// and the note must survive the round trip exactly. (The QR image is
// verified visually in the session screenshots.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpiLink, formatAmount, MERCHANT_VPA, MERCHANT_NAME } from '../src/upi.js';

function parse(link) {
  assert.ok(link.startsWith('upi://pay?'), link);
  return new URLSearchParams(new URL(link).search);
}

test('UPI link round-trips: merchant, amount, currency and note', () => {
  const params = parse(buildUpiLink({ amount: 152 }));
  assert.equal(params.get('pa'), MERCHANT_VPA);
  assert.equal(params.get('pn'), MERCHANT_NAME);
  assert.equal(params.get('am'), '152.00');
  assert.equal(params.get('cu'), 'INR');
  assert.equal(params.get('tn'), 'Kirana bill');
});

test('UPI link uses the shop\u2019s own VPA and name when given', () => {
  const params = parse(buildUpiLink({
    pa: 'srilakshmi@okhdfcbank', pn: 'Sri Lakshmi Stores', amount: 499,
  }));
  assert.equal(params.get('pa'), 'srilakshmi@okhdfcbank');
  assert.equal(params.get('pn'), 'Sri Lakshmi Stores');
  assert.equal(params.get('am'), '499.00');
});

test('formatAmount always carries two decimals', () => {
  assert.equal(formatAmount(60), '60.00');
  assert.equal(formatAmount(152.5), '152.50');
  assert.equal(formatAmount(0), '0.00');
});
