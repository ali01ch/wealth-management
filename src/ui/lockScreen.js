import {
  isBiometricUnlockReady,
  isPinValid,
  unlockWithBiometric,
  unlockWithPin,
} from '../cryptoLock.js';

export function showLockScreen() {
  return new Promise((resolve) => {
    const bioOnly = isBiometricUnlockReady();

    const backdrop = document.createElement('div');
    backdrop.className = 'lock-screen';
    backdrop.innerHTML = bioOnly
      ? `
      <div class="lock-card card">
        <h2>قفل برنامه</h2>
        <p class="muted">برای ورود از اثر انگشت یا Face ID استفاده کنید.</p>
        <p class="alert hidden" id="lock-error"></p>
        <button type="button" class="btn btn-block" id="lock-bio">ورود با اثر انگشت / Face ID</button>
        <p class="muted" style="margin-top:12px;font-size:0.78rem;line-height:1.6">
          اثر انگشت برای ورود فعال است؛ PIN فقط از تنظیمات برای مدیریت امنیت استفاده می‌شود.
        </p>
      </div>
    `
      : `
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
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.classList.add('app-locked');
    const errEl = backdrop.querySelector('#lock-error');
    let busy = false;

    const showMessage = (msg, soft = false) => {
      errEl.textContent = msg;
      errEl.classList.toggle('info', soft);
      errEl.classList.remove('hidden');
    };

    const finish = () => {
      backdrop.remove();
      document.body.classList.remove('app-locked');
      resolve(true);
    };

    if (bioOnly) {
      const tryBio = async () => {
        if (busy) return;
        busy = true;
        errEl.classList.add('hidden');
        errEl.classList.remove('info');
        const btn = backdrop.querySelector('#lock-bio');
        if (btn) btn.disabled = true;
        try {
          await unlockWithBiometric();
          finish();
        } catch (err) {
          const cancelled = err?.code === 'BIO_CANCELLED';
          showMessage(err.message || 'اثر انگشت ناموفق بود', cancelled);
        } finally {
          busy = false;
          if (btn) btn.disabled = false;
        }
      };
      backdrop.querySelector('#lock-bio')?.addEventListener('click', tryBio);
      setTimeout(() => {
        tryBio();
      }, 250);
      return;
    }

    const pinInput = backdrop.querySelector('#lock-pin');
    pinInput?.focus();

    backdrop.querySelector('#lock-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = pinInput.value;
      if (!isPinValid(pin)) {
        showMessage('PIN باید ۴ تا ۸ رقم باشد');
        return;
      }
      try {
        await unlockWithPin(pin);
        finish();
      } catch (err) {
        showMessage(err.message || 'ورود ناموفق بود');
      }
    });
  });
}
