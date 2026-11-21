// Receipt for a finished voice session — reads like a real shop receipt:
// shop name, date and time, itemised lines, a dashed total, and a
// thank-you line in the session language. Pure data in, structured receipt
// out; the counter renders it as a paper receipt.
import { UNIT_LABELS } from './intent.js';
import { formatINR } from './billing.js';

export const RECEIPT_LABELS = {
  en: { receipt: 'Receipt', total: 'Total', duration: 'Duration', turns: 'Turns', interruptions: 'Interruptions', signals: 'Restock signals', thanks: 'Thank you — come again!', items: 'items' },
  ta: { receipt: 'ரசீது', total: 'மொத்தம்', duration: 'நேரம்', turns: 'பேச்சுகள்', interruptions: 'குறுக்கீடுகள்', signals: 'மறுவாங்கல் குறிப்புகள்', thanks: 'நன்றி! மீண்டும் வாங்க!', items: 'பொருட்கள்' },
  te: { receipt: 'రసీదు', total: 'మొత్తం', duration: 'సమయం', turns: 'మాటలు', interruptions: 'అంతరాయాలు', signals: 'రీస్టాక్ సంకేతాలు', thanks: 'ధన్యవాదాలు! మళ్లీ రండి!', items: 'వస్తువులు' },
  hi: { receipt: 'रसीद', total: 'कुल', duration: 'समय', turns: 'बातें', interruptions: 'रुकावटें', signals: 'रीस्टॉक संकेत', thanks: 'धन्यवाद! फिर आइएगा!', items: 'सामान' },
  kn: { receipt: 'ರಶೀದಿ', total: 'ಒಟ್ಟು', duration: 'ಅವಧಿ', turns: 'ಮಾತುಗಳು', interruptions: 'ಅಡಚಣೆಗಳು', signals: 'ರಿಸ್ಟಾಕ್ ಸೂಚನೆಗಳು', thanks: 'ಧನ್ಯವಾದಗಳು! ಮತ್ತೆ ಬನ್ನಿ!', items: 'ವಸ್ತುಗಳು' },
  ml: { receipt: 'രസീത്', total: 'മൊത്തം', duration: 'സമയം', turns: 'സംസാരം', interruptions: 'തടസ്സങ്ങൾ', signals: 'റീസ്റ്റോക്ക് സൂചനകൾ', thanks: 'നന്ദി! വീണ്ടും വരൂ!', items: 'സാധനങ്ങൾ' },
  mr: { receipt: 'पावती', total: 'एकूण', duration: 'वेळ', turns: 'संवाद', interruptions: 'व्यत्यय', signals: 'रीस्टॉक सूचना', thanks: 'धन्यवाद! पुन्हा या!', items: 'वस्तू' },
};

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function qtyText(qty, unit, lang) {
  const label = (UNIT_LABELS[unit] && UNIT_LABELS[unit][lang]) || unit;
  const q = Number.isInteger(qty) ? String(qty) : String(qty);
  return label ? `${q} ${label}` : q;
}

// summary: VoiceSession.summary() shape. Returns a receipt object the UI
// renders — nothing here touches the DOM.
export function buildReceipt(summary, { shopName = 'KiranaVaani', lang = 'en' } = {}) {
  const labels = RECEIPT_LABELS[lang] || RECEIPT_LABELS.en;
  const lines = (summary.items || []).map((it) => ({
    itemId: it.itemId,
    name: it.name,
    qtyText: qtyText(it.qty, it.unit, lang),
    unitPrice: formatINR(it.price),
    total: formatINR(it.total),
  }));
  const when = summary.endedAt || summary.startedAt || new Date().toISOString();
  return {
    title: labels.receipt,
    shopName,
    date: new Date(when).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }),
    time: new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lines,
    itemCount: lines.length,
    total: formatINR(summary.total || 0),
    totalLabel: labels.total,
    totalRaw: summary.total || 0,
    meta: [
      { key: labels.duration, value: formatDuration(summary.durationMs) },
      { key: labels.turns, value: String(summary.turns || 0) },
      { key: labels.interruptions, value: String(summary.bargeIns || 0) },
      { key: labels.signals, value: String((summary.signals || []).length) },
    ],
    signals: (summary.signals || []).map((s) => s.name),
    thanks: labels.thanks,
    lang,
  };
}
