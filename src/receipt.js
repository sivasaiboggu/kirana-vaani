// Receipt for a finished voice session — reads like a real shop receipt:
// shop name, date and time, itemised lines, a dashed total, and a
// thank-you line in the session language. Pure data in, structured receipt
// out; the counter renders it as a paper receipt.
import { UNIT_LABELS } from './intent.js';
import { formatINR } from './billing.js';

// One sentence per language for the restock line on the receipt — it
// used to be hardcoded English inside an otherwise localised receipt.
export const RECEIPT_LABELS = {
  en: { receipt: 'Receipt', total: 'Total', duration: 'Duration', turns: 'Turns', interruptions: 'Interruptions', signals: 'Restock signals', thanks: 'Thank you — come again!', items: 'items', signalsNote: 'Restock note: {names} was asked for but out of stock.' },
  ta: { receipt: 'ரசீது', total: 'மொத்தம்', duration: 'நேரம்', turns: 'பேச்சுகள்', interruptions: 'குறுக்கீடுகள்', signals: 'மறுவாங்கல் குறிப்புகள்', thanks: 'நன்றி! மீண்டும் வாங்க!', items: 'பொருட்கள்', signalsNote: 'மறுவாங்கல் குறிப்பு: {names} கேட்டார்கள், ஆனால் ஸ்டாக் இல்லை.' },
  te: { receipt: 'రసీదు', total: 'మొత్తం', duration: 'సమయం', turns: 'మాటలు', interruptions: 'అంతరాయాలు', signals: 'రీస్టాక్ సంకేతాలు', thanks: 'ధన్యవాదాలు! మళ్లీ రండి!', items: 'వస్తువులు', signalsNote: 'రీస్టాక్ గమనిక: {names} అడిగారు, కానీ స్టాక్ లేదు.' },
  hi: { receipt: 'रसीद', total: 'कुल', duration: 'समय', turns: 'बातें', interruptions: 'रुकावटें', signals: 'रीस्टॉक संकेत', thanks: 'धन्यवाद! फिर आइएगा!', items: 'सामान', signalsNote: 'रीस्टॉक नोट: {names} माँगा गया, पर स्टॉक में नहीं था।' },
  kn: { receipt: 'ರಶೀದಿ', total: 'ಒಟ್ಟು', duration: 'ಅವಧಿ', turns: 'ಮಾತುಗಳು', interruptions: 'ಅಡಚಣೆಗಳು', signals: 'ರಿಸ್ಟಾಕ್ ಸೂಚನೆಗಳು', thanks: 'ಧನ್ಯವಾದಗಳು! ಮತ್ತೆ ಬನ್ನಿ!', items: 'ವಸ್ತುಗಳು', signalsNote: 'ರಿಸ್ಟಾಕ್ ಸೂಚನೆ: {names} ಕೇಳಿದರು, ಆದರೆ ಸ್ಟಾಕ್ ಇಲ್ಲ.' },
  ml: { receipt: 'രസീത്', total: 'മൊത്തം', duration: 'സമയം', turns: 'സംസാരം', interruptions: 'തടസ്സങ്ങൾ', signals: 'റീസ്റ്റോക്ക് സൂചനകൾ', thanks: 'നന്ദി! വീണ്ടും വരൂ!', items: 'സാധനങ്ങൾ', signalsNote: 'റീസ്റ്റോക്ക് കുറിപ്പ്: {names} ചോദിച്ചു, പക്ഷേ സ്റ്റോക്കില്ല.' },
  mr: { receipt: 'पावती', total: 'एकूण', duration: 'वेळ', turns: 'संवाद', interruptions: 'व्यत्यय', signals: 'रीस्टॉक सूचना', thanks: 'धन्यवाद! पुन्हा या!', items: 'वस्तू', signalsNote: 'रीस्टॉक नोंद: {names} मागितले, पण स्टॉक नव्हता.' },
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
    signalsNote: (summary.signals || []).length > 0
      ? labels.signalsNote.replace('{names}', (summary.signals || []).map((s) => s.name).join(', '))
      : '',
    thanks: labels.thanks,
    lang,
  };
}
