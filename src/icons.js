// Shared 24px outline icons. The shop's receipt mark uses the same stroke.
const shapes = {
  brand: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 4h8m-8 4h4m3 0h1m-8 4h4m3 0h1"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0m-7 7v5m-3 0h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M21 13.1A9 9 0 0 1 10.9 3 9 9 0 1 0 21 13.1Z"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]}</svg>`;
}
