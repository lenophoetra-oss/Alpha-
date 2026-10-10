import React, { useState, useMemo } from 'react';
import {
  Wallet,
  PhoneInventory,
  CatalogPreset,
  PawnRecord,
  InvestmentRecord,
  DebtRecord,
  LedgerTransaction,
  CustomerRecord,
  CustomerCategory,
  CUSTOMER_CATEGORY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_BADGE_STYLES,
  PERSONAL_GROUP_LABELS,
  parsePersonalExpenseNotes,
  StoreSettings,
  ReceiptPayload,
  formatIDR,
  getTodayDateString,
  buildWhatsAppUrl,
  License,
} from '../types';
import {
  saveCustomerRecord,
  deleteCustomerRecord,
  restoreBackupData,
  resetUserData,
  addLicense,
} from '../services/firestoreService';
import { downloadSignedApk } from '../utils/apkDownloader';
import { PWAInstallButton } from './PWAInstallButton';
import { AdminTrialKeygenPanel } from './TrialLicenseManager';
import { LicenseDashboard } from './LicenseDashboard';
import { TrialLicenseState } from '../utils/trialLicense';
import {
  pickPhoneContactFromDevice,
  parseVCardText,
  parseClipboardContact,
} from '../utils/phoneContacts';
import {
  User,
  Users,
  BarChart2,
  Settings,
  Info,
  Plus,
  Contact,
  MessageCircle,
  Edit2,
  Trash2,
  Search,
  Printer,
  Download,
  Upload,
  Moon,
  Sun,
  Lock,
  ShieldAlert,
  Check,
  Receipt,
  Smartphone,
  ClipboardPaste,
} from 'lucide-react';

export type DrawerSection =
  | 'profile'
  | 'customers'
  | 'reports'
  | 'trial_license'
  | 'settings'
  | 'about';
export type SettingsTab = 'nota' | 'theme' | 'security' | 'backup' | 'reset';

interface DrawerMenuViewsProps {
  section: DrawerSection;
  initialSettingsTab?: SettingsTab;
  uid: string;
  userEmail: string | null;
  userDisplayName: string | null;
  settings: StoreSettings;
  onUpdateSettings: (next: StoreSettings) => void;
  onLockAppNow: () => void;
  trialLicenseState: TrialLicenseState;
  onUpdateTrialLicenseState: (next: TrialLicenseState) => void;
  wallets: Wallet[];
  phones: PhoneInventory[];
  presets: CatalogPreset[];
  pawns: PawnRecord[];
  investments: InvestmentRecord[];
  debts: DebtRecord[];
  customers: CustomerRecord[];
  transactions: LedgerTransaction[];
  licenses: License[];
  onOpenReceipt: (receipt: ReceiptPayload) => void;
}

export const DrawerMenuViews: React.FC<DrawerMenuViewsProps> = ({
  section,
  initialSettingsTab = 'nota',
  uid,
  userEmail,
  userDisplayName,
  settings,
  onUpdateSettings,
  onLockAppNow,
  trialLicenseState,
  onUpdateTrialLicenseState,
  wallets,
  phones,
  presets,
  pawns,
  investments,
  debts,
  customers,
  transactions,
  licenses,
  onOpenReceipt,
}) => {
  // --- 1. PROFILE STATE ---
  const [profileSaved, setProfileSaved] = useState(false);

  // --- 2. CUSTOMERS STATE ---
  const [custSearch, setCustSearch] = useState('');
  const [custCategoryFilter, setCustCategoryFilter] = useState<CustomerCategory | 'all'>('all');
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCategory, setCustCategory] = useState<CustomerCategory>('umum');
  const [custNotes, setCustNotes] = useState('');
  const [isSavingCust, setIsSavingCust] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [contactMsgType, setContactMsgType] = useState<'success' | 'info'>('info');

  // --- 3. REPORTS STATE ---
  const [reportPeriod, setReportPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // --- 4. SETTINGS STATE ---
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(initialSettingsTab);
  const [notaSaved, setNotaSaved] = useState(false);
  const [pinInput, setPinInput] = useState(settings.appPinCode || '');
  const [pinSavedMsg, setPinSavedMsg] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatusMsg, setBackupStatusMsg] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetScope, setResetScope] = useState<'transactions_only' | 'all_data'>('transactions_only');
  const [isResetting, setIsResetting] = useState(false);
  const [resetDoneMsg, setResetDoneMsg] = useState('');

  const isAdmin = userEmail === 'lenophoetra@gmail.com';

  // Contact Picker Helper for Customer Modal & Direct Add from Contacts
  const handlePickFromPhone = async (openModalIfClosed = false) => {
    setContactMsg('');
    const res = await pickPhoneContactFromDevice();
    if (res.status === 'picked' && res.contact) {
      if (openModalIfClosed && !showCustModal) {
        setEditingCustomer(null);
        setCustCategory('umum');
        setCustNotes('Kontak dari Telepon HP');
        setShowCustModal(true);
      }
      if (res.contact.name) setCustName(res.contact.name);
      if (res.contact.phone) setCustPhone(res.contact.phone);
      setContactMsgType('success');
      setContactMsg(
        `Berhasil mengambil "${res.contact.name}" (${res.contact.phone || 'tanpa nomor'}) dari Kontak Telepon HP. Klik Simpan Pelanggan di bawah.`
      );
      return;
    }

    if (res.status === 'blocked_iframe' || res.status === 'unsupported') {
      if (openModalIfClosed && !showCustModal) {
        setEditingCustomer(null);
        setCustName('');
        setCustPhone('');
        setCustCategory('umum');
        setCustNotes('');
        setShowCustModal(true);
      }
      setContactMsgType('info');
      setContactMsg(
        res.message ||
          'Gunakan Aplikasi Android (.APK) atau Chrome HP untuk akses kontak 1-ketukan, atau gunakan tombol Tempel Clipboard / Impor Kontak (.vcf) di bawah.'
      );
    }
  };

  const handlePasteCustomerClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseClipboardContact(text);
      if (parsed && (parsed.name || parsed.phone)) {
        if (parsed.name) setCustName(parsed.name);
        if (parsed.phone) setCustPhone(parsed.phone);
        setContactMsgType('success');
        setContactMsg('Data nama/nomor berhasil ditempel dari Clipboard HP.');
      } else {
        setContactMsgType('info');
        setContactMsg('Clipboard kosong. Salin nama atau nomor WA terlebih dahulu.');
      }
    } catch {
      setContactMsgType('info');
      setContactMsg('Tekan lama pada kolom Nama atau Nomor HP lalu pilih Tempel (Paste).');
    }
  };

  const handleImportVcfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const list = parseVCardText(text);
      if (list.length === 0) {
        setContactMsgType('info');
        setContactMsg('File .vcf tidak berisi kontak yang valid.');
      } else if (list.length === 1) {
        setCustName(list[0].name);
        setCustPhone(list[0].phone);
        setContactMsgType('success');
        setContactMsg(`Kontak "${list[0].name}" (${list[0].phone}) siap disimpan.`);
      } else {
        setIsSavingCust(true);
        let importedCount = 0;
        for (const item of list.slice(0, 100)) {
          await saveCustomerRecord(uid, {
            name: item.name,
            phone: item.phone || '-',
            category: custCategory,
            notes: 'Impor dari Kontak HP (.vcf)',
          });
          importedCount++;
        }
        setIsSavingCust(false);
        setContactMsgType('success');
        setContactMsg(`Berhasil mengimpor ${importedCount} kontak dari HP ke Buku Pelanggan!`);
      }
    } catch {
      setContactMsgType('info');
      setContactMsg('Gagal membaca file kontak (.vcf).');
    } finally {
      e.target.value = '';
    }
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustCategory('umum');
    setCustNotes('');
    setContactMsg('');
    setShowCustModal(true);
  };

  const openEditCustomer = (c: CustomerRecord) => {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustPhone(c.phone === '-' ? '' : c.phone);
    setCustCategory(c.category);
    setCustNotes(c.notes === '-' ? '' : c.notes);
    setContactMsg('');
    setShowCustModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;
    setIsSavingCust(true);
    try {
      await saveCustomerRecord(
        uid,
        {
          name: custName,
          phone: custPhone || '-',
          category: custCategory,
          notes: custNotes || '-',
        },
        editingCustomer?.id
      );
      setShowCustModal(false);
    } finally {
      setIsSavingCust(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (custCategoryFilter !== 'all' && c.category !== custCategoryFilter) return false;
      if (custSearch.trim()) {
        const q = custSearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, custCategoryFilter, custSearch]);

  // --- REPORTS COMPUTATION ---
  const filteredReportTxs = useMemo(() => {
    const todayStr = getTodayDateString();
    const now = new Date();
    return transactions.filter((tx) => {
      if (reportPeriod === 'today') return tx.dateString === todayStr;
      if (reportPeriod === '7days') {
        const d = new Date(tx.dateString);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (reportPeriod === 'month') {
        return tx.dateString.slice(0, 7) === todayStr.slice(0, 7);
      }
      return true;
    });
  }, [transactions, reportPeriod]);

  const reportSummary = useMemo(() => {
    let omset = 0;
    let labaKotor = 0;
    let biayaToko = 0;
    let gajiPribadi = 0;
    let pemasukanPribadi = 0;
    let pengeluaranPribadi = 0;
    let pribadiKebutuhan = 0;
    let pribadiFoya = 0;
    let pribadiTabungan = 0;
    let kulakan = 0;

    const byCategory: Record<
      string,
      { count: number; totalAmount: number; totalProfit: number; flowType: string }
    > = {};

    for (const tx of filteredReportTxs) {
      if (!byCategory[tx.category]) {
        byCategory[tx.category] = {
          count: 0,
          totalAmount: 0,
          totalProfit: 0,
          flowType: tx.flowType,
        };
      }
      byCategory[tx.category].count += 1;
      byCategory[tx.category].totalAmount += tx.amount;
      byCategory[tx.category].totalProfit += tx.profitAmount;

      if (tx.flowType === 'masuk' && tx.category !== 'pemasukan_pribadi') {
        omset += tx.amount;
        labaKotor += tx.profitAmount;
      }
      if (tx.category === 'pengeluaran_toko') biayaToko += tx.amount;
      if (tx.category === 'gaji_pribadi') gajiPribadi += tx.amount;
      if (tx.category === 'pemasukan_pribadi') pemasukanPribadi += tx.amount;
      if (tx.category === 'pengeluaran_pribadi') {
        pengeluaranPribadi += tx.amount;
        const parsed = parsePersonalExpenseNotes(tx.notes, tx.referenceId);
        if (parsed.group === 'foya') pribadiFoya += tx.amount;
        else if (parsed.group === 'tabungan') pribadiTabungan += tx.amount;
        else pribadiKebutuhan += tx.amount;
      }
      if (tx.category === 'beli_hp' || tx.category === 'kulakan_barang') kulakan += tx.amount;
    }

    const labaBersih = labaKotor - biayaToko;
    const sisaLaba = labaBersih - gajiPribadi;
    const totalDanaPribadi = gajiPribadi + pemasukanPribadi;
    const sisaUangPribadi = totalDanaPribadi - pengeluaranPribadi;
    const kesimpulanPribadi =
      pengeluaranPribadi === 0
        ? 'Belum ada pengeluaran pribadi tercatat'
        : pribadiFoya > pribadiKebutuhan
        ? 'Terbanyak dipakai untuk Foya-foya / Hiburan'
        : 'Terbanyak dipakai untuk Kebutuhan Pokok';

    return {
      omset,
      labaKotor,
      biayaToko,
      labaBersih,
      gajiPribadi,
      pemasukanPribadi,
      totalDanaPribadi,
      pengeluaranPribadi,
      sisaUangPribadi,
      pribadiKebutuhan,
      pribadiFoya,
      pribadiTabungan,
      kesimpulanPribadi,
      sisaLaba,
      kulakan,
      byCategory,
    };
  }, [filteredReportTxs]);

  const handleExportReportCSV = () => {
    const headers = [
      'Tanggal',
      'Kategori',
      'Arus',
      'Judul Transaksi',
      'Pelanggan',
      'Nominal (Rp)',
      'Modal (Rp)',
      'Laba (Rp)',
      'Catatan',
    ];
    const rows = filteredReportTxs.map((tx) => [
      tx.dateString,
      CATEGORY_LABELS[tx.category] || tx.category,
      tx.flowType.toUpperCase(),
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.customerName.replace(/"/g, '""')}"`,
      tx.amount,
      tx.costAmount,
      tx.profitAmount,
      `"${tx.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_${settings.storeName.replace(/\s+/g, '_')}_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- BACKUP & RESTORE HANDLERS ---
  const handleDownloadBackup = () => {
    const backupObj = {
      version: '2.5',
      exportedAt: new Date().toISOString(),
      settings,
      wallets,
      presets,
      customers,
      phones,
      pawns,
      investments,
      debts,
      transactions,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_KasirKonter_${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setBackupStatusMsg('File Backup (.json) berhasil diunduh ke perangkat Anda.');
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setBackupStatusMsg('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.settings) {
        onUpdateSettings({ ...settings, ...parsed.settings });
      }
      await restoreBackupData(uid, parsed);
      setBackupStatusMsg('Data Backup berhasil dipulihkan (Restore) ke database konter!');
    } catch (err: any) {
      setBackupStatusMsg(`Gagal memulihkan file backup: ${err?.message || 'Format JSON tidak valid'}`);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    setIsResetting(true);
    setResetDoneMsg('');
    try {
      if (resetScope === 'transactions_only') {
        await resetUserData({ transactions });
        setResetDoneMsg('Seluruh riwayat transaksi berhasil dihapus bersih.');
      } else {
        await resetUserData({
          transactions,
          phones,
          pawns,
          investments,
          debts,
          customers,
          presets,
          wallets,
        });
        setResetDoneMsg('Seluruh data konter telah direset bersih ke kondisi awal.');
      }
      setResetConfirmText('');
    } finally {
      setIsResetting(false);
    }
  };

  // ============================================================================
  // 1. PROFIL VIEW
  // ============================================================================
  if (section === 'profile') {
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {(settings.storeName || 'K').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{settings.storeName}</h2>
              <p className="text-xs text-slate-500 truncate">
                Akun Terhubung: {userDisplayName || settings.ownerName} ({userEmail})
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setProfileSaved(true);
              setTimeout(() => setProfileSaved(false), 2500);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Konter / Toko
                </label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => onUpdateSettings({ ...settings, storeName: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Pemilik / Kasir
                </label>
                <input
                  type="text"
                  required
                  value={settings.ownerName}
                  onChange={(e) => onUpdateSettings({ ...settings, ownerName: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor WhatsApp Konter
                </label>
                <input
                  type="tel"
                  value={settings.storePhone}
                  onChange={(e) => onUpdateSettings({ ...settings, storePhone: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Konter (Tampil di Nota)
                </label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => onUpdateSettings({ ...settings, storeAddress: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {profileSaved ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Check className="w-4 h-4" /> Profil konter tersimpan otomatis!
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  Data profil digunakan pada header struk & nota WhatsApp.
                </span>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Simpan Profil
              </button>
            </div>
          </form>
        </div>

        {/* Ringkasan Statistik Akun */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Pelanggan Terdaftar</div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900">
              {customers.length} Orang
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Unit HP Aktif</div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900">
              {phones.filter((p) => p.status !== 'terjual').length} Unit
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Gadai Berjalan</div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900">
              {pawns.filter((p) => p.status === 'aktif' || p.status === 'diperpanjang').length} Barang
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Total Transaksi</div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900">
              {transactions.length} Nota
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. DATA PELANGGAN VIEW
  // ============================================================================
  if (section === 'customers') {
    return (
      <div className="space-y-3.5">
        {/* Header & Add Customer / Open Phone Contacts Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Buku Data Pelanggan & Kontak ({customers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tambah pelanggan manual atau buka langsung dari Kontak Telepon di HP pengguna
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePickFromPhone(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Contact className="w-4 h-4" />
              <span>Buka Kontak Telepon HP</span>
            </button>
            <button
              type="button"
              onClick={openAddCustomer}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pelanggan</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'umum', label: 'Umum' },
                { id: 'langganan', label: 'Langganan' },
                { id: 'gadai', label: 'Nasabah Gadai' },
                { id: 'supplier', label: 'Supplier' },
              ] as Array<{ id: CustomerCategory | 'all'; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCustCategoryFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  custCategoryFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="Cari nama atau nomor WA..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-slate-500">
                Belum ada data pelanggan. Tambahkan manual atau buka langsung dari Kontak Telepon HP.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePickFromPhone(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Contact className="w-3.5 h-3.5" />
                  <span>Buka Kontak Telepon HP</span>
                </button>
                <button
                  type="button"
                  onClick={openAddCustomer}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  + Tambah Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map((c) => {
                const custTxs = transactions.filter(
                  (t) => t.customerName.toLowerCase() === c.name.toLowerCase()
                );
                const waGreeting = `Halo Kak *${c.name}*, kami dari *${settings.storeName}*. `;
                const waLink = buildWhatsAppUrl(c.phone !== '-' ? c.phone : '', waGreeting);

                return (
                  <div
                    key={c.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{c.name}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {CUSTOMER_CATEGORY_LABELS[c.category]}
                        </span>
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-600">
                        No. HP/WA: <span className="font-semibold text-slate-900">{c.phone}</span> ·{' '}
                        <span>{custTxs.length} transaksi tercatat</span>
                      </div>
                      {c.notes && c.notes !== '-' && (
                        <div className="text-xs text-slate-500">{c.notes}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat WA</span>
                      </a>
                      <button
                        onClick={() => openEditCustomer(c)}
                        className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl cursor-pointer"
                        title="Edit Pelanggan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCustomerRecord(c.id)}
                        className="p-2 text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl cursor-pointer"
                        title="Hapus Pelanggan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Tambah / Edit Pelanggan */}
        {showCustModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowCustModal(false)}
          >
            <div
              className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-3.5 max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Data Pelanggan'}
                </h3>
              </div>

              {/* Primary Phone Contact Action Box */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                <button
                  type="button"
                  onClick={() => handlePickFromPhone(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  <Contact className="w-4 h-4" />
                  <span>Buka Kontak Telepon di HP Pengguna</span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteCustomerClipboard}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-emerald-200 text-[11px] font-medium rounded-lg cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Tempel Nomor</span>
                  </button>
                  <label className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-emerald-200 text-[11px] font-medium rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Impor File (.vcf)</span>
                    <input
                      type="file"
                      accept=".vcf,text/vcard,text/x-vcard"
                      onChange={handleImportVcfFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {contactMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs border ${
                    contactMsgType === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {contactMsg}
                </div>
              )}

              <form onSubmit={handleSaveCustomer} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Pelanggan / Mitra
                  </label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Contoh: Mas Andi"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nomor HP / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kategori
                    </label>
                    <select
                      value={custCategory}
                      onChange={(e) => setCustCategory(e.target.value as CustomerCategory)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="umum">Pelanggan Umum</option>
                      <option value="langganan">Langganan Konter</option>
                      <option value="gadai">Nasabah Gadai</option>
                      <option value="supplier">Supplier / Mitra</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alamat / Catatan Pelanggan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    placeholder="Contoh: Langganan voucher & servis"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCust}
                    className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
                  >
                    {isSavingCust ? 'Menyimpan...' : 'Simpan Pelanggan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 3. LAPORAN LENGKAP VIEW
  // ============================================================================
  if (section === 'reports') {
    const waReportText = [
      `*LAPORAN KEUANGAN - ${settings.storeName.toUpperCase()}*`,
      `Periode: ${reportPeriod.toUpperCase()} (${getTodayDateString()})`,
      `--------------------------------`,
      `Omset Penjualan : ${formatIDR(reportSummary.omset)}`,
      `Laba Kotor      : +${formatIDR(reportSummary.labaKotor)}`,
      `Biaya Toko      : -${formatIDR(reportSummary.biayaToko)}`,
      `*Laba Bersih    : ${formatIDR(reportSummary.labaBersih)}*`,
      `Gaji Diambil    : -${formatIDR(reportSummary.gajiPribadi)}`,
      `Sisa Laba Kas   : ${formatIDR(reportSummary.sisaLaba)}`,
      `Belanja Kulakan : ${formatIDR(reportSummary.kulakan)}`,
      `--------------------------------`,
      `*LAPORAN UANG PRIBADI*`,
      `Dana Pribadi    : ${formatIDR(reportSummary.totalDanaPribadi)}`,
      `Terpakai Pribadi: -${formatIDR(reportSummary.pengeluaranPribadi)}`,
      `• Kebutuhan     : ${formatIDR(reportSummary.pribadiKebutuhan)}`,
      `• Foya-foya     : ${formatIDR(reportSummary.pribadiFoya)}`,
      `• Tabungan/Sosial: ${formatIDR(reportSummary.pribadiTabungan)}`,
      `*Sisa Pribadi   : ${formatIDR(reportSummary.sisaUangPribadi)}*`,
      `Status          : ${reportSummary.kesimpulanPribadi}`,
    ].join('\n');

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Laporan Keuangan & Analitik Toko</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rekapitulasi laba rugi, rincian per kategori, cetak nota, dan kirim laporan ke WhatsApp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={buildWhatsAppUrl(settings.storePhone, waReportText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim Laporan ke WA</span>
            </a>
            <button
              onClick={handleExportReportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start w-fit">
          {(
            [
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua Waktu' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setReportPeriod(p.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                reportPeriod === p.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Omset Masuk & Laba Kotor</div>
            <div className="text-lg font-bold font-mono-tabular text-slate-900">
              {formatIDR(reportSummary.omset)}
            </div>
            <div className="text-xs font-mono-tabular font-semibold text-emerald-600">
              Laba Kotor: +{formatIDR(reportSummary.labaKotor)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Laba Bersih Toko (Setelah Biaya)</div>
            <div className="text-lg font-bold font-mono-tabular text-emerald-600">
              {formatIDR(reportSummary.labaBersih)}
            </div>
            <div className="text-xs font-mono-tabular text-slate-500">
              Biaya Toko: {formatIDR(reportSummary.biayaToko)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Gaji Diambil & Sisa Laba Toko</div>
            <div className="text-lg font-bold font-mono-tabular text-amber-600">
              {formatIDR(reportSummary.gajiPribadi)}
            </div>
            <div className="text-xs font-mono-tabular text-slate-600">
              Sisa Laba Kas: {formatIDR(reportSummary.sisaLaba)}
            </div>
          </div>
        </div>

        {/* Laporan Keuangan Pribadi (Kebutuhan vs Foya-foya & Sisa Uang Pribadi) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Laporan Keuangan Pribadi (Kebutuhan Pokok vs Foya-foya)
              </h3>
              <p className="text-xs text-slate-500">
                Rincian pemakaian uang pribadi, sisa saldo pribadi, dan porsi pengeluaran terbesar
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-xl border self-start ${
                reportSummary.pribadiFoya > reportSummary.pribadiKebutuhan
                  ? 'bg-pink-50 border-pink-200 text-pink-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {reportSummary.kesimpulanPribadi}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500">Total Uang Pribadi (Gaji + Masuk)</div>
              <div className="text-base font-bold font-mono-tabular text-emerald-600">
                {formatIDR(reportSummary.totalDanaPribadi)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500">Total Dipakai Pribadi</div>
              <div className="text-base font-bold font-mono-tabular text-rose-600">
                -{formatIDR(reportSummary.pengeluaranPribadi)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500">Sisa Uang Pribadi</div>
              <div
                className={`text-base font-bold font-mono-tabular ${
                  reportSummary.sisaUangPribadi >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {formatIDR(reportSummary.sisaUangPribadi)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-900">Kebutuhan Pokok</div>
                <div className="text-[11px] text-blue-700">
                  {reportSummary.pengeluaranPribadi > 0
                    ? `${Math.round(
                        (reportSummary.pribadiKebutuhan / reportSummary.pengeluaranPribadi) * 100
                      )}% dari pengeluaran`
                    : '0%'}
                </div>
              </div>
              <div className="text-sm font-bold font-mono-tabular text-blue-900">
                {formatIDR(reportSummary.pribadiKebutuhan)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-pink-50/70 border border-pink-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-pink-900">Foya-foya / Hiburan</div>
                <div className="text-[11px] text-pink-700">
                  {reportSummary.pengeluaranPribadi > 0
                    ? `${Math.round(
                        (reportSummary.pribadiFoya / reportSummary.pengeluaranPribadi) * 100
                      )}% dari pengeluaran`
                    : '0%'}
                </div>
              </div>
              <div className="text-sm font-bold font-mono-tabular text-pink-900">
                {formatIDR(reportSummary.pribadiFoya)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-900">Tabungan & Sosial</div>
                <div className="text-[11px] text-emerald-700">
                  {reportSummary.pengeluaranPribadi > 0
                    ? `${Math.round(
                        (reportSummary.pribadiTabungan / reportSummary.pengeluaranPribadi) * 100
                      )}% dari pengeluaran`
                    : '0%'}
                </div>
              </div>
              <div className="text-sm font-bold font-mono-tabular text-emerald-900">
                {formatIDR(reportSummary.pribadiTabungan)}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Category */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Rekapitulasi per Kategori Transaksi
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.entries(reportSummary.byCategory).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada transaksi pada periode ini.
              </div>
            ) : (
              Object.entries(reportSummary.byCategory).map(([cat, stats]) => (
                <div
                  key={cat}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        CATEGORY_BADGE_STYLES[cat as keyof typeof CATEGORY_BADGE_STYLES] ||
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                    </span>
                    <span className="text-[11px] text-slate-500">{stats.count} transaksi</span>
                  </div>
                  <div className="text-right font-mono-tabular">
                    <div className="font-bold text-slate-900">{formatIDR(stats.totalAmount)}</div>
                    {stats.totalProfit !== 0 && (
                      <div className="text-[11px] text-emerald-600">
                        Laba: +{formatIDR(stats.totalProfit)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Receipts List with Cetak Nota & WA Button */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Daftar Nota Transaksi ({filteredReportTxs.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredReportTxs.slice(0, 20).map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{tx.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {tx.dateString} · {tx.customerName} · {formatIDR(tx.amount)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onOpenReceipt({
                      receiptNo: tx.id.slice(-8).toUpperCase(),
                      dateString: tx.dateString,
                      categoryLabel: CATEGORY_LABELS[tx.category],
                      title: tx.title,
                      customerName: tx.customerName,
                      amount: tx.amount,
                      flowType: tx.flowType,
                      notes: tx.notes,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Nota & WA</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 4. PENGATURAN VIEW (Nota, Mode Gelap/Terang, Keamanan, Backup/Restore, Reset)
  // ============================================================================
  if (section === 'settings') {
    return (
      <div className="space-y-4">
        {/* Sub-menu Tabs for 5 Settings Categories */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'nota', label: 'Pengaturan Nota', icon: Receipt },
              { id: 'theme', label: 'Mode Gelap / Terang', icon: settings.themeMode === 'dark' ? Moon : Sun },
              { id: 'security', label: 'Keamanan Aplikasi', icon: Lock },
              { id: 'backup', label: 'Backup & Restore', icon: Download },
              { id: 'reset', label: 'Reset Data', icon: ShieldAlert },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSettingsTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  settingsTab === t.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4A. PENGATURAN NOTA */}
        {settingsTab === 'nota' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Pengaturan Struk & Nota Kasir</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan tampilan header, nomor WA, ukuran kertas printer thermal, dan pesan garansi di nota
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setNotaSaved(true);
                setTimeout(() => setNotaSaved(false), 2500);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Konter di Header Nota
                  </label>
                  <input
                    type="text"
                    value={settings.storeName}
                    onChange={(e) => onUpdateSettings({ ...settings, storeName: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor HP / WhatsApp Konter
                  </label>
                  <input
                    type="tel"
                    value={settings.storePhone}
                    onChange={(e) => onUpdateSettings({ ...settings, storePhone: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Lengkap / Slogan Konter
                </label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => onUpdateSettings({ ...settings, storeAddress: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Kaki Nota (Pesan Garansi / Ucapan Terima Kasih)
                </label>
                <textarea
                  rows={2}
                  value={settings.receiptFooter}
                  onChange={(e) => onUpdateSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ukuran Kertas Printer Thermal
                  </label>
                  <select
                    value={settings.paperSize}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        paperSize: e.target.value as '58mm' | '80mm',
                      })
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="58mm">Thermal 58mm (Standar Printer Bluetooth HP)</option>
                    <option value="80mm">Thermal 80mm (Kasir Lebar)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showLogoOnReceipt}
                      onChange={(e) =>
                        onUpdateSettings({ ...settings, showLogoOnReceipt: e.target.checked })
                      }
                      className="rounded border-slate-300"
                    />
                    <span>Tampilkan Ikon Toko pada Header Nota</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoOpenReceiptAfterTx}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          autoOpenReceiptAfterTx: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300"
                    />
                    <span>Otomatis tampilkan Nota setelah transaksi disimpan</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenReceipt({
                      receiptNo: 'DEMO-001',
                      dateString: getTodayDateString(),
                      timeString: '14:30',
                      categoryLabel: 'Penjualan HP',
                      title: 'Contoh Nota Penjualan Unit HP',
                      customerName: 'Pelanggan Contoh',
                      customerPhone: settings.storePhone,
                      amount: 2450000,
                      notes: 'Garansi toko 7 hari (Segel utuh)',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Lihat Pratinjau Nota</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  {notaSaved ? 'Tersimpan!' : 'Simpan Pengaturan Nota'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4B. MODE GELAP / TERANG */}
        {settingsTab === 'theme' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tampilan Mode Gelap & Terang</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih tema layar yang paling nyaman untuk mata Anda saat menjaga konter siang maupun malam
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, themeMode: 'light' })}
                className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                  settings.themeMode === 'light'
                    ? 'border-emerald-600 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Mode Terang (Light)</div>
                    <div className="text-xs text-slate-500">
                      Tampilan bersih & cerah untuk siang hari
                    </div>
                  </div>
                </div>
                {settings.themeMode === 'light' && (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, themeMode: 'dark' })}
                className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                  settings.themeMode === 'dark'
                    ? 'border-emerald-500 bg-slate-800/40'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Mode Gelap (Dark)</div>
                    <div className="text-xs text-slate-500">
                      Hemat baterai & nyaman di malam hari
                    </div>
                  </div>
                </div>
                {settings.themeMode === 'dark' && (
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* 4C. KEAMANAN APLIKASI (PIN LOCK) */}
        {settingsTab === 'security' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Keamanan Aplikasi (Kunci PIN Kasir)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lindungi akses pembukuan, saldo kas, dan modal konter dengan kode PIN rahasia
                </p>
              </div>
              {settings.appPinEnabled && settings.appPinCode && (
                <button
                  type="button"
                  onClick={onLockAppNow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci Sekarang</span>
                </button>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.appPinEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    onUpdateSettings({
                      ...settings,
                      appPinEnabled: enabled,
                      appPinCode: enabled && !settings.appPinCode ? '1234' : settings.appPinCode,
                    });
                    if (enabled && !pinInput) setPinInput('1234');
                  }}
                  className="rounded border-slate-300"
                />
                <span>Aktifkan Kunci PIN saat membuka aplikasi</span>
              </label>

              <div className="max-w-xs space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Kode PIN Keamanan (4 - 6 Angka)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Contoh: 1234"
                    className="w-full px-3 py-2 text-sm font-mono-tabular tracking-widest border border-slate-300 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (pinInput.length < 4) {
                        setPinSavedMsg('PIN minimal terdiri dari 4 angka.');
                        return;
                      }
                      onUpdateSettings({
                        ...settings,
                        appPinCode: pinInput,
                        appPinEnabled: true,
                      });
                      setPinSavedMsg('Kode PIN keamanan berhasil disimpan & diaktifkan!');
                    }}
                    className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
                  >
                    Simpan PIN
                  </button>
                </div>
                {pinSavedMsg && (
                  <div className="text-xs font-medium text-emerald-600">{pinSavedMsg}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4D. BACKUP & RESTORE DATA */}
        {settingsTab === 'backup' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Backup & Restore Data Konter</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simpan cadangan seluruh database konter ke file JSON atau pulihkan kembali kapan saja
              </p>
            </div>

            {backupStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                {backupStatusMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Backup Data (Ekspor JSON)</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mengunduh seluruh Kantong Kas, Stok HP, Gadai, Investasi, Pelanggan, dan Transaksi ke HP/Komputer Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Unduh File Backup (.json)
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Restore Data (Impor JSON)</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih file `.json` hasil backup sebelumnya untuk memulihkan data ke dalam akun konter ini.
                  </p>
                </div>
                <label className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center cursor-pointer">
                  <span>{isRestoring ? 'Memulihkan Data...' : 'Pilih File Backup (.json)'}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFileChange}
                    disabled={isRestoring}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 4E. RESET DATA */}
        {settingsTab === 'reset' && (
          <div className="bg-white border border-red-200 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-red-600">Reset & Pembersihan Data</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hati-hati: Tindakan ini akan menghapus data dari database konter Anda. Disarankan melakukan Backup terlebih dahulu.
              </p>
            </div>

            {resetDoneMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                {resetDoneMsg}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'transactions_only'}
                  onChange={() => setResetScope('transactions_only')}
                />
                <span>
                  Hapus Riwayat Transaksi Kas Saja ({transactions.length} transaksi) — Kantong Kas, Stok HP & Pelanggan tetap aman
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-medium text-red-700 cursor-pointer">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'all_data'}
                  onChange={() => setResetScope('all_data')}
                />
                <span>
                  Reset Seluruh Data Aplikasi ke Awal (Hapus Semua Transaksi, Stok HP, Gadai, Hutang, Pelanggan & Kantong Kas)
                </span>
              </label>
            </div>

            <div className="max-w-sm space-y-2 pt-2">
              <label className="block text-xs font-medium text-slate-700">
                Ketik kata <span className="font-mono-tabular font-bold text-red-600">RESET</span> untuk mengonfirmasi:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Ketik RESET"
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                />
                <button
                  type="button"
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || isResetting}
                  onClick={handleExecuteReset}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
                >
                  {isResetting ? 'Mereset...' : 'Jalankan Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 4B. TRIAL 3 HARI & LISENSI CUSTOMER VIEW
  // ============================================================================
  if (section === 'trial_license') {
    return (
      <div className="p-4 space-y-4">
        {isAdmin && (
          <AdminTrialKeygenPanel
            licenseState={trialLicenseState}
            storePhone={settings.storePhone}
            onUpdateLicenseState={onUpdateTrialLicenseState}
          />
        )}
        <LicenseDashboard
          uid={uid}
          userEmail={userEmail}
          licenses={licenses}
          onAddLicense={async (license) => {
            await addLicense(uid, {
              customerPhone: license.customerPhone,
              licenseKey: license.licenseKey,
              type: license.type,
              expiryDate: license.expiryDate,
              status: license.status,
            });
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // 5. TENTANG APLIKASI VIEW
  // ============================================================================
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Kasir Konter & Gadai Pro — Android Mobile Edition
            </h2>
            <p className="text-xs text-slate-500">Versi 3.1.0 · Sistem Manajemen Konter HP, Pergadaian & Kontak HP Terpadu</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Dirancang khusus untuk operasional harian konter HP di Indonesia: mulai dari jual beli HP baru, seken, dan minusan (80% fokus utama), kasir cepat voucher & topup 1-klik, pencatatan gadai barang fleksibel, tanam modal bagi hasil, buku pelanggan terintegrasi kontak telepon HP pengguna, hingga cetak struk thermal & kirim nota via WhatsApp.
        </p>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-bold text-slate-900">
              File Instalasi Android (.APK) Versi Terbaru v3.1 Siap Unduh
            </div>
            <div className="text-xs text-slate-600">
              Berisi paket aplikasi lengkap (Stok HP, 12 Aksi Cepat, Tanggal Transaksi, Trial 3 Hari & Lisensi, Gadai, Pembukuan, Navigasi Kembali Pintar & Kontak HP) dalam file <span className="font-mono-tabular font-semibold">Kasir-Konter-Gadai-Pro-v3.1.apk</span>.
            </div>
          </div>
          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
            <div className="font-bold text-slate-900">Integrasi WhatsApp & Kontak HP</div>
            <div className="text-slate-500">
              Ambil nomor langsung dari buku telepon HP Android & kirim nota transaksi atau pengingat gadai via WhatsApp.
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
            <div className="font-bold text-slate-900">Keamanan Cloud & Backup JSON</div>
            <div className="text-slate-500">
              Tersinkronisasi otomatis dengan akun Google serta dilengkapi fitur Kunci PIN, Mode Gelap, dan Backup/Restore penuh.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
