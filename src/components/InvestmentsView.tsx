import React, { useState, useMemo } from 'react';
import { Wallet, InvestmentRecord, formatIDR, getTodayDateString } from '../types';
import {
  createInvestmentRecord,
  updateInvestmentRecord,
  recordInvestmentProfitOrReturn,
  deleteInvestmentRecord,
} from '../services/firestoreService';
import { CurrencyInput } from './CurrencyInput';
import { Plus, TrendingUp, Trash2, Edit2 } from 'lucide-react';

interface InvestmentsViewProps {
  uid: string;
  wallets: Wallet[];
  investments: InvestmentRecord[];
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({ uid, wallets, investments }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInv, setEditingInv] = useState<InvestmentRecord | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [capitalAmount, setCapitalAmount] = useState('');
  const [profitShareNote, setProfitShareNote] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [deductWalletNow, setDeductWalletNow] = useState(true);
  const [invDate, setInvDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Catat Bagi Hasil / Pengembalian Modal
  const [activeInv, setActiveInv] = useState<InvestmentRecord | null>(null);
  const [profitSharedInput, setProfitSharedInput] = useState('');
  const [capitalReturnedInput, setCapitalReturnedInput] = useState('0');
  const [returnWalletId, setReturnWalletId] = useState(wallets[0]?.id || '');
  const [returnDate, setReturnDate] = useState(getTodayDateString());
  const [markCompleted, setMarkCompleted] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');

  const summary = useMemo(() => {
    let totalInvested = 0;
    let activeRemainingCapital = 0;
    let totalProfitReceived = 0;
    let activePartners = 0;

    for (const inv of investments) {
      totalInvested += inv.capitalAmount;
      totalProfitReceived += inv.totalProfitShared;
      if (inv.status === 'aktif') {
        activePartners += 1;
        activeRemainingCapital += Math.max(0, inv.capitalAmount - inv.returnedCapital);
      }
    }

    return { totalInvested, activeRemainingCapital, totalProfitReceived, activePartners };
  }, [investments]);

  const handleOpenAdd = () => {
    setEditingInv(null);
    setPartnerName('');
    setBusinessName('');
    setCapitalAmount('');
    setProfitShareNote('');
    setWalletId(wallets[0]?.id || '');
    setDeductWalletNow(true);
    setInvDate(getTodayDateString());
    setShowAddModal(true);
  };

  const handleOpenEditInv = (inv: InvestmentRecord) => {
    setEditingInv(inv);
    setPartnerName(inv.partnerName);
    setBusinessName(inv.businessName);
    setCapitalAmount(String(inv.capitalAmount));
    setProfitShareNote(inv.profitShareNote);
    setWalletId(inv.walletId || wallets[0]?.id || '');
    setDeductWalletNow(false);
    setShowAddModal(true);
  };

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerName.trim() || !businessName.trim()) return;
    if (!editingInv && deductWalletNow && !walletId) return;
    setIsSubmitting(true);
    try {
      if (editingInv) {
        await updateInvestmentRecord(editingInv.id, {
          partnerName: partnerName.trim(),
          businessName: businessName.trim(),
          capitalAmount: Number(capitalAmount) || 0,
          profitShareNote: profitShareNote.trim() || 'Bagi hasil sesuai kesepakatan',
          walletId: walletId || editingInv.walletId,
        });
      } else {
        await createInvestmentRecord(uid, {
          partnerName,
          businessName,
          capitalAmount: Number(capitalAmount) || 0,
          profitShareNote: profitShareNote || 'Bagi hasil sesuai kesepakatan',
          walletId: deductWalletNow ? walletId : walletId || '-',
          deductWalletNow,
          dateString: invDate,
        });
      }
      setShowAddModal(false);
      setEditingInv(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReturnModal = (inv: InvestmentRecord) => {
    setActiveInv(inv);
    setProfitSharedInput('');
    setCapitalReturnedInput('0');
    setReturnWalletId(wallets[0]?.id || inv.walletId);
    setReturnDate(getTodayDateString());
    setMarkCompleted(false);
    setReturnNotes('');
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInv || !returnWalletId) return;
    setIsSubmitting(true);
    try {
      await recordInvestmentProfitOrReturn(
        uid,
        activeInv,
        Number(profitSharedInput) || 0,
        Number(capitalReturnedInput) || 0,
        returnWalletId,
        markCompleted,
        returnNotes,
        returnDate
      );
      setActiveInv(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Strip + Add Action */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Modal Aktif ({summary.activePartners} Mitra)</div>
          <div className="text-lg sm:text-xl font-bold font-mono-tabular text-slate-900">
            {formatIDR(summary.activeRemainingCapital)}
          </div>
          <div className="text-[11px] text-slate-500">
            Total ditanam: {formatIDR(summary.totalInvested)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Total Bagi Hasil Diterima</div>
          <div className="text-lg sm:text-xl font-bold font-mono-tabular text-emerald-600">
            +{formatIDR(summary.totalProfitReceived)}
          </div>
          <div className="text-[11px] text-slate-500">Keuntungan masuk kas</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Rasio Imbal Hasil</div>
            <div className="text-lg sm:text-xl font-bold font-mono-tabular text-slate-900">
              {summary.totalInvested > 0
                ? `${((summary.totalProfitReceived / summary.totalInvested) * 100).toFixed(1)}%`
                : '0.0%'}
            </div>
          </div>
          <button
            onClick={handleOpenAdd}
            disabled={wallets.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tanam Modal
          </button>
        </div>
      </div>

      {/* Responsive Card List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {investments.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              Belum ada catatan tanam modal / investasi ke orang lain.
            </p>
            {wallets.length > 0 && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                + Catat Tanam Modal Baru
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {investments.map((inv) => {
              const remaining = Math.max(0, inv.capitalAmount - inv.returnedCapital);
              return (
                <div
                  key={inv.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {inv.partnerName}
                      </h3>
                      <span className="text-xs text-slate-500">
                        · {inv.businessName} · {inv.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{inv.profitShareNote}</div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-tabular">
                      <div>
                        <div className="text-[11px] font-sans text-slate-500">Modal Awal</div>
                        <div className="text-xs sm:text-sm font-medium text-slate-800">
                          {formatIDR(inv.capitalAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-sans text-slate-500">Sisa Aktif</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {formatIDR(remaining)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-sans text-slate-500">Bagi Hasil</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-600">
                          +{formatIDR(inv.totalProfitShared)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inv.status === 'aktif' && (
                        <button
                          onClick={() => handleOpenReturnModal(inv)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Bagi Hasil / Kembali</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditInv(inv)}
                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl cursor-pointer"
                        title="Edit Investasi"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteInvestmentRecord(inv.id)}
                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer"
                        title="Hapus"
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

      {/* Modal Tambah Tanam Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingInv ? 'Edit Data Tanam Modal' : 'Catat Tanam Modal Baru'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleCreateInvestment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Penerima Modal / Mitra
                </label>
                <input
                  type="text"
                  required
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Contoh: Mas Rian"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bidang Usaha / Keperluan Modal
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Contoh: Jual Beli HP / Konter Cabang"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nominal Modal Ditanam (Rp)
                </label>
                <CurrencyInput
                  required
                  value={capitalAmount}
                  onChange={setCapitalAmount}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kesepakatan Bagi Hasil
                </label>
                <input
                  type="text"
                  value={profitShareNote}
                  onChange={(e) => setProfitShareNote(e.target.value)}
                  placeholder="Contoh: Bagi hasil 50:50 tiap tanggal 1"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kantong Kas Sumber Modal
                  </label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!editingInv && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Tanam Modal
                    </label>
                    <input
                      type="date"
                      value={invDate}
                      onChange={(e) => setInvDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductWalletNow}
                  onChange={(e) => setDeductWalletNow(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Potong saldo kantong kas sekarang</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Investasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terima Bagi Hasil / Pengembalian Modal */}
      {activeInv && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveInv(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Terima Bagi Hasil / Kembali Modal
              </h3>
              <button
                onClick={() => setActiveInv(null)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {activeInv.partnerName} — {activeInv.businessName}
              </div>
              <div className="text-slate-600">
                Sisa Pokok Modal:{' '}
                <span className="font-mono-tabular font-semibold">
                  {formatIDR(Math.max(0, activeInv.capitalAmount - activeInv.returnedCapital))}
                </span>
              </div>
            </div>
            <form onSubmit={handleSaveReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nominal Bagi Hasil / Profit Diterima (Rp)
                </label>
                <CurrencyInput
                  value={profitSharedInput}
                  onChange={setProfitSharedInput}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pengembalian Pokok Modal (Rp) — Isi 0 jika modal lanjut
                </label>
                <CurrencyInput
                  value={capitalReturnedInput}
                  onChange={setCapitalReturnedInput}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uang Masuk Ke Kantong Kas
                  </label>
                  <select
                    value={returnWalletId}
                    onChange={(e) => setReturnWalletId(e.target.value)}
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
                    Tanggal Setoran
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Contoh: Bagi hasil bulan ini"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markCompleted}
                  onChange={(e) => setMarkCompleted(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Tandai kerjasama investasi ini sudah Selesai/Lunas</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveInv(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Setoran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
