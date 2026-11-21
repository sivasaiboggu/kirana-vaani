// Running bill: add / remove items, line totals, grand total.
// Cart is a plain object: { [itemId]: { item, qty } } — easy to serialise.

export function createCart() {
  return {};
}

export function addToCart(cart, item, qty) {
  const entry = cart[item.id];
  if (entry) entry.qty = round2(entry.qty + qty);
  else cart[item.id] = { item, qty: round2(qty) };
  return cart;
}

// Removes qty (or the whole line when qty is null / >= line qty).
// Returns { removed, lineGone } — removed is the quantity actually taken out.
export function removeFromCart(cart, item, qty = null) {
  const entry = cart[item.id];
  if (!entry) return { removed: 0, lineGone: false };
  if (qty === null || qty >= entry.qty) {
    const removed = entry.qty;
    delete cart[item.id];
    return { removed, lineGone: true };
  }
  entry.qty = round2(entry.qty - qty);
  return { removed: qty, lineGone: false };
}

export function lineTotal(entry) {
  return round2(entry.item.price * entry.qty);
}

export function cartLines(cart) {
  return Object.values(cart).map((entry) => ({ ...entry, total: lineTotal(entry) }));
}

export function cartTotal(cart) {
  return round2(cartLines(cart).reduce((sum, line) => sum + line.total, 0));
}

export function cartCount(cart) {
  return Object.keys(cart).length;
}

export function isEmpty(cart) {
  return cartCount(cart) === 0;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function formatINR(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQty(qty, unit) {
  return Number.isInteger(qty) ? `${qty} ${unit}` : `${qty} ${unit}`;
}
