const THEMES = ['light', 'dark', 'auto'];

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'auto';
}

export function resolveTheme(preference) {
  const pref = normalizeTheme(preference);
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function applyTheme(preference) {
  const pref = normalizeTheme(preference);
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = pref;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f7f1e6' : '#14110e');
  }

  return resolved;
}

export function watchSystemTheme(preferenceGetter, onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (normalizeTheme(preferenceGetter()) === 'auto') onChange();
  };
  if (mq.addEventListener) mq.addEventListener('change', handler);
  else mq.addListener(handler);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', handler);
    else mq.removeListener(handler);
  };
}
