const STORAGE_KEY = 'wealth-management-v1';

const DEFAULT_STATE = {
  purchases: [],
  goals: [],
  settings: {
    silverPurity: '999',
    refreshMinutes: 5,
    manualPrices: null,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadState() {
  try {
    if (typeof localStorage === 'undefined') return clone(DEFAULT_STATE);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      settings: {
        ...DEFAULT_STATE.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch {
    return clone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('فرمت فایل نامعتبر است');
  }
  const state = {
    purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    settings: {
      ...DEFAULT_STATE.settings,
      ...(parsed.settings || {}),
    },
  };
  saveState(state);
  return state;
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  return clone(DEFAULT_STATE);
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
