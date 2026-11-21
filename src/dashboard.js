// Owner-dashboard maths for KiranaVaani.
// Pure functions over session records + the shop catalogue — no DOM, no
// storage — so the Node test suite covers exactly what the dashboard shows.

export function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear()
    && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate();
}

export function todaysSessions(sessions, now = new Date()) {
  return (sessions || []).filter((s) => s.startedAt && sameDay(s.startedAt, now));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

// Top sellers across the given sessions: [{ itemId, name, qty, revenue }]
export function topSellers(sessions, n = 5) {
  const byId = new Map();
  for (const s of sessions || []) {
    for (const it of s.items || []) {
      const cur = byId.get(it.itemId) || { itemId: it.itemId, name: it.name, qty: 0, revenue: 0 };
      cur.qty = round2(cur.qty + (it.qty || 0));
      cur.revenue = round2(cur.revenue + (it.total || 0));
      byId.set(it.itemId, cur);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, n);
}

export function lowStockItems(items, threshold = 8) {
  return (items || [])
    .filter((i) => i.stock <= threshold)
    .sort((a, b) => a.stock - b.stock)
    .map((i) => ({ id: i.id, name: i.names.en, stock: i.stock, unit: i.unit, out: i.stock <= 0 }));
}

export function sessionsByLanguage(sessions) {
  const counts = {};
  for (const s of sessions || []) {
    const lang = s.lang || 'en';
    counts[lang] = (counts[lang] || 0) + 1;
  }
  return counts;
}

// Everything the dashboard header + panels need, for one shop, today.
export function summarizeSessions(sessions, items, now = new Date()) {
  const today = todaysSessions(sessions, now);
  const revenue = round2(today.reduce((sum, s) => sum + (s.total || 0), 0));
  const orders = today.length;
  const avgBill = orders ? round2(revenue / orders) : 0;
  const signals = today.flatMap((s) => (s.signals || []).map((sig) => ({
    ...sig,
    at: s.startedAt,
  })));
  return {
    orders,
    revenue,
    avgBill,
    sessions: today.length,
    topSellers: topSellers(today, 5),
    lowStock: lowStockItems(items, 8),
    signals,
    byLanguage: sessionsByLanguage(today),
  };
}
