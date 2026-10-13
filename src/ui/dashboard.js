import { portfolioValue } from '../calc.js';
import { dateFa, number, percent, pnlClass, toman } from '../format.js';

export function renderDashboard(root, { state, prices }) {
  const portfolio = portfolioValue(state.purchases, prices);
  const fetched = prices?.fetchedAt;

  root.innerHTML = `
    ${prices?.error || prices?.stale ? `<div class="alert">${prices.stale ? 'قیمت‌ها ممکن است قدیمی باشند. ' : ''}${prices.error || ''}</div>` : ''}

    <section class="card">
      <div class="label">ارزش کل دارایی‌ها</div>
      <div class="hero-value">${toman(portfolio.totalValue)}</div>
      <div class="row">
        <span class="label">هزینه خرید</span>
        <span class="value">${toman(portfolio.totalCost)}</span>
      </div>
      <div class="row">
        <span class="label">سود / زیان</span>
        <span class="value ${pnlClass(portfolio.totalPnl)}">
          ${toman(portfolio.totalPnl)}
          <small>(${percent(portfolio.totalPnlPercent)})</small>
        </span>
      </div>
      <p class="muted">آخرین قیمت: ${dateFa(fetched)}</p>
    </section>

    <section class="grid-2">
      ${['gold', 'silver', 'usd']
        .map((key) => {
          const b = portfolio.breakdown[key];
          return `
            <div class="stat card" style="padding:12px">
              <span class="label">${b.label}</span>
              <div class="value">${toman(b.value)}</div>
              <p class="muted" style="margin:6px 0 0">
                ${number(b.qty)} ${b.unit}
              </p>
              <p class="muted ${pnlClass(b.pnl)}" style="margin:4px 0 0;font-size:0.78rem">
                ${percent(b.pnlPercent)}
              </p>
            </div>
          `;
        })
        .join('')}
      <div class="stat card" style="padding:12px">
        <span class="label">تعداد خریدها</span>
        <div class="value">${number(state.purchases.length, 0)}</div>
        <p class="muted" style="margin:6px 0 0">اهداف: ${number(state.goals.length, 0)}</p>
      </div>
    </section>

    <section class="card">
      <h2>جزئیات موجودی</h2>
      ${Object.values(portfolio.breakdown)
        .map(
          (b) => `
        <div class="row">
          <div>
            <div class="value" style="text-align:right">${b.label}</div>
            <div class="muted">${number(b.qty)} ${b.unit} × ${toman(b.price)}</div>
          </div>
          <div class="value">${toman(b.value)}</div>
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}
