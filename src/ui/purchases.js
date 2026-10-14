import { ASSET_META, summarizeHoldings } from '../calc.js';
import { escapeHtml } from '../escape.js';
import { number, toman } from '../format.js';
import { formatJalaliLong, todayGregorianIso } from '../jalali.js';
import { enhanceMoneyInputs, formatMoneyInput, parseMoneyInput } from '../moneyInput.js';
import { createId } from '../storage.js';
import { mountJalaliDatePicker } from './jalaliDatePicker.js';

function purchaseFormHtml(purchase = null) {
  const p = purchase || {
    asset: 'gold',
    quantity: '',
    unitPrice: '',
    date: todayGregorianIso(),
    note: '',
  };
  return `
    <form class="form" id="purchase-form">
      <div class="field">
        <label for="asset">نوع دارایی</label>
        <select id="asset" name="asset" required>
          <option value="gold" ${p.asset === 'gold' ? 'selected' : ''}>طلا ۱۸ عیار (گرم)</option>
          <option value="silver" ${p.asset === 'silver' ? 'selected' : ''}>نقره (گرم)</option>
          <option value="usd" ${p.asset === 'usd' ? 'selected' : ''}>دلار</option>
        </select>
      </div>
      <div class="field">
        <label for="quantity">مقدار</label>
        <input id="quantity" name="quantity" type="text" inputmode="decimal" required value="${escapeHtml(p.quantity === '' || p.quantity == null ? '' : formatMoneyInput(p.quantity))}" data-money />
      </div>
      <div class="field">
        <label for="unitPrice">قیمت خرید هر واحد (تومان)</label>
        <input id="unitPrice" name="unitPrice" type="text" inputmode="decimal" required value="${escapeHtml(p.unitPrice === '' || p.unitPrice == null ? '' : formatMoneyInput(p.unitPrice))}" data-money />
      </div>
      <div class="field">
        <label for="date">تاریخ خرید (شمسی)</label>
        <input id="date" name="date" type="text" required value="${escapeHtml(p.date || todayGregorianIso())}" />
      </div>
      <div class="field">
        <label for="note">یادداشت (اختیاری)</label>
        <textarea id="note" name="note" placeholder="مثلاً خرید از بازار">${escapeHtml(p.note || '')}</textarea>
      </div>
      <button type="submit" class="btn btn-block">${purchase ? 'ذخیره تغییرات' : 'افزودن خرید'}</button>
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

export function renderPurchases(root, { state, onChange }) {
  const holdings = summarizeHoldings(state.purchases);
  const sorted = [...state.purchases].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  root.innerHTML = `
    <section class="card">
      <div class="section-title">
        <h2 style="margin:0">موجودی فعلی</h2>
        <button type="button" class="btn btn-sm" id="add-purchase">+ خرید جدید</button>
      </div>
      <div class="row"><span class="label">طلا</span><span class="value">${number(holdings.gold.qty)} گرم</span></div>
      <div class="row"><span class="label">نقره</span><span class="value">${number(holdings.silver.qty)} گرم</span></div>
      <div class="row"><span class="label">دلار</span><span class="value">${number(holdings.usd.qty)} دلار</span></div>
    </section>

    <section class="list" id="purchase-list">
      ${
        sorted.length === 0
          ? `<div class="empty card">هنوز خریدی ثبت نشده. اولین خرید را اضافه کنید.</div>`
          : sorted
              .map((p) => {
                const meta = ASSET_META[p.asset] || ASSET_META.gold;
                const cost = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
                return `
                <article class="list-item" data-id="${p.id}">
                  <div class="list-item-header">
                    <div>
                      <span class="badge badge-${p.asset}">${meta.label}</span>
                      <div class="value" style="margin-top:8px;text-align:right">
                        ${number(p.quantity)} ${meta.unit}
                      </div>
                    </div>
                    <div class="value">${toman(cost)}</div>
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
    onChange({ ...state, purchases: nextPurchases });
  };

  const openEditor = (purchase = null) => {
    const { backdrop, close } = openModal(
      purchase ? 'ویرایش خرید' : 'خرید جدید',
      purchaseFormHtml(purchase),
    );
    const form = backdrop.querySelector('#purchase-form');
    enhanceMoneyInputs(form);
    const dateInput = form.querySelector('#date');
    mountJalaliDatePicker(dateInput, {
      initialIso: purchase?.date || todayGregorianIso(),
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        id: purchase?.id || createId(),
        asset: String(fd.get('asset')),
        quantity: parseMoneyInput(fd.get('quantity')) ?? 0,
        unitPrice: parseMoneyInput(fd.get('unitPrice')) ?? 0,
        date: String(fd.get('date') || dateInput.dataset.iso || todayGregorianIso()),
        note: String(fd.get('note') || '').trim(),
      };
      if (!(next.quantity > 0) || !(next.unitPrice >= 0)) return;
      if (purchase) {
        persist(state.purchases.map((p) => (p.id === purchase.id ? next : p)));
      } else {
        persist([next, ...state.purchases]);
      }
      close();
    });
  };

  root.querySelector('#add-purchase')?.addEventListener('click', () => openEditor());

  root.querySelector('#purchase-list')?.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
    if (editId) {
      const purchase = state.purchases.find((p) => p.id === editId);
      if (purchase) openEditor(purchase);
    }
    if (deleteId) {
      if (confirm('این خرید حذف شود؟')) {
        persist(state.purchases.filter((p) => p.id !== deleteId));
      }
    }
  });
}
