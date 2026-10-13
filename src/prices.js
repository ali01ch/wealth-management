const IRAN_MARKET_URL =
  'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json';
const IRAN_MARKET_LATEST_URL =
  'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json';
const GTA_SILVER_URL = 'https://gtasilver.com/api/silver-price';

const CACHE_KEY = 'wealth-management-prices-cache';

function flattenMarketItems(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;

  const categories = payload?.data?.categories;
  if (categories && typeof categories === 'object') {
    const items = [];
    for (const category of Object.values(categories)) {
      const list = Array.isArray(category?.items)
        ? category.items
        : Array.isArray(category)
          ? category
          : [];
      items.push(...list);
    }
    return items;
  }

  return [];
}

function findSymbol(items, symbol) {
  if (!Array.isArray(items)) return null;
  return items.find((item) => item.symbol === symbol) || null;
}

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractFromIranMarket(payload, silverPurity) {
  const data = flattenMarketItems(payload);

  const usd = findSymbol(data, 'USD_IRR_FREE');
  const gold = findSymbol(data, 'GOLD_18K_IRR');
  const xau = findSymbol(data, 'XAU_USD');
  const silverSymbol = silverPurity === '925' ? 'SILVER_925_IRR' : 'SILVER_999_IRR';
  const silver = findSymbol(data, silverSymbol) || findSymbol(data, 'SILVER_999_IRR');

  const changeOf = (item) =>
    toNumber(item.change_pct ?? item.change_percent ?? item.changePercent);

  const mapItem = (item, extra = {}) =>
    item
      ? {
          price: toNumber(item.price),
          changePercent: changeOf(item),
          updatedAt: item.updated_at || item.timestamp || null,
          source: 'Iran Market',
          ...extra,
        }
      : null;

  return {
    usd: mapItem(usd),
    gold: mapItem(gold),
    silver: mapItem(silver, { purity: silverPurity }),
    xau: mapItem(xau),
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchGtaSilver(silverPurity) {
  const data = await fetchJson(GTA_SILVER_URL);
  const field = silverPurity === '925' ? 'gram_925' : 'gram_990';
  const price = toNumber(data?.prices?.[field] ?? data?.prices?.gram_990);
  if (price == null) return null;
  return {
    price,
    changePercent: toNumber(data.change_percent),
    updatedAt: data.updated_at || null,
    source: 'GTA Silver',
    purity: silverPurity,
    attribution: {
      name: 'GTA Silver',
      url: 'https://gtasilver.com/silver-price',
    },
  };
}

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

export function loadCachedPrices() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedPrices(prices) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(prices));
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyManualPrices(base, manual) {
  if (!manual) return base;
  const next = { ...base, assets: { ...base.assets } };
  for (const key of ['gold', 'silver', 'usd', 'xau']) {
    const value = toNumber(manual[key]);
    if (value != null && value > 0) {
      next.assets[key] = {
        ...(next.assets[key] || {}),
        price: value,
        source: 'دستی',
        changePercent: null,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  next.manualOverride = true;
  return next;
}

function pickAsset(primary, fallback) {
  return primary?.price != null ? primary : fallback;
}

export async function fetchLivePrices(settings = {}) {
  const silverPurity = settings.silverPurity === '925' ? '925' : '999';
  const errors = [];
  let assets = { gold: null, silver: null, usd: null, xau: null };
  let attribution = null;

  try {
    const popular = await fetchJson(IRAN_MARKET_URL);
    assets = extractFromIranMarket(popular, silverPurity);
  } catch (err) {
    errors.push(`popular.json: ${err.message}`);
  }

  if (
    !assets.gold?.price ||
    !assets.usd?.price ||
    !assets.silver?.price ||
    !assets.xau?.price
  ) {
    try {
      const latest = await fetchJson(IRAN_MARKET_LATEST_URL);
      const fromLatest = extractFromIranMarket(latest, silverPurity);
      assets = {
        gold: pickAsset(assets.gold, fromLatest.gold),
        silver: pickAsset(assets.silver, fromLatest.silver),
        usd: pickAsset(assets.usd, fromLatest.usd),
        xau: pickAsset(assets.xau, fromLatest.xau),
      };
    } catch (err) {
      errors.push(`latest-toman: ${err.message}`);
    }
  }

  if (!assets.silver || assets.silver.price == null) {
    try {
      const silver = await fetchGtaSilver(silverPurity);
      if (silver) {
        assets.silver = silver;
        attribution = silver.attribution;
      }
    } catch (err) {
      errors.push(`GTA Silver: ${err.message}`);
    }
  }

  const hasAny =
    (assets.gold && assets.gold.price != null) ||
    (assets.silver && assets.silver.price != null) ||
    (assets.usd && assets.usd.price != null) ||
    (assets.xau && assets.xau.price != null);

  if (!hasAny) {
    const cached = loadCachedPrices();
    if (cached) {
      return {
        ...cached,
        stale: true,
        error: errors.join(' | ') || 'دریافت قیمت ناموفق بود',
        fetchedAt: cached.fetchedAt,
      };
    }
    throw new Error(errors.join(' | ') || 'دریافت قیمت ناموفق بود');
  }

  const result = {
    assets,
    attribution,
    fetchedAt: new Date().toISOString(),
    stale: false,
    error: errors.length ? errors.join(' | ') : null,
    silverPurity,
  };

  saveCachedPrices(result);
  return applyManualPrices(result, settings.manualPrices);
}

export function getEffectivePrices(liveOrCached, settings = {}) {
  const base =
    liveOrCached ||
    loadCachedPrices() || {
      assets: { gold: null, silver: null, usd: null, xau: null },
      fetchedAt: null,
      stale: true,
      error: null,
    };
  return applyManualPrices(base, settings.manualPrices);
}
