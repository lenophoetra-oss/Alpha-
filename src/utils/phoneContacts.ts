/**
 * Unified Phone Contacts Picker & Parser for Android APK, Chrome Android (Contact Picker API),
 * Clipboard Smart-Parse, and vCard (.vcf) Contact Import.
 */

export interface PickedContact {
  name: string;
  phone: string;
  source: 'android_apk' | 'web_contacts_api' | 'vcard' | 'clipboard';
}

declare global {
  interface Window {
    __IS_ANDROID_APK__?: boolean;
    __onAndroidContactPicked?: (encodedName: string, encodedPhone: string) => void;
  }
}

/**
 * Normalizes Indonesian phone numbers from Contacts (e.g. "+62 812-3456-7890" -> "081234567890")
 */
export function normalizeContactPhone(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+62')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('62') && cleaned.length >= 10) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Opens the native Phone Contacts picker on the user's Android device:
 * 1. In the installed Android APK: invokes MainActivity's native Intent.ACTION_PICK
 *    (content://com.android.contacts/data/phones) via ChromeClient.onJsPrompt bridge.
 * 2. In Chrome Android (HTTPS / PWA): invokes navigator.contacts.select(['name', 'tel']).
 */
export async function pickPhoneContactFromDevice(): Promise<{
  contact: PickedContact | null;
  status: 'picked' | 'cancelled' | 'unsupported' | 'blocked_iframe';
  message?: string;
}> {
  // 1. Native Android APK Bridge (MainActivity + ChromeClient in classes.dex)
  if (
    typeof window !== 'undefined' &&
    (window.__IS_ANDROID_APK__ || window.location.protocol === 'file:')
  ) {
    return new Promise((resolve) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({
            contact: null,
            status: 'cancelled',
          });
        }
      }, 60000);

      window.__onAndroidContactPicked = (encName: string, encPhone: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        try {
          const decodedName = decodeURIComponent(encName || '').trim();
          const decodedPhone = normalizeContactPhone(decodeURIComponent(encPhone || '').trim());
          if (!decodedName && !decodedPhone) {
            resolve({ contact: null, status: 'cancelled' });
            return;
          }
          resolve({
            contact: {
              name: decodedName || 'Pelanggan Kontak',
              phone: decodedPhone,
              source: 'android_apk',
            },
            status: 'picked',
            message: 'Kontak berhasil diambil dari Kontak Telepon HP.',
          });
        } catch {
          resolve({ contact: null, status: 'cancelled' });
        }
      };

      // Trigger ChromeClient.onJsPrompt -> MainActivity.onBridgeCmd("PICK_CONTACT")
      try {
        window.prompt('PICK_CONTACT');
      } catch {
        window.clearTimeout(timeoutId);
        settled = true;
        resolve({
          contact: null,
          status: 'unsupported',
          message: 'Gagal membuka pemilih kontak telepon.',
        });
      }
    });
  }

  // 2. Web Contact Picker API (Chrome on Android)
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav && 'contacts' in nav && typeof window !== 'undefined' && 'ContactsManager' in window) {
    try {
      const contacts = await nav.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const picked = contacts[0];
        const rawName = (picked.name && picked.name[0]) ? String(picked.name[0]).trim() : '';
        const rawTel = (picked.tel && picked.tel[0]) ? String(picked.tel[0]).trim() : '';
        const normalizedPhone = normalizeContactPhone(rawTel);

        return {
          contact: {
            name: rawName || 'Pelanggan Kontak',
            phone: normalizedPhone,
            source: 'web_contacts_api',
          },
          status: 'picked',
          message: 'Kontak berhasil diambil dari Kontak Telepon HP.',
        };
      }
      return { contact: null, status: 'cancelled' };
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'InvalidStateError') {
        return { contact: null, status: 'cancelled' };
      }
      // SecurityError happens when inside a cross-origin preview iframe
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (inIframe || err?.name === 'SecurityError') {
        return {
          contact: null,
          status: 'blocked_iframe',
          message:
            'Browser membatasi akses Kontak langsung di dalam khung pratinjau (iframe). Gunakan Aplikasi Android (.APK), buka link penuh di Chrome HP, atau gunakan tombol Impor File Kontak (.vcf) / Tempel Clipboard di bawah.',
        };
      }
      return {
        contact: null,
        status: 'unsupported',
        message: 'Gagal mengakses Kontak Telepon. Gunakan opsi Impor Kontak (.vcf) atau Tempel Nomor.',
      };
    }
  }

  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  return {
    contact: null,
    status: inIframe ? 'blocked_iframe' : 'unsupported',
    message:
      'Untuk membuka Kontak Telepon langsung dengan 1 ketukan, jalankan di Aplikasi Android (.APK) atau Chrome HP Android. Anda juga bisa memilih file kontak (.vcf) atau menempel nomor di bawah.',
  };
}

/**
 * Parses a vCard (.vcf) file exported/shared from Android/iOS Contacts
 */
export function parseVCardText(vcfText: string): PickedContact[] {
  const results: PickedContact[] = [];
  if (!vcfText) return results;

  const cards = vcfText.split(/BEGIN:VCARD/i);
  for (const rawCard of cards) {
    if (!/END:VCARD/i.test(rawCard)) continue;
    const lines = rawCard.split(/\r?\n/);
    let name = '';
    let phone = '';

    for (const line of lines) {
      if (/^FN[;:]/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        if (val) name = val;
      } else if (!name && /^N[;:]/i.test(line)) {
        const parts = line
          .split(':')
          .slice(1)
          .join(':')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          name = parts.reverse().join(' ');
        }
      } else if (!phone && /^TEL[;:]/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        const normalized = normalizeContactPhone(val);
        if (normalized) phone = normalized;
      }
    }

    if (name || phone) {
      results.push({
        name: name || 'Pelanggan Kontak',
        phone,
        source: 'vcard',
      });
    }
  }
  return results;
}

/**
 * Parses clipboard text containing a contact name and/or phone number
 * e.g. "Budi Santoso 0812-3456-7890" or "+62 812 3456 7890"
 */
export function parseClipboardContact(text: string): PickedContact | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const phoneMatch = trimmed.match(/(\+?62|0)[\d\s\-()]{8,16}/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[0];
    const phone = normalizeContactPhone(rawPhone);
    const namePart = trimmed
      .replace(rawPhone, '')
      .replace(/[,:;|\-()]+/g, ' ')
      .trim();
    return {
      name: namePart || '',
      phone,
      source: 'clipboard',
    };
  }

  return {
    name: trimmed,
    phone: '',
    source: 'clipboard',
  };
}
