import React, { useState, useMemo } from 'react';
import {
  Wallet,
  CatalogPreset,
  PresetCategory,
  CustomerRecord,
  ReceiptPayload,
  CATEGORY_LABELS,
  PRESET_CATEGORY_STYLES,
  formatIDR,
  getTodayDateString,
} from '../types';
import {
  createTransaction,
  createDebtRecord,
  saveCatalogPreset,
  deleteCatalogPreset,
} from '../services/firestoreService';
import { Plus, Trash2, Edit2, Check, Sparkles, Clock } from 'lucide-react';
import { CustomerContactInput } from './CustomerContactInput';
import { CurrencyInput } from './CurrencyInput';

interface QuickPosViewProps {
  uid: string;
  wallets: Wallet[];
  presets: CatalogPreset[];
  customers?: CustomerRecord[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

type PosSubTab = 'penjualan' | 'topup_transfer' | 'kulakan' | 'setting_preset';

export const QuickPosView: React.FC<QuickPosViewProps> = ({
  uid,
  wallets,
  presets,
  customers = [],
  onOpenReceipt,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PosSubTab>('penjualan');
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<'all' | PresetCategory>('all');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Modal Input / Konfirmasi Penjualan Cepat
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleCategory, setSaleCategory] = useState<'voucher' | 'pulsa_data' | 'aksesoris' | 'servis'>('voucher');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productName, setProductName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [receiveWalletId, setReceiveWalletId] = useState(wallets[0]?.id || '');
  const [deductServerWallet, setDeductServerWallet] = useState(false);
  const [serverWalletId, setServerWalletId] = useState(
    wallets.find((w) => w.type === 'server' || w.type === 'bank')?.id || wallets[0]?.id || ''
  );
  const [saleDate, setSaleDate] = useState(getTodayDateString());
  const [salePaymentStatus, setSalePaymentStatus] = useState<'lunas' | 'hutang'>('lunas');
  const [salePaidNow, setSalePaidNow] = useState('0');
  const [saleDueDate, setSaleDueDate] = useState(getTodayDateString());
  const [isSavingSale, setIsSavingSale] = useState(false);

  // State Topup E-Wallet / Transfer Bank / Tarik Tunai
  const [transferMode, setTransferMode] = useState<'kirim_topup' | 'tarik_tunai'>('kirim_topup');
  const [tfCustomerName, setTfCustomerName] = useState('');
  const [tfCustomerPhone, setTfCustomerPhone] = useState('');
  const [tfTitle, setTfTitle] = useState('');
  const [tfPrincipalAmount, setTfPrincipalAmount] = useState('');
  const [tfAdminFee, setTfAdminFee] = useState('5000');
  const [tfCashWalletId, setTfCashWalletId] = useState(
    wallets.find((w) => w.type === 'tunai')?.id || wallets[0]?.id || ''
  );
  const [tfDigitalWalletId, setTfDigitalWalletId] = useState(
    wallets.find((w) => w.type === 'bank' || w.type === 'server' || w.type === 'ewallet')?.id ||
      wallets[1]?.id ||
      wallets[0]?.id ||
      ''
  );
  const [tfPaymentStatus, setTfPaymentStatus] = useState<'lunas' | 'hutang'>('lunas');
  const [tfPaidNow, setTfPaidNow] = useState('0');
  const [tfDueDate, setTfDueDate] = useState(getTodayDateString());
  const [tfDate, setTfDate] = useState(getTodayDateString());
  const [isSavingTf, setIsSavingTf] = useState(false);

  // State Kulakan Grosir
  const [kulakTitle, setKulakTitle] = useState('');
  const [kulakAmount, setKulakAmount] = useState('');
  const [kulakWalletId, setKulakWalletId] = useState(wallets[0]?.id || '');
  const [kulakDate, setKulakDate] = useState(getTodayDateString());
  const [kulakNotes, setKulakNotes] = useState('');
  const [isSavingKulak, setIsSavingKulak] = useState(false);

  // Modal Settingan Master Per-Voucher / Produk
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | undefined>(undefined);
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('voucher');
  const [presetName, setPresetName] = useState('');
  const [presetCost, setPresetCost] = useState('');
  const [presetSell, setPresetSell] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  const filteredPresets = useMemo(() => {
    if (presetCategoryFilter === 'all') return presets;
    return presets.filter((p) => p.category === presetCategoryFilter);
  }, [presets, presetCategoryFilter]);

  const handleOpenManualSale = () => {
    setSaleCategory('voucher');
    setProductName('');
    setCostPrice('');
    setSellPrice('');
    setCustomerName('');
    setCustomerPhone('');
    setReceiveWalletId(wallets[0]?.id || '');
    setDeductServerWallet(false);
    setSaleDate(getTodayDateString());
    setSalePaymentStatus('lunas');
    setSalePaidNow('0');
    setSaleDueDate(getTodayDateString());
    setShowSaleModal(true);
  };

  const handleSelectPreset = (preset: CatalogPreset) => {
    if (
      preset.category === 'voucher' ||
      preset.category === 'pulsa_data' ||
      preset.category === 'aksesoris' ||
      preset.category === 'servis'
    ) {
      setSaleCategory(preset.category);
    }
    setProductName(preset.name);
    setCostPrice(String(preset.costPrice));
    setSellPrice(String(preset.sellPrice));
    setCustomerName('');
    setCustomerPhone('');
    setReceiveWalletId(wallets[0]?.id || '');
    setDeductServerWallet(preset.category === 'pulsa_data');
    setSaleDate(getTodayDateString());
    setSalePaymentStatus('lunas');
    setSalePaidNow('0');
    setSaleDueDate(getTodayDateString());
    setShowSaleModal(true);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWallet = receiveWalletId || wallets[0]?.id;
    if (!productName.trim() || !targetWallet) return;

    const modal = Number(costPrice) || 0;
    const jual = Number(sellPrice) || 0;
    const untung = jual - modal;
    const isCredit = salePaymentStatus === 'hutang';
    const paidNow = isCredit ? Math.min(jual, Math.max(0, Number(salePaidNow) || 0)) : jual;
    const unpaid = Math.max(0, jual - paidNow);
    const finalCustName = customerName.trim() || (isCredit ? 'Pelanggan Kasbon' : 'Umum');

    setIsSavingSale(true);
    try {
      const txId = await createTransaction(uid, {
        category: saleCategory,
        flowType: 'masuk',
        title: unpaid > 0 ? `${productName} (Kasbon/Bayar Nanti)` : productName,
        customerName: finalCustName,
        walletId: targetWallet,
        secondaryWalletId: deductServerWallet && serverWalletId ? serverWalletId : '-',
        secondaryAmount: deductServerWallet ? modal : 0,
        amount: paidNow,
        costAmount: modal,
        profitAmount: untung,
        dateString: saleDate,
        notes:
          unpaid > 0
            ? `Tagihan: Rp ${jual.toLocaleString('id-ID')} | Dibayar: Rp ${paidNow.toLocaleString('id-ID')} | Sisa Piutang: Rp ${unpaid.toLocaleString('id-ID')}`
            : deductServerWallet
            ? `Potong saldo server/bank Rp ${modal.toLocaleString('id-ID')}`
            : `Stok kulakan (Modal Rp ${modal.toLocaleString('id-ID')}, Jual Rp ${jual.toLocaleString('id-ID')})`,
      });

      if (unpaid > 0) {
        await createDebtRecord(uid, {
          type: 'piutang',
          personName: finalCustName,
          phone: customerPhone.trim() || '-',
          description: `Kasbon ${productName} (Harga Rp ${jual.toLocaleString('id-ID')}, DP Rp ${paidNow.toLocaleString('id-ID')})`,
          totalAmount: unpaid,
          dueDate: saleDueDate || getTodayDateString(),
          walletId: targetWallet,
          recordInitialCashFlow: false,
          dateString: saleDate,
        });
      }

      setShowSaleModal(false);
      showToast(
        unpaid > 0
          ? `Transaksi ${productName} disimpan & Piutang ${formatIDR(unpaid)} otomatis masuk ke Buku Piutang!`
          : `Transaksi ${productName} berhasil disimpan (Untung ${formatIDR(untung)})`
      );
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: txId.slice(-8).toUpperCase(),
          dateString: saleDate,
          categoryLabel: CATEGORY_LABELS[saleCategory],
          title: productName,
          customerName: finalCustName,
          customerPhone: customerPhone || undefined,
          amount: jual,
          notes:
            unpaid > 0
              ? `STATUS: BELUM LUNAS (Sisa Tagihan: ${formatIDR(unpaid)})`
              : 'STATUS: LUNAS',
          extraLines:
            unpaid > 0
              ? [
                  { label: 'Total Harga', value: formatIDR(jual) },
                  { label: 'Dibayar Sekarang', value: formatIDR(paidNow) },
                  { label: 'Sisa Belum Dibayar', value: formatIDR(unpaid) },
                ]
              : undefined,
        });
      }
    } finally {
      setIsSavingSale(false);
    }
  };

  const handleSaveTopupTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const pokok = Number(tfPrincipalAmount) || 0;
    const admin = Number(tfAdminFee) || 0;
    if (!tfTitle.trim() || pokok <= 0 || !tfCashWalletId || !tfDigitalWalletId) return;

    const totalTagihan = transferMode === 'kirim_topup' ? pokok + admin : pokok;
    const isCredit = tfPaymentStatus === 'hutang' && transferMode === 'kirim_topup';
    const paidNow = isCredit ? Math.min(totalTagihan, Math.max(0, Number(tfPaidNow) || 0)) : totalTagihan;
    const unpaid = Math.max(0, totalTagihan - paidNow);
    const finalCustName = tfCustomerName.trim() || (isCredit ? 'Pelanggan Kasbon' : 'Umum');

    setIsSavingTf(true);
    try {
      if (transferMode === 'kirim_topup') {
        await createTransaction(uid, {
          category: 'topup_transfer',
          flowType: 'masuk',
          title:
            unpaid > 0
              ? `Topup/Transfer (Kasbon): ${tfTitle}`
              : `Topup/Transfer: ${tfTitle}`,
          customerName: finalCustName,
          walletId: tfCashWalletId,
          secondaryWalletId: tfDigitalWalletId,
          amount: paidNow,
          secondaryAmount: pokok,
          costAmount: pokok,
          profitAmount: admin,
          dateString: tfDate,
          notes:
            unpaid > 0
              ? `Pokok Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')} | Dibayar Rp ${paidNow.toLocaleString('id-ID')} | Piutang Rp ${unpaid.toLocaleString('id-ID')}`
              : `Nominal Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')}`,
        });

        if (unpaid > 0) {
          await createDebtRecord(uid, {
            type: 'piutang',
            personName: finalCustName,
            phone: tfCustomerPhone.trim() || '-',
            description: `Kasbon Topup/TF: ${tfTitle} (Pokok Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')})`,
            totalAmount: unpaid,
            dueDate: tfDueDate || getTodayDateString(),
            walletId: tfCashWalletId,
            recordInitialCashFlow: false,
            dateString: tfDate,
          });
        }
      } else {
        await createTransaction(uid, {
          category: 'topup_transfer',
          flowType: 'masuk',
          title: `Tarik Tunai: ${tfTitle}`,
          customerName: finalCustName,
          walletId: tfDigitalWalletId,
          secondaryWalletId: tfCashWalletId,
          amount: pokok,
          secondaryAmount: Math.max(0, pokok - admin),
          costAmount: Math.max(0, pokok - admin),
          profitAmount: admin,
          dateString: tfDate,
          notes: `Tarik Tunai Rp ${pokok.toLocaleString('id-ID')}, Admin Rp ${admin.toLocaleString('id-ID')}`,
        });
      }

      setTfTitle('');
      setTfPrincipalAmount('');
      setTfCustomerName('');
      setTfCustomerPhone('');
      setTfPaymentStatus('lunas');
      setTfPaidNow('0');

      showToast(
        unpaid > 0
          ? `Topup ${tfTitle} disimpan! Saldo Bank/Server terpotong & Piutang ${formatIDR(unpaid)} masuk ke Buku Piutang.`
          : `Transaksi ${tfTitle} berhasil disimpan (Laba Admin ${formatIDR(admin)})`
      );

      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: `TF-${Date.now().toString().slice(-6)}`,
          dateString: tfDate,
          categoryLabel: 'Topup / Transfer / Tarik Tunai',
          title: `${transferMode === 'kirim_topup' ? 'Topup/Transfer' : 'Tarik Tunai'}: ${tfTitle}`,
          customerName: finalCustName,
          customerPhone: tfCustomerPhone || undefined,
          amount: totalTagihan,
          notes:
            unpaid > 0
              ? `STATUS: BELUM LUNAS / KASBON (Sisa: ${formatIDR(unpaid)})`
              : 'STATUS: LUNAS',
          extraLines: [
            { label: 'Nominal Pokok', value: formatIDR(pokok) },
            { label: 'Biaya Admin', value: formatIDR(admin) },
            ...(unpaid > 0
              ? [
                  { label: 'Dibayar Sekarang', value: formatIDR(paidNow) },
                  { label: 'Sisa Tagihan (Piutang)', value: formatIDR(unpaid) },
                ]
              : []),
          ],
        });
      }
    } finally {
      setIsSavingTf(false);
    }
  };

  const handleSaveKulakan = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(kulakAmount) || 0;
    const targetWallet = kulakWalletId || wallets[0]?.id;
    if (!kulakTitle.trim() || total <= 0 || !targetWallet) return;

    setIsSavingKulak(true);
    try {
      await createTransaction(uid, {
        category: 'kulakan_barang',
        flowType: 'keluar',
        title: `Kulakan: ${kulakTitle}`,
        customerName: 'Grosir / Supplier',
        walletId: targetWallet,
        amount: total,
        costAmount: total,
        profitAmount: 0,
        dateString: kulakDate,
        notes: kulakNotes || 'Belanja modal kulakan voucher/aksesoris',
      });
      setKulakTitle('');
      setKulakAmount('');
      setKulakNotes('');
      showToast(`Catatan kulakan ${formatIDR(total)} berhasil disimpan`);
    } finally {
      setIsSavingKulak(false);
    }
  };

  const openAddPresetModal = () => {
    setEditingPresetId(undefined);
    setPresetCategory('voucher');
    setPresetName('');
    setPresetCost('');
    setPresetSell('');
    setShowPresetModal(true);
  };

  const startEditPreset = (p: CatalogPreset) => {
    setEditingPresetId(p.id);
    setPresetCategory(p.category);
    setPresetName(p.name);
    setPresetCost(String(p.costPrice));
    setPresetSell(String(p.sellPrice));
    setShowPresetModal(true);
  };

  const handleSavePresetForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    setIsSavingPreset(true);
    try {
      await saveCatalogPreset(
        uid,
        {
          category: presetCategory,
          name: presetName,
          costPrice: Number(presetCost) || 0,
          sellPrice: Number(presetSell) || 0,
        },
        editingPresetId
      );
      setShowPresetModal(false);
      showToast('Produk berhasil disimpan ke Katalog Tombol Cepat');
    } finally {
      setIsSavingPreset(false);
    }
  };

  const estimatedProfit = (Number(sellPrice) || 0) - (Number(costPrice) || 0);
  const saleUnpaidPreview =
    salePaymentStatus === 'hutang'
      ? Math.max(0, (Number(sellPrice) || 0) - (Number(salePaidNow) || 0))
      : 0;
  const tfTotalTagihan = (Number(tfPrincipalAmount) || 0) + (Number(tfAdminFee) || 0);
  const tfUnpaidPreview =
    tfPaymentStatus === 'hutang' && transferMode === 'kirim_topup'
      ? Math.max(0, tfTotalTagihan - (Number(tfPaidNow) || 0))
      : 0;

  return (
    <div className="space-y-3">
      {/* Header & Clean Segmented Sub-Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          Kasir Cepat: Voucher, Pulsa, Topup & Kulakan
        </h2>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-xl overflow-x-auto self-start max-w-full">
          {(
            [
              { id: 'penjualan', label: 'Katalog Cepat' },
              { id: 'topup_transfer', label: 'Topup & TF' },
              { id: 'kulakan', label: 'Kulakan' },
              { id: 'setting_preset', label: `Atur Katalog (${presets.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* TAB 1: KATALOG CEPAT (JELAS PEMISAHAN ANTARA TRANSAKSI BEBAS VS KATALOG TOMBOL CEPAT) */}
      {activeSubTab === 'penjualan' && (
        <div className="space-y-3">
          {/* Action Strip 1: Transaksi Bebas (Untuk barang/nominal yang tidak ada di katalog) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Transaksi Bebas (Produk / Nominal Di Luar Katalog)
              </div>
              <div className="text-[11px] text-slate-500">
                Gunakan tombol ini jika pelanggan membeli produk, pulsa, atau servis dengan harga custom (Bisa Lunas atau Kasbon).
              </div>
            </div>
            <button
              onClick={handleOpenManualSale}
              disabled={wallets.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Transaksi Bebas</span>
            </button>
          </div>

          {/* Action Strip 2: Katalog Tombol Cepat (Ketuk 1x untuk Jual) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Katalog Tombol Cepat (Ketuk 1x Produk untuk Jual)
                </div>
                <div className="text-[11px] text-slate-500">
                  Daftar produk yang sering terjual. Ketuk kartu di bawah untuk langsung memproses pembayaran.
                </div>
              </div>

              <button
                onClick={openAddPresetModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Tambah Produk ke Katalog</span>
              </button>
            </div>

            {/* Filter Kategori Katalog */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl overflow-x-auto max-w-full w-fit">
              {(
                [
                  { id: 'all', label: 'Semua Kategori' },
                  { id: 'voucher', label: 'Voucher Data' },
                  { id: 'pulsa_data', label: 'Pulsa & Paket' },
                  { id: 'aksesoris', label: 'Aksesoris HP' },
                  { id: 'servis', label: 'Jasa Servis' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setPresetCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    presetCategoryFilter === cat.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {filteredPresets.length === 0 ? (
              <div className="p-6 text-center space-y-2.5">
                <p className="text-xs text-slate-500">
                  Belum ada produk tersimpan pada kategori katalog ini.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={openAddPresetModal}
                    className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    + Tambah Produk ke Katalog
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredPresets.map((p) => {
                  const untung = p.sellPrice - p.costPrice;
                  const catStyle =
                    PRESET_CATEGORY_STYLES[p.category] || PRESET_CATEGORY_STYLES.voucher;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`bg-slate-50/70 border border-slate-200 ${catStyle.borderHover} rounded-xl p-2.5 sm:p-3 text-left transition-colors flex flex-col justify-between gap-1.5 cursor-pointer`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10px] font-semibold ${catStyle.textClass} truncate`}>
                          {catStyle.label}
                        </div>
                        <div className="font-bold text-xs text-slate-900 truncate mt-0.5">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-tabular truncate mt-0.5">
                          Modal {formatIDR(p.costPrice)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/70 w-full">
                        <span className="text-xs font-bold font-mono-tabular text-slate-900 truncate">
                          {formatIDR(p.sellPrice)}
                        </span>
                        <span className="text-[10px] font-mono-tabular font-semibold text-emerald-600 shrink-0">
                          +{formatIDR(untung)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TOPUP E-WALLET, TRANSFER BANK & TARIK TUNAI */}
      {activeSubTab === 'topup_transfer' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Topup E-Wallet, Transfer Bank & Tarik Tunai
            </h3>
            <p className="text-xs text-slate-500">
              Otomatis menyesuaikan 2 kantong saldo sekaligus. Mendukung pembayaran Lunas maupun Kasbon / Bayar Nanti lewat chat.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setTransferMode('kirim_topup')}
              className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                transferMode === 'kirim_topup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Topup / Transfer (Saldo Kita Keluar)
            </button>
            <button
              type="button"
              onClick={() => {
                setTransferMode('tarik_tunai');
                setTfPaymentStatus('lunas');
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                transferMode === 'tarik_tunai'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tarik Tunai (Uang Laci Keluar)
            </button>
          </div>

          <form onSubmit={handleSaveTopupTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jenis Layanan & Tujuan
              </label>
              <input
                type="text"
                required
                value={tfTitle}
                onChange={(e) => setTfTitle(e.target.value)}
                placeholder="Contoh: Topup DANA 100rb / Transfer BRI"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nominal Pokok
                </label>
                <CurrencyInput
                  required
                  value={tfPrincipalAmount}
                  onChange={setTfPrincipalAmount}
                  placeholder="100.000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Biaya Admin / Untung Konter
                </label>
                <CurrencyInput
                  required
                  value={tfAdminFee}
                  onChange={setTfAdminFee}
                  placeholder="5.000"
                />
              </div>
            </div>

            {/* Status Pembayaran (Lunas vs Kasbon/Bayar Nanti) untuk Topup/Transfer */}
            {transferMode === 'kirim_topup' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Status Pembayaran Pelanggan</div>
                    <div className="text-[11px] text-slate-500">
                      Total Tagihan Pelanggan:{' '}
                      <strong className="font-mono-tabular text-slate-900">
                        {formatIDR(tfTotalTagihan)}
                      </strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTfPaymentStatus('lunas')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        tfPaymentStatus === 'lunas'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Lunas Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTfPaymentStatus('hutang');
                        setTfPaidNow('0');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        tfPaymentStatus === 'hutang'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Bayar Nanti / Kasbon
                    </button>
                  </div>
                </div>

                {tfPaymentStatus === 'hutang' && (
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Otomatis Masuk Buku Piutang:</strong> Saldo Bank/Server Anda tetap terpotong{' '}
                        <span className="font-mono-tabular font-semibold">{formatIDR(Number(tfPrincipalAmount) || 0)}</span>{' '}
                        sekarang, dan sisa tagihan{' '}
                        <span className="font-mono-tabular font-bold">{formatIDR(tfUnpaidPreview)}</span>{' '}
                        otomatis dicatat sebagai Piutang Pelanggan. Saat dibayar malam/besok, cukup klik <strong>Bayar</strong> di menu Pembukuan.
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Dibayar Sekarang / DP (Isi 0 jika belum bayar)
                        </label>
                        <CurrencyInput
                          value={tfPaidNow}
                          onChange={setTfPaidNow}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Janji Bayar / Jatuh Tempo
                        </label>
                        <input
                          type="date"
                          value={tfDueDate}
                          onChange={(e) => setTfDueDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <CustomerContactInput
              uid={uid}
              customers={customers}
              nameValue={tfCustomerName}
              onNameChange={setTfCustomerName}
              phoneValue={tfCustomerPhone}
              onPhoneChange={setTfCustomerPhone}
              nameLabel={
                tfPaymentStatus === 'hutang'
                  ? 'Nama Pelanggan (Wajib untuk Piutang/Kasbon)'
                  : 'Nama Pelanggan (Opsional)'
              }
              phoneLabel="Nomor HP / Tujuan WA"
              namePlaceholder="Contoh: Mbak Siti"
              phonePlaceholder="081234567890"
              nameRequired={tfPaymentStatus === 'hutang'}
              defaultCategory="langganan"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kantong Kas Penerima (Uang Masuk)
                </label>
                <select
                  value={tfCashWalletId}
                  onChange={(e) => setTfCashWalletId(e.target.value)}
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
                  Kantong Bank / Server / E-Wallet (Saldo Terpotong)
                </label>
                <select
                  value={tfDigitalWalletId}
                  onChange={(e) => setTfDigitalWalletId(e.target.value)}
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
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  value={tfDate}
                  onChange={(e) => setTfDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingTf}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isSavingTf
                ? 'Memproses...'
                : tfPaymentStatus === 'hutang'
                ? `Simpan & Catat Piutang (${formatIDR(tfUnpaidPreview)})`
                : 'Simpan Transaksi Topup / Transfer'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CATAT KULAKAN MODAL */}
      {activeSubTab === 'kulakan' && (
        <div className="max-w-xl bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Catat Belanja Kulakan Modal (Voucher / Aksesoris)
            </h3>
            <p className="text-xs text-slate-500">
              Cukup catat total belanja kulakan grosir (misal Rp 625.000), lalu saat laku tinggal ketuk di menu Katalog Cepat.
            </p>
          </div>

          <form onSubmit={handleSaveKulakan} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Keterangan Kulakan
              </label>
              <input
                type="text"
                required
                value={kulakTitle}
                onChange={(e) => setKulakTitle(e.target.value)}
                placeholder="Contoh: Kulak Voucher Telkomsel & Indosat"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Total Nominal Kulakan
                </label>
                <CurrencyInput
                  required
                  value={kulakAmount}
                  onChange={setKulakAmount}
                  placeholder="625.000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tanggal Kulakan
                </label>
                <input
                  type="date"
                  value={kulakDate}
                  onChange={(e) => setKulakDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Potong Saldo Dari Kantong Kas
              </label>
              <select
                value={kulakWalletId}
                onChange={(e) => setKulakWalletId(e.target.value)}
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
                Catatan Rincian (Opsional)
              </label>
              <input
                type="text"
                value={kulakNotes}
                onChange={(e) => setKulakNotes(e.target.value)}
                placeholder="Contoh: Tsel 5GB 20pcs, Tsel 7GB 15pcs"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingKulak}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isSavingKulak ? 'Menyimpan...' : 'Simpan Catatan Kulakan'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: DAFTAR SETTINGAN HARGA KATALOG PRODUK */}
      {activeSubTab === 'setting_preset' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Daftar Katalog Produk Cepat ({presets.length})
              </h3>
              <p className="text-xs text-slate-500">
                Atur modal dan harga jual produk agar saat kasir cukup ketuk 1x.
              </p>
            </div>
            <button
              onClick={openAddPresetModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Produk Katalog
            </button>
          </div>

          {presets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Belum ada produk di katalog cepat.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {presets.map((p) => {
                const catStyle =
                  PRESET_CATEGORY_STYLES[p.category] || PRESET_CATEGORY_STYLES.voucher;
                return (
                  <div
                    key={p.id}
                    className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {p.name}
                        </span>
                        <span className={`text-[11px] font-semibold ${catStyle.textClass}`}>
                          · {catStyle.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                        Modal {formatIDR(p.costPrice)} · Jual{' '}
                        <span className="text-slate-900 font-semibold">{formatIDR(p.sellPrice)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono-tabular font-semibold text-emerald-600">
                        +{formatIDR(p.sellPrice - p.costPrice)}
                      </span>
                      <button
                        onClick={() => startEditPreset(p)}
                        className="p-2 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCatalogPreset(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
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
      )}

      {/* Modal / Bottom Sheet Konfirmasi Penjualan Cepat */}
      {showSaleModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowSaleModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Transaksi Penjualan Kasir
              </h3>
              <button
                onClick={() => setShowSaleModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Voucher / Produk / Layanan
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Contoh: Telkomsel 7GB / Tempered Glass"
                  className="w-full px-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Harga Modal</label>
                  <CurrencyInput
                    required
                    value={costPrice}
                    onChange={setCostPrice}
                    placeholder="25.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Harga Jual</label>
                  <CurrencyInput
                    required
                    value={sellPrice}
                    onChange={setSellPrice}
                    placeholder="32.000"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">Untung Transaksi Ini:</span>
                <span
                  className={`font-mono-tabular font-bold text-sm ${
                    estimatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {estimatedProfit >= 0 ? '+' : ''}
                  {formatIDR(estimatedProfit)}
                </span>
              </div>

              {/* Status Pembayaran: Lunas vs Bayar Nanti / Kasbon */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">Status Pembayaran</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSalePaymentStatus('lunas')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        salePaymentStatus === 'lunas'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      Lunas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSalePaymentStatus('hutang');
                        setSalePaidNow('0');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        salePaymentStatus === 'hutang'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      Kasbon / Nanti
                    </button>
                  </div>
                </div>

                {salePaymentStatus === 'hutang' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                      Sisa tagihan <strong>{formatIDR(saleUnpaidPreview)}</strong> akan otomatis tercatat di menu <strong>Pembukuan &rarr; Hutang & Piutang</strong>.
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Dibayar Sekarang (DP)
                        </label>
                        <CurrencyInput
                          value={salePaidNow}
                          onChange={setSalePaidNow}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Janji Bayar
                        </label>
                        <input
                          type="date"
                          value={saleDueDate}
                          onChange={(e) => setSaleDueDate(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uang Masuk Ke
                  </label>
                  <select
                    value={receiveWalletId}
                    onChange={(e) => setReceiveWalletId(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={saleCategory}
                    onChange={(e) => setSaleCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="voucher">Voucher Data</option>
                    <option value="pulsa_data">Pulsa Elektrik</option>
                    <option value="aksesoris">Aksesoris HP</option>
                    <option value="servis">Jasa Servis</option>
                  </select>
                </div>
              </div>

              <CustomerContactInput
                uid={uid}
                customers={customers}
                nameValue={customerName}
                onNameChange={setCustomerName}
                phoneValue={customerPhone}
                onPhoneChange={setCustomerPhone}
                nameLabel={
                  salePaymentStatus === 'hutang'
                    ? 'Nama Pelanggan (Wajib untuk Kasbon)'
                    : 'Nama Pelanggan (Opsional)'
                }
                phoneLabel="Nomor HP / Tujuan (Untuk WA)"
                namePlaceholder="Contoh: Mas Budi"
                phonePlaceholder="081234567890"
                nameRequired={salePaymentStatus === 'hutang'}
                defaultCategory="langganan"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductServerWallet}
                    onChange={(e) => setDeductServerWallet(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Potong Saldo Server / Bank sekarang (Khusus Pulsa Elektrik)</span>
                </label>

                {deductServerWallet && (
                  <select
                    value={serverWalletId}
                    onChange={(e) => setServerWalletId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        Potong dari: {w.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={isSavingSale || wallets.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isSavingSale
                  ? 'Menyimpan...'
                  : salePaymentStatus === 'hutang'
                  ? `Simpan & Catat Piutang (${formatIDR(saleUnpaidPreview)})`
                  : `Simpan Penjualan Lunas (${formatIDR(Number(sellPrice) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Produk Katalog */}
      {showPresetModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowPresetModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingPresetId ? 'Edit Produk Katalog Cepat' : 'Tambah Produk ke Katalog Cepat'}
              </h3>
              <button
                onClick={() => setShowPresetModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSavePresetForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                <select
                  value={presetCategory}
                  onChange={(e) => setPresetCategory(e.target.value as PresetCategory)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="voucher">Voucher Data / Fisik</option>
                  <option value="pulsa_data">Pulsa & Paket Elektrik</option>
                  <option value="aksesoris">Aksesoris HP</option>
                  <option value="servis">Jasa Servis</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Voucher / Produk
                </label>
                <input
                  type="text"
                  required
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Contoh: Telkomsel 5GB / Telkomsel 7GB"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Harga Modal</label>
                  <CurrencyInput
                    required
                    value={presetCost}
                    onChange={setPresetCost}
                    placeholder="13.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Harga Jual</label>
                  <CurrencyInput
                    required
                    value={presetSell}
                    onChange={setPresetSell}
                    placeholder="20.000"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPreset}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {isSavingPreset ? 'Menyimpan...' : 'Simpan ke Katalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
