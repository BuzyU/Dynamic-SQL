(function () {
  const STORAGE_KEY = 'theme-preference';
  const root = document.documentElement;

  function getPreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }

  // initialize
  setTheme(getPreference());

  // toggle
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = root.classList.contains('dark') ? 'light' : 'dark';
      setTheme(next);
    });
  });
})();


