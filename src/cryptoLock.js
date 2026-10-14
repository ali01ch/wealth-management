/**
 * قفل اختیاری با PIN + رمزنگاری AES-GCM.
 * اگر اثر انگشت فعال باشد، ورود فقط با بیومتریک است (کلید باز کردن روی دستگاه ذخیره می‌شود).
 * PIN برای فعال/خاموش کردن قفل و مدیریت امنیت در تنظیمات است.
 */

export const LOCK_META_KEY = 'wealth-lock-v1';
export const STORAGE_KEY = 'wealth-management-v1';
const SESSION_DEK_KEY = 'wealth-session-dek';
const ITERATIONS = 310000;

let memoryDek = null; // CryptoKey while unlocked

function bufToB64(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function b64ToBuf(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out.buffer;
}

export function isPinValid(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}

export function loadLockMeta() {
  try {
    const raw = localStorage.getItem(LOCK_META_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export function saveLockMeta(meta) {
  localStorage.setItem(LOCK_META_KEY, JSON.stringify(meta));
}

export function clearLockMeta() {
  localStorage.removeItem(LOCK_META_KEY);
}

export function isLockEnabled() {
  return Boolean(loadLockMeta().enabled);
}

export function isUnlocked() {
  return memoryDek != null;
}

export function lockSession() {
  memoryDek = null;
  try {
    sessionStorage.removeItem(SESSION_DEK_KEY);
  } catch {
    /* ignore */
  }
}

async function deriveKey(pin, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(pin)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function exportRawKey(key) {
  return crypto.subtle.exportKey('raw', key);
}

async function importRawKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function makeVerifier(key) {
  const raw = await exportRawKey(key);
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return bufToB64(digest);
}

export async function encryptPayload(plaintextObj, dek) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextObj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, encoded);
  return {
    v: 1,
    enc: true,
    iv: bufToB64(iv),
    data: bufToB64(cipher),
  };
}

export async function decryptPayload(blob, dek) {
  if (!blob?.enc || !blob.iv || !blob.data) {
    throw new Error('دادهٔ رمزشده نامعتبر است');
  }
  const iv = new Uint8Array(b64ToBuf(blob.iv));
  const data = b64ToBuf(blob.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

function rememberSessionDek(dek) {
  memoryDek = dek;
  exportRawKey(dek)
    .then((raw) => {
      try {
        sessionStorage.setItem(SESSION_DEK_KEY, bufToB64(raw));
      } catch {
        /* ignore */
      }
    })
    .catch(() => {});
}

export async function restoreSessionDek() {
  if (memoryDek) return true;
  try {
    const b64 = sessionStorage.getItem(SESSION_DEK_KEY);
    if (!b64) return false;
    memoryDek = await importRawKey(b64ToBuf(b64));
    return true;
  } catch {
    return false;
  }
}

export function getMemoryDek() {
  return memoryDek;
}

export async function unlockWithPin(pin) {
  const meta = loadLockMeta();
  if (!meta.enabled || !meta.salt || !meta.verifier) {
    throw new Error('قفل فعال نیست');
  }
  if (!isPinValid(pin)) {
    throw new Error('PIN باید ۴ تا ۸ رقم باشد');
  }
  const salt = b64ToBuf(meta.salt);
  const dek = await deriveKey(pin, salt);
  const verifier = await makeVerifier(dek);
  if (verifier !== meta.verifier) {
    throw new Error('PIN نادرست است');
  }
  rememberSessionDek(dek);
  return dek;
}

export async function enableLock(pin, currentState) {
  if (!isPinValid(pin)) {
    throw new Error('PIN باید ۴ تا ۸ رقم باشد');
  }
  if (!window.isSecureContext || !crypto?.subtle) {
    throw new Error('برای قفل به HTTPS و مرورگر امن نیاز است');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const dek = await deriveKey(pin, salt);
  const verifier = await makeVerifier(dek);
  const encrypted = await encryptPayload(currentState, dek);
  const prevTheme = currentState?.settings?.theme || 'auto';

  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
  saveLockMeta({
    enabled: true,
    salt: bufToB64(salt),
    verifier,
    iterations: ITERATIONS,
    uiTheme: prevTheme,
    biometric: null,
    createdAt: new Date().toISOString(),
  });
  rememberSessionDek(dek);
}

export async function disableLock(pin) {
  const dek = await unlockWithPin(pin);
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = JSON.parse(raw || '{}');
  let state;
  if (parsed?.enc) {
    state = await decryptPayload(parsed, dek);
  } else {
    state = parsed;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  clearLockMeta();
  lockSession();
  return state;
}

export async function changePin(oldPin, newPin) {
  if (!isPinValid(newPin)) {
    throw new Error('PIN جدید باید ۴ تا ۸ رقم باشد');
  }
  const dek = await unlockWithPin(oldPin);
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = JSON.parse(raw || '{}');
  const state = parsed?.enc ? await decryptPayload(parsed, dek) : parsed;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nextDek = await deriveKey(newPin, salt);
  const verifier = await makeVerifier(nextDek);
  const encrypted = await encryptPayload(state, nextDek);
  const meta = loadLockMeta();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
  const nextMeta = {
    ...meta,
    enabled: true,
    salt: bufToB64(salt),
    verifier,
    iterations: ITERATIONS,
  };
  if (meta.biometric?.credentialId) {
    const raw = await exportRawKey(nextDek);
    nextMeta.biometric = {
      ...meta.biometric,
      bioDek: bufToB64(raw),
    };
  }
  saveLockMeta(nextMeta);
  rememberSessionDek(nextDek);
}

export async function saveEncryptedState(state) {
  if (!memoryDek) {
    throw new Error('نشست قفل است');
  }
  const encrypted = await encryptPayload(state, memoryDek);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
  const meta = loadLockMeta();
  if (meta.enabled) {
    saveLockMeta({
      ...meta,
      uiTheme: state?.settings?.theme || meta.uiTheme || 'auto',
    });
  }
}

export function readStorageRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadDecryptedState(normalizeFn) {
  const raw = readStorageRaw();
  if (!raw) return normalizeFn(null);
  if (raw.enc) {
    if (!memoryDek) throw new Error('LOCKED');
    const state = await decryptPayload(raw, memoryDek);
    return normalizeFn(state);
  }
  return normalizeFn(raw);
}

export function biometricSupported() {
  return Boolean(
    window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function',
  );
}

export async function registerBiometric() {
  if (!biometricSupported()) {
    throw new Error('این دستگاه/مرورگر از اثر انگشت پشتیبانی نمی‌کند');
  }
  if (!memoryDek) {
    throw new Error('ابتدا با PIN وارد شوید');
  }
  const meta = loadLockMeta();
  if (!meta.enabled) {
    throw new Error('ابتدا قفل PIN را فعال کنید');
  }

  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'دارایی من',
        id: location.hostname === 'localhost' ? 'localhost' : location.hostname,
      },
      user: {
        id: userId,
        name: 'wealth-local-user',
        displayName: 'کاربر محلی',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  });

  if (!cred) throw new Error('ثبت اثر انگشت لغو شد');
  const id = bufToB64(cred.rawId);
  const rawDek = await exportRawKey(memoryDek);
  saveLockMeta({
    ...meta,
    biometric: {
      credentialId: id,
      bioDek: bufToB64(rawDek),
      registeredAt: new Date().toISOString(),
    },
  });
  return true;
}

export function isBiometricUnlockReady() {
  const meta = loadLockMeta();
  return Boolean(
    meta.enabled &&
      meta.biometric?.credentialId &&
      meta.biometric?.bioDek &&
      biometricSupported(),
  );
}

export async function clearBiometric() {
  const meta = loadLockMeta();
  saveLockMeta({ ...meta, biometric: null });
}

export async function unlockWithBiometric() {
  const meta = loadLockMeta();
  if (!meta.enabled || !meta.biometric?.credentialId) {
    throw new Error('اثر انگشت فعال نیست');
  }
  if (!meta.biometric.bioDek) {
    throw new Error('اثر انگشت ناقص است؛ از تنظیمات دوباره فعالش کنید');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allow = [
    {
      type: 'public-key',
      id: b64ToBuf(meta.biometric.credentialId),
    },
  ];
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: allow,
      userVerification: 'required',
      timeout: 60000,
    },
  });
  if (!assertion) {
    throw new Error('احراز هویت لغو شد');
  }

  const dek = await importRawKey(b64ToBuf(meta.biometric.bioDek));
  const verifier = await makeVerifier(dek);
  if (verifier !== meta.verifier) {
    throw new Error('کلید اثر انگشت منقضی شده؛ دوباره از تنظیمات فعال کنید');
  }
  rememberSessionDek(dek);
  return dek;
}
