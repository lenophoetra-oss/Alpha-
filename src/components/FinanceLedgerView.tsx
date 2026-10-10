import React, { useState, useMemo } from 'react';
import {
  Wallet,
  DebtRecord,
  DebtType,
  LedgerTransaction,
  CustomerRecord,
  ReceiptPayload,
  PersonalExpensePriority,
  PERSONAL_PRIORITY_LABELS,
  formatIDR,
  getTodayDateString,
  buildWhatsAppUrl,
} from '../types';
import {
  createTransaction,
  createDebtRecord,
  payDebtInstallment,
  deleteDebtRecord,
  deleteTransaction,
} from '../services/firestoreService';
import { HistoryView } from './HistoryView';
import { CustomerContactInput } from './CustomerContactInput';
import { CurrencyInput } from './CurrencyInput';
import { Plus, CheckCircle2, Trash2, MessageCircle, Printer, Wallet as WalletIcon } from 'lucide-react';

interface FinanceLedgerViewProps {
  uid: string;
  wallets: Wallet[];
  debts: DebtRecord[];
  transactions: LedgerTransaction[];
  customers?: CustomerRecord[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

export const FinanceLedgerView: React.FC<FinanceLedgerViewProps> = ({
  uid,
  wallets,
  debts,
  transactions,
  customers = [],
  onOpenReceipt,
}) => {
  const [subTab, setSubTab] = useState<
    'pengeluaran_gaji' | 'dompet_pribadi' | 'hutang_piutang' | 'riwayat'
  >('pengeluaran_gaji');

  // Modal Pengeluaran Toko & Gaji Pribadi
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<'pengeluaran_toko' | 'gaji_pribadi'>(
    'pengeluaran_toko'
  );
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseWalletId, setExpenseWalletId] = useState(wallets[0]?.id || '');
  const [expenseDate, setExpenseDate] = useState(getTodayDateString());
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Modal Pencatatan Pribadi (Dompet Pribadi: Kebutuhan vs Foya-foya vs Tabungan)
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [personalFlowMode, setPersonalFlowMode] = useState<'keluar' | 'masuk'>('keluar');
  const [personalPriority, setPersonalPriority] = useState<PersonalExpensePriority>('kebutuhan');
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalAmount, setPersonalAmount] = useState('');
  const [personalSourceMode, setPersonalSourceMode] = useState<'saldo_gaji' | 'potong_kantong'>(
    'saldo_gaji'
  );
  const [personalWalletId, setPersonalWalletId] = useState(wallets[0]?.id || '');
  const [personalDate, setPersonalDate] = useState(getTodayDateString());
  const [personalNotes, setPersonalNotes] = useState('');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  // Modal Hutang Piutang Baru
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [debtType, setDebtType] = useState<DebtType>('piutang');
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [debtDate, setDebtDate] = useState(getTodayDateString());
  const [debtWalletId, setDebtWalletId] = useState(wallets[0]?.id || '');
  const [recordInitialCashFlow, setRecordInitialCashFlow] = useState(false);
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  // Modal Bayar Cicilan / Lunas Hutang Piutang
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState(wallets[0]?.id || '');
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payNotes, setPayNotes] = useState('');

  const expenseHistory = useMemo(() => {
    return transactions.filter(
      (tx) => tx.category === 'pengeluaran_toko' || tx.category === 'gaji_pribadi'
    );
  }, [transactions]);

  const personalHistory = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.category === 'gaji_pribadi' ||
        tx.category === 'pengeluaran_pribadi' ||
        tx.category === 'pemasukan_pribadi'
    );
  }, [transactions]);

  const personalStats = useMemo(() => {
    let totalGajiDariToko = 0;
    let totalPemasukanLain = 0;
    let totalPengeluaranPribadi = 0;
    let totalKebutuhan = 0;
    let totalFoya = 0;
    let totalTabungan = 0;

    for (const tx of personalHistory) {
      if (tx.category === 'gaji_pribadi') {
        totalGajiDariToko += tx.amount;
      } else if (tx.category === 'pemasukan_pribadi') {
        totalPemasukanLain += tx.amount;
      } else if (tx.category === 'pengeluaran_pribadi') {
        totalPengeluaranPribadi += tx.amount;
        if (tx.referenceId === 'foya') {
          totalFoya += tx.amount;
        } else if (tx.referenceId === 'tabungan') {
          totalTabungan += tx.amount;
        } else {
          totalKebutuhan += tx.amount;
        }
      }
    }

    const totalDanaPribadi = totalGajiDariToko + totalPemasukanLain;
    const sisaUangPribadi = totalDanaPribadi - totalPengeluaranPribadi;

    let dominantLabel = 'Belum ada pengeluaran';
    if (totalPengeluaranPribadi > 0) {
      if (totalFoya > totalKebutuhan && totalFoya >= totalTabungan) {
        dominantLabel = 'Terbanyak untuk Hiburan / Foya-foya';
      } else if (totalKebutuhan >= totalFoya && totalKebutuhan >= totalTabungan) {
        dominantLabel = 'Terbanyak untuk Kebutuhan Pokok & Rumah';
      } else {
        dominantLabel = 'Terbanyak untuk Tabungan / Keluarga';
      }
    }

    return {
      totalGajiDariToko,
      totalPemasukanLain,
      totalDanaPribadi,
      totalPengeluaranPribadi,
      sisaUangPribadi,
      totalKebutuhan,
      totalFoya,
      totalTabungan,
      dominantLabel,
    };
  }, [personalHistory]);

  const totals = useMemo(() => {
    let totalBiayaToko = 0;
    let totalGajiPribadi = 0;
    for (const tx of expenseHistory) {
      if (tx.category === 'pengeluaran_toko') totalBiayaToko += tx.amount;
      if (tx.category === 'gaji_pribadi') totalGajiPribadi += tx.amount;
    }

    let sisaPiutang = 0;
    let sisaHutang = 0;
    for (const d of debts) {
      if (d.status === 'belum_lunas') {
        const rem = Math.max(0, d.totalAmount - d.paidAmount);
        if (d.type === 'piutang') sisaPiutang += rem;
        else sisaHutang += rem;
      }
    }

    return { totalBiayaToko, totalGajiPribadi, sisaPiutang, sisaHutang };
  }, [expenseHistory, debts]);

  const openExpenseModal = (cat: 'pengeluaran_toko' | 'gaji_pribadi') => {
    setExpenseCategory(cat);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseWalletId(wallets[0]?.id || '');
    setExpenseDate(getTodayDateString());
    setExpenseNotes('');
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWallet = expenseWalletId || wallets[0]?.id;
    const amt = Number(expenseAmount) || 0;
    if (!expenseTitle.trim() || amt <= 0 || !targetWallet) return;

    setIsSavingExpense(true);
    try {
      await createTransaction(uid, {
        category: expenseCategory,
        flowType: 'keluar',
        title: expenseTitle,
        customerName: expenseCategory === 'gaji_pribadi' ? 'Pemilik (Prive)' : 'Operasional Konter',
        walletId: targetWallet,
        amount: amt,
        costAmount: amt,
        profitAmount: 0,
        dateString: expenseDate,
        notes: expenseNotes || '-',
      });
      setShowExpenseModal(false);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const openPersonalModal = (mode: 'keluar' | 'masuk', priority: PersonalExpensePriority = 'kebutuhan') => {
    setPersonalFlowMode(mode);
    setPersonalPriority(priority);
    setPersonalTitle('');
    setPersonalAmount('');
    setPersonalSourceMode('saldo_gaji');
    setPersonalWalletId(wallets[0]?.id || '');
    setPersonalDate(getTodayDateString());
    setPersonalNotes('');
    setShowPersonalModal(true);
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(personalAmount) || 0;
    if (!personalTitle.trim() || amt <= 0) return;

    const useStoreWallet = personalSourceMode === 'potong_kantong' && personalWalletId;
    setIsSavingPersonal(true);
    try {
      if (personalFlowMode === 'keluar') {
        const priorityLabel = PERSONAL_PRIORITY_LABELS[personalPriority];
        await createTransaction(uid, {
          category: 'pengeluaran_pribadi',
          flowType: 'keluar',
          title: personalTitle,
          customerName: priorityLabel,
          walletId: useStoreWallet ? personalWalletId : '-',
          amount: amt,
          costAmount: 0,
          profitAmount: 0,
          referenceId: personalPriority,
          dateString: personalDate,
          notes:
            personalNotes ||
            (useStoreWallet
              ? `Kategori: ${priorityLabel} (Potong Kas Toko)`
              : `Kategori: ${priorityLabel} (Dari Uang Gaji Pribadi)`),
        });
      } else {
        await createTransaction(uid, {
          category: 'pemasukan_pribadi',
          flowType: 'masuk',
          title: personalTitle,
          customerName: 'Pemasukan Pribadi',
          walletId: useStoreWallet ? personalWalletId : '-',
          amount: amt,
          costAmount: 0,
          profitAmount: 0,
          referenceId: 'masuk_pribadi',
          dateString: personalDate,
          notes: personalNotes || 'Tambahan dana dompet pribadi',
        });
      }
      setShowPersonalModal(false);
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleSaveNewDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !description.trim()) return;
    setIsSubmittingDebt(true);
    try {
      await createDebtRecord(uid, {
        type: debtType,
        personName,
        phone: phone || '-',
        description,
        totalAmount: Number(totalAmount) || 0,
        dueDate,
        walletId: debtWalletId || wallets[0]?.id,
        recordInitialCashFlow,
        dateString: debtDate,
      });
      setShowAddDebtModal(false);
      setPersonName('');
      setPhone('');
      setDescription('');
      setTotalAmount('');
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  const handleOpenPayDebt = (d: DebtRecord) => {
    setPayingDebt(d);
    setPayAmount(String(Math.max(0, d.totalAmount - d.paidAmount)));
    setPayWalletId(wallets[0]?.id || '');
    setPayDate(getTodayDateString());
    setPayNotes('');
  };

  const handleConfirmPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt || !payWalletId) return;
    setIsSubmittingDebt(true);
    try {
      await payDebtInstallment(
        uid,
        payingDebt,
        Number(payAmount) || 0,
        payWalletId,
        payNotes,
        payDate
      );
      setPayingDebt(null);
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header & Clean 4-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          Pembukuan: Biaya Toko, Dompet Pribadi, Piutang & Riwayat
        </h2>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-xl overflow-x-auto self-start max-w-full">
          <button
            onClick={() => setSubTab('pengeluaran_gaji')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'pengeluaran_gaji'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Biaya & Gaji
          </button>
          <button
            onClick={() => setSubTab('dompet_pribadi')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'dompet_pribadi'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dompet Pribadi
          </button>
          <button
            onClick={() => setSubTab('hutang_piutang')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'hutang_piutang'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hutang & Piutang ({debts.filter((d) => d.status === 'belum_lunas').length})
          </button>
          <button
            onClick={() => setSubTab('riwayat')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'riwayat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Riwayat & Edit ({transactions.length})
          </button>
        </div>
      </div>

      {/* TAB 1: PENGELUARAN TOKO & GAJI PRIBADI */}
      {subTab === 'pengeluaran_gaji' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] text-slate-500">Total Biaya Operasional Toko</div>
                <div className="text-base sm:text-lg font-bold font-mono-tabular text-red-600 mt-0.5">
                  {formatIDR(totals.totalBiayaToko)}
                </div>
              </div>
              <button
                onClick={() => openExpenseModal('pengeluaran_toko')}
                disabled={wallets.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-xl whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Biaya Toko</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] text-slate-500">Total Gaji Pribadi Diambil (Prive)</div>
                <div className="text-base sm:text-lg font-bold font-mono-tabular text-amber-600 mt-0.5">
                  {formatIDR(totals.totalGajiPribadi)}
                </div>
              </div>
              <button
                onClick={() => openExpenseModal('gaji_pribadi')}
                disabled={wallets.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-xl whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ambil Gaji</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Riwayat Biaya Toko & Gaji Pribadi ({expenseHistory.length})
              </h3>
              <button
                onClick={() => setSubTab('dompet_pribadi')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                Lihat Pemakaian Uang Pribadi &rarr;
              </button>
            </div>
            {expenseHistory.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Belum ada catatan pengeluaran operasional atau pengambilan gaji pribadi.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenseHistory.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {tx.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tx.dateString} ·{' '}
                        {tx.category === 'gaji_pribadi'
                          ? 'Gaji Pribadi (Prive)'
                          : 'Biaya Operasional Toko'}
                        {tx.notes && tx.notes !== '-' ? ` · ${tx.notes}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-mono-tabular font-bold ${
                          tx.category === 'gaji_pribadi' ? 'text-amber-600' : 'text-red-600'
                        }`}
                      >
                        -{formatIDR(tx.amount)}
                      </span>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-xl cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DOMPET PRIBADI (KEBUTUHAN POKOK VS FOYA-FOYA VS TABUNGAN) */}
      {subTab === 'dompet_pribadi' && (
        <div className="space-y-3.5">
          {/* Top Summary Cards: Sisa Uang Pribadi, Total Masuk, Total Terpakai */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs text-slate-500">
                  Sisa Uang Pribadi (Dari Gaji Prive + Pemasukan Pribadi)
                </div>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span
                    className={`text-xl sm:text-2xl font-bold font-mono-tabular ${
                      personalStats.sisaUangPribadi >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatIDR(personalStats.sisaUangPribadi)}
                  </span>
                  <span className="text-xs text-slate-500">{personalStats.dominantLabel}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openPersonalModal('masuk')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Dana Pribadi</span>
                </button>
                <button
                  onClick={() => openPersonalModal('keluar', 'kebutuhan')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <WalletIcon className="w-3.5 h-3.5" />
                  <span>Catat Pengeluaran Pribadi</span>
                </button>
              </div>
            </div>

            {/* Breakdown Cards: Kebutuhan Pokok vs Hiburan/Foya-foya vs Tabungan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-800">Kebutuhan Pokok & Rumah</span>
                  <span className="font-mono-tabular text-[11px] font-bold text-emerald-700">
                    {personalStats.totalPengeluaranPribadi > 0
                      ? `${Math.round(
                          (personalStats.totalKebutuhan / personalStats.totalPengeluaranPribadi) * 100
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <div className="text-base font-bold font-mono-tabular text-slate-900">
                  {formatIDR(personalStats.totalKebutuhan)}
                </div>
                <div className="text-[11px] text-slate-600">
                  Makan, listrik rumah, sekolah, bensin harian
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-800">Hiburan / Foya-foya</span>
                  <span className="font-mono-tabular text-[11px] font-bold text-amber-700">
                    {personalStats.totalPengeluaranPribadi > 0
                      ? `${Math.round(
                          (personalStats.totalFoya / personalStats.totalPengeluaranPribadi) * 100
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <div className="text-base font-bold font-mono-tabular text-slate-900">
                  {formatIDR(personalStats.totalFoya)}
                </div>
                <div className="text-[11px] text-slate-600">
                  Nongkrong, hobi, belanja gaya hidup, jajan
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-800">Tabungan / Keluarga / Sosial</span>
                  <span className="font-mono-tabular text-[11px] font-bold text-blue-700">
                    {personalStats.totalPengeluaranPribadi > 0
                      ? `${Math.round(
                          (personalStats.totalTabungan / personalStats.totalPengeluaranPribadi) * 100
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <div className="text-base font-bold font-mono-tabular text-slate-900">
                  {formatIDR(personalStats.totalTabungan)}
                </div>
                <div className="text-[11px] text-slate-600">
                  Tabungan pribadi, orang tua, sedekah, darurat
                </div>
              </div>
            </div>
          </div>

          {/* Riwayat Catatan Keuangan Pribadi */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Riwayat Uang Pribadi ({personalHistory.length})
              </h3>
              <span className="text-xs font-mono-tabular text-slate-500">
                Total Masuk: {formatIDR(personalStats.totalDanaPribadi)} · Terpakai:{' '}
                {formatIDR(personalStats.totalPengeluaranPribadi)}
              </span>
            </div>

            {personalHistory.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Belum ada catatan pemakaian uang pribadi. Ambil gaji dari toko atau catat pengeluaran pribadi Anda.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {personalHistory.map((tx) => {
                  const isIncome =
                    tx.category === 'gaji_pribadi' || tx.category === 'pemasukan_pribadi';
                  const badgeLabel =
                    tx.category === 'gaji_pribadi'
                      ? 'Gaji dari Toko (Prive)'
                      : tx.category === 'pemasukan_pribadi'
                      ? 'Pemasukan Pribadi'
                      : PERSONAL_PRIORITY_LABELS[tx.referenceId as PersonalExpensePriority] ||
                        'Pengeluaran Pribadi';

                  return (
                    <div
                      key={tx.id}
                      className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {tx.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {tx.dateString} ·{' '}
                          <span
                            className={`font-semibold ${
                              tx.referenceId === 'foya'
                                ? 'text-amber-600'
                                : tx.referenceId === 'tabungan'
                                ? 'text-blue-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {badgeLabel}
                          </span>
                          {tx.notes && tx.notes !== '-' ? ` · ${tx.notes}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-mono-tabular font-bold ${
                            isIncome ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatIDR(tx.amount)}
                        </span>
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-xl cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HUTANG & PIUTANG */}
      {subTab === 'hutang_piutang' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Sisa Piutang (Pelanggan Belum Bayar)</div>
              <div className="text-lg sm:text-xl font-bold font-mono-tabular text-emerald-600">
                {formatIDR(totals.sisaPiutang)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <div className="text-xs text-slate-500">Sisa Hutang Konter</div>
              <div className="text-lg sm:text-xl font-bold font-mono-tabular text-red-600">
                {formatIDR(totals.sisaHutang)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Catat kasbon manual atau lihat piutang otomatis dari Kasir
              </div>
              <button
                onClick={() => setShowAddDebtModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Catat Bon
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {debts.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Belum ada catatan hutang atau piutang.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {debts.map((d) => {
                  const rem = Math.max(0, d.totalAmount - d.paidAmount);
                  return (
                    <div
                      key={d.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {d.personName}
                          </h3>
                          <span
                            className={`text-xs font-semibold ${
                              d.status === 'lunas' ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            · {d.type === 'piutang' ? 'PIUTANG PELANGGAN' : 'HUTANG KONTER'} ·{' '}
                            {d.status === 'lunas' ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          {d.description} · WA: {d.phone} · Tempo: {d.dueDate}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-tabular">
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Total</div>
                            <div className="text-xs sm:text-sm font-medium text-slate-700">
                              {formatIDR(d.totalAmount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Dibayar</div>
                            <div className="text-xs sm:text-sm font-medium text-slate-600">
                              {formatIDR(d.paidAmount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Sisa</div>
                            <div className="text-xs sm:text-sm font-bold text-slate-900">
                              {formatIDR(rem)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {d.status === 'belum_lunas' && (
                            <button
                              onClick={() => handleOpenPayDebt(d)}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Bayar / Lunasi</span>
                            </button>
                          )}
                          {onOpenReceipt && (
                            <button
                              onClick={() =>
                                onOpenReceipt({
                                  receiptNo: `BON-${d.id.slice(-6).toUpperCase()}`,
                                  dateString: getTodayDateString(),
                                  categoryLabel:
                                    d.type === 'piutang'
                                      ? 'Catatan Piutang / Kasbon'
                                      : 'Catatan Hutang Konter',
                                  title: d.description,
                                  customerName: d.personName,
                                  customerPhone: d.phone !== '-' ? d.phone : undefined,
                                  amount: rem,
                                  notes: `Jatuh Tempo: ${d.dueDate}`,
                                  extraLines: [
                                    { label: 'Total Awal', value: formatIDR(d.totalAmount) },
                                    { label: 'Sudah Dibayar', value: formatIDR(d.paidAmount) },
                                    { label: 'Sisa Tagihan', value: formatIDR(rem) },
                                  ],
                                })
                              }
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl cursor-pointer"
                              title="Cetak Nota Kasbon"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Nota</span>
                            </button>
                          )}
                          <a
                            href={buildWhatsAppUrl(
                              d.phone !== '-' ? d.phone : '',
                              `Halo Kak *${d.personName}*, menginfokan rincian catatan *${d.description}* dengan total *${formatIDR(d.totalAmount)}*, sudah dibayar *${formatIDR(d.paidAmount)}*, dan sisa tagihan *${formatIDR(rem)}* (Jatuh tempo: ${d.dueDate}). Terima kasih.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl"
                            title="Chat WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </a>
                          <button
                            onClick={() => deleteDebtRecord(d.id)}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SEMUA RIWAYAT TRANSAKSI (DENGAN TOMBOL EDIT) */}
      {subTab === 'riwayat' && (
        <HistoryView
          wallets={wallets}
          transactions={transactions}
          onOpenReceipt={onOpenReceipt}
        />
      )}

      {/* Modal Input Biaya Toko / Gaji Pribadi */}
      {showExpenseModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowExpenseModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {expenseCategory === 'gaji_pribadi'
                  ? 'Catat Ambil Gaji Pribadi (Prive)'
                  : 'Catat Pengeluaran Operasional Toko'}
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setExpenseCategory('pengeluaran_toko')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  expenseCategory === 'pengeluaran_toko'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Biaya Toko
              </button>
              <button
                type="button"
                onClick={() => setExpenseCategory('gaji_pribadi')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  expenseCategory === 'gaji_pribadi'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gaji Pribadi
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {expenseCategory === 'gaji_pribadi'
                    ? 'Keterangan Ambil Gaji Pribadi'
                    : 'Nama Pengeluaran Operasional'}
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder={
                    expenseCategory === 'gaji_pribadi'
                      ? 'Contoh: Gaji Pribadi Mingguan'
                      : 'Contoh: Token Listrik Konter / Plastik'
                  }
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nominal</label>
                  <CurrencyInput
                    required
                    value={expenseAmount}
                    onChange={setExpenseAmount}
                    placeholder="100.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ambil Dari Kantong Kas
                </label>
                <select
                  value={expenseWalletId}
                  onChange={(e) => setExpenseWalletId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSavingExpense ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pencatatan Dompet Pribadi */}
      {showPersonalModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowPersonalModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {personalFlowMode === 'keluar'
                  ? 'Catat Pemakaian Uang Pribadi'
                  : 'Tambah Pemasukan Dompet Pribadi'}
              </h3>
              <button
                onClick={() => setShowPersonalModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPersonalFlowMode('keluar')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  personalFlowMode === 'keluar'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Pengeluaran Pribadi
              </button>
              <button
                type="button"
                onClick={() => setPersonalFlowMode('masuk')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  personalFlowMode === 'masuk'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Pemasukan Pribadi
              </button>
            </div>

            <form onSubmit={handleSavePersonal} className="space-y-4">
              {personalFlowMode === 'keluar' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori Penggunaan Uang Pribadi
                  </label>
                  <select
                    value={personalPriority}
                    onChange={(e) =>
                      setPersonalPriority(e.target.value as PersonalExpensePriority)
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="kebutuhan">Kebutuhan Pokok & Rumah (Makan, Listrik, Bensin)</option>
                    <option value="foya">Hiburan / Gaya Hidup / Foya-foya (Jajan, Nongkrong, Hobi)</option>
                    <option value="tabungan">Tabungan / Keluarga / Sosial</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dipakai Untuk Apa / Keterangan
                </label>
                <input
                  type="text"
                  required
                  value={personalTitle}
                  onChange={(e) => setPersonalTitle(e.target.value)}
                  placeholder={
                    personalFlowMode === 'keluar'
                      ? 'Contoh: Belanja Dapur / Ngopi & Jajan Malam'
                      : 'Contoh: Bonus / Uang Masuk Pribadi'
                  }
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nominal</label>
                  <CurrencyInput
                    required
                    value={personalAmount}
                    onChange={setPersonalAmount}
                    placeholder="50.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={personalDate}
                    onChange={(e) => setPersonalDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Sumber Dana
                </label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="personalSource"
                      checked={personalSourceMode === 'saldo_gaji'}
                      onChange={() => setPersonalSourceMode('saldo_gaji')}
                    />
                    <span>
                      Dari Saldo Gaji Pribadi (Tidak potong kas toko lagi)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="personalSource"
                      checked={personalSourceMode === 'potong_kantong'}
                      onChange={() => setPersonalSourceMode('potong_kantong')}
                    />
                    <span>Potong / Masuk langsung ke Kantong Kas Toko</span>
                  </label>
                </div>

                {personalSourceMode === 'potong_kantong' && (
                  <select
                    value={personalWalletId}
                    onChange={(e) => setPersonalWalletId(e.target.value)}
                    className="w-full mt-2 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPersonalModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPersonal}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSavingPersonal ? 'Menyimpan...' : 'Simpan Catatan Pribadi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Hutang/Piutang */}
      {showAddDebtModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowAddDebtModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Catat Piutang / Hutang Baru</h3>
              <button
                onClick={() => setShowAddDebtModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSaveNewDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Catatan</label>
                <select
                  value={debtType}
                  onChange={(e) => setDebtType(e.target.value as DebtType)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="piutang">Piutang (Pelanggan Hutang ke Konter)</option>
                  <option value="hutang">Hutang (Konter Hutang ke Supplier)</option>
                </select>
              </div>
              <CustomerContactInput
                uid={uid}
                customers={customers}
                nameValue={personName}
                onNameChange={setPersonName}
                phoneValue={phone}
                onPhoneChange={setPhone}
                nameLabel="Nama Pelanggan / Supplier"
                phoneLabel="Nomor WA / HP"
                namePlaceholder="Contoh: Mas Dani"
                phonePlaceholder="0812..."
                nameRequired
                defaultCategory={debtType === 'hutang' ? 'supplier' : 'umum'}
              />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keterangan</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Kurang bayar HP / Bon Pulsa"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Total Nominal</label>
                  <CurrencyInput
                    required
                    value={totalAmount}
                    onChange={setTotalAmount}
                    placeholder="200.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={debtDate}
                    onChange={(e) => setDebtDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordInitialCashFlow}
                  onChange={(e) => setRecordInitialCashFlow(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Pinjaman uang tunai langsung (Potong / Tambah Kas sekarang)</span>
              </label>
              {recordInitialCashFlow && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Kantong Kas</label>
                  <select
                    value={debtWalletId}
                    onChange={(e) => setDebtWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDebtModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDebt}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bayar Cicilan / Lunas */}
      {payingDebt && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPayingDebt(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {payingDebt.type === 'piutang'
                  ? 'Terima Pembayaran Piutang'
                  : 'Bayar Cicilan Hutang'}
              </h3>
              <button
                onClick={() => setPayingDebt(null)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">{payingDebt.personName}</div>
              <div className="text-slate-600">
                Sisa Tagihan:{' '}
                <span className="font-mono-tabular font-semibold">
                  {formatIDR(Math.max(0, payingDebt.totalAmount - payingDebt.paidAmount))}
                </span>
              </div>
            </div>
            <form onSubmit={handleConfirmPayDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nominal Dibayar Sekarang
                </label>
                <CurrencyInput
                  required
                  value={payAmount}
                  onChange={setPayAmount}
                  placeholder="100.000"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {payingDebt.type === 'piutang'
                      ? 'Uang Masuk Ke Kantong Kas'
                      : 'Ambil Uang Dari Kantong Kas'}
                  </label>
                  <select
                    value={payWalletId}
                    onChange={(e) => setPayWalletId(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Pembayaran
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDebt}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
