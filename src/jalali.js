import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';

const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toGregorianIso(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export function fromGregorianIso(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return toJalaali(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function todayGregorianIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatJalaliDisplay(iso) {
  const j = fromGregorianIso(iso);
  if (!j) return '—';
  return `${toFaDigits(j.jy)}/${toFaDigits(pad(j.jm))}/${toFaDigits(pad(j.jd))}`;
}

export function formatJalaliLong(iso) {
  const j = fromGregorianIso(iso);
  if (!j) return '—';
  return `${toFaDigits(j.jd)} ${MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
}

export function toFaDigits(value) {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

export function monthLabel(jy, jm) {
  return `${MONTHS[jm - 1]} ${toFaDigits(jy)}`;
}

export function monthDays(jy, jm) {
  return jalaaliMonthLength(jy, jm);
}

/** شنبه=۰ … جمعه=۶ */
export function weekdayIndex(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  const js = new Date(g.gy, g.gm - 1, g.gd).getDay(); // Sun=0
  return (js + 1) % 7;
}

export function shiftMonth(jy, jm, delta) {
  let m = jm + delta;
  let y = jy;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { jy: y, jm: m };
}

export { MONTHS, WEEKDAYS };
