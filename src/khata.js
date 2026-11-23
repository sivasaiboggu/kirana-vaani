import { round2 } from './billing.js';
import { storeGet, storeSet } from './store.js';

export const khataKey = (shopId) => `kirana.khata.${shopId}`;

export function getKhataEntries(shopId) {
  const entries = storeGet(khataKey(shopId), []);
  return Array.isArray(entries) ? entries : [];
}

export function getKhataAccounts(shopId) {
  const accounts = new Map();
  for (const entry of getKhataEntries(shopId)) {
    const { customer, customerId } = entry;
    const account = accounts.get(customerId) || { customer, customerId, balance: 0, entries: [] };
    const delta = entry.kind === 'bill' ? entry.bill.total : -entry.amount;
    account.balance = round2(account.balance + delta);
    account.entries.unshift(entry);
    accounts.set(customerId, account);
  }
  return [...accounts.values()].sort((a, b) => b.balance - a.balance || a.customer.localeCompare(b.customer));
}

function writeEntry(shopId, build) {
  const key = khataKey(shopId);
  const write = () => {
    const entries = getKhataEntries(shopId);
    const entry = build();
    const existing = entries.find(({ id }) => id === entry.id);
    if (existing) return existing;
    if (!storeSet(key, [...entries, entry])) throw new Error('This browser could not save the khata entry. Try again.');
    return entry;
  };
  // Vite, GitHub Pages and installed HTTPS instances can serialize writes across tabs.
  if (typeof window !== 'undefined' && navigator.locks) return navigator.locks.request(key, write);
  return Promise.resolve().then(write);
}

export function postKhataBill(shopId, rawCustomer, bill) {
  const customer = rawCustomer.trim().replace(/\s+/gu, ' ').normalize('NFC');
  return writeEntry(shopId, () => {
    if (!customer || customer.length > 60) throw new Error('Enter a customer name of up to 60 characters.');
    if (!bill.id || !bill.items.length || !Number.isFinite(bill.total) || bill.total <= 0) {
      throw new Error('Add an item to the bill first.');
    }
    return { id: bill.id, customer, customerId: customer.toLocaleLowerCase('en-IN'), kind: 'bill', at: bill.endedAt, bill };
  });
}

export function postKhataRepayment(shopId, customerId, rawAmount, id = crypto.randomUUID()) {
  return writeEntry(shopId, () => {
    const existing = getKhataEntries(shopId).find((entry) => entry.id === id);
    if (existing) return existing;
    const account = getKhataAccounts(shopId).find((entry) => entry.customerId === customerId);
    const amount = Number(rawAmount);
    if (!/^\d+(\.\d{1,2})?$/.test(String(rawAmount).trim()) || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter an amount greater than ₹0, with up to two decimal places.');
    }
    if (!account || amount > account.balance) throw new Error('The payment exceeds the outstanding balance.');
    return { id, customer: account.customer, customerId, kind: 'repayment', at: new Date().toISOString(), amount };
  });
}
