import React, { useState, useMemo } from 'react';
import {
  Wallet,
  PhoneInventory,
  CatalogPreset,
  CustomerRecord,
  PawnRecord,
  InvestmentRecord,
  DebtRecord,
  LedgerTransaction,
  WalletType,
  ReceiptPayload,
  formatIDR,
  CATEGORY_LABELS,
  WALLET_TYPE_STYLES,
  getTodayDateString,
} from '../types';
import {
  createWallet,
  updateWallet,
  deleteWallet,
  createTransaction,
  bootstrapStarterData,
} from '../services/firestoreService';
import {
  Plus,
  ArrowLeftRight,
  Edit2,
  Trash2,
  Sparkles,
  ChevronRight,
  Printer,
  Banknote,
  Landmark,
  Smartphone,
  Zap,
} from 'lucide-react';
import { AssetDistributionChart } from './AssetDistributionChart';
import { CurrencyInput } from './CurrencyInput';
import { QuickActionsHub } from './QuickActionsHub';

interface DashboardViewProps {
  uid: string;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  phones: PhoneInventory[];
  presets?: CatalogPreset[];
  customers?: CustomerRecord[];
  pawns: PawnRecord[];
  investments: InvestmentRecord[];
  debts: DebtRecord[];
  transactions: LedgerTransaction[];
  onNavigate: (tab: string) => void;
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

type DateFilter = 'today' | '7days' | 'month' | 'all';
type OverviewMode = 'profit' | 'assets';

export const DashboardView: React.FC<DashboardViewProps> = ({
  uid,
  wallets,
  walletBalances,
  phones,
  presets = [],
  customers = [],
  pawns,
  investments,
  debts,
  transactions,
  onNavigate,
  onOpenReceipt,
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('profit');
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Wallet Modal State
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('tunai');
  const [walletInitialBalance, setWalletInitialBalance] = useState('');
  const [walletAccountInfo, setWalletAccountInfo] = useState('');
  const [isSavingWallet, setIsSavingWallet] = useState(false);

  // Transfer / Mutasi Modal State
  const [showMutasiModal, setShowMutasiModal] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [mutasiAmount, setMutasiAmount] = useState('');
  const [mutasiAdminCost, setMutasiAdminCost] = useState('0');
  const [mutasiDate, setMutasiDate] = useState(getTodayDateString());
  const [mutasiNotes, setMutasiNotes] = useState('');
  const [isSavingMutasi, setIsSavingMutasi] = useState(false);

  const todayStr = getTodayDateString();
  const currentMonthPrefix = todayStr.slice(0, 7);

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (dateFilter === 'today') return tx.dateString === todayStr;
      if (dateFilter === '7days') return tx.dateString >= sevenDaysAgoStr;
      if (dateFilter === 'month') return tx.dateString.startsWith(currentMonthPrefix);
      return true;
    });
  }, [transactions, dateFilter, todayStr, sevenDaysAgoStr, currentMonthPrefix]);

  const metrics = useMemo(() => {
    let omsetPenjualan = 0;
    let labaKotor = 0;
    let pengeluaranToko = 0;
    let gajiPribadi = 0;
    let belanjaKulakan = 0;

    let omsetHp = 0;
    let labaHp = 0;
    let unitHpTerjual = 0;

    let omsetKonterHarian = 0;
    let labaKonterHarian = 0;
    let labaGadaiInvestasi = 0;

    const salesCategories = new Set([
      'jual_hp',
      'voucher',
      'pulsa_data',
      'aksesoris',
      'topup_transfer',
      'servis',
      'gadai_masuk',
      'investasi_masuk',
    ]);

    for (const tx of filteredTransactions) {
      if (salesCategories.has(tx.category)) {
        omsetPenjualan += tx.amount;
        labaKotor += tx.profitAmount;
      }

      if (tx.category === 'jual_hp') {
        omsetHp += tx.amount;
        labaHp += tx.profitAmount;
        unitHpTerjual += 1;
      } else if (
        tx.category === 'voucher' ||
        tx.category === 'pulsa_data' ||
        tx.category === 'aksesoris' ||
        tx.category === 'topup_transfer' ||
        tx.category === 'servis'
      ) {
        omsetKonterHarian += tx.amount;
        labaKonterHarian += tx.profitAmount;
      } else if (tx.category === 'gadai_masuk' || tx.category === 'investasi_masuk') {
        labaGadaiInvestasi += tx.profitAmount;
      }

      if (tx.category === 'pengeluaran_toko') {
        pengeluaranToko += tx.amount;
      } else if (tx.category === 'gaji_pribadi') {
        gajiPribadi += tx.amount;
      } else if (tx.category === 'kulakan_barang' || tx.category === 'beli_hp') {
        belanjaKulakan += tx.amount;
      }
    }

    const labaBersihToko = labaKotor - pengeluaranToko;
    const sisaLabaSetelahGaji = labaBersihToko - gajiPribadi;

    return {
      omsetPenjualan,
      labaKotor,
      pengeluaranToko,
      labaBersihToko,
      gajiPribadi,
      sisaLabaSetelahGaji,
      belanjaKulakan,
      omsetHp,
      labaHp,
      unitHpTerjual,
      omsetKonterHarian,
      labaKonterHarian,
      labaGadaiInvestasi,
    };
  }, [filteredTransactions]);

  const assetPositions = useMemo(() => {
    const totalLiquidCash = wallets.reduce((sum, w) => sum + (walletBalances[w.id] ?? 0), 0);

    const activePhones = phones.filter((p) => p.status !== 'terjual');
    const modalStokHp = activePhones.reduce((sum, p) => sum + p.buyPrice + p.serviceCost, 0);
    const countHpReady = phones.filter((p) => p.status === 'tersedia').length;
    const countHpServis = phones.filter((p) => p.status === 'servis').length;

    const activePawns = pawns.filter((pw) => pw.status === 'aktif' || pw.status === 'diperpanjang');
    const modalGadaiAktif = activePawns.reduce((sum, pw) => sum + pw.loanAmount, 0);

    const activeInvestments = investments.filter((inv) => inv.status === 'aktif');
    const modalInvestasiAktif = activeInvestments.reduce(
      (sum, inv) => sum + Math.max(0, inv.capitalAmount - inv.returnedCapital),
      0
    );

    const sisaPiutang = debts
      .filter((d) => d.type === 'piutang' && d.status === 'belum_lunas')
      .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

    const sisaHutang = debts
      .filter((d) => d.type === 'hutang' && d.status === 'belum_lunas')
      .reduce((sum, d) => sum + Math.max(0, d.totalAmount - d.paidAmount), 0);

    const totalKekayaanBersih =
      totalLiquidCash + modalStokHp + modalGadaiAktif + modalInvestasiAktif + sisaPiutang - sisaHutang;

    return {
      totalLiquidCash,
      modalStokHp,
      countHpReady,
      countHpServis,
      activePawnsCount: activePawns.length,
      modalGadaiAktif,
      activeInvestmentsCount: activeInvestments.length,
      modalInvestasiAktif,
      sisaPiutang,
      sisaHutang,
      totalKekayaanBersih,
    };
  }, [wallets, walletBalances, phones, pawns, investments, debts]);

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      await bootstrapStarterData(uid);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const openAddWallet = () => {
    setEditingWallet(null);
    setWalletName('');
    setWalletType('tunai');
    setWalletInitialBalance('0');
    setWalletAccountInfo('');
    setShowWalletModal(true);
  };

  const openEditWallet = (w: Wallet) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletType(w.type);
    setWalletInitialBalance(String(w.initialBalance));
    setWalletAccountInfo(w.accountInfo === '-' ? '' : w.accountInfo);
    setShowWalletModal(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) return;
    setIsSavingWallet(true);
    try {
      if (editingWallet) {
        await updateWallet(editingWallet.id, {
          name: walletName,
          type: walletType,
          initialBalance: Number(walletInitialBalance) || 0,
          accountInfo: walletAccountInfo || '-',
        });
      } else {
        await createWallet(uid, {
          name: walletName,
          type: walletType,
          initialBalance: Number(walletInitialBalance) || 0,
          accountInfo: walletAccountInfo || '-',
        });
      }
      setShowWalletModal(false);
    } finally {
      setIsSavingWallet(false);
    }
  };

  const handleOpenMutasi = () => {
    setFromWalletId(wallets[0]?.id || '');
    setToWalletId(wallets[1]?.id || wallets[0]?.id || '');
    setMutasiAmount('');
    setMutasiAdminCost('0');
    setMutasiDate(getTodayDateString());
    setMutasiNotes('');
    setShowMutasiModal(true);
  };

  const handleSaveMutasi = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(mutasiAmount) || 0;
    const adminCost = Number(mutasiAdminCost) || 0;
    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId || amount <= 0) return;

    const fromWallet = wallets.find((w) => w.id === fromWalletId);
    const toWallet = wallets.find((w) => w.id === toWalletId);

    setIsSavingMutasi(true);
    try {
      await createTransaction(uid, {
        category: 'mutasi_saldo',
        flowType: 'mutasi',
        title: `Pindah Saldo: ${fromWallet?.name || 'Asal'} ke ${toWallet?.name || 'Tujuan'}`,
        customerName: 'Internal Konter',
        walletId: fromWalletId,
        secondaryWalletId: toWalletId,
        amount: amount + adminCost,
        secondaryAmount: amount,
        costAmount: adminCost,
        profitAmount: -adminCost,
        dateString: mutasiDate,
        notes: mutasiNotes || 'Mutasi saldo antar kantong kas',
      });
      setShowMutasiModal(false);
    } finally {
      setIsSavingMutasi(false);
    }
  };

  const walletTypeLabel: Record<WalletType, string> = {
    tunai: 'Kas Tunai',
    bank: 'Rekening Bank',
    server: 'Saldo Server',
    ewallet: 'E-Wallet',
  };

  const walletTypeIcon: Record<WalletType, React.ComponentType<{ className?: string }>> = {
    tunai: Banknote,
    bank: Landmark,
    ewallet: Smartphone,
    server: Zap,
  };

  return (
    <div className="space-y-3.5">
      {/* Starter Banner if no wallets exist yet */}
      {wallets.length === 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold">Mulai Cepat Kasir Konter & Gadai Pro</h2>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Siapkan otomatis 3 kantong kas utama (Kas Laci, Bank, Server Pulsa) dan preset voucher populer.
            </p>
          </div>
          <button
            onClick={handleBootstrap}
            disabled={isBootstrapping}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isBootstrapping ? 'Menyiapkan...' : 'Buat Kantong Standar'}
          </button>
        </div>
      )}

      {/* 1. Ringkas: Saldo Kas Aktif & Daftar Kantong Kas (Grid 2 Kolom di HP) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <div className="text-[11px] text-slate-500">Total Saldo Kas Aktif</div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono-tabular text-slate-900 tracking-tight">
                {formatIDR(assetPositions.totalLiquidCash)}
              </span>
              <span className="text-[11px] text-slate-500">
                Kekayaan Bersih:{' '}
                <strong className="font-mono-tabular text-emerald-700">
                  {formatIDR(assetPositions.totalKekayaanBersih)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {wallets.length >= 2 && (
              <button
                onClick={handleOpenMutasi}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Mutasi</span>
              </button>
            )}
            <button
              onClick={openAddWallet}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Kantong</span>
            </button>
          </div>
        </div>

        {/* Daftar Kantong Kas Compact Grid (Warna Kantong Seragam Mode Gelap & Saldo Tidak Terpotong) */}
        {wallets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {wallets.map((w) => {
              const liveBal = walletBalances[w.id] ?? w.initialBalance;
              const style = WALLET_TYPE_STYLES[w.type] || WALLET_TYPE_STYLES.tunai;
              const WIcon = walletTypeIcon[w.type] || Banknote;
              return (
                <div
                  key={w.id}
                  className={`p-2.5 sm:p-3 transition-colors flex flex-col justify-between gap-2 ${style.cardBg}`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="wallet-icon-box w-7 h-7 rounded-lg border flex items-center justify-center shrink-0">
                        <WIcon className={`w-3.5 h-3.5 ${style.dotColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="wallet-label-text text-[11px] font-semibold truncate">
                          {w.name}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {walletTypeLabel[w.type]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center shrink-0 -mr-1">
                      <button
                        onClick={() => openEditWallet(w)}
                        title="Edit Kantong"
                        className="wallet-action-btn p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteWallet(w.id)}
                        title="Hapus Kantong"
                        className="wallet-action-btn p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="wallet-balance-text text-xs sm:text-sm font-bold font-mono-tabular tracking-tight truncate pt-1 border-t border-slate-700/60">
                    {formatIDR(liveBal)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 1B. Menu Aksi Cepat Lengkap (12 Icon Transaksi Terkelompok) */}
      <QuickActionsHub
        uid={uid}
        wallets={wallets}
        phones={phones}
        presets={presets}
        customers={customers}
        onOpenReceipt={onOpenReceipt}
        onNavigate={onNavigate}
      />

      {/* 2. Ringkasan Laporan Terpadu (Grid 2x2 Rapat di HP, 4 Kolom di Desktop) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl">
            <button
              onClick={() => setOverviewMode('profit')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                overviewMode === 'profit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laba & Gaji
            </button>
            <button
              onClick={() => setOverviewMode('assets')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                overviewMode === 'assets'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Posisi Modal & Aset
            </button>
          </div>

          {/* Date Filter (Only shown on Profit tab) */}
          {overviewMode === 'profit' && (
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'today', label: 'Hari Ini' },
                  { id: '7days', label: '7 Hari' },
                  { id: 'month', label: 'Bulan Ini' },
                  { id: 'all', label: 'Semua' },
                ] as { id: DateFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDateFilter(tab.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    dateFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {overviewMode === 'profit' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Total Omset</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(metrics.omsetPenjualan)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                HP {formatIDR(metrics.omsetHp)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Laba Kotor</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-emerald-600 truncate">
                +{formatIDR(metrics.labaKotor)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                HP ({metrics.unitHpTerjual}u): {formatIDR(metrics.labaHp)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Laba Bersih Toko</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(metrics.labaBersihToko)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Biaya: {formatIDR(metrics.pengeluaranToko)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Gaji Diambil (Prive)</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-amber-600 truncate">
                {formatIDR(metrics.gajiPribadi)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Sisa: <span className="font-mono-tabular font-semibold text-slate-800">{formatIDR(metrics.sisaLabaSetelahGaji)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Modal Stok HP</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(assetPositions.modalStokHp)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {assetPositions.countHpReady} Siap · {assetPositions.countHpServis} Servis
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Uang di Gadai</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(assetPositions.modalGadaiAktif)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {assetPositions.activePawnsCount} barang aktif
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Tanam Modal</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(assetPositions.modalInvestasiAktif)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {assetPositions.activeInvestmentsCount} mitra aktif
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Piutang vs Hutang</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(assetPositions.sisaPiutang)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Hutang: <span className="font-mono-tabular text-red-600">{formatIDR(assetPositions.sisaHutang)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Side-by-Side di Desktop & Compact di HP: Grafik Distribusi Aset + Transaksi Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        <div className="lg:col-span-6">
          <AssetDistributionChart
            cashAmount={assetPositions.totalLiquidCash}
            phoneInventoryValue={assetPositions.modalStokHp}
            activePawnLoans={assetPositions.modalGadaiAktif}
            phoneUnitsCount={assetPositions.countHpReady + assetPositions.countHpServis}
            activePawnsCount={assetPositions.activePawnsCount}
          />
        </div>

        {/* 4. Aktivitas Transaksi Terakhir */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Transaksi Terbaru</h3>
              <button
                onClick={() => onNavigate('finance')}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <span>Semua Riwayat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="p-6 text-center space-y-2.5">
                <p className="text-xs text-slate-500">Belum ada transaksi tercatat hari ini.</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onNavigate('phones')}
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Input HP
                  </button>
                  <button
                    onClick={() => onNavigate('pos')}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Kasir Voucher
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.slice(0, 4).map((tx) => (
                  <div
                    key={tx.id}
                    className="px-3.5 py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {tx.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {tx.dateString} · {CATEGORY_LABELS[tx.category]} · {tx.customerName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono-tabular">
                        <div
                          className={`text-xs font-bold ${
                            tx.flowType === 'masuk'
                              ? 'text-emerald-600'
                              : tx.flowType === 'keluar'
                              ? 'text-red-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {tx.flowType === 'masuk' ? '+' : tx.flowType === 'keluar' ? '-' : ''}
                          {formatIDR(tx.amount)}
                        </div>
                        {tx.profitAmount !== 0 && (
                          <div
                            className={`text-[10px] ${
                              tx.profitAmount > 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            Laba {tx.profitAmount > 0 ? '+' : ''}
                            {formatIDR(tx.profitAmount)}
                          </div>
                        )}
                      </div>

                      {onOpenReceipt && (
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
                          className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Cetak Nota & Kirim WA"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal Tambah / Edit Kantong Kas */}
      {showWalletModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowWalletModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingWallet ? 'Atur Kantong Saldo' : 'Tambah Kantong Saldo'}
              </h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSaveWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kantong Kas</label>
                <input
                  type="text"
                  required
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="Contoh: Kas Tunai Laci / BCA Konter / Server Pulsa"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Kantong</label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as WalletType)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 bg-white"
                >
                  <option value="tunai">Kas Tunai (Laci)</option>
                  <option value="bank">Rekening Bank / M-Banking</option>
                  <option value="server">Saldo Server Pulsa / PPOB</option>
                  <option value="ewallet">E-Wallet (DANA / OVO / GoPay)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Saldo Awal
                </label>
                <CurrencyInput
                  required
                  value={walletInitialBalance}
                  onChange={setWalletInitialBalance}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan / Nomor Rekening (Opsional)
                </label>
                <input
                  type="text"
                  value={walletAccountInfo}
                  onChange={(e) => setWalletAccountInfo(e.target.value)}
                  placeholder="Contoh: BCA 1234567890"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingWallet}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isSavingWallet ? 'Menyimpan...' : 'Simpan Kantong'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mutasi / Pindah Saldo Antar Kantong */}
      {showMutasiModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowMutasiModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Pindah / Deposit Saldo</h3>
              <button
                onClick={() => setShowMutasiModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSaveMutasi} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Dari Kantong</label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ke Kantong</label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nominal Pindah</label>
                  <CurrencyInput
                    required
                    value={mutasiAmount}
                    onChange={setMutasiAmount}
                    placeholder="500.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Biaya Admin</label>
                  <CurrencyInput
                    value={mutasiAdminCost}
                    onChange={setMutasiAdminCost}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Mutasi
                  </label>
                  <input
                    type="date"
                    required
                    value={mutasiDate}
                    onChange={(e) => setMutasiDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={mutasiNotes}
                    onChange={(e) => setMutasiNotes(e.target.value)}
                    placeholder="Contoh: Deposit server"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMutasiModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingMutasi || fromWalletId === toWalletId}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingMutasi ? 'Memproses...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
