import React, { useState, useMemo } from 'react';
import {
  Wallet,
  PawnRecord,
  InvestmentRecord,
  PawnItemCategory,
  PawnFeeScheme,
  CustomerRecord,
  ReceiptPayload,
  formatIDR,
  getTodayDateString,
  buildWhatsAppUrl,
} from '../types';
import {
  createPawnRecord,
  updatePawnRecord,
  extendPawnRecord,
  redeemPawnRecord,
  forfeitPawnRecord,
  deletePawnRecord,
} from '../services/firestoreService';
import { InvestmentsView } from './InvestmentsView';
import { CustomerContactInput } from './CustomerContactInput';
import { CurrencyInput } from './CurrencyInput';
import {
  Plus,
  CalendarClock,
  CheckCircle2,
  ArchiveRestore,
  Trash2,
  MessageCircle,
  Printer,
  Edit2,
} from 'lucide-react';

interface PawnsViewProps {
  uid: string;
  wallets: Wallet[];
  pawns: PawnRecord[];
  investments?: InvestmentRecord[];
  customers?: CustomerRecord[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

export const PawnsView: React.FC<PawnsViewProps> = ({
  uid,
  wallets,
  pawns,
  investments = [],
  customers = [],
  onOpenReceipt,
}) => {
  const [sectionTab, setSectionTab] = useState<'gadai' | 'investasi'>('gadai');
  const [filterMode, setFilterMode] = useState<'active' | 'overdue' | 'completed' | 'all'>('active');

  // Modal Gadai Baru / Edit Gadai
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPawn, setEditingPawn] = useState<PawnRecord | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemCategory, setItemCategory] = useState<PawnItemCategory>('hp');
  const [itemName, setItemName] = useState('');
  const [itemCondition, setItemCondition] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeScheme, setFeeScheme] = useState<PawnFeeScheme>('fleksibel');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [pawnDate, setPawnDate] = useState(getTodayDateString());
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Perpanjang Gadai
  const [extendingPawn, setExtendingPawn] = useState<PawnRecord | null>(null);
  const [extendFeePaid, setExtendFeePaid] = useState('');
  const [extendNewDueDate, setExtendNewDueDate] = useState('');
  const [extendWalletId, setExtendWalletId] = useState(wallets[0]?.id || '');
  const [extendDate, setExtendDate] = useState(getTodayDateString());

  // Modal Tebus Gadai
  const [redeemingPawn, setRedeemingPawn] = useState<PawnRecord | null>(null);
  const [redeemExtraFee, setRedeemExtraFee] = useState('');
  const [redeemWalletId, setRedeemWalletId] = useState(wallets[0]?.id || '');
  const [redeemDate, setRedeemDate] = useState(getTodayDateString());

  // Modal Hangus / Pindah ke Stok Jualan
  const [forfeitingPawn, setForfeitingPawn] = useState<PawnRecord | null>(null);
  const [moveToStock, setMoveToStock] = useState(true);
  const [forfeitTargetPrice, setForfeitTargetPrice] = useState('');

  const todayStr = getTodayDateString();

  const filteredPawns = useMemo(() => {
    return pawns.filter((pw) => {
      const isActive = pw.status === 'aktif' || pw.status === 'diperpanjang';
      const isOverdue = isActive && pw.dueDate < todayStr;
      if (filterMode === 'active') return isActive;
      if (filterMode === 'overdue') return isOverdue;
      if (filterMode === 'completed') return pw.status === 'ditebus' || pw.status === 'hangus_lelang';
      return true;
    });
  }, [pawns, filterMode, todayStr]);

  const summary = useMemo(() => {
    let activeCount = 0;
    let overdueCount = 0;
    let totalLoanOut = 0;
    let totalFeeProfit = 0;

    for (const pw of pawns) {
      totalFeeProfit += pw.totalFeeCollected;
      if (pw.status === 'aktif' || pw.status === 'diperpanjang') {
        activeCount += 1;
        totalLoanOut += pw.loanAmount;
        if (pw.dueDate < todayStr) overdueCount += 1;
      }
    }

    return { activeCount, overdueCount, totalLoanOut, totalFeeProfit };
  }, [pawns, todayStr]);

  const handleOpenAdd = () => {
    setEditingPawn(null);
    setCustomerName('');
    setCustomerPhone('');
    setItemCategory('hp');
    setItemName('');
    setItemCondition('');
    setLoanAmount('');
    setFeeAmount('');
    setFeeScheme('fleksibel');
    setPawnDate(getTodayDateString());
    setWalletId(wallets[0]?.id || '');
    setShowAddModal(true);
  };

  const handleOpenEditPawn = (pw: PawnRecord) => {
    setEditingPawn(pw);
    setCustomerName(pw.customerName);
    setCustomerPhone(pw.customerPhone === '-' ? '' : pw.customerPhone);
    setItemCategory(pw.itemCategory);
    setItemName(pw.itemName);
    setItemCondition(pw.itemCondition);
    setLoanAmount(String(pw.loanAmount));
    setFeeAmount(String(pw.feeAmount));
    setFeeScheme(pw.feeScheme);
    setDueDate(pw.dueDate);
    setWalletId(pw.walletId || wallets[0]?.id || '');
    setShowAddModal(true);
  };

  const handleCreatePawn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !itemName.trim() || !walletId) return;
    setIsSubmitting(true);
    try {
      if (editingPawn) {
        await updatePawnRecord(editingPawn.id, {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || '-',
          itemCategory,
          itemName: itemName.trim(),
          itemCondition: itemCondition.trim() || 'Lengkap Normal',
          loanAmount: Number(loanAmount) || 0,
          feeAmount: Number(feeAmount) || 0,
          feeScheme,
          dueDate,
          walletId,
        });
        setShowAddModal(false);
        setEditingPawn(null);
      } else {
        await createPawnRecord(uid, {
          customerName,
          customerPhone: customerPhone || '-',
          itemCategory,
          itemName,
          itemCondition: itemCondition || 'Lengkap Normal',
          loanAmount: Number(loanAmount) || 0,
          feeAmount: Number(feeAmount) || 0,
          feeScheme,
          dueDate,
          walletId,
          dateString: pawnDate,
        });
        setShowAddModal(false);
        if (onOpenReceipt) {
          onOpenReceipt({
            receiptNo: `GD-${Date.now().toString().slice(-6)}`,
            dateString: pawnDate,
            categoryLabel: 'Surat Bukti Gadai',
            title: `Gadai ${itemName}`,
            customerName,
            customerPhone: customerPhone || undefined,
            amount: Number(loanAmount) || 0,
            notes: `Kelengkapan: ${itemCondition || 'Lengkap'} | Jatuh Tempo: ${dueDate}`,
            extraLines: [
              { label: 'Pinjaman Pokok', value: formatIDR(Number(loanAmount) || 0) },
              { label: 'Biaya Jasa', value: formatIDR(Number(feeAmount) || 0) },
              { label: 'Jatuh Tempo', value: dueDate },
            ],
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenExtend = (pw: PawnRecord) => {
    setExtendingPawn(pw);
    setExtendFeePaid(String(pw.feeAmount));
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setExtendNewDueDate(d.toISOString().slice(0, 10));
    setExtendWalletId(wallets[0]?.id || pw.walletId);
    setExtendDate(getTodayDateString());
  };

  const handleConfirmExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingPawn || !extendWalletId) return;
    setIsSubmitting(true);
    try {
      await extendPawnRecord(
        uid,
        extendingPawn,
        Number(extendFeePaid) || 0,
        extendNewDueDate,
        extendWalletId,
        extendDate
      );
      setExtendingPawn(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRedeem = (pw: PawnRecord) => {
    setRedeemingPawn(pw);
    setRedeemExtraFee(pw.feeScheme === 'potong_awal' ? '0' : String(pw.feeAmount));
    setRedeemWalletId(wallets[0]?.id || pw.walletId);
    setRedeemDate(getTodayDateString());
  };

  const handleConfirmRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemingPawn || !redeemWalletId) return;
    setIsSubmitting(true);
    try {
      await redeemPawnRecord(
        uid,
        redeemingPawn,
        Number(redeemExtraFee) || 0,
        redeemWalletId,
        redeemDate
      );
      setRedeemingPawn(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenForfeit = (pw: PawnRecord) => {
    setForfeitingPawn(pw);
    setMoveToStock(true);
    setForfeitTargetPrice(String(pw.loanAmount + pw.feeAmount));
  };

  const handleConfirmForfeit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forfeitingPawn) return;
    setIsSubmitting(true);
    try {
      await forfeitPawnRecord(
        uid,
        forfeitingPawn,
        moveToStock,
        Number(forfeitTargetPrice) || forfeitingPawn.loanAmount
      );
      setForfeitingPawn(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const schemeLabel: Record<PawnFeeScheme, string> = {
    potong_awal: 'Potong Awal',
    bayar_akhir: 'Bayar Saat Tebus',
    fleksibel: 'Fleksibel',
  };

  return (
    <div className="space-y-3">
      {/* Header & Clean Top Switcher: Barang Gadai vs Tanam Modal */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          Gadai Barang & Tanam Modal
        </h2>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => setSectionTab('gadai')}
            className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              sectionTab === 'gadai'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Barang Gadai ({summary.activeCount})
          </button>
          <button
            onClick={() => setSectionTab('investasi')}
            className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              sectionTab === 'investasi'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tanam Modal ({investments.filter((i) => i.status === 'aktif').length})
          </button>
        </div>
      </div>

      {sectionTab === 'investasi' ? (
        <InvestmentsView uid={uid} wallets={wallets} investments={investments} />
      ) : (
        <>
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Gadai Aktif</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900">
                {summary.activeCount} Barang
              </div>
              <div className="text-[10px] text-slate-500 truncate">Dititipkan di konter</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Pinjaman Keluar</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
                {formatIDR(summary.totalLoanOut)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Pokok belum ditebus</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Jatuh Tempo</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-amber-600">
                {summary.overdueCount} Barang
              </div>
              <div className="text-[10px] text-slate-500 truncate">Perlu diperpanjang</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
              <div className="text-[11px] text-slate-500 truncate">Untung Jasa Gadai</div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-emerald-600 truncate">
                +{formatIDR(summary.totalFeeProfit)}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Akumulasi biaya jasa</div>
            </div>
          </div>

          {/* Filter Bar & Add Button */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
              {(
                [
                  { id: 'active', label: `Aktif (${summary.activeCount})` },
                  { id: 'overdue', label: `Tempo (${summary.overdueCount})` },
                  { id: 'completed', label: 'Selesai' },
                  { id: 'all', label: 'Semua' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    filterMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleOpenAdd}
              disabled={wallets.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-slate-900 text-white text-[11px] font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gadai Baru</span>
            </button>
          </div>

          {/* Responsive Pawns Card List */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {filteredPawns.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-500">Tidak ada barang gadai pada filter ini.</p>
                {wallets.length > 0 && (
                  <button
                    onClick={handleOpenAdd}
                    className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    + Terima Barang Gadai Baru
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPawns.map((pw) => {
                  const isActive = pw.status === 'aktif' || pw.status === 'diperpanjang';
                  const isOverdue = isActive && pw.dueDate < todayStr;
                  return (
                    <div
                      key={pw.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between lg:justify-start gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {pw.itemName}
                          </h3>
                          <span className="text-xs font-medium text-slate-500 shrink-0">
                            · {pw.itemCategory.toUpperCase()} · {pw.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          Nasabah: <span className="font-semibold text-slate-900">{pw.customerName}</span> ({pw.customerPhone}) · {pw.itemCondition}
                        </div>

                        <div className="text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
                          <span
                            className={`font-mono-tabular font-semibold ${
                              isOverdue ? 'text-red-600' : 'text-slate-700'
                            }`}
                          >
                            Jatuh Tempo: {pw.dueDate} {isOverdue ? '(LEWAT TEMPO)' : ''}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">{schemeLabel[pw.feeScheme]}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-tabular">
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Pinjaman</div>
                            <div className="text-xs sm:text-sm font-bold text-slate-900">
                              {formatIDR(pw.loanAmount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Jasa/Periode</div>
                            <div className="text-xs sm:text-sm font-medium text-slate-700">
                              {formatIDR(pw.feeAmount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-slate-500">Jasa Masuk</div>
                            <div className="text-xs sm:text-sm font-bold text-emerald-600">
                              +{formatIDR(pw.totalFeeCollected)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleOpenRedeem(pw)}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Tebus</span>
                              </button>
                              <button
                                onClick={() => handleOpenExtend(pw)}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl cursor-pointer"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                                <span>Perpanjang</span>
                              </button>
                              <button
                                onClick={() => handleOpenForfeit(pw)}
                                title="Hangus / Pindah ke Stok Jualan"
                                className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-xl cursor-pointer"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                                <span>Lelang</span>
                              </button>
                            </>
                          )}
                          {onOpenReceipt && (
                            <button
                              onClick={() =>
                                onOpenReceipt({
                                  receiptNo: `GD-${pw.id.slice(-6).toUpperCase()}`,
                                  dateString: getTodayDateString(),
                                  categoryLabel: 'Surat Bukti Gadai',
                                  title: `Gadai ${pw.itemName} (${pw.status.toUpperCase()})`,
                                  customerName: pw.customerName,
                                  customerPhone: pw.customerPhone !== '-' ? pw.customerPhone : undefined,
                                  amount: pw.loanAmount,
                                  notes: `Kondisi: ${pw.itemCondition} | Jatuh Tempo: ${pw.dueDate}`,
                                  extraLines: [
                                    { label: 'Pinjaman Pokok', value: formatIDR(pw.loanAmount) },
                                    { label: 'Jasa per Periode', value: formatIDR(pw.feeAmount) },
                                    { label: 'Total Jasa Masuk', value: formatIDR(pw.totalFeeCollected) },
                                    { label: 'Jatuh Tempo', value: pw.dueDate },
                                  ],
                                })
                              }
                              title="Cetak Nota Gadai & Kirim WA"
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Nota</span>
                            </button>
                          )}
                          <a
                            href={buildWhatsAppUrl(
                              pw.customerPhone !== '-' ? pw.customerPhone : '',
                              `Halo Kak *${pw.customerName}*, menginfokan untuk barang gadai *${pw.itemName}* dengan pinjaman pokok *${formatIDR(pw.loanAmount)}* dan jasa *${formatIDR(pw.feeAmount)}* memiliki tanggal jatuh tempo pada *${pw.dueDate}*. Silakan konfirmasi jika ingin perpanjang atau tebus. Terima kasih.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat WhatsApp Nasabah"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </a>
                          <button
                            onClick={() => handleOpenEditPawn(pw)}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl cursor-pointer"
                            title="Edit Data Gadai"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deletePawnRecord(pw.id)}
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
        </>
      )}

      {/* Modal Input Gadai Baru */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingPawn ? 'Edit Data Barang Gadai' : 'Terima Barang Gadai Baru'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleCreatePawn} className="space-y-4">
              <CustomerContactInput
                uid={uid}
                customers={customers}
                nameValue={customerName}
                onNameChange={setCustomerName}
                phoneValue={customerPhone}
                onPhoneChange={setCustomerPhone}
                nameLabel="Nama Penggadai / Nasabah"
                phoneLabel="Nomor WA / HP Penggadai"
                namePlaceholder="Contoh: Pak Hendra"
                phonePlaceholder="Contoh: 08123456789"
                nameRequired
                defaultCategory="gadai"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori Barang</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as PawnItemCategory)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="hp">HP / Smartphone</option>
                    <option value="motor">Motor / Kendaraan</option>
                    <option value="laptop">Laptop / Komputer</option>
                    <option value="elektronik">TV / Elektronik</option>
                    <option value="lainnya">Barang Lainnya</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama / Tipe Barang Jaminan
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Contoh: Oppo Reno 8 / Honda Vario 150"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kelengkapan, Kondisi & Sandi/PIN
                </label>
                <input
                  type="text"
                  value={itemCondition}
                  onChange={(e) => setItemCondition(e.target.value)}
                  placeholder="Contoh: Unit + Cas Ori, PIN Layar 2580"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pokok Pinjaman (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={loanAmount}
                    onChange={setLoanAmount}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Biaya Jasa / Titip (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={feeAmount}
                    onChange={setFeeAmount}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Gadai
                  </label>
                  <input
                    type="date"
                    required
                    value={pawnDate}
                    onChange={(e) => setPawnDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Skema Pembayaran Jasa
                  </label>
                  <select
                    value={feeScheme}
                    onChange={(e) => setFeeScheme(e.target.value as PawnFeeScheme)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="fleksibel">Fleksibel (Bayar Saat Tebus / Perpanjang)</option>
                    <option value="potong_awal">Potong di Awal (Jasa Langsung Masuk)</option>
                    <option value="bayar_akhir">Bayar di Akhir Saat Tebus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cairkan Pinjaman Dari Kantong Kas
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
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingPawn
                    ? 'Simpan Perubahan'
                    : 'Simpan & Cairkan Gadai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Perpanjang Gadai */}
      {extendingPawn && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setExtendingPawn(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Perpanjang Masa Gadai</h3>
              <button
                onClick={() => setExtendingPawn(null)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {extendingPawn.itemName} ({extendingPawn.customerName})
              </div>
              <div className="text-slate-600">
                Pokok Pinjaman: <span className="font-mono-tabular font-semibold">{formatIDR(extendingPawn.loanAmount)}</span>
              </div>
            </div>
            <form onSubmit={handleConfirmExtend} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Biaya Jasa Perpanjangan Diterima (Rp)
                </label>
                <CurrencyInput
                  required
                  value={extendFeePaid}
                  onChange={setExtendFeePaid}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={extendDate}
                    onChange={(e) => setExtendDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jatuh Tempo Baru
                  </label>
                  <input
                    type="date"
                    required
                    value={extendNewDueDate}
                    onChange={(e) => setExtendNewDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Uang Jasa Masuk Ke Kantong
                </label>
                <select
                  value={extendWalletId}
                  onChange={(e) => setExtendWalletId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingPawn(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Simpan Perpanjangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tebus Lunas Gadai */}
      {redeemingPawn && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setRedeemingPawn(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Tebus Lunas Barang Gadai</h3>
              <button
                onClick={() => setRedeemingPawn(null)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {redeemingPawn.itemName} — {redeemingPawn.customerName}
              </div>
              <div className="text-slate-600">
                Pokok Pinjaman Kembali:{' '}
                <span className="font-mono-tabular font-semibold">
                  {formatIDR(redeemingPawn.loanAmount)}
                </span>
              </div>
              <div className="text-emerald-700 font-medium pt-1">
                Total Diterima Kasir:{' '}
                <span className="font-mono-tabular font-bold">
                  {formatIDR(redeemingPawn.loanAmount + (Number(redeemExtraFee) || 0))}
                </span>
              </div>
            </div>
            <form onSubmit={handleConfirmRedeem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Biaya Jasa Saat Tebus (Rp) — Isi 0 jika sudah potong awal
                </label>
                <CurrencyInput
                  required
                  value={redeemExtraFee}
                  onChange={setRedeemExtraFee}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uang Tebusan Masuk Ke Kantong
                  </label>
                  <select
                    value={redeemWalletId}
                    onChange={(e) => setRedeemWalletId(e.target.value)}
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
                    Tanggal Tebus
                  </label>
                  <input
                    type="date"
                    required
                    value={redeemDate}
                    onChange={(e) => setRedeemDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRedeemingPawn(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Konfirmasi Tebus Lunas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hangus / Lelang ke Stok Jualan */}
      {forfeitingPawn && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setForfeitingPawn(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Gadai Hangus / Pindah ke Stok Jualan
              </h3>
              <button
                onClick={() => setForfeitingPawn(null)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Barang <strong>{forfeitingPawn.itemName}</strong> milik{' '}
              <strong>{forfeitingPawn.customerName}</strong> dengan pokok pinjaman{' '}
              <span className="font-mono-tabular font-semibold">{formatIDR(forfeitingPawn.loanAmount)}</span>{' '}
              akan ditandai sebagai Hangus / Lelang.
            </p>
            <form onSubmit={handleConfirmForfeit} className="space-y-4">
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moveToStock}
                  onChange={(e) => setMoveToStock(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Masukkan otomatis ke daftar Stok Unit Siap Jual</span>
              </label>
              {moveToStock && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Harga Jual Barang (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={forfeitTargetPrice}
                    onChange={setForfeitTargetPrice}
                    placeholder="0"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForfeitingPawn(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Proses Hangus / Lelang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
