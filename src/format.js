const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const faDecimal = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function toman(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${faNumber.format(Math.round(n))} تومان`;
}

export function number(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${faDecimal.format(n)}٪`;
}

export function dateFa(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export function pnlClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? 'positive' : 'negative';
}
