/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  OperationType,
  handleFirestoreError,
} from './firebase';
import {
  LOCAL_ANDROID_UID,
  isLocalAndroidMode,
  isRunningInAndroidApk,
  setLocalAndroidMode,
  subscribeCollection,
} from './services/localDb';
import {
  Wallet,
  PhoneInventory,
  CatalogPreset,
  PawnRecord,
  InvestmentRecord,
  DebtRecord,
  LedgerTransaction,
  CustomerRecord,
  StoreSettings,
  ReceiptPayload,
  License,
  computeWalletBalances,
  formatIDR,
  getDefaultStoreSettings,
  loadStoreSettings,
  saveStoreSettings,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardView } from './components/DashboardView';
import { PhonesView } from './components/PhonesView';
import { QuickPosView } from './components/QuickPosView';
import { PawnsView } from './components/PawnsView';
import { FinanceLedgerView } from './components/FinanceLedgerView';
import {
  DrawerMenuViews,
  DrawerSection,
  SettingsTab,
} from './components/DrawerMenuViews';
import { NotaReceiptModal } from './components/NotaReceiptModal';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import {
  TrialCountdownBanner,
  TrialExpiredLockScreen,
} from './components/TrialLicenseManager';
import {
  TrialLicenseState,
  loadTrialLicenseState,
  saveTrialLicenseState,
  startThreeDayTrial,
  evaluateLicenseStatus,
  getConfiguredApkOrUrlTrialDurationMs,
  fetchServerTrialConfig,
} from './utils/trialLicense';
import { downloadSignedApk } from './utils/apkDownloader';
import {
  LayoutDashboard,
  Smartphone,
  Zap,
  ShieldCheck,
  Receipt,
  LogOut,
  Monitor,
  Menu,
  X,
  User,
  Users,
  BarChart2,
  Settings,
  Info,
  Moon,
  Sun,
  Lock,
  Download,
  ShieldAlert,
  ChevronRight,
  KeyRound,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'phones'
  | 'pos'
  | 'pawns'
  | 'finance'
  | 'drawer_view';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [drawerSection, setDrawerSection] = useState<DrawerSection>('profile');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsTab>('nota');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Toggle to preview the native Android App layout even when viewing on a wide desktop screen
  const [androidPreviewMode, setAndroidPreviewMode] = useState(false);

  // Store Settings & Dark Mode & App PIN Lock
  const [settings, setSettings] = useState<StoreSettings>(() => getDefaultStoreSettings());
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Nota / Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptPayload | null>(null);

  // 3-Day Free Trial & Customer License State
  const [trialLicenseState, setTrialLicenseState] = useState<TrialLicenseState>(() =>
    loadTrialLicenseState()
  );
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Touch Swipe Gesture Tracking (Swipe Right to Open Drawer, Swipe Left to Close)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Back Navigation History Stack & Double-Back Exit Confirmation
  const navHistoryRef = useRef<
    Array<{ tab: NavTab; drawerSection: DrawerSection; settingsSubTab: SettingsTab }>
  >([]);
  const exitConfirmUntilRef = useRef<number>(0);
  const hasUserGestureGuardRef = useRef<boolean>(false);
  const [backExitToast, setBackExitToast] = useState(false);

  // Firestore Collections State
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [phones, setPhones] = useState<PhoneInventory[]>([]);
  const [presets, setPresets] = useState<CatalogPreset[]>([]);
  const [pawns, setPawns] = useState<PawnRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);

  const makeLocalUser = (): FirebaseUser =>
    ({
      uid: LOCAL_ANDROID_UID,
      email: 'kasir@konter-android.lokal',
      displayName: 'Kasir Konter (Memori HP Android)',
    } as unknown as FirebaseUser);

  useEffect(() => {
    if (isLocalAndroidMode()) {
      const localUser = makeLocalUser();
      setUser(localUser);
      setIsAuthReady(true);
      const loaded = loadStoreSettings(localUser.uid, localUser.email);
      setSettings(loaded);
      if (loaded.appPinEnabled && loaded.appPinCode) {
        setIsAppLocked(true);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthReady(true);
        const loaded = loadStoreSettings(currentUser.uid, currentUser.email);
        setSettings(loaded);
        if (loaded.appPinEnabled && loaded.appPinCode) {
          setIsAppLocked(true);
        }
      } else if (isLocalAndroidMode()) {
        const localUser = makeLocalUser();
        setUser(localUser);
        setIsAuthReady(true);
      } else {
        setUser(null);
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Apply Dark / Light Theme Class to <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', settings.themeMode === 'dark');
    }
  }, [settings.themeMode]);

  // Auto-trigger APK download or Free Trial if opened via special query params or Trial APK build
  const isTrialApkBuild = Boolean((window as any).__APK_DEFAULT_TRIAL_MODE__);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('download') === 'apk') {
      downloadSignedApk();
    } else if (params.get('download') === 'apk-trial') {
      const durParam = Number(params.get('dur')) || undefined;
      downloadSignedApk({ trialMode: true, durationMs: durParam });
    }
    if (
      params.get('trial') === '3days' ||
      params.get('trial') === '1' ||
      isTrialApkBuild
    ) {
      const waParam = params.get('wa') || undefined;
      const priceParam = params.get('price') || undefined;
      const configuredDur = getConfiguredApkOrUrlTrialDurationMs();
      const started = startThreeDayTrial(waParam, priceParam, configuredDur);
      setTrialLicenseState(started);
      setLocalAndroidMode(true);
      const localUser = makeLocalUser();
      setUser(localUser);
      setIsAuthReady(true);

      // Sync latest trial duration from server if not explicitly overridden by ?dur= in URL
      if (!params.get('dur')) {
        fetchServerTrialConfig().then((remoteCfg) => {
          if (remoteCfg && remoteCfg.trialDurationMs && remoteCfg.trialDurationMs >= 10000) {
            const duration = remoteCfg.trialDurationMs;
            setTrialLicenseState((prev) => {
              if (prev.isActivatedFull || prev.isOwnerDevice) return prev;
              if (prev.trialDurationMs === duration) return prev;
              const next: TrialLicenseState = {
                ...prev,
                isTrialMode: true,
                trialDurationMs: duration,
                trialEndsAt: prev.trialStartedAt + duration,
                adminWaNumber: remoteCfg.adminWaNumber || prev.adminWaNumber,
                licensePriceText: remoteCfg.licensePriceText || prev.licensePriceText,
              };
              saveTrialLicenseState(next);
              return next;
            });
          }
        });
      }
    }
  }, [isTrialApkBuild]);

  // Live 1s ticker so short trials (e.g. 1-2 minutes) count down and lock on the exact second
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleUpdateTrialLicenseState = (next: TrialLicenseState) => {
    setTrialLicenseState(next);
    saveTrialLicenseState(next);
  };

  const handleUpdateSettings = (next: StoreSettings) => {
    setSettings(next);
    if (user) {
      saveStoreSettings(user.uid, next);
    }
  };

  useEffect(() => {
    if (!isAuthReady || !user) {
      setWallets([]);
      setPhones([]);
      setPresets([]);
      setPawns([]);
      setInvestments([]);
      setDebts([]);
      setCustomers([]);
      setTransactions([]);
      return;
    }

    const uid = user.uid;

    const unsubWallets = subscribeCollection<Wallet>(
      'wallets',
      uid,
      (list) => {
        const sorted = [...list].sort(
          (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
        );
        setWallets(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'wallets')
    );

    const unsubPhones = subscribeCollection<PhoneInventory>(
      'phones',
      uid,
      (list) => {
        const sorted = [...list].sort(
          (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setPhones(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'phones')
    );

    const unsubPresets = subscribeCollection<CatalogPreset>(
      'catalog_presets',
      uid,
      (list) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        setPresets(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'catalog_presets')
    );

    const unsubPawns = subscribeCollection<PawnRecord>(
      'pawns',
      uid,
      (list) => {
        const sorted = [...list].sort(
          (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setPawns(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'pawns')
    );

    const unsubInvestments = subscribeCollection<InvestmentRecord>(
      'investments',
      uid,
      (list) => {
        const sorted = [...list].sort(
          (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setInvestments(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    );

    const unsubDebts = subscribeCollection<DebtRecord>(
      'debts',
      uid,
      (list) => {
        const sorted = [...list].sort(
          (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setDebts(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'debts')
    );

    const unsubCustomers = subscribeCollection<CustomerRecord>(
      'customers',
      uid,
      (list) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        setCustomers(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
    );

    const unsubTransactions = subscribeCollection<LedgerTransaction>(
      'transactions',
      uid,
      (list) => {
        const sorted = [...list].sort((a, b) => {
          const dateCmp = b.dateString.localeCompare(a.dateString);
          if (dateCmp !== 0) return dateCmp;
          return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
        });
        setTransactions(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubLicenses = subscribeCollection<License>(
      'licenses',
      uid,
      (list) => {
        setLicenses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'licenses')
    );

    return () => {
      unsubWallets();
      unsubPhones();
      unsubPresets();
      unsubPawns();
      unsubInvestments();
      unsubDebts();
      unsubCustomers();
      unsubTransactions();
      unsubLicenses();
    };
  }, [isAuthReady, user]);

  const walletBalances = useMemo(
    () => computeWalletBalances(wallets, transactions),
    [wallets, transactions]
  );

  const totalCashNow = useMemo(
    () => wallets.reduce((sum, w) => sum + (walletBalances[w.id] ?? 0), 0),
    [wallets, walletBalances]
  );

  const handleEnterLocalMode = () => {
    setLocalAndroidMode(true);
    const localUser = makeLocalUser();
    setUser(localUser);
    const loaded = loadStoreSettings(localUser.uid, localUser.email);
    setSettings(loaded);
  };

  const handleStartCustomerTrial = () => {
    const started = startThreeDayTrial(
      settings.storePhone,
      undefined,
      trialLicenseState.trialDurationMs
    );
    setTrialLicenseState(started);
    setLocalAndroidMode(true);
    const localUser = makeLocalUser();
    setUser(localUser);
    const loaded = loadStoreSettings(localUser.uid, localUser.email);
    setSettings(loaded);
  };

  const licenseEval = useMemo(
    () => evaluateLicenseStatus(trialLicenseState, user?.email, nowTick),
    [trialLicenseState, user?.email, nowTick]
  );

  const handleLogin = async () => {
    setLoginError('');
    if (isRunningInAndroidApk()) {
      handleEnterLocalMode();
      return;
    }
    setIsLoggingIn(true);
    try {
      setLocalAndroidMode(false);
      await loginWithGoogle();
    } catch (err: any) {
      setLoginError(
        err?.message ||
          'Gagal masuk dengan Google. Anda juga dapat langsung masuk menggunakan Mode Memori HP.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setLocalAndroidMode(false);
    setIsDrawerOpen(false);
    if (user?.uid === LOCAL_ANDROID_UID) {
      if (!isRunningInAndroidApk()) {
        setUser(null);
      }
      return;
    }
    await logoutUser();
  };

  const pushBrowserHistoryGuard = (fromUserGesture = false) => {
    if (typeof window === 'undefined' || isRunningInAndroidApk()) return;
    try {
      if (fromUserGesture) {
        hasUserGestureGuardRef.current = true;
      }
      window.history.pushState(
        { kasirBackGuard: true, ts: Date.now() },
        '',
        window.location.href
      );
    } catch {
      // Ignore history API restrictions
    }
  };

  const switchTab = (nextTab: NavTab) => {
    if (nextTab !== activeTab) {
      navHistoryRef.current = [
        ...navHistoryRef.current.slice(-19),
        { tab: activeTab, drawerSection, settingsSubTab },
      ];
    }
    setActiveTab(nextTab);
    pushBrowserHistoryGuard(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavigate = (tab: string) => {
    if (tab === 'investments') {
      switchTab('pawns');
    } else if (tab === 'history') {
      switchTab('finance');
    } else {
      switchTab(tab as NavTab);
    }
  };

  const openDrawerSection = (sec: DrawerSection, subTab?: SettingsTab) => {
    if (
      activeTab !== 'drawer_view' ||
      drawerSection !== sec ||
      (subTab && settingsSubTab !== subTab)
    ) {
      navHistoryRef.current = [
        ...navHistoryRef.current.slice(-19),
        { tab: activeTab, drawerSection, settingsSubTab },
      ];
    }
    setDrawerSection(sec);
    if (subTab) setSettingsSubTab(subTab);
    setActiveTab('drawer_view');
    setIsDrawerOpen(false);
    pushBrowserHistoryGuard(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Universal Back Button Handler (Android APK hardware/gesture back + Browser/PWA popstate)
  const handleBackActionRef = useRef<() => boolean>(() => true);
  handleBackActionRef.current = () => {
    // 1. Close Nota / Receipt modal if open
    if (activeReceipt) {
      setActiveReceipt(null);
      return true;
    }

    // 2. Close Hamburger Menu Drawer if open
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
      return true;
    }

    // 3. Close any open Modal / Bottom Sheet in any View (QuickActionsHub, Wallet, Phones, Pawns, Finance, etc.)
    if (typeof document !== 'undefined') {
      const modalOverlays = Array.from(
        document.querySelectorAll('div.fixed.inset-0.z-50')
      ) as HTMLElement[];
      if (modalOverlays.length > 0) {
        const topOverlay = modalOverlays[modalOverlays.length - 1];
        topOverlay.click();
        return true;
      }
    }

    // 4. If currently on a sub-tab or Drawer Menu View (not on Beranda / dashboard), go back to previous tab or Beranda
    if (user && activeTab !== 'dashboard') {
      while (navHistoryRef.current.length > 0) {
        const prev = navHistoryRef.current.pop()!;
        if (
          prev.tab !== activeTab ||
          (prev.tab === 'drawer_view' && prev.drawerSection !== drawerSection)
        ) {
          setActiveTab(prev.tab);
          setDrawerSection(prev.drawerSection);
          setSettingsSubTab(prev.settingsSubTab);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return true;
        }
      }
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return true;
    }

    // 5. Already on Beranda (dashboard) with nothing open -> Require double-back within 2.5s to exit app
    const now = Date.now();
    if (now < exitConfirmUntilRef.current) {
      exitConfirmUntilRef.current = 0;
      setBackExitToast(false);
      if (isRunningInAndroidApk() && typeof window !== 'undefined') {
        try {
          window.prompt('EXIT_APP');
        } catch {
          // Ignore
        }
      }
      return false;
    }

    exitConfirmUntilRef.current = now + 2500;
    setBackExitToast(true);
    window.setTimeout(() => {
      setBackExitToast(false);
    }, 2500);
    return true;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Expose global callback for Android APK WebView MainActivity.onBackPressed()
    (window as any).__onAndroidBackPressed = () => {
      handleBackActionRef.current();
    };

    if (!isRunningInAndroidApk()) {
      pushBrowserHistoryGuard(false);
    }

    const onPopState = () => {
      hasUserGestureGuardRef.current = false;
      const stayedInApp = handleBackActionRef.current();
      if (stayedInApp) {
        pushBrowserHistoryGuard(false);
      } else {
        try {
          window.history.back();
        } catch {
          // Ignore
        }
      }
    };

    // Ensure Chromium/Android Chrome sees a user-gesture-activated history entry when user taps buttons/tabs
    const onUserInteraction = (e: Event) => {
      if (isRunningInAndroidApk()) return;
      const target = e.target as HTMLElement | null;
      if (
        !hasUserGestureGuardRef.current ||
        (target && target.closest('button, [role="button"]'))
      ) {
        if (!hasUserGestureGuardRef.current) {
          pushBrowserHistoryGuard(true);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          activeReceipt ||
          isDrawerOpen ||
          document.querySelectorAll('div.fixed.inset-0.z-50').length > 0
        ) {
          handleBackActionRef.current();
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onUserInteraction, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onUserInteraction, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Swipe-Right to Open Hamburger Drawer, Swipe-Left to Close
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX.current;
    const deltaY = Math.abs(endY - touchStartY.current);

    // Horizontal swipe must dominate vertical scroll
    if (Math.abs(deltaX) > 60 && deltaY < 50) {
      // Swipe right starting near the left half of screen -> open Hamburger Drawer
      if (deltaX > 60 && !isDrawerOpen && touchStartX.current < 140) {
        setIsDrawerOpen(true);
      } else if (deltaX < -60 && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">Memuat Aplikasi Kasir Konter...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <OfflineIndicator />
        <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200">
          <a href="/" className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
            Kasir Konter & Gadai Pro
          </a>
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#fitur-hp" className="hover:text-slate-900 transition-colors">
              Stok & Jual Beli HP
            </a>
            <a href="#fitur-voucher" className="hover:text-slate-900 transition-colors">
              Kasir Voucher & Topup
            </a>
            <a href="#fitur-gadai" className="hover:text-slate-900 transition-colors">
              Gadai & Modal
            </a>
            <a href="#fitur-pembukuan" className="hover:text-slate-900 transition-colors">
              Pembukuan Kas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isLoggingIn ? 'Memproses...' : 'Masuk Google'}
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs font-medium text-slate-500">
                Aplikasi Android & Web · Kasir Konter HP · Pergadaian · Nota WhatsApp
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight text-balance">
                Aplikasi Kasir Konter HP & Gadai yang Rapi, Ringan, dan Terhubung ke WhatsApp & Kontak HP.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                Dilengkapi menu geser (Hamburger Drawer), buku pelanggan terintegrasi kontak telepon, cetak nota thermal 58mm/80mm, kirim struk & pengingat gadai via WhatsApp, mode gelap, kunci PIN, dan backup/restore data.
              </p>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {loginError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-6 py-3 min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {isLoggingIn ? 'Menghubungkan ke Akun...' : 'Masuk dengan Google (Cloud)'}
                </button>
                <button
                  type="button"
                  onClick={handleStartCustomerTrial}
                  className="px-5 py-3 min-h-[48px] bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span>Coba Gratis 3 Hari (Trial Customer)</span>
                </button>
                <PWAInstallButton />
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Fitur Lengkap Operasional Konter
              </h2>
              <div className="divide-y divide-slate-100 text-xs text-slate-600">
                <div id="fitur-hp" className="py-3 space-y-0.5">
                  <div className="font-semibold text-slate-900">01. Stok & Jual Beli HP (80% Fokus Utama)</div>
                  <div>Catat HP baru, seken & minusan, biaya servis tambahan, serta cetak nota garansi.</div>
                </div>
                <div id="fitur-voucher" className="py-3 space-y-0.5">
                  <div className="font-semibold text-slate-900">02. Kasir Cepat Voucher, Topup & Kontak HP</div>
                  <div>Ketuk 1x tombol preset voucher, pilih nomor langsung dari Kontak HP, dan kirim struk WA.</div>
                </div>
                <div id="fitur-gadai" className="py-3 space-y-0.5">
                  <div className="font-semibold text-slate-900">03. Gadai Barang & Pengingat WhatsApp</div>
                  <div>Kelola titipan gadai HP/motor/laptop serta pengingat jatuh tempo otomatis ke WA nasabah.</div>
                </div>
                <div id="fitur-pembukuan" className="py-3 space-y-0.5">
                  <div className="font-semibold text-slate-900">04. Menu Geser: Pelanggan, Laporan & Pengaturan</div>
                  <div>Atur kop nota, mode gelap/terang, kunci PIN keamanan, serta backup/restore JSON.</div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 text-center text-xs text-slate-500 bg-white">
          Kasir Konter & Gadai Pro — Tersedia untuk HP Android, Tablet, dan Komputer.
        </footer>
      </div>
    );
  }

  // 3-Day Trial Expired Lock Screen
  if (licenseEval.status === 'trial_expired') {
    return (
      <TrialExpiredLockScreen
        licenseState={trialLicenseState}
        isOwnerSimulation={licenseEval.isOwnerAccount}
        statsSummary={{
          walletsCount: wallets.length,
          phonesCount: phones.length,
          transactionsCount: transactions.length,
        }}
        onUpdateLicenseState={handleUpdateTrialLicenseState}
        onExitTrialToLogin={handleLogout}
      />
    );
  }

  // App PIN Lock Screen
  if (isAppLocked && settings.appPinEnabled && settings.appPinCode) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-sm w-full p-6 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold">{settings.storeName}</h2>
            <p className="text-xs text-slate-400 mt-1">
              Masukkan PIN Keamanan Kasir untuk membuka aplikasi
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (unlockPinInput === settings.appPinCode) {
                setIsAppLocked(false);
                setUnlockPinInput('');
                setUnlockError('');
              } else {
                setUnlockError('Kode PIN salah. Silakan coba lagi.');
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              autoFocus
              maxLength={6}
              value={unlockPinInput}
              onChange={(e) => setUnlockPinInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-3 text-center text-lg font-mono-tabular tracking-[0.5em] bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />
            {unlockError && <div className="text-xs text-red-400">{unlockError}</div>}
            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
            >
              Buka Kunci Kasir
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5 Clean, Consolidated Navigation Items
  const navItems: Array<{
    id: NavTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Beranda & Saldo', mobileLabel: 'Beranda', icon: LayoutDashboard },
    { id: 'phones', label: 'Stok & Jual HP', mobileLabel: 'Stok HP', icon: Smartphone },
    { id: 'pos', label: 'Kasir & Topup', mobileLabel: 'Kasir', icon: Zap },
    { id: 'pawns', label: 'Gadai & Modal', mobileLabel: 'Gadai', icon: ShieldCheck },
    { id: 'finance', label: 'Pembukuan Kas', mobileLabel: 'Pembukuan', icon: Receipt },
  ];

  // Hamburger Drawer Menu Items
  const drawerItems: Array<{
    id: DrawerSection;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'profile',
      label: 'Profil Konter & Akun',
      desc: 'Identitas toko, nomor WA & ringkasan akun',
      icon: User,
    },
    {
      id: 'customers',
      label: `Data Pelanggan (${customers.length})`,
      desc: 'Buku pelanggan, akses kontak HP & chat WA',
      icon: Users,
    },
    {
      id: 'reports',
      label: 'Laporan & Analitik',
      desc: 'Rekap laba rugi, cetak nota & kirim WA',
      icon: BarChart2,
    },
    {
      id: 'trial_license',
      label: 'Trial 3 Hari & Lisensi Customer',
      desc: 'Bagikan link trial 3 hari & buat kode aktivasi',
      icon: KeyRound,
    },
    {
      id: 'settings',
      label: 'Pengaturan Aplikasi',
      desc: 'Nota, Mode Gelap, PIN, Backup & Reset',
      icon: Settings,
    },
    {
      id: 'about',
      label: 'Tentang Aplikasi',
      desc: 'Informasi versi & panduan penggunaan',
      icon: Info,
    },
  ];

  const renderHamburgerDrawer = () => {
    if (!isDrawerOpen) return null;
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex"
        onClick={() => setIsDrawerOpen(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-80 max-w-[86vw] bg-white h-full shadow-2xl border-r border-slate-200 flex flex-col justify-between overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4 p-4">
            {/* Drawer Header: Store Profile & Theme Switcher */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                    {(settings.storeName || 'K').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{settings.storeName}</div>
                    <div className="text-[11px] text-slate-300 truncate">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Saldo Kas Aktif</div>
                  <div className="font-mono-tabular font-bold text-emerald-400">
                    {formatIDR(totalCashNow)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    handleUpdateSettings({
                      ...settings,
                      themeMode: settings.themeMode === 'dark' ? 'light' : 'dark',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer"
                >
                  {settings.themeMode === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Gelap</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Primary Hamburger Menu Items */}
            <div className="space-y-1">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Menu Utama & Manajemen
              </div>
              {drawerItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === 'drawer_view' && drawerSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => openDrawerSection(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{item.label}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </button>
                );
              })}
            </div>

            {/* Direct Shortcuts for Settings Sub-items */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Pintasan Pengaturan
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => openDrawerSection('settings', 'nota')}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  <span>Atur Nota</span>
                </button>
                <button
                  onClick={() => openDrawerSection('settings', 'theme')}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Gelap/Terang</span>
                </button>
                <button
                  onClick={() => openDrawerSection('settings', 'security')}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>PIN Keamanan</span>
                </button>
                <button
                  onClick={() => openDrawerSection('settings', 'backup')}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Backup Data</span>
                </button>
                <button
                  onClick={() => openDrawerSection('settings', 'reset')}
                  className="col-span-2 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-medium cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <span>Reset & Bersihkan Data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-3.5 border-t border-slate-100 space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              <PWAInstallButton fullWidth />
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setAndroidPreviewMode(!androidPreviewMode);
                }}
                className="hidden md:inline-flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{androidPreviewMode ? 'Mode Layar Penuh' : 'Pratinjau Layar HP'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-slate-400">Geser kiri untuk tutup</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActiveView = () => (
    <>
      {activeTab === 'dashboard' && (
        <DashboardView
          uid={user.uid}
          wallets={wallets}
          walletBalances={walletBalances}
          phones={phones}
          presets={presets}
          customers={customers}
          pawns={pawns}
          investments={investments}
          debts={debts}
          transactions={transactions}
          onNavigate={handleNavigate}
          onOpenReceipt={setActiveReceipt}
        />
      )}

      {activeTab === 'phones' && (
        <PhonesView
          uid={user.uid}
          wallets={wallets}
          phones={phones}
          customers={customers}
          transactions={transactions}
          onOpenReceipt={setActiveReceipt}
        />
      )}

      {activeTab === 'pos' && (
        <QuickPosView
          uid={user.uid}
          wallets={wallets}
          presets={presets}
          customers={customers}
          onOpenReceipt={setActiveReceipt}
        />
      )}

      {activeTab === 'pawns' && (
        <PawnsView
          uid={user.uid}
          wallets={wallets}
          pawns={pawns}
          investments={investments}
          customers={customers}
          onOpenReceipt={setActiveReceipt}
        />
      )}

      {activeTab === 'finance' && (
        <FinanceLedgerView
          uid={user.uid}
          wallets={wallets}
          debts={debts}
          transactions={transactions}
          customers={customers}
          onOpenReceipt={setActiveReceipt}
        />
      )}

      {activeTab === 'drawer_view' && (
        <DrawerMenuViews
          section={drawerSection}
          initialSettingsTab={settingsSubTab}
          uid={user.uid}
          userEmail={user.email}
          userDisplayName={user.displayName}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onLockAppNow={() => setIsAppLocked(true)}
          trialLicenseState={trialLicenseState}
          onUpdateTrialLicenseState={handleUpdateTrialLicenseState}
          wallets={wallets}
          phones={phones}
          presets={presets}
          pawns={pawns}
          investments={investments}
          debts={debts}
          customers={customers}
          transactions={transactions}
          licenses={licenses}
          onOpenReceipt={setActiveReceipt}
        />
      )}
    </>
  );

  // If user enabled Android App Preview Mode on Desktop, render inside a sleek Android Smartphone App Shell
  if (androidPreviewMode) {
    return (
      <ErrorBoundary>
        <div
          className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 sm:p-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <OfflineIndicator />
          {renderHamburgerDrawer()}
          <NotaReceiptModal
            receipt={activeReceipt}
            settings={settings}
            customers={customers}
            onClose={() => setActiveReceipt(null)}
          />

          {/* Top Bar outside phone frame on desktop */}
          <div className="w-full max-w-[430px] flex items-center justify-between px-3 py-2 text-white text-xs mb-1">
            <span className="font-medium text-slate-300">Pratinjau Layar HP Android</span>
            <div className="flex items-center gap-2">
              <PWAInstallButton compact />
              <button
                onClick={() => setAndroidPreviewMode(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Layar Penuh</span>
              </button>
            </div>
          </div>

          {/* Android Phone Frame (420px x 840px) */}
          <div className="w-full max-w-[430px] h-[86vh] min-h-[640px] bg-slate-50 sm:rounded-[32px] sm:border-[6px] sm:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
            {/* Compact Android App Bar with Hamburger Menu Button */}
            <header className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  title="Buka Menu (Atau Geser Kanan)"
                  className="p-1.5 -ml-1 text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {activeTab !== 'dashboard' && (
                  <button
                    type="button"
                    onClick={() => handleBackActionRef.current()}
                    title="Kembali ke halaman sebelumnya"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </button>
                )}
                <div className="text-xs sm:text-sm font-bold tracking-tight truncate">
                  {settings.storeName}
                </div>
              </div>
              <button
                onClick={() => openDrawerSection('customers')}
                title="Data Pelanggan"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg cursor-pointer shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pelanggan</span>
              </button>
            </header>

            {/* Scrollable Android Content Area */}
            {licenseEval.status === 'trial_active' && (
              <TrialCountdownBanner
                licenseState={trialLicenseState}
                remainingText={licenseEval.remainingText}
                isOwnerSimulation={licenseEval.isOwnerAccount}
                onUpdateLicenseState={handleUpdateTrialLicenseState}
              />
            )}
            <main className="flex-1 overflow-y-auto p-2.5 pb-16">
              {renderActiveView()}
            </main>

            {/* Fixed 5-Tab Android Bottom Navigation Bar */}
            <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-14 shrink-0 px-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
                      isActive ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <div
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${
                        isActive ? 'bg-slate-900 text-white' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[68px]">
                      {item.mobileLabel}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen bg-slate-50 flex flex-col pb-16 lg:pb-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <OfflineIndicator />
        {renderHamburgerDrawer()}
        <NotaReceiptModal
          receipt={activeReceipt}
          settings={settings}
          customers={customers}
          onClose={() => setActiveReceipt(null)}
        />

        {/* Left-Edge Swipe Sensor Strip for Android/Mobile Touch Swipe-Right */}
        <div
          className="fixed left-0 top-12 bottom-14 w-3 z-20 lg:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* 3-Day Free Trial Countdown Banner (Shown when in Trial Mode) */}
        {licenseEval.status === 'trial_active' && (
          <TrialCountdownBanner
            licenseState={trialLicenseState}
            remainingText={licenseEval.remainingText}
            isOwnerSimulation={licenseEval.isOwnerAccount}
            onUpdateLicenseState={handleUpdateTrialLicenseState}
          />
        )}

        {/* Compact 3-Zone Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-5 h-12 sm:h-13 flex items-center justify-between gap-4">
          {/* Zone 1: Hamburger Button + Back Button + Single-Line Brand Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                setIsDrawerOpen(true);
                pushBrowserHistoryGuard(true);
              }}
              title="Menu Utama (Geser Kanan untuk Membuka)"
              className="p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            {activeTab !== 'dashboard' && (
              <button
                type="button"
                onClick={() => handleBackActionRef.current()}
                title="Kembali ke halaman sebelumnya"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>
            )}
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                switchTab('dashboard');
              }}
              className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate whitespace-nowrap"
            >
              {settings.storeName}
            </a>
          </div>

          {/* Zone 2: 5 Clean Primary Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2'
                    : 'hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Actions (Data Pelanggan & Unduh APK) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => openDrawerSection('customers')}
              title="Data Pelanggan & Kontak Telepon"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pelanggan ({customers.length})</span>
            </button>
            <PWAInstallButton compact />
          </div>
        </header>

        {/* Main Content Viewport (Full Width, Compact Padding) */}
        <main className="flex-1 min-w-0 p-2.5 sm:p-4 lg:p-5 max-w-6xl mx-auto w-full">
          {renderActiveView()}
        </main>

        {/* Double-Back Exit Confirmation Toast */}
        {backExitToast && (
          <div className="fixed bottom-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white text-xs font-semibold shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none">
            Tekan Kembali sekali lagi untuk keluar aplikasi
          </div>
        )}

        {/* Fixed Compact Bottom Navigation Bar on Android / Mobile (< lg) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-14 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <div
                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-slate-900 text-white' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[68px]">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </ErrorBoundary>
  );
}
