import { dateFa, percent, pnlClass, toman } from '../format.js';

const LABELS = {
  gold: { title: 'طلا ۱۸ عیار', unit: 'گرم' },
  silver: { title: 'نقره', unit: 'گرم' },
  usd: { title: 'دلار آزاد', unit: 'دلار' },
};

export function renderPrices(root, { prices, settings }) {
  const assets = prices?.assets || {};
  const silverLabel =
    settings.silverPurity === '925' ? 'نقره ۹۲۵' : 'نقره ۹۹۹';

  root.innerHTML = `
    ${prices?.error || prices?.stale ? `<div class="alert">${prices.stale ? 'نمایش از کش. ' : ''}${prices.error || ''}</div>` : ''}
    ${
      prices?.manualOverride
        ? `<div class="alert info">برخی قیمت‌ها دستی تنظیم شده‌اند.</div>`
        : ''
    }

    ${['gold', 'silver', 'usd']
      .map((key) => {
        const item = assets[key];
        const meta = LABELS[key];
        const title = key === 'silver' ? silverLabel : meta.title;
        return `
          <section class="card price-card">
            <div class="label">${title}</div>
            <div class="hero-value">${item?.price != null ? toman(item.price) : '—'}</div>
            <div class="row">
              <span class="label">واحد</span>
              <span class="value">هر ${meta.unit}</span>
            </div>
            <div class="row">
              <span class="label">تغییر</span>
              <span class="value ${pnlClass(item?.changePercent)}">${percent(item?.changePercent)}</span>
            </div>
            <div class="row">
              <span class="label">منبع</span>
              <span class="value">${item?.source || '—'}</span>
            </div>
          </section>
        `;
      })
      .join('')}

    <p class="muted">به‌روزرسانی: ${dateFa(prices?.fetchedAt)}</p>
    ${
      prices?.attribution
        ? `<p class="attribution">قیمت نقره از <a href="${prices.attribution.url}" target="_blank" rel="noopener">${prices.attribution.name}</a></p>`
        : ''
    }
    <p class="muted">قیمت‌ها تقریبی بازار آزاد هستند و مرجع معامله رسمی نیستند.</p>
  `;
}
