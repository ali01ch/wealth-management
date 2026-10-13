import { analyzeGoldBuySignal } from '../calc.js';
import { number, percent, pnlClass, toman } from '../format.js';

export function renderGoldSignal(root, { prices }) {
  const signal = analyzeGoldBuySignal(prices);
  const xau = prices?.assets?.xau;

  if (!signal) {
    root.innerHTML = `
      <section class="card">
        <h2>تحلیل خرید طلا</h2>
        <p class="empty" style="padding:16px 0">
          برای محاسبه به انس جهانی، دلار آزاد و قیمت طلای ۱۸ عیار نیاز است.
          دکمه به‌روزرسانی را بزنید یا در تنظیمات قیمت دستی وارد کنید.
        </p>
      </section>
      ${
        xau?.price != null
          ? `<section class="card price-card">
              <div class="label">انس جهانی طلا</div>
              <div class="hero-value">${number(xau.price, 2)} دلار</div>
            </section>`
          : ''
      }
    `;
    return;
  }

  const bubbleLabel =
    signal.premiumPct > 0
      ? `حباب ${percent(signal.premiumPct)}`
      : signal.premiumPct < 0
        ? `تخفیف ${percent(Math.abs(signal.premiumPct))}`
        : 'بدون حباب';

  root.innerHTML = `
    <section class="card signal-hero ${signal.verdictClass}">
      <div class="label">آیا الان طلا بخرم؟</div>
      <div class="hero-value signal-verdict">${signal.verdict}</div>
      <p class="signal-advice">${signal.advice}</p>
      <div class="badge">${bubbleLabel}</div>
    </section>

    <section class="card">
      <h2>محاسبه ارزش منصفانه</h2>
      <div class="row">
        <span class="label">انس جهانی</span>
        <span class="value">${number(signal.xau, 2)} دلار</span>
      </div>
      <div class="row">
        <span class="label">دلار آزاد</span>
        <span class="value">${toman(signal.usd)}</span>
      </div>
      <div class="row">
        <span class="label">ارزش منصفانه ۱۸ عیار</span>
        <span class="value">${toman(signal.fair18)}</span>
      </div>
      <div class="row">
        <span class="label">قیمت بازار ایران</span>
        <span class="value">${toman(signal.local18)}</span>
      </div>
      <div class="row">
        <span class="label">اختلاف هر گرم</span>
        <span class="value ${pnlClass(-signal.diff)}">${toman(signal.diff)}</span>
      </div>
      <div class="row">
        <span class="label">حباب / تخفیف</span>
        <span class="value ${pnlClass(-signal.premiumPct)}">${percent(signal.premiumPct)}</span>
      </div>
    </section>

    <section class="card">
      <h2>فرمول</h2>
      <p class="muted" style="margin:0;line-height:1.7">
        ارزش منصفانهٔ هر گرم ۱۸ عیار =
        (انس دلاری ÷ ۳۱٫۱۰۳۵) × دلار آزاد × ۰٫۷۵
      </p>
      <p class="muted" style="margin:10px 0 0;line-height:1.7">
        اگر قیمت بازار از این عدد کمتر باشد، خرید منطقی‌تر است؛ اگر بیشتر باشد معمولاً حباب دارد.
        این فقط معیار نسبی است، نه توصیهٔ قطعی سرمایه‌گذاری.
      </p>
    </section>

    <section class="card price-card">
      <div class="label">انس جهانی طلا</div>
      <div class="hero-value">${number(signal.xau, 2)} دلار</div>
      <div class="row">
        <span class="label">تغییر</span>
        <span class="value ${pnlClass(xau?.changePercent)}">${percent(xau?.changePercent)}</span>
      </div>
      <div class="row">
        <span class="label">منبع</span>
        <span class="value">${xau?.source || '—'}</span>
      </div>
    </section>
  `;
}

/** کارت خلاصه برای داشبورد */
export function goldSignalSummaryHtml(prices) {
  const signal = analyzeGoldBuySignal(prices);
  if (!signal) return '';

  return `
    <section class="card signal-hero ${signal.verdictClass}" style="padding:14px">
      <div class="section-title">
        <div>
          <div class="label">سیگنال خرید طلا</div>
          <div class="value" style="margin-top:4px;text-align:right;font-size:1.15rem">${signal.verdict}</div>
        </div>
        <span class="badge">${percent(signal.premiumPct)} حباب</span>
      </div>
      <p class="muted" style="margin:8px 0 0">
        بازار ${toman(signal.local18)} · منصفانه ${toman(signal.fair18)}
      </p>
    </section>
  `;
}
