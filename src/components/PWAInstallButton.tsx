import React, { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Download, Check, Loader2 } from 'lucide-react';
import { downloadSignedApk } from '../utils/apkDownloader';
import { loadTrialLicenseState } from '../utils/trialLicense';
import { isRunningInAndroidApk } from '../services/localDb';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline || isRunningInAndroidApk()) return null;

  return (
    <div className="bg-amber-600 text-white text-xs font-medium px-4 py-1.5 text-center">
      Mode Offline Aktif — Perubahan data disimpan di perangkat dan akan disinkronkan saat koneksi kembali.
    </div>
  );
};

export const PWAInstallButton: React.FC<{
  compact?: boolean;
  fullWidth?: boolean;
  label?: string;
  forceTrialApk?: boolean;
}> = ({ compact = false, fullWidth = false, label, forceTrialApk }) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'done'>('idle');

  if (isRunningInAndroidApk() && !forceTrialApk) {
    return null;
  }

  const handleDownloadApk = async () => {
    if (status === 'downloading') return;
    setStatus('downloading');
    try {
      const lic = loadTrialLicenseState();
      const useTrialApk =
        forceTrialApk !== undefined
          ? forceTrialApk
          : Boolean(lic.isTrialMode && !lic.isActivatedFull && !lic.isOwnerDevice);
      await downloadSignedApk({ trialMode: useTrialApk });
      setStatus('done');
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('idle');
    }
  };

  const baseClass = compact
    ? 'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer shrink-0'
    : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer shrink-0';

  return (
    <button
      type="button"
      onClick={handleDownloadApk}
      title="Download Aplikasi Android Terbaru v3.0 (Kasir-Konter-Gadai-Pro-v3.0.apk)"
      className={`${baseClass} ${fullWidth ? 'w-full' : ''}`}
    >
      {status === 'downloading' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{compact ? 'Menyiapkan v3.0...' : 'Menyiapkan & Mengunduh APK v3.0...'}</span>
        </>
      ) : status === 'done' ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>{compact ? 'v3.0 Terunduh!' : 'APK v3.0 Terunduh — Buka & Install'}</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          <span>
            {label
              ? label
              : compact
                ? 'Download APK v3.0'
                : 'Download APK Android v3.0 (.apk)'}
          </span>
        </>
      )}
    </button>
  );
};
