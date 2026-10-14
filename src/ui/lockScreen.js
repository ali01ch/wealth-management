import {
  biometricSupported,
  isPinValid,
  loadLockMeta,
  unlockWithBiometric,
  unlockWithPin,
} from '../cryptoLock.js';

export function showLockScreen() {
  return new Promise((resolve) => {
    const meta = loadLockMeta();
    const hasBio = Boolean(meta.biometric?.credentialId) && biometricSupported();

    const backdrop = document.createElement('div');
    backdrop.className = 'lock-screen';
    backdrop.innerHTML = `
      <div class="lock-card card">
        <h2>قفل برنامه</h2>
        <p class="muted">برای ادامه PIN خود را وارد کنید.</p>
        <form class="form" id="lock-form">
          <div class="field">
            <label for="lock-pin">PIN</label>
            <input id="lock-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" required placeholder="۴ تا ۸ رقم" />
          </div>
          <p class="alert hidden" id="lock-error"></p>
          <button type="submit" class="btn btn-block">ورود</button>
          ${
            hasBio
              ? `<button type="button" class="btn btn-secondary btn-block" id="lock-bio">ورود با اثر انگشت / Face ID</button>`
              : ''
          }
        </form>
        <p class="muted" style="margin-top:12px;font-size:0.78rem;line-height:1.6">
          دادهٔ دارایی با PIN رمزنگاری شده است. اثر انگشت فقط پس از یک‌بار ورود با PIN در همین نشست کار می‌کند.
        </p>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.classList.add('app-locked');
    const pinInput = backdrop.querySelector('#lock-pin');
    const errEl = backdrop.querySelector('#lock-error');
    pinInput?.focus();

    const showError = (msg) => {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    };

    const finish = () => {
      backdrop.remove();
      document.body.classList.remove('app-locked');
      resolve(true);
    };

    backdrop.querySelector('#lock-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = pinInput.value;
      if (!isPinValid(pin)) {
        showError('PIN باید ۴ تا ۸ رقم باشد');
        return;
      }
      try {
        await unlockWithPin(pin);
        finish();
      } catch (err) {
        showError(err.message || 'ورود ناموفق بود');
      }
    });

    backdrop.querySelector('#lock-bio')?.addEventListener('click', async () => {
      try {
        await unlockWithBiometric();
        finish();
      } catch (err) {
        showError(err.message || 'اثر انگشت ناموفق بود');
      }
    });
  });
}
