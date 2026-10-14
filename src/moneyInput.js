/**
 * جداکننده سه‌رقمی زنده برای فیلدهای مبلغ.
 * جداکننده هزارگان: U+066C (٬)
 * جداکننده اعشار: نقطه (.)
 */

/** ARABIC THOUSANDS SEPARATOR */
export const THOUSANDS_SEP = '\u066C';
/** Decimal separator */
export const DECIMAL_SEP = '.';

export function parseMoneyInput(value) {
  if (value == null || value === '') return null;
  const normalized = String(value)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/٫/g, '.')
    .replace(new RegExp(`[${THOUSANDS_SEP},]`, 'g'), '')
    .replace(/[^\d.]/g, '');

  if (!normalized) return null;

  const parts = normalized.split('.');
  const intPart = parts[0] || '0';
  const decPart = parts.length > 1 ? parts.slice(1).join('').replace(/\./g, '') : '';
  const raw = decPart ? `${intPart}.${decPart}` : intPart;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyInput(value, { allowDecimal = true } = {}) {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseMoneyInput(value);
  if (n == null || !Number.isFinite(n)) return '';

  const negative = n < 0;
  const abs = Math.abs(n);
  const [intRaw, decRaw] = String(abs).split('.');
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);

  let text = intFormatted;
  if (allowDecimal && decRaw != null && decRaw !== '') {
    text += `${DECIMAL_SEP}${decRaw}`;
  }
  return negative ? `-${text}` : text;
}

function caretOffsetFromEnd(input) {
  return input.value.length - (input.selectionStart ?? input.value.length);
}

function setCaretFromEnd(input, fromEnd) {
  const pos = Math.max(0, input.value.length - fromEnd);
  input.setSelectionRange(pos, pos);
}

/**
 * @param {HTMLInputElement} input
 * @param {{ allowDecimal?: boolean }} [options]
 */
export function enhanceMoneyInput(input, { allowDecimal = true } = {}) {
  if (!input || input.dataset.moneyEnhanced === '1') return;
  input.dataset.moneyEnhanced = '1';
  input.type = 'text';
  input.setAttribute('inputmode', allowDecimal ? 'decimal' : 'numeric');
  input.setAttribute('autocomplete', 'off');
  input.classList.add('money-input');

  if (input.value !== '') {
    input.value = formatMoneyInput(input.value, { allowDecimal });
  }

  input.addEventListener('input', () => {
    const fromEnd = caretOffsetFromEnd(input);
    const stripped = String(input.value).replace(new RegExp(`[${THOUSANDS_SEP},]`, 'g'), '');
    const trailingDecimal = allowDecimal && /\.$/.test(stripped);
    let formatted = formatMoneyInput(input.value, { allowDecimal });
    if (trailingDecimal && formatted !== '' && !formatted.endsWith('.')) {
      formatted += '.';
    }
    if (input.value !== formatted) {
      input.value = formatted;
      setCaretFromEnd(input, fromEnd);
    }
  });

  input.addEventListener('blur', () => {
    const n = parseMoneyInput(input.value);
    input.value = n == null ? '' : formatMoneyInput(n, { allowDecimal });
  });
}

/** همه inputهای با data-money داخل root */
export function enhanceMoneyInputs(root) {
  root?.querySelectorAll('input[data-money]')?.forEach((el) => {
    const allowDecimal = el.getAttribute('data-money') !== 'int';
    enhanceMoneyInput(el, { allowDecimal });
  });
}
