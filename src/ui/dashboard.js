import { portfolioValue } from '../calc.js';
import { dateFa, number, percent, pnlClass, toman } from '../format.js';
import { goldSignalSummaryHtml } from './goldSignal.js';

export function renderDashboard(root, { state, prices }) {
  const portfolio = portfolioValue(state.purchases, prices);
  const fetched = prices?.fetchedAt;
  const txCount = state.purchases.length;
  const sellCount = state.purchases.filter((t) => t.kind === 'sell').length;

  root.innerHTML = `
    ${prices?.error || prices?.stale ? `<div class="alert">${prices.stale ? 'قیمت‌ها ممکن است قدیمی باشند. ' : ''}${prices.error || ''}</div>` : ''}
    ${portfolio.ledgerOk === false ? `<div class="alert">${portfolio.ledgerError || 'دفتر معاملات ناسازگار است.'}</div>` : ''}

    ${goldSignalSummaryHtml(prices)}

    <section class="card">
      <div class="label">ارزش کل دارایی‌های فعلی</div>
      <div class="hero-value">${toman(portfolio.totalValue)}</div>
      <div class="row">
        <span class="label">بهای تمام‌شده باقی‌مانده</span>
        <span class="value">${toman(portfolio.totalCost)}</span>
      </div>
      <div class="row">
        <span class="label">سود / زیان تحقق‌نیافته</span>
        <span class="value ${pnlClass(portfolio.unrealizedPnl)}">
          ${toman(portfolio.unrealizedPnl)}
          <small>(${percent(portfolio.unrealizedPnlPercent)})</small>
        </span>
      </div>
      <div class="row">
        <span class="label">سود / زیان تحقق‌یافته (فروش‌ها)</span>
        <span class="value ${pnlClass(portfolio.realizedPnl)}">${toman(portfolio.realizedPnl)}</span>
      </div>
      <div class="row">
        <span class="label">جمع عملکرد</span>
        <span class="value ${pnlClass(portfolio.totalPnl)}">${toman(portfolio.totalPnl)}</span>
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
              <p class="muted ${pnlClass(b.unrealized)}" style="margin:4px 0 0;font-size:0.78rem">
                ${percent(b.pnlPercent)}
              </p>
            </div>
          `;
        })
        .join('')}
      <div class="stat card" style="padding:12px">
        <span class="label">تعداد معاملات</span>
        <div class="value">${number(txCount, 0)}</div>
        <p class="muted" style="margin:6px 0 0">فروش: ${number(sellCount, 0)} · اهداف: ${number(state.goals.length, 0)}</p>
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
            ${
              b.realized
                ? `<div class="muted ${pnlClass(b.realized)}">تحقق‌یافته: ${toman(b.realized)}</div>`
                : ''
            }
          </div>
          <div class="value">${toman(b.value)}</div>
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}
