import { icon } from './icons.js';

const KEY = 'kirana.appearance';

export function initTheme(button) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  const isDark = () => (root.dataset.theme || (system.matches ? 'dark' : 'light')) === 'dark';
  const render = () => {
    const dark = isDark();
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon(dark ? 'sun' : 'moon');
  };

  system.addEventListener('change', render);
  button.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch { /* use this page's preference */ }
    render();
  });
  render();
}
