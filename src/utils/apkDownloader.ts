import { PUBLIC_SHARED_APP_URL, TRIAL_DURATION_MS, DEFAULT_ADMIN_WA } from './trialLicense';

/**
 * Downloads the full standalone + cloud signed Android Package
 * - Admin / Full Version: Kasir-Konter-Gadai-Pro-v3.1.apk
 * - Customer Trial Version: Kasir-Konter-Trial-3Hari-v3.1.apk
 * Package: id.kasirkonter.gadaipro (Version 3.1.0, versionCode 7)
 */
export const CURRENT_APK_VERSION = '3.1';
export const CURRENT_APK_FILENAME = 'Kasir-Konter-Gadai-Pro-v3.1.apk';
export const TRIAL_APK_FILENAME = 'Kasir-Konter-Trial-3Hari-v3.1.apk';

export async function downloadSignedApk(options?: {
  trialMode?: boolean;
  durationMs?: number;
  adminWa?: string;
  priceText?: string;
}): Promise<void> {
  const isTrial = Boolean(options?.trialMode);
  const fileName = isTrial ? TRIAL_APK_FILENAME : CURRENT_APK_FILENAME;
  const endpointPath = isTrial ? '/download-apk-trial' : '/download-apk';

  const queryParts: string[] = ['v=3.1.0'];
  if (isTrial) {
    const dur = options?.durationMs && options.durationMs > 0 ? options.durationMs : TRIAL_DURATION_MS;
    const wa = (options?.adminWa || DEFAULT_ADMIN_WA).replace(/[^0-9+]/g, '') || DEFAULT_ADMIN_WA;
    queryParts.push(`dur=${dur}`);
    queryParts.push(`wa=${encodeURIComponent(wa)}`);
    if (options?.priceText) {
      queryParts.push(`price=${encodeURIComponent(options.priceText.trim())}`);
    }
  }
  queryParts.push(`t=${Date.now()}`);
  const fullQuery = queryParts.join('&');

  // If running inside the installed Android APK WebView (file://), open the public HTTPS download URL in system browser
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || Boolean((window as any).__IS_ANDROID_APK__))
  ) {
    const publicApkUrl = `${PUBLIC_SHARED_APP_URL}${endpointPath}?${fullQuery}`;
    try {
      window.prompt(publicApkUrl);
      return;
    } catch {
      // Fallback
    }
  }

  // Unregister any stale service workers and clear old caches that could intercept binary .apk downloads
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await window.caches.keys();
      for (const name of cacheNames) {
        await window.caches.delete(name);
      }
    }
  } catch {
    // Ignore service worker/cache cleanup errors
  }

  try {
    const response = await fetch(`${endpointPath}?${fullQuery}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    // Verify we received the actual ZIP/APK binary (starts with 'PK' 0x50 0x4B)
    const header = new Uint8Array(arrayBuffer.slice(0, 2));
    if (header[0] !== 0x50 || header[1] !== 0x4b || arrayBuffer.byteLength < 100000) {
      throw new Error('Invalid APK header');
    }

    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.android.package-archive',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 6000);
  } catch {
    // Direct attachment endpoint with Content-Disposition: attachment
    const link = document.createElement('a');
    link.href = `${endpointPath}?${fullQuery}`;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
    }, 2500);
  }
}
