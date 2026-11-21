// UPI payment link + QR payload for the running bill.
// Pure client-side: no server, no key. The QR encodes a standard UPI intent
// (upi://pay) that any UPI app (GPay, PhonePe, Paytm) can scan.
// DEMO merchant VPA below — a real shop replaces `pa` with its own UPI ID.

export const MERCHANT_VPA = 'kirana@okhdfcbank';
export const MERCHANT_NAME = 'KiranaVaani';

export function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

export function buildUpiLink({ pa = MERCHANT_VPA, pn = MERCHANT_NAME, amount, note = 'Kirana bill' } = {}) {
  const params = new URLSearchParams({
    pa,
    pn,
    am: formatAmount(amount),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
