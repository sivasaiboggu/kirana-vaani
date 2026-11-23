import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { KiranaAgent } from '../src/agent.js';
import { getKhataAccounts, getKhataEntries, postKhataBill, postKhataRepayment } from '../src/khata.js';
import { __clearMemoryStore, makeSessionRecord } from '../src/store.js';

const shop = 'sri-lakshmi';
const bill = (id, total) => makeSessionRecord(shop, { id, total, items: [{ itemId: 'sugar', qty: 1 }] });

beforeEach(__clearMemoryStore);

test('khata groups names across repeated bills, keeps receipt history and isolates shops', async () => {
  await postKhataBill(shop, '  Lakshmi   Rao ', bill('first', 48));
  await postKhataBill(shop, 'lakshmi rao', bill('second', 96));
  await postKhataBill(shop, 'Lakshmi Rao', bill('second', 96));
  const [account] = getKhataAccounts(shop);
  assert.equal(account.customer, 'Lakshmi Rao');
  assert.equal(account.balance, 144);
  assert.deepEqual(account.entries.map(({ bill }) => bill.id), ['second', 'first']);
  assert.deepEqual(getKhataAccounts('annapurna'), []);
});

test('khata rejects overpayment and invalid money, and retains a settled account', async () => {
  await postKhataBill(shop, 'Lakshmi', bill('first', 48));
  await assert.rejects(postKhataRepayment(shop, 'lakshmi', '4.003'), /two decimal places/);
  await assert.rejects(postKhataRepayment(shop, 'lakshmi', '49'), /outstanding/);
  await postKhataRepayment(shop, 'lakshmi', '25.30', 'cash-payment');
  await postKhataRepayment(shop, 'lakshmi', '25.30', 'cash-payment');
  assert.equal(getKhataAccounts(shop)[0].balance, 22.70);
  const concurrent = await Promise.allSettled([postKhataRepayment(shop, 'lakshmi', '22.70'), postKhataRepayment(shop, 'lakshmi', '10')]);
  assert.deepEqual(concurrent.map(({ status }) => status), ['fulfilled', 'rejected']);
  assert.equal(getKhataAccounts(shop)[0].balance, 0);
  assert.equal(getKhataEntries(shop).length, 3);
});

test('bill edits and substitute confirmations use the same remaining shelf', () => {
  const agent = new KiranaAgent();
  agent.process('2 kg basmati rice', 'en');
  const substitute = agent.pendingSuggestion.item;
  agent.setQuantity(substitute.id, substitute.stock - .5);
  const reply = agent.process('yes', 'en');
  assert.equal(substitute.stock, 0);
  assert.match(reply.reply, /0\.5/);
  assert.throws(() => agent.setQuantity(substitute.id, agent.lines[0].qty + 1), /left on the shelf/);
  agent.setQuantity(substitute.id, 0);
  assert.deepEqual(agent.lines, []);
  assert.ok(substitute.stock > 0);
});
