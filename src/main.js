import './styles.css';
import { loadState, saveState } from './storage.js';
import { fetchLivePrices, getEffectivePrices, loadCachedPrices } from './prices.js';
import { dateFa } from './format.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderPurchases } from './ui/purchases.js';
import { renderPrices } from './ui/pricesView.js';
import { renderGoals } from './ui/goals.js';
import { renderSettings } from './ui/settings.js';

const view = document.getElementById('view');
const priceStatus = document.getElementById('price-status');
const refreshBtn = document.getElementById('refresh-prices');

let state = loadState();
let prices = getEffectivePrices(loadCachedPrices(), state.settings);
let currentTab = 'dashboard';
let refreshTimer = null;
let fetching = false;

function setStatus(text) {
  if (priceStatus) priceStatus.textContent = text;
}

function persist(nextState) {
  state = nextState;
  saveState(state);
  scheduleRefresh();
  render();
}

function render() {
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
  if (fetching) return;
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
  const minutes = Math.max(1, Number(state.settings.refreshMinutes) || 5);
  refreshTimer = setInterval(() => refreshPrices(false), minutes * 60 * 1000);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    render();
  });
});

refreshBtn?.addEventListener('click', () => refreshPrices(true));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPrices(false);
});

render();
scheduleRefresh();
refreshPrices(false);
