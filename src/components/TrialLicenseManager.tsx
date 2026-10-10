import React, { useState, useEffect } from 'react';
import {
  TrialLicenseState,
  TRIAL_DURATION_MS,
  DEFAULT_ADMIN_WA,
  DEFAULT_LICENSE_PRICE,
  verifyEnteredLicenseKey,
  generateLifetimeLicenseKey,
  generateExtendTrialKey,
  normalizeCustomerId,
  buildCleanTrialShareUrl,
  buildDirectTrialApkDownloadUrl,
  formatRemainingDuration,
  formatTrialDurationLabel,
  syncTrialConfigToServer,
  fetchServerTrialConfig,
  evaluateLicenseStatus,
} from '../utils/trialLicense';
import { downloadSignedApk } from '../utils/apkDownloader';
import { buildWhatsAppUrl } from '../types';
import {
  Clock,
  KeyRound,
  ShieldCheck,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  Lock,
  Share2,
  Eye,
  RotateCcw,
  Download,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface TrialCountdownBannerProps {
  licenseState: TrialLicenseState;
  remainingText: string;
  isOwnerSimulation: boolean;
  onUpdateLicenseState: (next: TrialLicenseState) => void;
}

export const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({
  licenseState,
  remainingText,
  isOwnerSimulation,
  onUpdateLicenseState,
}) => {
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const durationLabel = formatTrialDurationLabel(licenseState.trialDurationMs);

  const handleCopyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(licenseState.customerId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleVerifyKey = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyEnteredLicenseKey(licenseState.customerId, keyInput);
    if (!res.valid) {
      setFeedback({ ok: false, text: res.message });
      return;
    }

    if (res.type === 'lifetime') {
      const next: TrialLicenseState = {
        ...licenseState,
        isActivatedFull: true,
        isTrialMode: false,
        activatedKey: res.normalizedKey,
        activatedAt: Date.now(),
        ownerSimulation: 'none',
      };
      onUpdateLicenseState(next);
      setFeedback({ ok: true, text: res.message });
      setTimeout(() => setShowActivateModal(false), 1200);
    } else if (res.type === 'extend_3days') {
      if (licenseState.usedExtensionCodes.includes(res.normalizedKey)) {
        setFeedback({
          ok: false,
          text: 'Kode perpanjangan 3 hari ini sudah pernah digunakan sebelumnya.',
        });
        return;
      }
      const baseTime = Math.max(Date.now(), licenseState.trialEndsAt);
      const next: TrialLicenseState = {
        ...licenseState,
        trialEndsAt: baseTime + TRIAL_DURATION_MS,
        usedExtensionCodes: [...licenseState.usedExtensionCodes, res.normalizedKey],
        ownerSimulation: 'none',
      };
      onUpdateLicenseState(next);
      setFeedback({ ok: true, text: res.message });
      setTimeout(() => setShowActivateModal(false), 1200);
    }
  };

  const waOrderUrl = buildWhatsAppUrl(
    licenseState.adminWaNumber,
    `Halo Admin, saya sedang mencoba *Trial Gratis (${durationLabel})* aplikasi *Kasir Konter & Gadai Pro* dan ingin membeli *Kode Aktivasi Full Version*.\n\nID Pelanggan saya: *${licenseState.customerId}*`
  );

  return (
    <>
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-5 py-2 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider shrink-0">
              <Clock className="w-3 h-3" />
              Trial {durationLabel}
            </span>
            <span className="font-medium text-slate-800 truncate">
              Sisa Waktu: <strong className="font-mono-tabular">{remainingText}</strong> · ID:{' '}
              <strong className="font-mono-tabular">{licenseState.customerId}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isOwnerSimulation && (
              <button
                type="button"
                onClick={() =>
                  onUpdateLicenseState({ ...licenseState, ownerSimulation: 'none' })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
              >
                Matikan Simulasi
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setKeyInput('');
                setFeedback(null);
                setShowActivateModal(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
            >
              <KeyRound className="w-3 h-3 text-amber-400" />
              <span>Masukkan Kode Lisensi</span>
            </button>
          </div>
        </div>
      </div>

      {showActivateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowActivateModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Aktivasi Full Version / Perpanjang Trial
              </h3>
              <button
                type="button"
                onClick={() => setShowActivateModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300">ID Pelanggan Perangkat Anda:</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Tersalin' : 'Salin ID'}</span>
                </button>
              </div>
              <div className="text-base font-bold font-mono-tabular tracking-wider text-amber-400">
                {licenseState.customerId}
              </div>
              <div className="text-[11px] text-slate-300">
                Sisa Masa Percobaan Gratis: <strong className="text-white">{remainingText}</strong>
              </div>
            </div>

            <form onSubmit={handleVerifyKey} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kode Lisensi / Kode Aktivasi dari Admin
                </label>
                <input
                  type="text"
                  required
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: PRO-LFT-XXXX-XXXX"
                  className="w-full px-3 py-2.5 text-sm font-mono-tabular uppercase border border-slate-300 rounded-xl"
                />
              </div>

              {feedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium ${
                    feedback.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={waOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl text-center"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Beli Kode via WA Admin</span>
                </a>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Aktifkan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

interface TrialExpiredLockScreenProps {
  licenseState: TrialLicenseState;
  isOwnerSimulation: boolean;
  statsSummary: {
    walletsCount: number;
    phonesCount: number;
    transactionsCount: number;
  };
  onUpdateLicenseState: (next: TrialLicenseState) => void;
  onExitTrialToLogin?: () => void;
}

export const TrialExpiredLockScreen: React.FC<TrialExpiredLockScreenProps> = ({
  licenseState,
  isOwnerSimulation,
  statsSummary,
  onUpdateLicenseState,
  onExitTrialToLogin,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  const durationLabel = formatTrialDurationLabel(licenseState.trialDurationMs);

  const handleCopyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(licenseState.customerId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const res = verifyEnteredLicenseKey(licenseState.customerId, keyInput);
    if (!res.valid) {
      setErrorMsg(res.message);
      return;
    }

    if (res.type === 'lifetime') {
      setSuccessMsg(res.message);
      setTimeout(() => {
        onUpdateLicenseState({
          ...licenseState,
          isActivatedFull: true,
          isTrialMode: false,
          activatedKey: res.normalizedKey,
          activatedAt: Date.now(),
          ownerSimulation: 'none',
        });
      }, 800);
    } else if (res.type === 'extend_3days') {
      if (licenseState.usedExtensionCodes.includes(res.normalizedKey)) {
        setErrorMsg('Kode perpanjangan 3 hari ini sudah pernah digunakan sebelumnya.');
        return;
      }
      setSuccessMsg(res.message);
      setTimeout(() => {
        onUpdateLicenseState({
          ...licenseState,
          trialEndsAt: Date.now() + TRIAL_DURATION_MS,
          usedExtensionCodes: [...licenseState.usedExtensionCodes, res.normalizedKey],
          ownerSimulation: 'none',
        });
      }, 800);
    }
  };

  const waUrl = buildWhatsAppUrl(
    licenseState.adminWaNumber,
    `Halo Admin, masa *Trial Gratis (${durationLabel})* aplikasi *Kasir Konter & Gadai Pro* saya sudah berakhir. Saya ingin memesan *Kode Lisensi Full Version*.\n\nID Pelanggan saya: *${licenseState.customerId}*`
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#152036] border border-slate-700/80 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Masa Trial {durationLabel} Berakhir
          </span>
          {isOwnerSimulation && (
            <button
              type="button"
              onClick={() =>
                onUpdateLicenseState({ ...licenseState, ownerSimulation: 'none' })
              }
              className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Matikan Simulasi
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Terima Kasih Telah Mencoba Kasir Konter & Gadai Pro
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Masa uji coba gratis <strong>{durationLabel}</strong> untuk perangkat ini telah selesai dan aplikasi otomatis terkunci. Seluruh data yang sudah Anda input tetap <strong>100% aman tersimpan</strong> dan siap dilanjutkan setelah aktivasi.
          </p>
        </div>

        {/* Data Tersimpan Aman */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#0b111e] border border-slate-800 text-center">
          <div>
            <div className="text-sm font-bold font-mono-tabular text-emerald-400">
              {statsSummary.walletsCount}
            </div>
            <div className="text-[10px] text-slate-400">Kantong Kas</div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono-tabular text-sky-400">
              {statsSummary.phonesCount}
            </div>
            <div className="text-[10px] text-slate-400">Stok Unit HP</div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono-tabular text-amber-400">
              {statsSummary.transactionsCount}
            </div>
            <div className="text-[10px] text-slate-400">Transaksi</div>
          </div>
        </div>

        {/* Box ID Pelanggan */}
        <div className="p-3.5 rounded-2xl bg-[#0b111e] border border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">ID Pelanggan Perangkat Anda:</span>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 text-emerald-400 font-semibold cursor-pointer"
            >
              {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Disalin' : 'Salin ID'}</span>
            </button>
          </div>
          <div className="text-lg font-bold font-mono-tabular tracking-wider text-amber-400">
            {licenseState.customerId}
          </div>
          <div className="text-[11px] text-slate-400">
            Info Lisensi Full Version: <strong className="text-white">{licenseState.licensePriceText}</strong>
          </div>
        </div>

        {/* Form Input Kode Lisensi */}
        <form onSubmit={handleActivate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Masukkan Kode Aktivasi Full Version
            </label>
            <input
              type="text"
              required
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              placeholder="PRO-LFT-XXXX-XXXX"
              className="w-full px-3.5 py-3 text-sm font-mono-tabular uppercase bg-[#0b111e] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Buka Kunci & Aktifkan Full Version
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 bg-[#1e293b] hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>Pesan Kode Aktivasi via WhatsApp Admin</span>
          </a>

          {onExitTrialToLogin && (
            <button
              type="button"
              onClick={onExitTrialToLogin}
              className="w-full py-2 text-[11px] text-slate-400 hover:text-white cursor-pointer"
            >
              Kembali ke Halaman Login Akun
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface AdminTrialKeygenPanelProps {
  licenseState: TrialLicenseState;
  storePhone: string;
  onUpdateLicenseState: (next: TrialLicenseState) => void;
}

export const AdminTrialKeygenPanel: React.FC<AdminTrialKeygenPanelProps> = ({
  licenseState,
  storePhone,
  onUpdateLicenseState,
}) => {
  const [targetCustomerId, setTargetCustomerId] = useState(licenseState.customerId);
  const [extBatch, setExtBatch] = useState(1);
  const [customerWaPhone, setCustomerWaPhone] = useState('');
  const [adminWaInput, setAdminWaInput] = useState(
    licenseState.adminWaNumber && licenseState.adminWaNumber !== '081234567890'
      ? licenseState.adminWaNumber
      : storePhone || DEFAULT_ADMIN_WA
  );
  const [priceTextInput, setPriceTextInput] = useState(
    licenseState.licensePriceText || DEFAULT_LICENSE_PRICE
  );

  const initialMs = licenseState.trialDurationMs || TRIAL_DURATION_MS;
  const initialTotalMin = Math.max(1, Math.round(initialMs / (60 * 1000)));
  const initialUnit: 'menit' | 'jam' | 'hari' =
    initialTotalMin % 1440 === 0
      ? 'hari'
      : initialTotalMin % 60 === 0
        ? 'jam'
        : 'menit';
  const initialVal =
    initialUnit === 'hari'
      ? initialTotalMin / 1440
      : initialUnit === 'jam'
        ? initialTotalMin / 60
        : initialTotalMin;

  const [trialDurationValue, setTrialDurationValue] = useState<string | number>(initialVal);
  const [trialDurationUnit, setTrialDurationUnit] = useState<'menit' | 'jam' | 'hari'>(
    initialUnit
  );

  const getDurationInMinutes = (value: string | number, unit: 'menit' | 'jam' | 'hari') => {
    const safeVal = Math.max(1, Number(value) || 1);
    if (unit === 'jam') return safeVal * 60;
    if (unit === 'hari') return safeVal * 24 * 60;
    return safeVal;
  };

  const currentDurationMinutes = getDurationInMinutes(trialDurationValue, trialDurationUnit);
  const currentDurationMs = currentDurationMinutes * 60 * 1000;
  const currentDurationLabel = formatTrialDurationLabel(currentDurationMs);

  const [customShareUrlInput, setCustomShareUrlInput] = useState(
    licenseState.customShareUrl || ''
  );
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [savedConfigMsg, setSavedConfigMsg] = useState('');
  const [isDownloadingTrialApk, setIsDownloadingTrialApk] = useState(false);

  // Customer activation state when in customer trial mode
  const [customerKeyInput, setCustomerKeyInput] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [showOwnerUnlock, setShowOwnerUnlock] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [showDevTools, setShowDevTools] = useState(false);

  const isPureCustomerTrial =
    licenseState.isTrialMode &&
    !licenseState.isActivatedFull &&
    !licenseState.isOwnerDevice &&
    licenseState.ownerSimulation !== 'simulate_trial' &&
    licenseState.ownerSimulation !== 'simulate_expired';

  // On mount, if local state doesn't have an explicit configSyncedAt yet, pull the saved server config (e.g. 2 Menit)
  useEffect(() => {
    if (isPureCustomerTrial) return;
    fetchServerTrialConfig().then((remoteCfg) => {
      if (
        remoteCfg &&
        remoteCfg.trialDurationMs &&
        remoteCfg.trialDurationMs >= 10000 &&
        !licenseState.configSyncedAt
      ) {
        const totalMin = Math.max(1, Math.round(remoteCfg.trialDurationMs / (60 * 1000)));
        const nextUnit: 'menit' | 'jam' | 'hari' =
          totalMin % 1440 === 0 ? 'hari' : totalMin % 60 === 0 ? 'jam' : 'menit';
        const nextVal =
          nextUnit === 'hari'
            ? totalMin / 1440
            : nextUnit === 'jam'
              ? totalMin / 60
              : totalMin;
        setTrialDurationValue(nextVal);
        setTrialDurationUnit(nextUnit);
        onUpdateLicenseState({
          ...licenseState,
          trialDurationMs: remoteCfg.trialDurationMs,
          adminWaNumber: remoteCfg.adminWaNumber || licenseState.adminWaNumber,
          licensePriceText: remoteCfg.licensePriceText || licenseState.licensePriceText,
          configSyncedAt: Date.now(),
        });
      }
    });
  }, []);

  const handleDurationValueChange = (rawStr: string) => {
    setTrialDurationValue(rawStr);
    const numVal = Number(rawStr);
    if (!rawStr || isNaN(numVal) || numVal < 1) return;
    const nextMs = getDurationInMinutes(numVal, trialDurationUnit) * 60 * 1000;
    const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
    const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
    onUpdateLicenseState({
      ...licenseState,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
      trialDurationMs: nextMs,
      configSyncedAt: Date.now(),
      customShareUrl: customShareUrlInput.trim() || undefined,
    });
    syncTrialConfigToServer({
      trialDurationMs: nextMs,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
    });
  };

  const handleDurationUnitChange = (nextUnit: 'menit' | 'jam' | 'hari') => {
    setTrialDurationUnit(nextUnit);
    const nextMs = getDurationInMinutes(trialDurationValue, nextUnit) * 60 * 1000;
    const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
    const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
    onUpdateLicenseState({
      ...licenseState,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
      trialDurationMs: nextMs,
      configSyncedAt: Date.now(),
      customShareUrl: customShareUrlInput.trim() || undefined,
    });
    syncTrialConfigToServer({
      trialDurationMs: nextMs,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
    });
  };

  const applyDurationPreset = (val: number, unit: 'menit' | 'jam' | 'hari') => {
    setTrialDurationValue(val);
    setTrialDurationUnit(unit);
    const nextMs = getDurationInMinutes(val, unit) * 60 * 1000;
    const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
    const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
    onUpdateLicenseState({
      ...licenseState,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
      trialDurationMs: nextMs,
      configSyncedAt: Date.now(),
      customShareUrl: customShareUrlInput.trim() || undefined,
    });
    syncTrialConfigToServer({
      trialDurationMs: nextMs,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
    });
    setSavedConfigMsg(
      `Durasi Trial berhasil diatur ke ${formatTrialDurationLabel(nextMs)}! Link & APK siap dibagikan.`
    );
    setTimeout(() => setSavedConfigMsg(''), 3500);
  };

  const cleanTargetId = normalizeCustomerId(targetCustomerId);
  const generatedLifetimeKey = generateLifetimeLicenseKey(cleanTargetId);
  const generatedExtendKey = generateExtendTrialKey(cleanTargetId, extBatch);

  // Always generates a valid public https:// URL with ?dur=<currentDurationMs> embedded
  const shareableTrialUrl = buildCleanTrialShareUrl(
    adminWaInput,
    priceTextInput,
    customShareUrlInput,
    currentDurationMs
  );
  const directTrialApkUrl = buildDirectTrialApkDownloadUrl(
    customShareUrlInput,
    currentDurationMs,
    adminWaInput
  );

  const copyText = (text: string, label: string) => {
    if (!isPureCustomerTrial) {
      const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
      const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
      onUpdateLicenseState({
        ...licenseState,
        adminWaNumber: cleanWa,
        licensePriceText: cleanPrice,
        trialDurationMs: currentDurationMs,
        customShareUrl: customShareUrlInput.trim() || undefined,
      });
      syncTrialConfigToServer({
        trialDurationMs: currentDurationMs,
        adminWaNumber: cleanWa,
        licensePriceText: cleanPrice,
      });
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(label);
      setTimeout(() => setCopiedType(null), 2200);
    }
  };

  const handleSaveTrialConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
    const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
    onUpdateLicenseState({
      ...licenseState,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
      trialDurationMs: currentDurationMs,
      customShareUrl: customShareUrlInput.trim() || undefined,
    });
    syncTrialConfigToServer({
      trialDurationMs: currentDurationMs,
      adminWaNumber: cleanWa,
      licensePriceText: cleanPrice,
    });
    setSavedConfigMsg(
      `Pengaturan berhasil disimpan! Durasi Trial aktif: ${currentDurationLabel}.`
    );
    setTimeout(() => setSavedConfigMsg(''), 3500);
  };

  const handleDownloadTrialApkFile = async () => {
    setIsDownloadingTrialApk(true);
    try {
      const cleanWa = adminWaInput.trim() || storePhone || DEFAULT_ADMIN_WA;
      const cleanPrice = priceTextInput.trim() || DEFAULT_LICENSE_PRICE;
      await syncTrialConfigToServer({
        trialDurationMs: currentDurationMs,
        adminWaNumber: cleanWa,
        licensePriceText: cleanPrice,
      });
      await downloadSignedApk({
        trialMode: true,
        durationMs: currentDurationMs,
        adminWa: cleanWa,
        priceText: cleanPrice,
      });
    } finally {
      setTimeout(() => setIsDownloadingTrialApk(false), 1200);
    }
  };

  const shareTrialLinkToWa = buildWhatsAppUrl(
    customerWaPhone,
    `Halo Kak! Silakan coba gratis aplikasi *Kasir Konter & Gadai Pro* selama *${currentDurationLabel} (Full Fitur)*.\n\n1. Klik Link Aplikasi Web / Trial (${currentDurationLabel}):\n${shareableTrialUrl}\n\n2. Atau Download File APK Android Trial (${currentDurationLabel}):\n${directTrialApkUrl}\n\nSemua fitur (Stok & Jual Beli HP, Kasir Voucher/Topup, Gadai, Pembukuan & Cetak Nota WA) bisa langsung dicoba. Jika cocok, bisa lanjut aktivasi Full Version (${priceTextInput.trim() || DEFAULT_LICENSE_PRICE}) kapan saja tanpa kehilangan data.`
  );

  const sendLifetimeKeyToWa = buildWhatsAppUrl(
    customerWaPhone,
    `Terima kasih telah melakukan aktivasi *Kasir Konter & Gadai Pro (Full Version)*!\n\nBerikut Kode Aktivasi Permanen untuk ID Pelanggan *${cleanTargetId}*:\n*${generatedLifetimeKey}*\n\nSilakan masukkan kode tersebut pada kolom Aktivasi di aplikasi Anda.`
  );

  const handleCustomerVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyEnteredLicenseKey(licenseState.customerId, customerKeyInput);
    if (!res.valid) {
      setCustomerFeedback({ ok: false, text: res.message });
      return;
    }
    if (res.type === 'lifetime') {
      onUpdateLicenseState({
        ...licenseState,
        isActivatedFull: true,
        isTrialMode: false,
        activatedKey: res.normalizedKey,
        activatedAt: Date.now(),
        ownerSimulation: 'none',
      });
      setCustomerFeedback({ ok: true, text: res.message });
    } else if (res.type === 'extend_3days') {
      if (licenseState.usedExtensionCodes.includes(res.normalizedKey)) {
        setCustomerFeedback({
          ok: false,
          text: 'Kode perpanjangan 3 hari ini sudah pernah digunakan sebelumnya.',
        });
        return;
      }
      const baseTime = Math.max(Date.now(), licenseState.trialEndsAt);
      onUpdateLicenseState({
        ...licenseState,
        trialEndsAt: baseTime + TRIAL_DURATION_MS,
        usedExtensionCodes: [...licenseState.usedExtensionCodes, res.normalizedKey],
        ownerSimulation: 'none',
      });
      setCustomerFeedback({ ok: true, text: res.message });
    }
  };

  const handleUnlockOwnerPanel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = ownerPinInput.trim().toUpperCase();
    if (
      cleanPin === 'ADMIN-85782' ||
      cleanPin === '081529285782' ||
      cleanPin === 'PRO-MASTER-UNLIMITED-2026'
    ) {
      onUpdateLicenseState({
        ...licenseState,
        isOwnerDevice: true,
        isTrialMode: false,
        ownerSimulation: 'none',
      });
      setShowOwnerUnlock(false);
      setOwnerPinInput('');
    } else {
      setCustomerFeedback({
        ok: false,
        text: 'PIN Admin tidak sesuai.',
      });
    }
  };

  // If opened by a prospective customer in trial mode, show Customer Activation screen instead of Keygen
  if (isPureCustomerTrial) {
    const remMs = Math.max(0, licenseState.trialEndsAt - Date.now());
    const remText = formatRemainingDuration(remMs);
    const custDurLabel = formatTrialDurationLabel(licenseState.trialDurationMs);
    const waOrderUrl = buildWhatsAppUrl(
      licenseState.adminWaNumber || DEFAULT_ADMIN_WA,
      `Halo Admin, saya sedang mencoba *Trial Gratis (${custDurLabel})* aplikasi *Kasir Konter & Gadai Pro* dan ingin memesan *Kode Lisensi Full Version*.\n\nID Pelanggan perangkat saya: *${licenseState.customerId}*`
    );

    return (
      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-[#152036] border border-slate-700 text-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              Status: Mode Trial Gratis ({custDurLabel})
            </span>
            <span className="text-xs text-slate-300">
              Sisa Waktu: <strong className="text-emerald-400 font-mono-tabular">{remText}</strong>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0b111e] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">ID Pelanggan Perangkat Anda:</span>
              <button
                type="button"
                onClick={() => copyText(licenseState.customerId, 'cust_id')}
                className="inline-flex items-center gap-1 text-emerald-400 font-semibold cursor-pointer"
              >
                {copiedType === 'cust_id' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedType === 'cust_id' ? 'ID Tersalin' : 'Salin ID Pelanggan'}</span>
              </button>
            </div>
            <div className="text-lg font-bold font-mono-tabular tracking-wider text-amber-400">
              {licenseState.customerId}
            </div>
            <div className="text-xs text-slate-400">
              Harga Aktivasi Full Version:{' '}
              <strong className="text-white">
                {licenseState.licensePriceText || DEFAULT_LICENSE_PRICE}
              </strong>
            </div>
          </div>

          <form onSubmit={handleCustomerVerify} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Masukkan Kode Aktivasi Full Version dari Admin
              </label>
              <input
                type="text"
                required
                value={customerKeyInput}
                onChange={(e) => setCustomerKeyInput(e.target.value.toUpperCase())}
                placeholder="Contoh: PRO-LFT-XXXX-XXXX"
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular uppercase bg-[#0b111e] border border-slate-700 rounded-xl text-white"
              />
            </div>

            {customerFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium ${
                  customerFeedback.ok
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                }`}
              >
                {customerFeedback.text}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={waOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl text-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Pesan Kode Aktivasi via WA Admin</span>
              </a>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
              >
                Aktifkan Full Version Sekarang
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Seluruh data transaksi & stok selama masa trial tetap tersimpan 100% aman.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('konter_pro_trial_license_v1');
                  window.location.reload();
                }}
                className="text-[11px] text-rose-400 hover:text-rose-200 cursor-pointer"
              >
                Reset Trial
              </button>
              <button
                type="button"
                onClick={() => setShowOwnerUnlock((v) => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Panel Admin
              </button>
            </div>
          </div>

          {showOwnerUnlock && (
            <form onSubmit={handleUnlockOwnerPanel} className="flex items-center gap-2 pt-1">
              <input
                type="password"
                value={ownerPinInput}
                onChange={(e) => setOwnerPinInput(e.target.value)}
                placeholder="Masukkan Nomor WA / Kode Admin"
                className="flex-1 px-3 py-1.5 text-xs bg-[#0b111e] border border-slate-700 rounded-lg text-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Buka Keygen Admin
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#152036] border border-slate-700 text-white space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Sistem Trial Fleksibel ({currentDurationLabel}) & Generator Lisensi Customer
              </h3>
              <p className="text-[11px] text-slate-300">
                Atur durasi trial (Menit, Jam, atau Hari), bagikan link/APK ke perangkat tes atau customer, dan otomatis terkunci saat waktu habis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 1: Bagikan Link & APK Trial Gratis ke Calon Customer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>1. Pengaturan Durasi Trial & Link Download APK untuk Calon Customer</span>
            </h4>
            <button
              onClick={() => {
                localStorage.removeItem('konter_pro_trial_license_v1');
                window.location.reload();
              }}
              className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg hover:bg-rose-200 cursor-pointer"
            >
              Reset Trial (DEBUG)
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Saat Anda mengatur durasi (misalnya <strong>2 Menit</strong> atau <strong>7 Hari</strong>), sistem langsung menyematkan durasi tersebut ke dalam <strong>Link & File APK Trial</strong>. Perangkat lain yang menginstal APK ini akan otomatis menghitung mundur dan <strong>terkunci otomatis</strong> tepat saat waktu habis.
          </p>
        </div>

        <form onSubmit={handleSaveTrialConfig} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor WA Anda (Tujuan Pesan Aktivasi Customer)
              </label>
              <input
                type="text"
                value={adminWaInput}
                onChange={(e) => setAdminWaInput(e.target.value)}
                placeholder="081529285782"
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Keterangan Harga Lisensi Full Version
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={priceTextInput}
                  onChange={(e) => setPriceTextInput(e.target.value)}
                  placeholder="Rp 150.000 (Aktif Selamanya)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-900">
                  Atur Durasi Trial (Bisa Menit, Jam, atau Hari):
                </label>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                  <Check className="w-3 h-3" />
                  Tersimpan: {currentDurationLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={trialDurationValue}
                  onChange={(e) => handleDurationValueChange(e.target.value)}
                  onBlur={() => {
                    const safeVal = Math.max(1, Number(trialDurationValue) || 1);
                    setTrialDurationValue(safeVal);
                  }}
                  className="w-28 px-3 py-2 text-xs font-bold font-mono-tabular border border-slate-300 rounded-xl bg-white"
                />
                <select
                  value={trialDurationUnit}
                  onChange={(e) =>
                    handleDurationUnitChange(e.target.value as 'menit' | 'jam' | 'hari')
                  }
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                >
                  <option value="menit">Menit</option>
                  <option value="jam">Jam</option>
                  <option value="hari">Hari</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Simpan Pengaturan ({currentDurationLabel})</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-600 mr-1">Pilihan Cepat:</span>
                {[
                  { label: '1 Menit', val: 1, unit: 'menit' as const },
                  { label: '2 Menit (Tes)', val: 2, unit: 'menit' as const },
                  { label: '5 Menit', val: 5, unit: 'menit' as const },
                  { label: '1 Jam', val: 1, unit: 'jam' as const },
                  { label: '1 Hari', val: 1, unit: 'hari' as const },
                  { label: '3 Hari', val: 3, unit: 'hari' as const },
                  { label: '7 Hari', val: 7, unit: 'hari' as const },
                ].map((preset) => {
                  const isSelected =
                    Number(trialDurationValue) === preset.val && trialDurationUnit === preset.unit;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyDurationPreset(preset.val, preset.unit)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Link Google Drive / MediaFire / Domain Custom Anda (Opsional — kosongkan untuk pakai Link Cloud Otomatis):
            </label>
            <input
              type="text"
              value={customShareUrlInput}
              onChange={(e) => setCustomShareUrlInput(e.target.value)}
              placeholder="Kosongkan untuk otomatis pakai link HTTPS publik resmi..."
              className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-xl bg-slate-50"
            />
          </div>
        </form>

        {savedConfigMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            {savedConfigMsg}
          </div>
        )}

        {/* Opsi A: Link HTTPS Web & Download Trial */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Opsi A — Link HTTPS Publik Calon Customer (Durasi: {currentDurationLabel}):
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Link Aktif & Klikable
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareableTrialUrl}
              className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-300 rounded-xl text-emerald-700 font-semibold"
            />
            <button
              type="button"
              onClick={() => copyText(shareableTrialUrl, 'trial_link')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
            >
              {copiedType === 'trial_link' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Link Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link Trial</span>
                </>
              )}
            </button>
            <a
              href={shareTrialLinkToWa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim ke WA Calon Customer</span>
            </a>
          </div>
        </div>

        {/* Opsi B: Download File APK Khusus Trial */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Opsi B — File APK Android Khusus Trial ({currentDurationLabel})
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Salin link download di bawah atau unduh file APK-nya untuk di-install di HP lain. Begitu dibuka di perangkat tes/customer, aplikasi langsung berjalan dalam <strong>Mode Trial ({currentDurationLabel})</strong> dengan hitung mundur detik dan <strong>otomatis terkunci</strong> tepat saat {currentDurationLabel} habis!
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTrialApkFile}
              disabled={isDownloadingTrialApk}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isDownloadingTrialApk
                  ? `Menyiapkan APK Trial (${currentDurationLabel})...`
                  : `Download File APK Trial (${currentDurationLabel})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => copyText(directTrialApkUrl, 'apk_trial_url')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              {copiedType === 'apk_trial_url' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Link Download APK ({currentDurationLabel}) Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link Download Langsung APK Trial ({currentDurationLabel})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bagian 2: Keygen / Generator Kode Aktivasi untuk Customer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>2. Generator Kode Aktivasi (Keygen Lisensi Customer)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Masukkan <strong>ID Pelanggan</strong> yang tampil di layar kunci perangkat customer (contoh: <span className="font-mono-tabular">KGP-XXXX-XXX</span>) untuk membuat Kode Aktivasi Full Version atau menambah masa trial +3 hari.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Masukkan ID Pelanggan Customer
            </label>
            <input
              type="text"
              value={targetCustomerId}
              onChange={(e) => setTargetCustomerId(e.target.value.toUpperCase())}
              placeholder="Contoh: KGP-8492-X7B"
              className="w-full px-3 py-2.5 text-sm font-mono-tabular uppercase font-bold border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nomor WA Customer (Opsional untuk Kirim Kode)
            </label>
            <input
              type="text"
              value={customerWaPhone}
              onChange={(e) => setCustomerWaPhone(e.target.value)}
              placeholder="0812..."
              className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {cleanTargetId ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Kartu Kode Full Version Selamanya */}
            <div className="p-4 rounded-2xl bg-[#152036] border border-slate-700 text-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Kode Lisensi Full Version (Selamanya)
                </span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-base sm:text-lg font-bold font-mono-tabular tracking-wider text-white bg-[#0b111e] px-3 py-2 rounded-xl border border-slate-800">
                {generatedLifetimeKey}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => copyText(generatedLifetimeKey, 'lifetime_key')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {copiedType === 'lifetime_key' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kode Full</span>
                    </>
                  )}
                </button>
                <a
                  href={sendLifetimeKeyToWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kirim WA</span>
                </a>
              </div>
            </div>

            {/* Kartu Kode Perpanjang Trial +3 Hari */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                  Kode Tambah Masa Trial (+3 Hari)
                </span>
                <select
                  value={extBatch}
                  onChange={(e) => setExtBatch(Number(e.target.value))}
                  className="text-[11px] px-2 py-0.5 border border-slate-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Kuota Ke-{n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono-tabular tracking-wider text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200">
                {generatedExtendKey}
              </div>
              <button
                type="button"
                onClick={() => copyText(generatedExtendKey, 'extend_key')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                {copiedType === 'extend_key' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kode Trial +3 Hari Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Kode Perpanjang +3 Hari</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bagian 3: Simulasi Pratinjau untuk Admin */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <span>3. Simulasi Tampilan Calon Customer (Khusus Admin)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingin langsung mengetes hitung mundur ({currentDurationLabel}) atau tampilan saat terkunci di layar ini? Klik tombol di bawah:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDevTools(!showDevTools)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer py-2"
            >
              {showDevTools ? '▲ Sembunyikan Testing Tools' : '▼ Tampilkan Testing Tools (Admin)'}
            </button>
            {showDevTools && (
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateLicenseState({
                      ...licenseState,
                      trialDurationMs: currentDurationMs,
                      trialStartedAt: Date.now(),
                      trialEndsAt: Date.now() + currentDurationMs,
                      ownerSimulation: 'simulate_trial',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tes Hitung Mundur</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateLicenseState({
                      ...licenseState,
                      trialDurationMs: currentDurationMs,
                      ownerSimulation: 'simulate_expired',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lihat Tampilan Terkunci</span>
                </button>

                {licenseState.ownerSimulation && licenseState.ownerSimulation !== 'none' && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLicenseState({
                        ...licenseState,
                        ownerSimulation: 'none',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Kembali ke Normal</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
