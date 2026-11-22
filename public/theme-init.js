// Set a saved appearance before styles paint. Storage may be blocked.
try {
  const theme = localStorage.getItem('kirana.appearance');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
} catch { /* keep the system preference */ }
