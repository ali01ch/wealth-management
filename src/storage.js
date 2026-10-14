import {
  STORAGE_KEY,
  getMemoryDek,
  isLockEnabled,
  isUnlocked,
  loadDecryptedState,
  saveEncryptedState,
} from './cryptoLock.js';

export { STORAGE_KEY };

const DEFAULT_STATE = {
  purchases: [],
  goals: [],
  settings: {
    silverPurity: '999',
    refreshMinutes: 5,
    manualPrices: null,
    theme: 'auto',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePurchases(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    ...item,
    kind: item?.kind === 'sell' ? 'sell' : 'buy',
  }));
}

export function normalizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return clone(DEFAULT_STATE);
  return {
    purchases: normalizePurchases(parsed.purchases),
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    settings: {
      ...DEFAULT_STATE.settings,
      ...(parsed.settings || {}),
    },
  };
}

/** بارگذاری همگام فقط وقتی قفل نیست یا داده plaintext است */
export function loadState() {
  try {
    if (typeof localStorage === 'undefined') return clone(DEFAULT_STATE);
    if (isLockEnabled() && !isUnlocked()) {
      return clone(DEFAULT_STATE);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (parsed?.enc) {
      // نباید به اینجا برسیم بدون unlock؛ احتیاطاً خالی
      return clone(DEFAULT_STATE);
    }
    return normalizeState(parsed);
  } catch {
    return clone(DEFAULT_STATE);
  }
}

export async function loadStateAsync() {
  return loadDecryptedState(normalizeState);
}

export async function saveState(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (isLockEnabled()) {
      if (!getMemoryDek()) {
        throw new Error('برای ذخیره باید قفل باز باشد');
      }
      await saveEncryptedState(state);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export async function importState(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || parsed.enc) {
    throw new Error('فرمت فایل نامعتبر است');
  }
  const state = normalizeState(parsed);
  await saveState(state);
  return state;
}

export async function clearState() {
  const empty = clone(DEFAULT_STATE);
  if (isLockEnabled()) {
    if (!getMemoryDek()) {
      throw new Error('برای پاک کردن داده باید قفل باز باشد');
    }
    await saveEncryptedState(empty);
    return empty;
  }
  localStorage.removeItem(STORAGE_KEY);
  return empty;
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export { DEFAULT_STATE };
