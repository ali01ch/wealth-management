import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-500.css';
import '@fontsource/vazirmatn/arabic-600.css';
import '@fontsource/vazirmatn/arabic-700.css';
import './styles.css';
import {
  isLockEnabled,
  loadLockMeta,
  restoreSessionDek,
} from './cryptoLock.js';
import { loadStateAsync, saveState } from './storage.js';
import { fetchLivePrices, getEffectivePrices, loadCachedPrices } from './prices.js';
import { dateFa } from './format.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderPurchases } from './ui/purchases.js';
import { renderPrices } from './ui/pricesView.js';
import { renderGoldSignal } from './ui/goldSignal.js';
import { renderGoals } from './ui/goals.js';
import { renderSettings } from './ui/settings.js';
import { showLockScreen } from './ui/lockScreen.js';
import { applyTheme, watchSystemTheme } from './theme.js';

const view = document.getElementById('view');
const priceStatus = document.getElementById('price-status');
const refreshBtn = document.getElementById('refresh-prices');

let state = null;
let prices = null;
let currentTab = 'prices';
let refreshTimer = null;
let fetching = false;
let booted = false;

function setStatus(text) {
  if (priceStatus) priceStatus.textContent = text;
}

async function persist(nextState) {
  state = nextState;
  try {
    await saveState(state);
  } catch (err) {
    alert(err.message || 'ذخیره ناموفق بود');
    return;
  }
  applyTheme(state.settings.theme);
  scheduleRefresh();
  render();
}

function render() {
  if (!booted || !state) return;
  const ctx = {
    state,
    prices,
    settings: state.settings,
    onChange: persist,
    onRefreshPrices: () => refreshPrices(true),
  };

  switch (currentTab) {
    case 'purchases':
      renderPurchases(view, ctx);
      break;
    case 'prices':
      renderPrices(view, ctx);
      break;
    case 'signal':
      renderGoldSignal(view, ctx);
      break;
    case 'goals':
      renderGoals(view, ctx);
      break;
    case 'settings':
      renderSettings(view, ctx);
      break;
    default:
      renderDashboard(view, ctx);
  }
}

async function refreshPrices(manual = false) {
  if (!booted || !state || fetching) return;
  fetching = true;
  if (manual) setStatus('در حال به‌روزرسانی…');
  refreshBtn?.classList.add('spinning');

  try {
    const live = await fetchLivePrices(state.settings);
    prices = getEffectivePrices(live, state.settings);
    const hint = prices.stale ? ' (کش)' : '';
    setStatus(`قیمت‌ها به‌روز شدند${hint} — ${dateFa(prices.fetchedAt)}`);
  } catch (err) {
    prices = getEffectivePrices(loadCachedPrices(), state.settings);
    setStatus(`خطا در دریافت قیمت: ${err.message}`);
  } finally {
    fetching = false;
    refreshBtn?.classList.remove('spinning');
    render();
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (!state) return;
  const minutes = Math.max(1, Number(state.settings.refreshMinutes) || 5);
  refreshTimer = setInterval(() => refreshPrices(false), minutes * 60 * 1000);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (!booted) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    render();
  });
});

refreshBtn?.addEventListener('click', () => refreshPrices(true));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && booted) refreshPrices(false);
});

async function boot() {
  document.body.classList.add('boot-pending');

  const meta = loadLockMeta();
  if (meta.uiTheme) applyTheme(meta.uiTheme);

  if (isLockEnabled()) {
    await restoreSessionDek();
    await showLockScreen();
  }

  try {
    state = await loadStateAsync();
  } catch (err) {
    alert(err.message || 'بارگذاری داده ناموفق بود');
    return;
  }

  prices = getEffectivePrices(loadCachedPrices(), state.settings);
  applyTheme(state.settings.theme);
  watchSystemTheme(
    () => state.settings.theme,
    () => applyTheme(state.settings.theme),
  );

  booted = true;
  document.body.classList.remove('boot-pending');
  render();
  scheduleRefresh();
  refreshPrices(false);
}

boot();
