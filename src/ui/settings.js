import {
  biometricSupported,
  changePin,
  clearBiometric,
  disableLock,
  enableLock,
  isLockEnabled,
  isPinValid,
  loadLockMeta,
  registerBiometric,
} from '../cryptoLock.js';
import { enhanceMoneyInputs, formatMoneyInput, parseMoneyInput } from '../moneyInput.js';
import { clearState, exportState, importState } from '../storage.js';
import { applyTheme, normalizeTheme } from '../theme.js';

function askPin(message) {
  const value = window.prompt(message, '');
  return value == null ? null : String(value).trim();
}

export function renderSettings(root, { state, onChange, onRefreshPrices }) {
  const s = state.settings;
  const theme = normalizeTheme(s.theme);
  const moneyVal = (v) => (v == null || v === '' ? '' : formatMoneyInput(v));
  const lockOn = isLockEnabled();
  const meta = loadLockMeta();
  const bioOn = Boolean(meta.biometric?.credentialId);
  const bioOk = biometricSupported();

  root.innerHTML = `
    <section class="card">
      <h2>امنیت</h2>
      <p class="muted" style="margin-top:0;line-height:1.7">
        قفل اختیاری است. با فعال‌سازی، دادهٔ دارایی با PIN رمزنگاری می‌شود.
        اثر انگشت فقط میانبر ورود در همان نشست است (پس از یک‌بار PIN).
      </p>
      ${
        lockOn
          ? `
            <div class="row"><span class="label">وضعیت قفل</span><span class="value positive">فعال</span></div>
            <div class="row"><span class="label">اثر انگشت</span><span class="value">${bioOn ? 'فعال' : 'خاموش'}</span></div>
            <div class="form" style="margin-top:12px">
              <button type="button" class="btn btn-secondary btn-block" id="change-pin">تغییر PIN</button>
              ${
                bioOk
                  ? bioOn
                    ? `<button type="button" class="btn btn-secondary btn-block" id="clear-bio">خاموش کردن اثر انگشت</button>`
                    : `<button type="button" class="btn btn-secondary btn-block" id="enable-bio">فعال‌سازی اثر انگشت / Face ID</button>`
                  : `<p class="muted">این مرورگر از بیومتریک پشتیبانی نمی‌کند.</p>`
              }
              <button type="button" class="btn btn-danger btn-block" id="disable-lock">خاموش کردن قفل</button>
            </div>
          `
          : `
            <div class="form">
              <button type="button" class="btn btn-block" id="enable-lock">فعال‌سازی قفل با PIN</button>
            </div>
          `
      }
    </section>

    <section class="card">
      <h2>ظاهر</h2>
      <div class="field">
        <label>تم</label>
        <div class="theme-seg" role="radiogroup" aria-label="تم">
          <label>
            <input type="radio" name="theme" value="light" ${theme === 'light' ? 'checked' : ''} />
            <span>روشن</span>
          </label>
          <label>
            <input type="radio" name="theme" value="dark" ${theme === 'dark' ? 'checked' : ''} />
            <span>تیره</span>
          </label>
          <label>
            <input type="radio" name="theme" value="auto" ${theme === 'auto' ? 'checked' : ''} />
            <span>خودکار</span>
          </label>
        </div>
      </div>
    </section>

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
      <p class="muted" style="margin-top:12px">خروجی JSON رمزنگاری‌نشده است؛ مراقب نگهداری‌اش باشید.</p>
    </section>

    <section class="card">
      <h2>درباره</h2>
      <p class="muted">اپ کاملاً سمت‌کلاینت برای پیگیری طلا، نقره و دلار با قیمت بازار ایران.</p>
      <button type="button" class="btn btn-ghost" id="force-refresh" style="width:auto;padding:10px 14px">به‌روزرسانی قیمت الان</button>
    </section>
  `;

  enhanceMoneyInputs(root.querySelector('#settings-form'));

  root.querySelector('#enable-lock')?.addEventListener('click', async () => {
    const pin = askPin('یک PIN ۴ تا ۸ رقمی انتخاب کنید:');
    if (pin == null) return;
    if (!isPinValid(pin)) {
      alert('PIN باید فقط عدد و بین ۴ تا ۸ رقم باشد');
      return;
    }
    const again = askPin('تکرار PIN:');
    if (again == null) return;
    if (pin !== again) {
      alert('PINها یکسان نیستند');
      return;
    }
    if (!confirm('با فعال‌سازی، داده‌ها رمزنگاری می‌شوند. PIN را فراموش نکنید؛ بازیابی ممکن نیست.')) {
      return;
    }
    try {
      await enableLock(pin, state);
      alert('قفل فعال شد');
      onChange(state);
    } catch (err) {
      alert(err.message || 'فعال‌سازی ناموفق بود');
    }
  });

  root.querySelector('#disable-lock')?.addEventListener('click', async () => {
    const pin = askPin('برای خاموش کردن قفل، PIN را وارد کنید:');
    if (pin == null) return;
    try {
      const unlockedState = await disableLock(pin);
      alert('قفل خاموش شد');
      onChange(unlockedState);
    } catch (err) {
      alert(err.message || 'خاموش کردن قفل ناموفق بود');
    }
  });

  root.querySelector('#change-pin')?.addEventListener('click', async () => {
    const oldPin = askPin('PIN فعلی:');
    if (oldPin == null) return;
    const newPin = askPin('PIN جدید (۴ تا ۸ رقم):');
    if (newPin == null) return;
    const again = askPin('تکرار PIN جدید:');
    if (again == null) return;
    if (newPin !== again) {
      alert('PINهای جدید یکسان نیستند');
      return;
    }
    try {
      await changePin(oldPin, newPin);
      alert('PIN تغییر کرد');
      onChange(state);
    } catch (err) {
      alert(err.message || 'تغییر PIN ناموفق بود');
    }
  });

  root.querySelector('#enable-bio')?.addEventListener('click', async () => {
    try {
      await registerBiometric();
      alert('اثر انگشت فعال شد');
      onChange(state);
    } catch (err) {
      alert(err.message || 'ثبت اثر انگشت ناموفق بود');
    }
  });

  root.querySelector('#clear-bio')?.addEventListener('click', async () => {
    if (!confirm('اثر انگشت خاموش شود؟')) return;
    await clearBiometric();
    alert('اثر انگشت خاموش شد');
    onChange(state);
  });

  root.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const nextTheme = normalizeTheme(radio.value);
      applyTheme(nextTheme);
      onChange({
        ...state,
        settings: { ...state.settings, theme: nextTheme },
      });
    });
  });

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
        ...state.settings,
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
      const imported = await importState(text);
      applyTheme(imported.settings?.theme);
      onChange(imported);
      alert('داده‌ها با موفقیت وارد شدند.');
    } catch (err) {
      alert(`واردات ناموفق بود: ${err.message}`);
    } finally {
      fileInput.value = '';
    }
  });

  root.querySelector('#reset-data')?.addEventListener('click', async () => {
    if (confirm('همه خریدها، اهداف و تنظیمات پاک شوند؟')) {
      const cleared = await clearState();
      applyTheme(cleared.settings.theme);
      onChange(cleared);
    }
  });

  root.querySelector('#force-refresh')?.addEventListener('click', () => onRefreshPrices());
}
