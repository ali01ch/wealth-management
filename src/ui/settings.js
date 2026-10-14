import { enhanceMoneyInputs, formatMoneyInput, parseMoneyInput } from '../moneyInput.js';
import { clearState, exportState, importState } from '../storage.js';

export function renderSettings(root, { state, onChange, onRefreshPrices }) {
  const s = state.settings;
  const moneyVal = (v) => (v == null || v === '' ? '' : formatMoneyInput(v));

  root.innerHTML = `
    <section class="card">
      <h2>تنظیمات قیمت</h2>
      <form class="form" id="settings-form">
        <div class="field">
          <label for="silverPurity">عیار نقره</label>
          <select id="silverPurity" name="silverPurity">
            <option value="999" ${s.silverPurity !== '925' ? 'selected' : ''}>۹۹۹ / ۹۹۰</option>
            <option value="925" ${s.silverPurity === '925' ? 'selected' : ''}>۹۲۵</option>
          </select>
        </div>
        <div class="field">
          <label for="refreshMinutes">بازه به‌روزرسانی خودکار (دقیقه)</label>
          <input id="refreshMinutes" name="refreshMinutes" type="number" min="1" max="60" value="${s.refreshMinutes || 5}" />
        </div>
        <h3>قیمت دستی (اختیاری، برای آفلاین)</h3>
        <div class="field">
          <label for="manualGold">طلا ۱۸ عیار — تومان / گرم</label>
          <input id="manualGold" name="manualGold" type="text" inputmode="decimal" value="${moneyVal(s.manualPrices?.gold)}" placeholder="خالی = قیمت آنلاین" data-money />
        </div>
        <div class="field">
          <label for="manualSilver">نقره — تومان / گرم</label>
          <input id="manualSilver" name="manualSilver" type="text" inputmode="decimal" value="${moneyVal(s.manualPrices?.silver)}" placeholder="خالی = قیمت آنلاین" data-money />
        </div>
        <div class="field">
          <label for="manualUsd">دلار — تومان</label>
          <input id="manualUsd" name="manualUsd" type="text" inputmode="decimal" value="${moneyVal(s.manualPrices?.usd)}" placeholder="خالی = قیمت آنلاین" data-money />
        </div>
        <div class="field">
          <label for="manualXau">انس جهانی طلا — دلار</label>
          <input id="manualXau" name="manualXau" type="text" inputmode="decimal" value="${moneyVal(s.manualPrices?.xau)}" placeholder="خالی = قیمت آنلاین" data-money />
        </div>
        <button type="submit" class="btn btn-block">ذخیره تنظیمات</button>
        <button type="button" class="btn btn-secondary btn-block" id="clear-manual">پاک کردن قیمت دستی</button>
      </form>
    </section>

    <section class="card">
      <h2>پشتیبان‌گیری</h2>
      <div class="form">
        <button type="button" class="btn btn-secondary btn-block" id="export-data">خروجی JSON</button>
        <button type="button" class="btn btn-secondary btn-block" id="import-data">واردات JSON</button>
        <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
        <button type="button" class="btn btn-danger btn-block" id="reset-data">پاک کردن همه داده‌ها</button>
      </div>
      <p class="muted" style="margin-top:12px">داده‌ها فقط روی همین مرورگر ذخیره می‌شوند.</p>
    </section>

    <section class="card">
      <h2>درباره</h2>
      <p class="muted">اپ کاملاً سمت‌کلاینت برای پیگیری طلا، نقره و دلار با قیمت بازار ایران.</p>
      <button type="button" class="btn btn-ghost" id="force-refresh" style="width:auto;padding:10px 14px">به‌روزرسانی قیمت الان</button>
    </section>
  `;

  enhanceMoneyInputs(root.querySelector('#settings-form'));

  root.querySelector('#settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const manual = {
      gold: parseMoneyInput(fd.get('manualGold')),
      silver: parseMoneyInput(fd.get('manualSilver')),
      usd: parseMoneyInput(fd.get('manualUsd')),
      xau: parseMoneyInput(fd.get('manualXau')),
    };
    const hasManual = Object.values(manual).some((v) => v != null && v > 0);
    const next = {
      ...state,
      settings: {
        silverPurity: String(fd.get('silverPurity')),
        refreshMinutes: Math.max(1, Number(fd.get('refreshMinutes')) || 5),
        manualPrices: hasManual ? manual : null,
      },
    };
    onChange(next);
    onRefreshPrices();
  });

  root.querySelector('#clear-manual')?.addEventListener('click', () => {
    onChange({
      ...state,
      settings: { ...state.settings, manualPrices: null },
    });
    onRefreshPrices();
  });

  root.querySelector('#export-data')?.addEventListener('click', () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealth-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = root.querySelector('#import-file');
  root.querySelector('#import-data')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importState(text);
      onChange(imported);
      alert('داده‌ها با موفقیت وارد شدند.');
    } catch (err) {
      alert(`واردات ناموفق بود: ${err.message}`);
    } finally {
      fileInput.value = '';
    }
  });

  root.querySelector('#reset-data')?.addEventListener('click', () => {
    if (confirm('همه خریدها، اهداف و تنظیمات پاک شوند؟')) {
      onChange(clearState());
    }
  });

  root.querySelector('#force-refresh')?.addEventListener('click', () => onRefreshPrices());
}
