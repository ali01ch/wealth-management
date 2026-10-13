import { analyzeGoal, formatMonths, portfolioValue } from '../calc.js';
import { escapeHtml } from '../escape.js';
import { number, toman } from '../format.js';
import { createId } from '../storage.js';

function goalFormHtml(goal = null) {
  const g = goal || {
    title: '',
    targetToman: '',
    monthlySavings: '',
  };
  return `
    <form class="form" id="goal-form">
      <div class="field">
        <label for="title">عنوان هدف</label>
        <input id="title" name="title" required placeholder="مثلاً خرید خانه" value="${escapeHtml(g.title || '')}" />
      </div>
      <div class="field">
        <label for="targetToman">مبلغ هدف (تومان)</label>
        <input id="targetToman" name="targetToman" type="number" inputmode="decimal" min="0" required value="${g.targetToman || ''}" />
      </div>
      <div class="field">
        <label for="monthlySavings">پس‌انداز ماهانه (تومان، اختیاری)</label>
        <input id="monthlySavings" name="monthlySavings" type="number" inputmode="decimal" min="0" value="${g.monthlySavings || ''}" placeholder="برای تخمین زمان" />
      </div>
      <button type="submit" class="btn btn-block">${goal ? 'ذخیره تغییرات' : 'افزودن هدف'}</button>
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

export function renderGoals(root, { state, prices, onChange }) {
  const portfolio = portfolioValue(state.purchases, prices);

  root.innerHTML = `
    <section class="card">
      <div class="section-title">
        <h2 style="margin:0">اهداف</h2>
        <button type="button" class="btn btn-sm" id="add-goal">+ هدف جدید</button>
      </div>
      <p class="muted" style="margin:10px 0 0">
        ارزش فعلی دارایی‌ها: ${toman(portfolio.totalValue)}
      </p>
    </section>

    <section class="list" id="goal-list">
      ${
        state.goals.length === 0
          ? `<div class="empty card">هدفی ندارید. مثلاً قیمت خانه را به‌عنوان هدف ثبت کنید.</div>`
          : state.goals
              .map((goal) => {
                const a = analyzeGoal(goal, portfolio, prices);
                const timeLabel = formatMonths(a.monthsEstimate);
                return `
                <article class="list-item" data-id="${goal.id}">
                  <div class="list-item-header">
                    <div>
                      <div class="value" style="text-align:right">${escapeHtml(goal.title)}</div>
                      <div class="muted">هدف: ${toman(a.target)}</div>
                    </div>
                    <span class="badge">${number(a.progress, 1)}٪</span>
                  </div>
                  <div class="progress"><span style="width:${a.progress}%"></span></div>
                  ${
                    a.reached
                      ? `<p class="positive">به این هدف رسیده‌اید.</p>`
                      : `
                        <div class="row"><span class="label">باقی‌مانده</span><span class="value">${toman(a.remaining)}</span></div>
                        <div class="row"><span class="label">معادل طلا</span><span class="value">${a.needed.goldGrams != null ? `${number(a.needed.goldGrams)} گرم` : '—'}</span></div>
                        <div class="row"><span class="label">معادل نقره</span><span class="value">${a.needed.silverGrams != null ? `${number(a.needed.silverGrams)} گرم` : '—'}</span></div>
                        <div class="row"><span class="label">معادل دلار</span><span class="value">${a.needed.usdAmount != null ? `${number(a.needed.usdAmount)} دلار` : '—'}</span></div>
                        ${
                          timeLabel
                            ? `<div class="row"><span class="label">تخمین زمان</span><span class="value">${timeLabel}</span></div>`
                            : `<p class="muted">برای تخمین زمان، پس‌انداز ماهانه را در ویرایش هدف وارد کنید.</p>`
                        }
                      `
                  }
                  <div class="list-item-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${goal.id}">ویرایش</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${goal.id}">حذف</button>
                  </div>
                </article>
              `;
              })
              .join('')
      }
    </section>
  `;

  const persist = (goals) => onChange({ ...state, goals });

  const openEditor = (goal = null) => {
    const { backdrop, close } = openModal(goal ? 'ویرایش هدف' : 'هدف جدید', goalFormHtml(goal));
    const form = backdrop.querySelector('#goal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        id: goal?.id || createId(),
        title: String(fd.get('title') || '').trim(),
        targetToman: Number(fd.get('targetToman')),
        monthlySavings: Number(fd.get('monthlySavings') || 0),
      };
      if (!next.title || !(next.targetToman > 0)) return;
      if (goal) {
        persist(state.goals.map((g) => (g.id === goal.id ? next : g)));
      } else {
        persist([next, ...state.goals]);
      }
      close();
    });
  };

  root.querySelector('#add-goal')?.addEventListener('click', () => openEditor());
  root.querySelector('#goal-list')?.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
    if (editId) {
      const goal = state.goals.find((g) => g.id === editId);
      if (goal) openEditor(goal);
    }
    if (deleteId && confirm('این هدف حذف شود؟')) {
      persist(state.goals.filter((g) => g.id !== deleteId));
    }
  });
}
