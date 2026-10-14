import {
  ASSET_META,
  availableQuantity,
  portfolioValue,
  summarizeHoldings,
  validateTransactions,
} from '../calc.js';
import { escapeHtml } from '../escape.js';
import { number, pnlClass, toman } from '../format.js';
import { formatJalaliLong, todayGregorianIso } from '../jalali.js';
import { enhanceMoneyInputs, formatMoneyInput, parseMoneyInput } from '../moneyInput.js';
import { createId } from '../storage.js';
import { mountJalaliDatePicker } from './jalaliDatePicker.js';

function txKind(tx) {
  return tx?.kind === 'sell' ? 'sell' : 'buy';
}

function transactionFormHtml(tx = null) {
  const p = tx || {
    kind: 'buy',
    asset: 'gold',
    quantity: '',
    unitPrice: '',
    date: todayGregorianIso(),
    note: '',
  };
  const kind = txKind(p);
  return `
    <form class="form" id="purchase-form">
      <div class="field">
        <label for="kind">نوع معامله</label>
        <select id="kind" name="kind" required>
          <option value="buy" ${kind === 'buy' ? 'selected' : ''}>خرید</option>
          <option value="sell" ${kind === 'sell' ? 'selected' : ''}>فروش</option>
        </select>
      </div>
      <div class="field">
        <label for="asset">نوع دارایی</label>
        <select id="asset" name="asset" required>
          <option value="gold" ${p.asset === 'gold' ? 'selected' : ''}>طلا ۱۸ عیار (گرم)</option>
          <option value="silver" ${p.asset === 'silver' ? 'selected' : ''}>نقره (گرم)</option>
          <option value="usd" ${p.asset === 'usd' ? 'selected' : ''}>دلار</option>
        </select>
      </div>
      <p class="muted" id="available-hint" style="margin:0"></p>
      <div class="field">
        <label for="quantity">مقدار</label>
        <input id="quantity" name="quantity" type="text" inputmode="decimal" required value="${escapeHtml(p.quantity === '' || p.quantity == null ? '' : formatMoneyInput(p.quantity))}" data-money />
      </div>
      <div class="field">
        <label for="unitPrice" id="unit-price-label">${kind === 'sell' ? 'قیمت فروش هر واحد (تومان)' : 'قیمت خرید هر واحد (تومان)'}</label>
        <input id="unitPrice" name="unitPrice" type="text" inputmode="decimal" required value="${escapeHtml(p.unitPrice === '' || p.unitPrice == null ? '' : formatMoneyInput(p.unitPrice))}" data-money />
      </div>
      <div class="field">
        <label for="date">تاریخ معامله (شمسی)</label>
        <input id="date" name="date" type="text" required value="${escapeHtml(p.date || todayGregorianIso())}" />
      </div>
      <div class="field">
        <label for="note">یادداشت (اختیاری)</label>
        <textarea id="note" name="note" placeholder="مثلاً فروش به صرافی">${escapeHtml(p.note || '')}</textarea>
      </div>
      <button type="submit" class="btn btn-block">${tx ? 'ذخیره تغییرات' : 'ثبت معامله'}</button>
      <button type="button" class="btn btn-secondary btn-block" data-close-modal>انصراف</button>
    </form>
  `;
}

function openModal(title, html) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal"><h3>${title}</h3>${html}</div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close-modal]')) close();
  });
  return { backdrop, close };
}

export function renderPurchases(root, { state, onChange, prices }) {
  const holdings = summarizeHoldings(state.purchases);
  const portfolio = portfolioValue(state.purchases, prices);
  const sorted = [...state.purchases].sort((a, b) => {
    const byDate = String(b.date).localeCompare(String(a.date));
    if (byDate !== 0) return byDate;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  root.innerHTML = `
    <section class="card">
      <div class="section-title">
        <h2 style="margin:0">موجودی فعلی</h2>
        <button type="button" class="btn btn-sm" id="add-tx">+ معامله</button>
      </div>
      <div class="row"><span class="label">طلا</span><span class="value">${number(holdings.gold.qty)} گرم</span></div>
      <div class="row"><span class="label">نقره</span><span class="value">${number(holdings.silver.qty)} گرم</span></div>
      <div class="row"><span class="label">دلار</span><span class="value">${number(holdings.usd.qty)} دلار</span></div>
      <div class="row">
        <span class="label">سود/زیان تحقق‌یافته</span>
        <span class="value ${pnlClass(portfolio.realizedPnl)}">${toman(portfolio.realizedPnl)}</span>
      </div>
    </section>

    <section class="list" id="purchase-list">
      ${
        sorted.length === 0
          ? `<div class="empty card">هنوز معامله‌ای ثبت نشده. خرید یا فروش اضافه کنید.</div>`
          : sorted
              .map((p) => {
                const meta = ASSET_META[p.asset] || ASSET_META.gold;
                const kind = txKind(p);
                const amount = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
                const kindLabel = kind === 'sell' ? 'فروش' : 'خرید';
                return `
                <article class="list-item" data-id="${p.id}">
                  <div class="list-item-header">
                    <div>
                      <span class="badge badge-kind-${kind}">${kindLabel}</span>
                      <span class="badge badge-${p.asset}">${meta.label}</span>
                      <div class="value" style="margin-top:8px;text-align:right">
                        ${number(p.quantity)} ${meta.unit}
                      </div>
                    </div>
                    <div class="value ${kind === 'sell' ? 'negative' : 'positive'}">${kind === 'sell' ? '−' : '+'}${toman(amount)}</div>
                  </div>
                  <div class="muted">قیمت واحد: ${toman(p.unitPrice)}</div>
                  <div class="muted">تاریخ: ${formatJalaliLong(p.date)}</div>
                  ${p.note ? `<div class="muted">${escapeHtml(p.note)}</div>` : ''}
                  <div class="list-item-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">ویرایش</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${p.id}">حذف</button>
                  </div>
                </article>
              `;
              })
              .join('')
      }
    </section>
  `;

  const persist = (nextPurchases) => {
    const check = validateTransactions(nextPurchases);
    if (!check.ok) {
      alert(check.error || 'این مجموعه معاملات معتبر نیست.');
      return false;
    }
    onChange({ ...state, purchases: nextPurchases });
    return true;
  };

  const openEditor = (tx = null) => {
    const { backdrop, close } = openModal(
      tx ? 'ویرایش معامله' : 'معامله جدید',
      transactionFormHtml(tx),
    );
    const form = backdrop.querySelector('#purchase-form');
    enhanceMoneyInputs(form);
    const dateInput = form.querySelector('#date');
    const kindSelect = form.querySelector('#kind');
    const assetSelect = form.querySelector('#asset');
    const priceLabel = form.querySelector('#unit-price-label');
    const availableHint = form.querySelector('#available-hint');

    mountJalaliDatePicker(dateInput, {
      initialIso: tx?.date || todayGregorianIso(),
    });

    const refreshHints = () => {
      const kind = kindSelect.value === 'sell' ? 'sell' : 'buy';
      const asset = assetSelect.value;
      priceLabel.textContent =
        kind === 'sell' ? 'قیمت فروش هر واحد (تومان)' : 'قیمت خرید هر واحد (تومان)';
      if (kind === 'sell') {
        const avail = availableQuantity(state.purchases, asset, tx?.id || null);
        const meta = ASSET_META[asset];
        availableHint.textContent = `موجودی قابل فروش: ${number(avail)} ${meta.unit}`;
        availableHint.classList.remove('hidden');
      } else {
        availableHint.textContent = '';
      }
    };

    kindSelect.addEventListener('change', refreshHints);
    assetSelect.addEventListener('change', refreshHints);
    refreshHints();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        id: tx?.id || createId(),
        kind: String(fd.get('kind')) === 'sell' ? 'sell' : 'buy',
        asset: String(fd.get('asset')),
        quantity: parseMoneyInput(fd.get('quantity')) ?? 0,
        unitPrice: parseMoneyInput(fd.get('unitPrice')) ?? 0,
        date: String(fd.get('date') || dateInput.dataset.iso || todayGregorianIso()),
        note: String(fd.get('note') || '').trim(),
      };
      if (!(next.quantity > 0) || !(next.unitPrice >= 0)) return;

      const nextList = tx
        ? state.purchases.map((p) => (p.id === tx.id ? next : p))
        : [next, ...state.purchases];

      if (!persist(nextList)) return;
      close();
    });
  };

  root.querySelector('#add-tx')?.addEventListener('click', () => openEditor());

  root.querySelector('#purchase-list')?.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
    if (editId) {
      const item = state.purchases.find((p) => p.id === editId);
      if (item) openEditor(item);
    }
    if (deleteId) {
      if (confirm('این معامله حذف شود؟')) {
        persist(state.purchases.filter((p) => p.id !== deleteId));
      }
    }
  });
}
