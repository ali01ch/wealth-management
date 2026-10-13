export const ASSET_META = {
  gold: { label: 'طلا ۱۸ عیار', unit: 'گرم', priceKey: 'gold' },
  silver: { label: 'نقره', unit: 'گرم', priceKey: 'silver' },
  usd: { label: 'دلار', unit: 'دلار', priceKey: 'usd' },
};

export function summarizeHoldings(purchases) {
  const summary = {
    gold: { qty: 0, cost: 0 },
    silver: { qty: 0, cost: 0 },
    usd: { qty: 0, cost: 0 },
  };

  for (const p of purchases) {
    const type = p.asset;
    if (!summary[type]) continue;
    const qty = Number(p.quantity) || 0;
    const unitPrice = Number(p.unitPrice) || 0;
    summary[type].qty += qty;
    summary[type].cost += qty * unitPrice;
  }

  for (const key of Object.keys(summary)) {
    const item = summary[key];
    item.avgCost = item.qty > 0 ? item.cost / item.qty : 0;
  }

  return summary;
}

function assetPrice(prices, key) {
  return Number(prices?.assets?.[key]?.price) || 0;
}

export function portfolioValue(purchases, prices) {
  const holdings = summarizeHoldings(purchases);
  const breakdown = {};
  let totalValue = 0;
  let totalCost = 0;

  for (const [key, meta] of Object.entries(ASSET_META)) {
    const h = holdings[key];
    const price = assetPrice(prices, meta.priceKey);
    const value = h.qty * price;
    breakdown[key] = {
      ...meta,
      qty: h.qty,
      cost: h.cost,
      avgCost: h.avgCost,
      price,
      value,
      pnl: value - h.cost,
      pnlPercent: h.cost > 0 ? ((value - h.cost) / h.cost) * 100 : 0,
    };
    totalValue += value;
    totalCost += h.cost;
  }

  return {
    holdings,
    breakdown,
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    totalPnlPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
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
