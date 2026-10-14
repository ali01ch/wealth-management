import {
  WEEKDAYS,
  formatJalaliLong,
  fromGregorianIso,
  monthDays,
  monthLabel,
  shiftMonth,
  toFaDigits,
  toGregorianIso,
  todayGregorianIso,
  weekdayIndex,
} from '../jalali.js';

/**
 * تبدیل input متنی به datepicker شمسی.
 * مقدار ذخیره‌شده در data-iso و hidden input به صورت میلادی YYYY-MM-DD است.
 */
export function mountJalaliDatePicker(input, { initialIso } = {}) {
  const iso = initialIso || input.value || todayGregorianIso();
  input.type = 'text';
  input.readOnly = true;
  input.classList.add('jalali-date-input');
  input.setAttribute('inputmode', 'none');
  input.dataset.iso = iso;
  input.value = formatJalaliLong(iso);

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = input.name;
  hidden.value = iso;
  input.removeAttribute('name');
  input.after(hidden);

  const open = () => openSheet(input, hidden);
  input.addEventListener('click', open);
  input.addEventListener('focus', (e) => {
    e.target.blur();
    open();
  });

  return {
    getIso: () => hidden.value,
    destroy: () => {
      input.removeEventListener('click', open);
    },
  };
}

function openSheet(displayInput, hiddenInput) {
  if (document.querySelector('.jalali-sheet-backdrop')) return;

  let selected = fromGregorianIso(hiddenInput.value) || fromGregorianIso(todayGregorianIso());
  let view = { jy: selected.jy, jm: selected.jm };

  const backdrop = document.createElement('div');
  backdrop.className = 'jalali-sheet-backdrop';
  backdrop.innerHTML = `
    <div class="jalali-sheet" role="dialog" aria-label="انتخاب تاریخ شمسی">
      <div class="jalali-sheet-handle"></div>
      <div class="jalali-sheet-header">
        <button type="button" class="btn btn-ghost jalali-nav" data-nav="-1" aria-label="ماه قبل">‹</button>
        <div class="jalali-month-label"></div>
        <button type="button" class="btn btn-ghost jalali-nav" data-nav="1" aria-label="ماه بعد">›</button>
      </div>
      <div class="jalali-weekdays"></div>
      <div class="jalali-grid"></div>
      <div class="jalali-sheet-actions">
        <button type="button" class="btn btn-secondary" data-today>امروز</button>
        <button type="button" class="btn" data-confirm>تأیید</button>
      </div>
    </div>
  `;

  const weekdaysEl = backdrop.querySelector('.jalali-weekdays');
  weekdaysEl.innerHTML = WEEKDAYS.map((d) => `<span>${d}</span>`).join('');

  const labelEl = backdrop.querySelector('.jalali-month-label');
  const gridEl = backdrop.querySelector('.jalali-grid');

  const render = () => {
    labelEl.textContent = monthLabel(view.jy, view.jm);
    const days = monthDays(view.jy, view.jm);
    const start = weekdayIndex(view.jy, view.jm, 1);
    const cells = [];
    for (let i = 0; i < start; i += 1) cells.push('<span class="jalali-day empty"></span>');
    for (let d = 1; d <= days; d += 1) {
      const isSelected =
        selected.jy === view.jy && selected.jm === view.jm && selected.jd === d;
      const today = fromGregorianIso(todayGregorianIso());
      const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
      cells.push(
        `<button type="button" class="jalali-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}" data-day="${d}">${toFaDigits(d)}</button>`,
      );
    }
    gridEl.innerHTML = cells.join('');
  };

  render();
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 180);
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view = shiftMonth(view.jy, view.jm, Number(btn.dataset.nav));
      render();
    });
  });

  gridEl.addEventListener('click', (e) => {
    const day = e.target.closest('[data-day]')?.dataset.day;
    if (!day) return;
    selected = { jy: view.jy, jm: view.jm, jd: Number(day) };
    render();
  });

  backdrop.querySelector('[data-today]')?.addEventListener('click', () => {
    selected = fromGregorianIso(todayGregorianIso());
    view = { jy: selected.jy, jm: selected.jm };
    render();
  });

  backdrop.querySelector('[data-confirm]')?.addEventListener('click', () => {
    const iso = toGregorianIso(selected.jy, selected.jm, selected.jd);
    hiddenInput.value = iso;
    displayInput.dataset.iso = iso;
    displayInput.value = formatJalaliLong(iso);
    close();
  });
}
