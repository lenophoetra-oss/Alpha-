import React, { useState, useMemo } from 'react';
import {
  Wallet,
  PhoneInventory,
  PhoneCondition,
  PhoneCompleteness,
  PhoneStatus,
  CustomerRecord,
  LedgerTransaction,
  ReceiptPayload,
  formatIDR,
  getTodayDateString,
} from '../types';
import {
  createPhoneInventory,
  updatePhoneInventory,
  addPhoneServiceExpense,
  sellPhoneUnit,
  deletePhoneInventory,
} from '../services/firestoreService';
import { Plus, Search, Wrench, CheckCircle2, Trash2, Printer, Edit2 } from 'lucide-react';
import { CustomerContactInput } from './CustomerContactInput';
import { CurrencyInput } from './CurrencyInput';

interface PhonesViewProps {
  uid: string;
  wallets: Wallet[];
  phones: PhoneInventory[];
  transactions?: LedgerTransaction[];
  customers?: CustomerRecord[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
}

export const PhonesView: React.FC<PhonesViewProps> = ({
  uid,
  wallets,
  phones,
  transactions = [],
  customers = [],
  onOpenReceipt,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | PhoneStatus>('tersedia');
  const [conditionFilter, setConditionFilter] = useState<'all' | PhoneCondition>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Tambah / Edit HP
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState<PhoneInventory | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [imei, setImei] = useState('');
  const [condition, setCondition] = useState<PhoneCondition>('seken');
  const [completeness, setCompleteness] = useState<PhoneCompleteness>('fullset');
  const [minusNotes, setMinusNotes] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [serviceCost, setServiceCost] = useState('0');
  const [targetSellPrice, setTargetSellPrice] = useState('');
  const [soldPriceEdit, setSoldPriceEdit] = useState('0');
  const [initialStatus, setInitialStatus] = useState<PhoneStatus>('tersedia');
  const [sourceInfo, setSourceInfo] = useState('');
  const [sourcePhone, setSourcePhone] = useState('');
  const [buyerInfoEdit, setBuyerInfoEdit] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [recordPurchaseTx, setRecordPurchaseTx] = useState(true);
  const [buyDate, setBuyDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Tambah Biaya Servis / Part
  const [servicingPhone, setServicingPhone] = useState<PhoneInventory | null>(null);
  const [addedServiceCost, setAddedServiceCost] = useState('');
  const [serviceNoteInput, setServiceNoteInput] = useState('');
  const [serviceWalletId, setServiceWalletId] = useState(wallets[0]?.id || '');
  const [serviceNextStatus, setServiceNextStatus] = useState<'tersedia' | 'servis'>('tersedia');
  const [serviceDate, setServiceDate] = useState(getTodayDateString());

  // Modal Jual Unit HP
  const [sellingPhone, setSellingPhone] = useState<PhoneInventory | null>(null);
  const [actualSoldPrice, setActualSoldPrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleWalletId, setSaleWalletId] = useState(wallets[0]?.id || '');
  const [saleNotes, setSaleNotes] = useState('');
  const [salePaymentMode, setSalePaymentMode] = useState<'lunas' | 'hutang'>('lunas');
  const [salePaidNow, setSalePaidNow] = useState('0');
  const [saleDueDate, setSaleDueDate] = useState(getTodayDateString());
  const [sellDate, setSellDate] = useState(getTodayDateString());

  const walletMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) map[w.id] = w.name;
    return map;
  }, [wallets]);

  const filteredPhones = useMemo(() => {
    return phones.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (conditionFilter !== 'all' && p.condition !== conditionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.brand.toLowerCase().includes(q) ||
          p.model.toLowerCase().includes(q) ||
          p.imei.toLowerCase().includes(q) ||
          p.minusNotes.toLowerCase().includes(q) ||
          p.sourceInfo.toLowerCase().includes(q) ||
          p.buyerInfo.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [phones, statusFilter, conditionFilter, searchQuery]);

  const summary = useMemo(() => {
    let availableCount = 0;
    let serviceCount = 0;
    let soldCount = 0;
    let activeCapital = 0;
    let potentialRevenue = 0;
    let realizedProfit = 0;

    for (const p of phones) {
      const hpp = p.buyPrice + p.serviceCost;
      if (p.status === 'tersedia') {
        availableCount += 1;
        activeCapital += hpp;
        potentialRevenue += p.targetSellPrice;
      } else if (p.status === 'servis') {
        serviceCount += 1;
        activeCapital += hpp;
        potentialRevenue += p.targetSellPrice;
      } else if (p.status === 'terjual') {
        soldCount += 1;
        realizedProfit += p.soldPrice - hpp;
      }
    }

    return {
      availableCount,
      serviceCount,
      soldCount,
      activeCapital,
      potentialRevenue,
      potentialProfit: potentialRevenue - activeCapital,
      realizedProfit,
    };
  }, [phones]);

  const handleOpenAdd = () => {
    setEditingPhone(null);
    setBrand('');
    setModel('');
    setImei('');
    setCondition('seken');
    setCompleteness('fullset');
    setMinusNotes('');
    setBuyPrice('');
    setServiceCost('0');
    setTargetSellPrice('');
    setSoldPriceEdit('0');
    setInitialStatus('tersedia');
    setSourceInfo('');
    setSourcePhone('');
    setBuyerInfoEdit('-');
    setSelectedWalletId(wallets[0]?.id || '');
    setRecordPurchaseTx(true);
    setBuyDate(getTodayDateString());
    setShowAddModal(true);
  };

  const handleOpenEdit = (phone: PhoneInventory) => {
    setEditingPhone(phone);
    setBrand(phone.brand);
    setModel(phone.model);
    setImei(phone.imei === '-' ? '' : phone.imei);
    setCondition(phone.condition);
    setCompleteness(phone.completeness);
    setMinusNotes(phone.minusNotes);
    setBuyPrice(String(phone.buyPrice));
    setServiceCost(String(phone.serviceCost));
    setTargetSellPrice(String(phone.targetSellPrice));
    setSoldPriceEdit(String(phone.soldPrice || 0));
    setInitialStatus(phone.status);
    setSourceInfo(phone.sourceInfo);
    setSourcePhone('');
    setBuyerInfoEdit(phone.buyerInfo || '-');
    setSelectedWalletId(
      phone.walletId && phone.walletId !== '-' ? phone.walletId : wallets[0]?.id || ''
    );
    setRecordPurchaseTx(true);
    setShowAddModal(true);
  };

  const handleSaveNewOrEditPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingPhone) {
        await updatePhoneInventory(
          editingPhone,
          {
            brand,
            model,
            imei: imei || '-',
            condition,
            completeness,
            minusNotes: minusNotes || 'Normal',
            buyPrice: Number(buyPrice) || 0,
            serviceCost: Number(serviceCost) || 0,
            targetSellPrice: Number(targetSellPrice) || 0,
            soldPrice: Number(soldPriceEdit) || editingPhone.soldPrice || 0,
            status: initialStatus,
            sourceInfo: sourcePhone.trim()
              ? `${sourceInfo || 'User / Kulakan'} (${sourcePhone.trim()})`
              : sourceInfo || 'User / Kulakan',
            buyerInfo: buyerInfoEdit || editingPhone.buyerInfo || '-',
            walletId: selectedWalletId || editingPhone.walletId || '-',
          },
          transactions
        );
      } else {
        if (recordPurchaseTx && !selectedWalletId) return;
        await createPhoneInventory(uid, {
          brand,
          model,
          imei: imei || '-',
          condition,
          completeness,
          minusNotes: minusNotes || (condition === 'baru' ? 'Segel / Baru' : 'Normal Mulus'),
          buyPrice: Number(buyPrice) || 0,
          serviceCost: Number(serviceCost) || 0,
          targetSellPrice: Number(targetSellPrice) || 0,
          status: initialStatus,
          sourceInfo: sourcePhone.trim()
            ? `${sourceInfo || 'User / Kulakan'} (${sourcePhone.trim()})`
            : sourceInfo || 'User / Kulakan',
          walletId: recordPurchaseTx ? selectedWalletId : selectedWalletId || '-',
          recordPurchaseTx,
          dateString: buyDate,
        });
      }
      setShowAddModal(false);
      setEditingPhone(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenServiceModal = (phone: PhoneInventory) => {
    setServicingPhone(phone);
    setAddedServiceCost('');
    setServiceNoteInput('');
    setServiceWalletId(wallets[0]?.id || phone.walletId);
    setServiceNextStatus('tersedia');
    setServiceDate(getTodayDateString());
  };

  const handleSaveServiceExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servicingPhone || !serviceWalletId) return;
    setIsSubmitting(true);
    try {
      await addPhoneServiceExpense(
        uid,
        servicingPhone,
        Number(addedServiceCost) || 0,
        serviceNoteInput,
        serviceWalletId,
        serviceNextStatus,
        serviceDate
      );
      setServicingPhone(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSellModal = (phone: PhoneInventory) => {
    setSellingPhone(phone);
    setActualSoldPrice(String(phone.targetSellPrice || phone.buyPrice + phone.serviceCost));
    setBuyerName('');
    setBuyerPhone('');
    setSaleWalletId(wallets[0]?.id || phone.walletId);
    setSaleNotes('');
    setSalePaymentMode('lunas');
    setSalePaidNow('0');
    setSaleDueDate(getTodayDateString());
    setSellDate(getTodayDateString());
  };

  const handleConfirmSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingPhone || !saleWalletId) return;
    const dealPrice = Number(actualSoldPrice) || 0;
    const isCredit = salePaymentMode === 'hutang';
    const paidNowVal = isCredit ? Math.min(dealPrice, Math.max(0, Number(salePaidNow) || 0)) : dealPrice;
    const unpaidVal = Math.max(0, dealPrice - paidNowVal);
    const finalBuyer = buyerName.trim() || (isCredit ? 'Pembeli HP (Kasbon)' : 'Pembeli Umum');
    const buyerDisplay = buyerPhone.trim() ? `${finalBuyer} (${buyerPhone.trim()})` : finalBuyer;

    setIsSubmitting(true);
    try {
      await sellPhoneUnit(
        uid,
        sellingPhone,
        dealPrice,
        buyerDisplay,
        saleWalletId,
        saleNotes,
        {
          isCredit,
          paidNow: paidNowVal,
          buyerPhone: buyerPhone.trim(),
          dueDate: saleDueDate,
          dateString: sellDate,
        }
      );
      const soldSnapshot = sellingPhone;
      setSellingPhone(null);
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: `HP-${soldSnapshot.id.slice(-6).toUpperCase()}`,
          dateString: sellDate,
          categoryLabel: 'Penjualan Unit HP',
          title: `${soldSnapshot.brand} ${soldSnapshot.model}`,
          customerName: finalBuyer,
          customerPhone: buyerPhone.trim() || undefined,
          amount: dealPrice,
          notes:
            unpaidVal > 0
              ? `STATUS: BELUM LUNAS / DP (Sisa Piutang: ${formatIDR(unpaidVal)}) | ${saleNotes || soldSnapshot.minusNotes}`
              : saleNotes || soldSnapshot.minusNotes,
          extraLines: [
            { label: 'IMEI / Kode', value: soldSnapshot.imei },
            { label: 'Kondisi', value: soldSnapshot.condition.toUpperCase() },
            { label: 'Kelengkapan', value: soldSnapshot.completeness.toUpperCase() },
            ...(unpaidVal > 0
              ? [
                  { label: 'Dibayar Sekarang (DP)', value: formatIDR(paidNowVal) },
                  { label: 'Sisa Tagihan (Piutang)', value: formatIDR(unpaidVal) },
                ]
              : []),
          ],
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const conditionLabel: Record<PhoneCondition, string> = {
    baru: 'Baru',
    seken: 'Seken Normal',
    minusan: 'Minusan / Bahan',
  };

  const completenessLabel: Record<PhoneCompleteness, string> = {
    fullset: 'Fullset Dus',
    unit_cas: 'Unit + Cas',
    batangan: 'Batangan',
  };

  const sellUnpaidPreview =
    salePaymentMode === 'hutang'
      ? Math.max(0, (Number(actualSoldPrice) || 0) - (Number(salePaidNow) || 0))
      : 0;

  return (
    <div className="space-y-3">
      {/* Header & Primary Action */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
          Stok & Jual Beli HP
        </h2>
        <button
          onClick={handleOpenAdd}
          disabled={wallets.length === 0}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Input HP Masuk</span>
        </button>
      </div>

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
          <div className="text-[11px] text-slate-500 truncate">Stok Unit Aktif</div>
          <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900">
            {summary.availableCount + summary.serviceCount} Unit
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {summary.availableCount} Siap · {summary.serviceCount} Servis
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
          <div className="text-[11px] text-slate-500 truncate">Modal Stok (HPP)</div>
          <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
            {formatIDR(summary.activeCapital)}
          </div>
          <div className="text-[10px] text-slate-500 truncate">Beli + biaya servis</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
          <div className="text-[11px] text-slate-500 truncate">Target Etalase</div>
          <div className="text-sm sm:text-base font-bold font-mono-tabular text-slate-900 truncate">
            {formatIDR(summary.potentialRevenue)}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Potensi: <span className="font-mono-tabular text-emerald-600">+{formatIDR(summary.potentialProfit)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-0.5">
          <div className="text-[11px] text-slate-500 truncate">Laba Terjual ({summary.soldCount}u)</div>
          <div className="text-sm sm:text-base font-bold font-mono-tabular text-emerald-600 truncate">
            +{formatIDR(summary.realizedProfit)}
          </div>
          <div className="text-[10px] text-slate-500 truncate">Untung terealisasi</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'tersedia', label: `Siap (${summary.availableCount})` },
                { id: 'servis', label: `Servis (${summary.serviceCount})` },
                { id: 'terjual', label: `Terjual (${summary.soldCount})` },
                { id: 'all', label: 'Semua' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tipe HP, IMEI, minus..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Condition Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto">
          {(
            [
              { id: 'all', label: 'Semua Kondisi' },
              { id: 'baru', label: 'Baru' },
              { id: 'seken', label: 'Seken Normal' },
              { id: 'minusan', label: 'Minusan / Bahan' },
            ] as const
          ).map((cond) => (
            <button
              key={cond.id}
              onClick={() => setConditionFilter(cond.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                conditionFilter === cond.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cond.label}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Phone List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filteredPhones.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">Tidak ada unit HP pada kategori ini.</p>
            {wallets.length > 0 && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                + Input Unit HP Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPhones.map((phone) => {
              const totalCost = phone.buyPrice + phone.serviceCost;
              const activePrice = phone.status === 'terjual' ? phone.soldPrice : phone.targetSellPrice;
              const profit = activePrice - totalCost;
              const walletLabel = walletMap[phone.walletId] || 'Kantong Kas';

              return (
                <div
                  key={phone.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Info Unit & Kondisi */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between lg:justify-start gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {phone.brand} {phone.model}
                      </h3>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          phone.status === 'tersedia'
                            ? 'text-emerald-600'
                            : phone.status === 'servis'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                        }`}
                      >
                        · {conditionLabel[phone.condition]} · {phone.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>{completenessLabel[phone.completeness]}</span>
                      <span>·</span>
                      <span>IMEI: {phone.imei}</span>
                      <span>·</span>
                      <span>Asal: {phone.sourceInfo}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-700">Modal: {walletLabel}</span>
                    </div>

                    <div className="text-xs text-slate-700 pt-0.5">
                      Catatan: {phone.minusNotes}
                      {phone.status === 'terjual' && (
                        <span className="text-emerald-700 font-medium">
                          {' '}· Pembeli: {phone.buyerInfo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Angka Modal, Harga Jual & Laba + Tombol Aksi */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="grid grid-cols-3 gap-4 text-left sm:text-right font-mono-tabular">
                      <div>
                        <div className="text-[11px] font-sans text-slate-500">Modal HPP</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800">
                          {formatIDR(totalCost)}
                        </div>
                        {phone.serviceCost > 0 && (
                          <div className="text-[10px] font-sans text-slate-400">
                            +Servis {formatIDR(phone.serviceCost)}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {phone.status === 'terjual' ? 'Terjual' : 'Harga Jual'}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {formatIDR(activePrice)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {phone.status === 'terjual' ? 'Laba Real' : 'Est. Laba'}
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {profit >= 0 ? '+' : ''}
                          {formatIDR(profit)}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons (Jual, +Servis, Edit, Nota, Hapus) */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {phone.status !== 'terjual' && (
                        <>
                          <button
                            onClick={() => handleOpenSellModal(phone)}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Jual</span>
                          </button>
                          <button
                            onClick={() => handleOpenServiceModal(phone)}
                            title="Tambah Biaya Servis / Part"
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>+Servis</span>
                          </button>
                        </>
                      )}
                      {phone.status === 'terjual' && onOpenReceipt && (
                        <button
                          onClick={() =>
                            onOpenReceipt({
                              receiptNo: `HP-${phone.id.slice(-6).toUpperCase()}`,
                              dateString: getTodayDateString(),
                              categoryLabel: 'Penjualan Unit HP',
                              title: `${phone.brand} ${phone.model}`,
                              customerName: phone.buyerInfo,
                              amount: phone.soldPrice,
                              notes: phone.minusNotes,
                              extraLines: [
                                { label: 'IMEI / Kode', value: phone.imei },
                                { label: 'Kondisi', value: phone.condition.toUpperCase() },
                                { label: 'Kelengkapan', value: phone.completeness.toUpperCase() },
                              ],
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Nota & WA</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(phone)}
                        title="Edit Harga Modal, Kantong Kas, atau Info HP"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => deletePhoneInventory(phone.id)}
                        title="Hapus Unit"
                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
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

      {/* Modal Input / Edit HP Masuk */}
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
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingPhone ? 'Edit Data HP, Harga Modal & Kantong Kas' : 'Input Stok / Kulak HP Masuk'}
                </h3>
                {editingPhone && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perubahan harga modal atau kantong kas akan otomatis menyesuaikan saldo kas & riwayat transaksi.
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSaveNewOrEditPhone} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Merk HP</label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Contoh: iPhone / Samsung / Xiaomi"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tipe & Kapasitas (RAM/ROM)
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Contoh: 13 Pro 128GB / Redmi Note 12"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kondisi</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as PhoneCondition)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="seken">Seken Normal</option>
                    <option value="minusan">Minusan / Bahan</option>
                    <option value="baru">Baru (Segel)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kelengkapan</label>
                  <select
                    value={completeness}
                    onChange={(e) => setCompleteness(e.target.value as PhoneCompleteness)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="fullset">Fullset (Dus + Cas)</option>
                    <option value="unit_cas">Unit + Charger</option>
                    <option value="batangan">Batangan (Unit Saja)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status Unit</label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as PhoneStatus)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="tersedia">Siap Dijual</option>
                    <option value="servis">Masuk Servis Dulu</option>
                    {editingPhone && <option value="terjual">Sudah Terjual</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  IMEI / Kode Unit (Opsional)
                </label>
                <input
                  type="text"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder="Contoh: 356789..."
                  className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                />
              </div>

              <CustomerContactInput
                uid={uid}
                customers={customers}
                nameValue={sourceInfo}
                onNameChange={setSourceInfo}
                phoneValue={sourcePhone}
                onPhoneChange={setSourcePhone}
                nameLabel="Asal Barang / Nama Penjual"
                phoneLabel="Nomor HP / WA Penjual (Opsional)"
                namePlaceholder="Contoh: User Andi / Supplier"
                phonePlaceholder="081234567890"
                defaultCategory="supplier"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Kondisi / Detail Minus
                </label>
                <input
                  type="text"
                  value={minusNotes}
                  onChange={(e) => setMinusNotes(e.target.value)}
                  placeholder="Contoh: LCD retak pojok / Normal mulus"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Harga Beli (Modal)</label>
                  <CurrencyInput
                    required
                    value={buyPrice}
                    onChange={setBuyPrice}
                    placeholder="1.500.000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Biaya Servis</label>
                  <CurrencyInput
                    value={serviceCost}
                    onChange={setServiceCost}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Harga Jual</label>
                  <CurrencyInput
                    required
                    value={targetSellPrice}
                    onChange={setTargetSellPrice}
                    placeholder="1.850.000"
                  />
                </div>
              </div>

              {editingPhone && initialStatus === 'terjual' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Harga Terjual Deal
                    </label>
                    <CurrencyInput
                      value={soldPriceEdit}
                      onChange={setSoldPriceEdit}
                      placeholder="1.850.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Pembeli
                    </label>
                    <input
                      type="text"
                      value={buyerInfoEdit}
                      onChange={(e) => setBuyerInfoEdit(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kantong Kas Modal Pembelian
                  </label>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!editingPhone && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Pembelian
                    </label>
                    <input
                      type="date"
                      value={buyDate}
                      onChange={(e) => setBuyDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                )}
              </div>
              {!editingPhone && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordPurchaseTx}
                      onChange={(e) => setRecordPurchaseTx(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Potong saldo kantong kas sekarang</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
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
                    : editingPhone
                    ? 'Simpan Perubahan Unit HP'
                    : 'Simpan Unit HP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Biaya Servis / Rekondisi */}
      {servicingPhone && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setServicingPhone(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Tambah Biaya Servis / Part HP
              </h3>
              <button
                onClick={() => setServicingPhone(null)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {servicingPhone.brand} {servicingPhone.model}
              </div>
              <div className="text-slate-600">
                Modal saat ini:{' '}
                <span className="font-mono-tabular font-semibold">
                  {formatIDR(servicingPhone.buyPrice + servicingPhone.serviceCost)}
                </span>
              </div>
            </div>
            <form onSubmit={handleSaveServiceExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Biaya Servis / Ganti Part Tambahan
                </label>
                <CurrencyInput
                  required
                  value={addedServiceCost}
                  onChange={setAddedServiceCost}
                  placeholder="150.000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan Perbaikan / Part
                </label>
                <input
                  type="text"
                  required
                  value={serviceNoteInput}
                  onChange={(e) => setServiceNoteInput(e.target.value)}
                  placeholder="Contoh: Ganti LCD / Baterai"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Potong Kantong</label>
                  <select
                    value={serviceWalletId}
                    onChange={(e) => setServiceWalletId(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status Unit</label>
                  <select
                    value={serviceNextStatus}
                    onChange={(e) => setServiceNextStatus(e.target.value as 'tersedia' | 'servis')}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="tersedia">Selesai (Siap Jual)</option>
                    <option value="servis">Masih Diservis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Servis</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setServicingPhone(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Biaya Servis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Proses Jual HP */}
      {sellingPhone && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSellingPhone(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Proses Transaksi Jual HP</h3>
              <button
                onClick={() => setSellingPhone(null)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="font-semibold text-slate-900 text-sm">
                {sellingPhone.brand} {sellingPhone.model}
              </div>
              <div className="text-slate-600">
                Total Modal (HPP):{' '}
                <span className="font-mono-tabular font-semibold">
                  {formatIDR(sellingPhone.buyPrice + sellingPhone.serviceCost)}
                </span>
              </div>
              <div className="text-emerald-700 font-medium pt-1">
                Untung Bersih:{' '}
                <span className="font-mono-tabular font-bold">
                  {formatIDR(
                    (Number(actualSoldPrice) || 0) -
                      (sellingPhone.buyPrice + sellingPhone.serviceCost)
                  )}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSell} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Harga Terjual Deal
                </label>
                <CurrencyInput
                  required
                  value={actualSoldPrice}
                  onChange={setActualSoldPrice}
                  placeholder="1.850.000"
                />
              </div>

              {/* Status Pembayaran HP: Lunas vs DP / Kasbon */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">Status Pembayaran</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSalePaymentMode('lunas')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        salePaymentMode === 'lunas'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      Lunas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSalePaymentMode('hutang');
                        setSalePaidNow('0');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        salePaymentMode === 'hutang'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      DP / Kasbon
                    </button>
                  </div>
                </div>

                {salePaymentMode === 'hutang' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                      Sisa kekurangan <strong>{formatIDR(sellUnpaidPreview)}</strong> akan otomatis masuk ke menu <strong>Pembukuan &rarr; Hutang & Piutang</strong>.
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Uang Masuk Sekarang (DP)
                        </label>
                        <CurrencyInput
                          value={salePaidNow}
                          onChange={setSalePaidNow}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Jatuh Tempo Pelunasan
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

              <CustomerContactInput
                uid={uid}
                customers={customers}
                nameValue={buyerName}
                onNameChange={setBuyerName}
                phoneValue={buyerPhone}
                onPhoneChange={setBuyerPhone}
                nameLabel={
                  salePaymentMode === 'hutang'
                    ? 'Nama Pembeli (Wajib untuk DP/Kasbon)'
                    : 'Nama Pembeli / Pelanggan'
                }
                phoneLabel="Nomor WA Pembeli (Untuk Kirim Nota)"
                namePlaceholder="Contoh: Mas Budi"
                phonePlaceholder="081234567890"
                nameRequired={salePaymentMode === 'hutang'}
                defaultCategory="umum"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Uang Masuk ke Kantong Kas
                  </label>
                  <select
                    value={saleWalletId}
                    onChange={(e) => setSaleWalletId(e.target.value)}
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
                    Tanggal Penjualan
                  </label>
                  <input
                    type="date"
                    value={sellDate}
                    onChange={(e) => setSellDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Garansi / Keterangan"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSellingPhone(null)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {isSubmitting
                    ? 'Memproses...'
                    : salePaymentMode === 'hutang'
                    ? `Simpan & Catat Piutang (${formatIDR(sellUnpaidPreview)})`
                    : 'Konfirmasi Terjual Lunas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
