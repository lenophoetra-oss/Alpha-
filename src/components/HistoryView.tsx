import React, { useState, useMemo } from 'react';
import {
  Wallet,
  LedgerTransaction,
  TransactionCategory,
  TransactionFlowType,
  ReceiptPayload,
  CATEGORY_LABELS,
  formatIDR,
} from '../types';
import { updateTransaction, deleteTransaction } from '../services/firestoreService';
import { Search, Download, Trash2, SlidersHorizontal, Printer, Edit2 } from 'lucide-react';
import { CurrencyInput } from './CurrencyInput';

interface HistoryViewProps {
  wallets: Wallet[];
  transactions: LedgerTransaction[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  wallets,
  transactions,
  onOpenReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [flowFilter, setFlowFilter] = useState<'all' | TransactionFlowType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TransactionCategory>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Edit Transaction Modal State
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCategory, setEditCategory] = useState<TransactionCategory>('voucher');
  const [editFlowType, setEditFlowType] = useState<TransactionFlowType>('masuk');
  const [editWalletId, setEditWalletId] = useState('');
  const [editSecondaryWalletId, setEditSecondaryWalletId] = useState('-');
  const [editSecondaryAmount, setEditSecondaryAmount] = useState('0');
  const [editAmount, setEditAmount] = useState('0');
  const [editCostAmount, setEditCostAmount] = useState('0');
  const [editProfitAmount, setEditProfitAmount] = useState('0');
  const [editDateString, setEditDateString] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const walletMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) map[w.id] = w.name;
    return map;
  }, [wallets]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (flowFilter !== 'all' && tx.flowType !== flowFilter) return false;
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
      if (
        walletFilter !== 'all' &&
        tx.walletId !== walletFilter &&
        tx.secondaryWalletId !== walletFilter
      ) {
        return false;
      }
      if (startDate && tx.dateString < startDate) return false;
      if (endDate && tx.dateString > endDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const label = CATEGORY_LABELS[tx.category] || tx.category;
        const match =
          tx.title.toLowerCase().includes(q) ||
          tx.customerName.toLowerCase().includes(q) ||
          tx.notes.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, flowFilter, categoryFilter, walletFilter, startDate, endDate, searchQuery]);

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalProfit = 0;
    for (const tx of filteredTransactions) {
      if (tx.flowType === 'masuk') totalIn += tx.amount;
      if (tx.flowType === 'keluar') totalOut += tx.amount;
      totalProfit += tx.profitAmount;
    }
    return { totalIn, totalOut, totalProfit };
  }, [filteredTransactions]);

  const handleOpenEditTx = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditCustomerName(tx.customerName);
    setEditCategory(tx.category);
    setEditFlowType(tx.flowType);
    setEditWalletId(tx.walletId);
    setEditSecondaryWalletId(tx.secondaryWalletId || '-');
    setEditSecondaryAmount(String(tx.secondaryAmount || 0));
    setEditAmount(String(tx.amount));
    setEditCostAmount(String(tx.costAmount || 0));
    setEditProfitAmount(String(tx.profitAmount || 0));
    setEditDateString(tx.dateString);
    setEditNotes(tx.notes === '-' ? '' : tx.notes);
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = Number(editAmount) || 0;
    const cost = Number(editCostAmount) || 0;
    const secAmt = Number(editSecondaryAmount) || 0;

    // Auto-compute profit if it's a standard sales category, otherwise keep user's profit or 0
    const salesCats = new Set([
      'jual_hp',
      'voucher',
      'pulsa_data',
      'aksesoris',
      'servis',
    ]);
    const computedProfit = salesCats.has(editCategory)
      ? amt - cost
      : Number(editProfitAmount) || 0;

    setIsSavingEdit(true);
    try {
      await updateTransaction(editingTx.id, {
        category: editCategory,
        flowType: editFlowType,
        title: editTitle,
        customerName: editCustomerName,
        walletId: editWalletId || '-',
        secondaryWalletId: editSecondaryWalletId || '-',
        secondaryAmount: secAmt,
        amount: amt,
        costAmount: cost,
        profitAmount: computedProfit,
        dateString: editDateString,
        notes: editNotes || '-',
      });
      setEditingTx(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Tanggal',
      'Kategori',
      'Aliran',
      'Judul Transaksi',
      'Pelanggan/Mitra',
      'Kantong Kas',
      'Nominal (Rp)',
      'Modal/HPP (Rp)',
      'Laba Bersih (Rp)',
      'Catatan',
    ];
    const rows = filteredTransactions.map((tx) => [
      tx.dateString,
      CATEGORY_LABELS[tx.category] || tx.category,
      tx.flowType,
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.customerName.replace(/"/g, '""')}"`,
      `"${walletMap[tx.walletId] || tx.walletId}"`,
      tx.amount,
      tx.costAmount,
      tx.profitAmount,
      `"${tx.notes.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `riwayat_kasir_konter_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary Strip for Filtered Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Total Uang Masuk</div>
          <div className="text-lg sm:text-xl font-bold font-mono-tabular text-emerald-600">
            +{formatIDR(totals.totalIn)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Total Uang Keluar</div>
          <div className="text-lg sm:text-xl font-bold font-mono-tabular text-red-600">
            -{formatIDR(totals.totalOut)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Total Laba Bersih</div>
            <div className="text-lg sm:text-xl font-bold font-mono-tabular text-slate-900">
              {formatIDR(totals.totalProfit)}
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV ({filteredTransactions.length})</span>
          </button>
        </div>
      </div>

      {/* Clean Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Flow Type Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'masuk', label: 'Masuk' },
                { id: 'keluar', label: 'Keluar' },
                { id: 'mutasi', label: 'Mutasi' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFlowFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  flowFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi, nama, catatan..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                showAdvancedFilters
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
            >
              <option value="all">Semua Kategori</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
            >
              <option value="all">Semua Kantong Kas</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Dari Tanggal"
              className="px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-xl"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Sampai Tanggal"
              className="px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Responsive Transactions List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada transaksi yang cocok dengan filter pencarian.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 sm:px-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                    {tx.title}
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-mono-tabular">{tx.dateString}</span>
                    <span>·</span>
                    <span className="font-medium text-slate-700">
                      {CATEGORY_LABELS[tx.category] || tx.category}
                    </span>
                    <span>·</span>
                    <span>{tx.customerName}</span>
                    <span>·</span>
                    <span className="font-medium text-emerald-700">
                      {walletMap[tx.walletId] || 'Tanpa Potong Kas'}
                    </span>
                  </div>
                  {tx.notes && tx.notes !== '-' && (
                    <div className="text-[11px] text-slate-400 truncate">{tx.notes}</div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right font-mono-tabular">
                    <div
                      className={`text-xs sm:text-sm font-bold ${
                        tx.flowType === 'masuk'
                          ? 'text-emerald-600'
                          : tx.flowType === 'keluar'
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {tx.flowType === 'masuk' ? '+' : tx.flowType === 'keluar' ? '-' : ''}
                      {formatIDR(tx.amount)}
                    </div>
                    {tx.profitAmount !== 0 && (
                      <div
                        className={`text-[11px] ${
                          tx.profitAmount > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        Laba {tx.profitAmount > 0 ? '+' : ''}
                        {formatIDR(tx.profitAmount)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditTx(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                      title="Edit Transaksi, Nominal & Kantong Kas"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {onOpenReceipt && (
                      <button
                        onClick={() =>
                          onOpenReceipt({
                            receiptNo: tx.id.slice(-8).toUpperCase(),
                            dateString: tx.dateString,
                            categoryLabel: CATEGORY_LABELS[tx.category] || tx.category,
                            title: tx.title,
                            customerName: tx.customerName,
                            amount: tx.amount,
                            flowType: tx.flowType,
                            walletName: walletMap[tx.walletId] || 'Kas',
                            notes: tx.notes,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                        title="Cetak Nota & Kirim WA"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Nota</span>
                      </button>
                    )}

                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                      title="Hapus Transaksi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Edit Transaksi & Kantong Kas */}
      {editingTx && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setEditingTx(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Edit Transaksi & Kantong Kas
                </h3>
                <p className="text-xs text-slate-500">
                  Koreksi harga, modal, atau pindah kantong kas jika salah pilih.
                </p>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Judul / Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nominal Transaksi
                  </label>
                  <CurrencyInput
                    required
                    value={editAmount}
                    onChange={(val) => {
                      setEditAmount(val);
                      const salesCats = new Set([
                        'jual_hp',
                        'voucher',
                        'pulsa_data',
                        'aksesoris',
                        'servis',
                      ]);
                      if (salesCats.has(editCategory)) {
                        setEditProfitAmount(
                          String((Number(val) || 0) - (Number(editCostAmount) || 0))
                        );
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Modal / HPP
                  </label>
                  <CurrencyInput
                    value={editCostAmount}
                    onChange={(val) => {
                      setEditCostAmount(val);
                      const salesCats = new Set([
                        'jual_hp',
                        'voucher',
                        'pulsa_data',
                        'aksesoris',
                        'servis',
                      ]);
                      if (salesCats.has(editCategory)) {
                        setEditProfitAmount(
                          String((Number(editAmount) || 0) - (Number(val) || 0))
                        );
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kantong Kas Utama
                </label>
                <select
                  value={editWalletId}
                  onChange={(e) => setEditWalletId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="-">Tanpa Potong Kas Toko (Dompet Pribadi)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {editSecondaryWalletId && editSecondaryWalletId !== '-' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Kantong Kedua (Server/Tujuan)
                    </label>
                    <select
                      value={editSecondaryWalletId}
                      onChange={(e) => setEditSecondaryWalletId(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="-">Tidak Ada</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Nominal Kantong Kedua
                    </label>
                    <CurrencyInput
                      value={editSecondaryAmount}
                      onChange={setEditSecondaryAmount}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pelanggan / Mitra
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={editDateString}
                    onChange={(e) => setEditDateString(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
