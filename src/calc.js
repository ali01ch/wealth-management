export const ASSET_META = {
  gold: { label: 'طلا ۱۸ عیار', unit: 'گرم', priceKey: 'gold' },
  silver: { label: 'نقره', unit: 'گرم', priceKey: 'silver' },
  usd: { label: 'دلار', unit: 'دلار', priceKey: 'usd' },
};

/** گرم در یک انس تروی */
export const TROY_OUNCE_GRAMS = 31.1034768;

/**
 * مقایسه قیمت داخلی طلای ۱۸ عیار با ارزش منصفانه از انس جهانی × دلار آزاد.
 * حباب مثبت = داخلی گران‌تر از ارزش جهانی.
 */
export function analyzeGoldBuySignal(prices) {
  const xau = Number(prices?.assets?.xau?.price);
  const usd = Number(prices?.assets?.usd?.price);
  const local18 = Number(prices?.assets?.gold?.price);

  if (!(xau > 0 && usd > 0 && local18 > 0)) return null;

  const fair24 = (xau / TROY_OUNCE_GRAMS) * usd;
  const fair18 = fair24 * (18 / 24);
  const diff = local18 - fair18;
  const premiumPct = (diff / fair18) * 100;

  let verdict;
  let verdictClass;
  let advice;

  if (premiumPct <= -1) {
    verdict = 'الان بخر';
    verdictClass = 'signal-buy';
    advice = 'قیمت داخلی از ارزش جهانی پایین‌تر است؛ خرید نسبتاً مناسب به‌نظر می‌رسد.';
  } else if (premiumPct <= 2) {
    verdict = 'فرقی ندارد';
    verdictClass = 'signal-neutral';
    advice = 'قیمت داخلی نزدیک به ارزش منصفانهٔ انس × دلار است.';
  } else {
    verdict = 'فعلاً نخر';
    verdictClass = 'signal-avoid';
    advice = 'طلای داخلی نسبت به انس جهانی گران‌تر است (حباب مثبت).';
  }

  return {
    xau,
    usd,
    local18,
    fair18,
    fair24,
    diff,
    premiumPct,
    verdict,
    verdictClass,
    advice,
  };
}

export function normalizeTx(tx) {
  if (!tx || typeof tx !== 'object') return null;
  return {
    ...tx,
    kind: tx.kind === 'sell' ? 'sell' : 'buy',
    asset: tx.asset,
    quantity: Number(tx.quantity) || 0,
    unitPrice: Number(tx.unitPrice) || 0,
  };
}

/** ترتیب زمانی برای دفتر کل: تاریخ، بعد خرید قبل فروش در همان روز */
export function sortTransactionsChronological(transactions) {
  return [...transactions]
    .map(normalizeTx)
    .filter(Boolean)
    .sort((a, b) => {
      const byDate = String(a.date || '').localeCompare(String(b.date || ''));
      if (byDate !== 0) return byDate;
      const ka = a.kind === 'sell' ? 1 : 0;
      const kb = b.kind === 'sell' ? 1 : 0;
      if (ka !== kb) return ka - kb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function emptyBook() {
  return {
    gold: { qty: 0, cost: 0, realized: 0 },
    silver: { qty: 0, cost: 0, realized: 0 },
    usd: { qty: 0, cost: 0, realized: 0 },
  };
}

/**
 * اجرای دفتر کل با میانگین بهای تمام‌شده (average cost).
 * فروش: کم شدن موجودی و هزینهٔ باقی‌مانده، ثبت سود/زیان تحقق‌یافته.
 */
export function runLedger(transactions) {
  const book = emptyBook();
  const ordered = sortTransactionsChronological(transactions);

  for (const tx of ordered) {
    const row = book[tx.asset];
    if (!row) continue;
    const qty = tx.quantity;
    const price = tx.unitPrice;
    if (!(qty > 0) || !(price >= 0)) {
      return {
        ok: false,
        error: 'مقدار و قیمت باید معتبر باشند.',
        book: null,
      };
    }

    if (tx.kind === 'buy') {
      row.qty += qty;
      row.cost += qty * price;
      continue;
    }

    // sell
    if (qty > row.qty + 1e-9) {
      const meta = ASSET_META[tx.asset];
      return {
        ok: false,
        error: `موجودی ${meta?.label || tx.asset} کافی نیست (درخواستی: ${qty}، موجود: ${row.qty}).`,
        book: null,
      };
    }

    const avgCost = row.qty > 0 ? row.cost / row.qty : 0;
    const costBasis = avgCost * qty;
    const proceeds = qty * price;
    row.realized += proceeds - costBasis;
    row.qty -= qty;
    row.cost -= costBasis;

    if (row.qty < 1e-9) {
      row.qty = 0;
      row.cost = 0;
    }
  }

  return { ok: true, error: null, book };
}

export function summarizeHoldings(transactions) {
  const { ok, book } = runLedger(transactions);
  const summary = emptyBook();

  if (!ok || !book) {
    for (const key of Object.keys(summary)) {
      summary[key].avgCost = 0;
    }
    return summary;
  }

  for (const key of Object.keys(summary)) {
    const item = book[key];
    summary[key] = {
      qty: item.qty,
      cost: item.cost,
      realized: item.realized,
      avgCost: item.qty > 0 ? item.cost / item.qty : 0,
    };
  }
  return summary;
}

/** موجودی قابل فروش قبل از اعمال یک تراکنش (مثلاً هنگام ویرایش) */
export function availableQuantity(transactions, asset, excludeId = null) {
  const filtered = transactions.filter((t) => t.id !== excludeId);
  const holdings = summarizeHoldings(filtered);
  return holdings[asset]?.qty || 0;
}

export function validateTransactions(transactions) {
  return runLedger(transactions);
}

function assetPrice(prices, key) {
  return Number(prices?.assets?.[key]?.price) || 0;
}

export function portfolioValue(transactions, prices) {
  const ledger = runLedger(transactions);
  const holdings = summarizeHoldings(transactions);
  const breakdown = {};
  let totalValue = 0;
  let totalCost = 0;
  let totalRealized = 0;

  for (const [key, meta] of Object.entries(ASSET_META)) {
    const h = holdings[key];
    const price = assetPrice(prices, meta.priceKey);
    const value = h.qty * price;
    const unrealized = value - h.cost;
    breakdown[key] = {
      ...meta,
      qty: h.qty,
      cost: h.cost,
      avgCost: h.avgCost,
      price,
      value,
      realized: h.realized || 0,
      unrealized,
      pnl: unrealized,
      pnlPercent: h.cost > 0 ? (unrealized / h.cost) * 100 : 0,
    };
    totalValue += value;
    totalCost += h.cost;
    totalRealized += h.realized || 0;
  }

  const unrealizedPnl = totalValue - totalCost;
  const totalPnl = unrealizedPnl + totalRealized;

  return {
    holdings,
    breakdown,
    totalValue,
    totalCost,
    unrealizedPnl,
    unrealizedPnlPercent: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0,
    realizedPnl: totalRealized,
    totalPnl,
    totalPnlPercent: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    ledgerOk: ledger.ok,
    ledgerError: ledger.error,
  };
}

export function analyzeGoal(goal, portfolio, prices) {
  const target = Number(goal.targetToman) || 0;
  const current = portfolio.totalValue || 0;
  const remaining = Math.max(0, target - current);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  const goldPrice = assetPrice(prices, 'gold');
  const silverPrice = assetPrice(prices, 'silver');
  const usdPrice = assetPrice(prices, 'usd');

  const needed = {
    goldGrams: goldPrice > 0 ? remaining / goldPrice : null,
    silverGrams: silverPrice > 0 ? remaining / silverPrice : null,
    usdAmount: usdPrice > 0 ? remaining / usdPrice : null,
  };

  const monthly = Number(goal.monthlySavings) || 0;
  let monthsEstimate = null;
  if (remaining <= 0) {
    monthsEstimate = 0;
  } else if (monthly > 0) {
    monthsEstimate = remaining / monthly;
  }

  return {
    target,
    current,
    remaining,
    progress,
    needed,
    monthsEstimate,
    reached: remaining <= 0 && target > 0,
  };
}

export function formatMonths(months) {
  if (months == null || !Number.isFinite(months)) return null;
  if (months <= 0) return 'رسیده‌اید';
  if (months < 1) return 'کمتر از یک ماه';
  const whole = Math.ceil(months);
  if (whole < 12) return `حدود ${whole} ماه`;
  const years = Math.floor(whole / 12);
  const rem = whole % 12;
  if (rem === 0) return `حدود ${years} سال`;
  return `حدود ${years} سال و ${rem} ماه`;
}
