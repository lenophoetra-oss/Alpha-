const STORAGE_KEY_TRIAL = 'konter_pro_trial_license_v1';
export const TRIAL_DURATION_DAYS = 3;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000; // Default 72 Hours

export const ADMIN_OWNER_EMAIL = 'lenophoetra@gmail.com';
export const DEFAULT_ADMIN_WA = '081529285782';
export const DEFAULT_LICENSE_PRICE = 'Rp 150.000 (Aktif Selamanya)';
export const PUBLIC_SHARED_APP_URL =
  'https://ais-pre-mepg7bs4c56nwygjtymarj-965899113239.asia-east1.run.app';

export type LicenseStatusType = 'admin_owner' | 'full_activated' | 'trial_active' | 'trial_expired';

export interface TrialLicenseState {
  customerId: string;
  isTrialMode: boolean;
  trialStartedAt: number; // timestamp ms
  trialEndsAt: number; // timestamp ms
  isActivatedFull: boolean;
  activatedKey?: string;
  activatedAt?: number;
  adminWaNumber: string;
  licensePriceText: string;
  customShareUrl?: string;
  isOwnerDevice?: boolean;
  usedExtensionCodes: string[];
  // For owner simulation/testing
  ownerSimulation?: 'none' | 'simulate_trial' | 'simulate_expired';
  trialDurationMs?: number;
  configSyncedAt?: number;
}

/**
 * Formats a trial duration in ms into a clean label like "2 Menit", "1 Jam", "3 Hari", "7 Hari".
 */
export function formatTrialDurationLabel(durationMs?: number): string {
  const ms = durationMs && durationMs > 0 ? durationMs : TRIAL_DURATION_MS;
  const totalMinutes = Math.max(1, Math.round(ms / (60 * 1000)));
  if (totalMinutes % (24 * 60) === 0) {
    return `${totalMinutes / (24 * 60)} Hari`;
  }
  if (totalMinutes % 60 === 0) {
    return `${totalMinutes / 60} Jam`;
  }
  return `${totalMinutes} Menit`;
}

/**
 * Always resolves a public HTTPS URL that prospective customers can click in WhatsApp.
 * Never returns file:// (from Android APK WebView), null, localhost, or private ais-dev- URLs.
 */
export function getPublicAppBaseUrl(customUrl?: string): string {
  if (customUrl && /^https?:\/\//i.test(customUrl.trim())) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window === 'undefined') return PUBLIC_SHARED_APP_URL;
  const origin = window.location.origin || '';
  if (
    !origin ||
    origin === 'null' ||
    origin.startsWith('file:') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return PUBLIC_SHARED_APP_URL;
  }
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-').replace(/\/+$/, '');
  }
  return origin.replace(/\/+$/, '');
}

/**
 * Builds a clean, 100% WhatsApp-clickable HTTPS link for Free Trial with custom duration.
 * Avoids raw spaces or parentheses in URL query params so WhatsApp highlights the entire URL.
 */
export function buildCleanTrialShareUrl(
  adminWa: string,
  priceText?: string,
  customBaseUrl?: string,
  durationMs?: number
): string {
  const baseUrl = getPublicAppBaseUrl(customBaseUrl);
  const cleanWa = (adminWa || DEFAULT_ADMIN_WA).replace(/[^0-9+]/g, '') || DEFAULT_ADMIN_WA;
  const trimmedPrice = (priceText || '').trim();
  const dur = durationMs && durationMs > 0 ? durationMs : TRIAL_DURATION_MS;

  // If customBaseUrl is an external link (like Google Drive / MediaFire), return it directly
  if (
    customBaseUrl &&
    /^https?:\/\//i.test(customBaseUrl.trim()) &&
    !customBaseUrl.includes('.run.app')
  ) {
    return customBaseUrl.trim();
  }

  const baseParams = `trial=1&dur=${dur}&wa=${encodeURIComponent(cleanWa)}`;

  if (!trimmedPrice || trimmedPrice === DEFAULT_LICENSE_PRICE) {
    return `${baseUrl}/?${baseParams}`;
  }

  const safePrice = encodeURIComponent(trimmedPrice)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27')
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A');

  return `${baseUrl}/?${baseParams}&price=${safePrice}`;
}

/**
 * Builds a direct HTTPS download URL for the Customer Trial APK, embedding the configured duration & WA.
 */
export function buildDirectTrialApkDownloadUrl(
  customBaseUrl?: string,
  durationMs?: number,
  adminWa?: string
): string {
  const baseUrl = getPublicAppBaseUrl(customBaseUrl);
  if (
    customBaseUrl &&
    /^https?:\/\//i.test(customBaseUrl.trim()) &&
    !customBaseUrl.includes('.run.app')
  ) {
    return customBaseUrl.trim();
  }
  const dur = durationMs && durationMs > 0 ? durationMs : TRIAL_DURATION_MS;
  const cleanWa = (adminWa || DEFAULT_ADMIN_WA).replace(/[^0-9+]/g, '') || DEFAULT_ADMIN_WA;
  return `${baseUrl}/Kasir-Konter-Trial-3Hari-v3.0.apk?dur=${dur}&wa=${encodeURIComponent(cleanWa)}`;
}

/**
 * Syncs the Admin's chosen trial configuration to the backend server so any APK download
 * or trial device immediately receives the exact trial duration (e.g. 2 minutes, 1 hour, 7 days).
 */
export async function syncTrialConfigToServer(config: {
  trialDurationMs: number;
  adminWaNumber: string;
  licensePriceText: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({
    trialDurationMs: config.trialDurationMs,
    adminWaNumber: config.adminWaNumber,
    licensePriceText: config.licensePriceText,
  });

  const endpoints: string[] = [];
  if (window.location.protocol.startsWith('http')) {
    endpoints.push('/api/trial-config');
  }
  endpoints.push(`${PUBLIC_SHARED_APP_URL}/api/trial-config`);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.ok) return;
    } catch {
      // Try next endpoint
    }
  }
}

export async function fetchServerTrialConfig(): Promise<{
  trialDurationMs?: number;
  adminWaNumber?: string;
  licensePriceText?: string;
  updatedAt?: number;
} | null> {
  if (typeof window === 'undefined') return null;
  const endpoints: string[] = [];
  if (window.location.protocol.startsWith('http')) {
    endpoints.push(`/api/trial-config?t=${Date.now()}`);
  }
  endpoints.push(`${PUBLIC_SHARED_APP_URL}/api/trial-config?t=${Date.now()}`);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.trialDurationMs === 'number' && data.trialDurationMs > 0) {
          return data;
        }
      }
    } catch {
      // Ignore network errors when offline
    }
  }
  return null;
}

function generateRandomCustomerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 3; i++) {
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KGP-${part1}-${part2}`;
}

export function normalizeCustomerId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/**
 * Deterministic hash helper to generate & verify license keys without needing a central server.
 */
function computeSignature(input: string, secretSalt: string): string {
  const str = `${normalizeCustomerId(input)}::${secretSalt}`;
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  return `${hex1}-${hex2}`;
}

/**
 * Generates a Full Lifetime License Key for a given Customer ID
 */
export function generateLifetimeLicenseKey(customerId: string): string {
  const cleanId = normalizeCustomerId(customerId);
  if (!cleanId) return '';
  const sig = computeSignature(cleanId, 'KASIR_KONTER_GADAI_PRO_LIFETIME_2026');
  return `PRO-LFT-${sig}`;
}

/**
 * Generates a +3 Days Trial Extension Key for a given Customer ID
 */
export function generateExtendTrialKey(customerId: string, batchNumber = 1): string {
  const cleanId = normalizeCustomerId(customerId);
  if (!cleanId) return '';
  const sig = computeSignature(cleanId, `KASIR_KONTER_EXTEND_3DAYS_${batchNumber}`);
  return `TRL-3D${batchNumber}-${sig}`;
}

/**
 * Verifies a License Key or Extension Key entered by a customer
 */
export function verifyEnteredLicenseKey(
  customerId: string,
  enteredKey: string
): { valid: boolean; type?: 'lifetime' | 'extend_3days'; normalizedKey: string; message: string } {
  const cleanKey = enteredKey.trim().toUpperCase();
  const cleanId = normalizeCustomerId(customerId);

  // Check lifetime key for this customer ID or Master Owner Key
  const expectedLifetime = generateLifetimeLicenseKey(cleanId);
  if (
    cleanKey === expectedLifetime ||
    cleanKey === 'PRO-MASTER-UNLIMITED-2026' ||
    cleanKey === 'ADMIN-85782'
  ) {
    return {
      valid: true,
      type: 'lifetime',
      normalizedKey: cleanKey,
      message: 'Kode Lisensi Full Version valid! Aplikasi telah aktif selamanya.',
    };
  }

  // Check +3 days extension keys (batches 1..9)
  for (let b = 1; b <= 9; b++) {
    const expectedExt = generateExtendTrialKey(cleanId, b);
    if (cleanKey === expectedExt) {
      return {
        valid: true,
        type: 'extend_3days',
        normalizedKey: cleanKey,
        message: 'Kode Perpanjangan Trial +3 Hari valid! Masa percobaan ditambah 3 hari.',
      };
    }
  }

  return {
    valid: false,
    normalizedKey: cleanKey,
    message:
      'Kode aktivasi tidak sesuai dengan ID Pelanggan perangkat ini. Pastikan ID Pelanggan yang dikirim ke Admin sudah benar.',
  };
}

export function getConfiguredApkOrUrlTrialDurationMs(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const durParam = Number(params.get('dur'));
    if (durParam && durParam >= 10000) {
      return durParam;
    }
  } catch {
    // Ignore URL parse error
  }
  const apkDur = Number((window as any).__APK_DEFAULT_TRIAL_DURATION_MS__);
  if (apkDur && apkDur >= 10000) {
    return apkDur;
  }
  return undefined;
}

export function loadTrialLicenseState(): TrialLicenseState {
  const now = Date.now();
  const isTrialApkBuild =
    typeof window !== 'undefined' && Boolean((window as any).__APK_DEFAULT_TRIAL_MODE__);
  const apkAdminWa =
    typeof window !== 'undefined' && (window as any).__APK_DEFAULT_ADMIN_WA__
      ? String((window as any).__APK_DEFAULT_ADMIN_WA__)
      : DEFAULT_ADMIN_WA;
  const apkLicensePrice =
    typeof window !== 'undefined' && (window as any).__APK_DEFAULT_LICENSE_PRICE__
      ? String((window as any).__APK_DEFAULT_LICENSE_PRICE__)
      : DEFAULT_LICENSE_PRICE;
  const configuredDurationMs = getConfiguredApkOrUrlTrialDurationMs();
  const initialDurationMs = configuredDurationMs || TRIAL_DURATION_MS;

  const defaultState: TrialLicenseState = {
    customerId: generateRandomCustomerId(),
    isTrialMode: isTrialApkBuild,
    trialStartedAt: now,
    trialEndsAt: now + initialDurationMs,
    trialDurationMs: initialDurationMs,
    isActivatedFull: false,
    adminWaNumber: apkAdminWa,
    licensePriceText: apkLicensePrice,
    usedExtensionCodes: [],
    ownerSimulation: 'none',
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_TRIAL);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY_TRIAL, JSON.stringify(defaultState));
      return defaultState;
    }
    const parsed = JSON.parse(raw) as Partial<TrialLicenseState>;
    const savedWa =
      parsed.adminWaNumber && parsed.adminWaNumber !== '081234567890'
        ? parsed.adminWaNumber
        : apkAdminWa;
    const forceTrial =
      isTrialApkBuild && !parsed.isActivatedFull && !parsed.isOwnerDevice
        ? true
        : Boolean(parsed.isTrialMode);

    let startedAt = parsed.trialStartedAt || now;
    let durationMs = parsed.trialDurationMs || initialDurationMs;
    let endsAt = parsed.trialEndsAt || startedAt + durationMs;

    // If this is a Trial APK build (or opened with a specific ?dur= param) and the device was either:
    // 1) Not previously in trial mode (e.g. upgraded from an older APK), OR
    // 2) Configured with a new/different trial duration in the APK/URL
    if (
      forceTrial &&
      !parsed.isActivatedFull &&
      !parsed.isOwnerDevice &&
      (!parsed.isTrialMode ||
        (configuredDurationMs && parsed.trialDurationMs !== configuredDurationMs))
    ) {
      durationMs = configuredDurationMs || durationMs;
      startedAt = now;
      endsAt = now + durationMs;
    }

    const merged: TrialLicenseState = {
      ...defaultState,
      ...parsed,
      isTrialMode: forceTrial,
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
      trialDurationMs: durationMs,
      adminWaNumber: savedWa,
      customerId: parsed.customerId || defaultState.customerId,
      usedExtensionCodes: Array.isArray(parsed.usedExtensionCodes)
        ? parsed.usedExtensionCodes
        : [],
    };

    if (
      merged.isTrialMode !== parsed.isTrialMode ||
      merged.trialEndsAt !== parsed.trialEndsAt ||
      merged.trialDurationMs !== parsed.trialDurationMs
    ) {
      window.localStorage.setItem(STORAGE_KEY_TRIAL, JSON.stringify(merged));
    }

    return merged;
  } catch {
    return defaultState;
  }
}

export function saveTrialLicenseState(state: TrialLicenseState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_TRIAL, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save trial license state', e);
  }
}

export function startThreeDayTrial(
  customWa?: string,
  customPrice?: string,
  customDurationMs?: number
): TrialLicenseState {
  const current = loadTrialLicenseState();
  if (current.isActivatedFull || current.isOwnerDevice) {
    return current;
  }

  const now = Date.now();
  const configuredDur = customDurationMs || getConfiguredApkOrUrlTrialDurationMs();
  const duration = configuredDur || current.trialDurationMs || TRIAL_DURATION_MS;

  // Reset clock only if not already in trial mode OR if a new duration was explicitly passed via URL/APK config
  const isNewDurationConfig = Boolean(
    configuredDur && current.trialDurationMs && configuredDur !== current.trialDurationMs
  );
  const startedAt =
    current.isTrialMode && current.trialStartedAt && !isNewDurationConfig
      ? current.trialStartedAt
      : now;
  const endsAt =
    current.isTrialMode && current.trialEndsAt && !isNewDurationConfig
      ? Math.min(current.trialEndsAt, startedAt + duration)
      : startedAt + duration;

  const next: TrialLicenseState = {
    ...current,
    isTrialMode: true,
    isOwnerDevice: false,
    trialStartedAt: startedAt,
    trialEndsAt: endsAt,
    trialDurationMs: duration,
    adminWaNumber:
      customWa && customWa !== '081234567890'
        ? customWa
        : current.adminWaNumber || DEFAULT_ADMIN_WA,
    licensePriceText: customPrice || current.licensePriceText || DEFAULT_LICENSE_PRICE,
  };
  saveTrialLicenseState(next);
  return next;
}

export function evaluateLicenseStatus(
  state: TrialLicenseState,
  userEmail?: string | null,
  nowMs: number = Date.now()
): {
  status: LicenseStatusType;
  remainingMs: number;
  remainingText: string;
  isOwnerAccount: boolean;
} {
  const isOwnerAccount =
    (!!userEmail && userEmail.toLowerCase() === ADMIN_OWNER_EMAIL.toLowerCase()) ||
    Boolean(state.isOwnerDevice);

  const durationLabel = formatTrialDurationLabel(state.trialDurationMs);

  // Check if owner is testing the trial/expired screens
  if (
    isOwnerAccount ||
    state.ownerSimulation === 'simulate_trial' ||
    state.ownerSimulation === 'simulate_expired'
  ) {
    if (state.ownerSimulation === 'simulate_expired') {
      return {
        status: 'trial_expired',
        remainingMs: 0,
        remainingText: `Masa Trial ${durationLabel} Habis (Simulasi)`,
        isOwnerAccount: true,
      };
    }
    if (state.ownerSimulation === 'simulate_trial') {
      const rem = Math.max(0, state.trialEndsAt - nowMs);
      if (rem <= 0) {
        return {
          status: 'trial_expired',
          remainingMs: 0,
          remainingText: `Masa Trial ${durationLabel} Habis (Simulasi)`,
          isOwnerAccount: true,
        };
      }
      return {
        status: 'trial_active',
        remainingMs: rem,
        remainingText: formatRemainingDuration(rem),
        isOwnerAccount: true,
      };
    }
    if (isOwnerAccount) {
      return {
        status: 'admin_owner',
        remainingMs: Infinity,
        remainingText: 'Lisensi Utama (Owner)',
        isOwnerAccount: true,
      };
    }
  }

  if (state.isActivatedFull) {
    return {
      status: 'full_activated',
      remainingMs: Infinity,
      remainingText: 'Full Version Aktif Selamanya',
      isOwnerAccount: false,
    };
  }

  if (state.isTrialMode) {
    const remainingMs = Math.max(0, state.trialEndsAt - nowMs);
    if (remainingMs <= 0) {
      return {
        status: 'trial_expired',
        remainingMs: 0,
        remainingText: `Masa Trial ${durationLabel} Habis`,
        isOwnerAccount: false,
      };
    }
    return {
      status: 'trial_active',
      remainingMs,
      remainingText: formatRemainingDuration(remainingMs),
      isOwnerAccount: false,
    };
  }

  // Default for non-trial local or normal mode unless trial is triggered
  return {
    status: 'full_activated',
    remainingMs: Infinity,
    remainingText: 'Aktif',
    isOwnerAccount: false,
  };
}

export function formatRemainingDuration(ms: number): string {
  if (ms <= 0) return '0 Menit 0 Detik';
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days} Hari ${hours} Jam ${minutes} Menit`;
  }
  if (hours > 0) {
    return `${hours} Jam ${minutes} Menit ${seconds} Detik`;
  }
  return `${minutes} Menit ${seconds} Detik`;
}
