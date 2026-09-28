export const THEME_STORAGE_KEY = "ryoga-theme";
// The previous site stored "true"/"false" under this key; honour it once.
export const LEGACY_THEME_STORAGE_KEY = "darkMode";

export function isTheme(value) {
  return value === "light" || value === "dark";
}

// Runs before the body is painted, including when localStorage is unavailable.
export const THEME_INIT_SCRIPT = `(() => {
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  let theme = read(${JSON.stringify(THEME_STORAGE_KEY)});
  if (theme !== 'light' && theme !== 'dark') {
    const legacy = read(${JSON.stringify(LEGACY_THEME_STORAGE_KEY)});
    theme = legacy === 'true' ? 'dark' : legacy === 'false' ? 'light'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();`;
