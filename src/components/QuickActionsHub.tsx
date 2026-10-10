import React, { useState, useMemo } from 'react';
import {
  Wallet,
  PhoneInventory,
  CatalogPreset,
  CustomerRecord,
  ReceiptPayload,
  PhoneCondition,
  PhoneCompleteness,
  PhoneStatus,
  PawnItemCategory,
  PawnFeeScheme,
  DebtType,
  PersonalExpensePriority,
  PERSONAL_PRIORITY_LABELS,
  CATEGORY_LABELS,
  formatIDR,
  getTodayDateString,
} from '../types';
import {
  createTransaction,
  createDebtRecord,
  createPhoneInventory,
  sellPhoneUnit,
  createPawnRecord,
  createInvestmentRecord,
} from '../services/firestoreService';
import { CurrencyInput } from './CurrencyInput';
import { CustomerContactInput } from './CustomerContactInput';
import {
  Zap,
  ArrowUpRight,
  Wrench,
  ShoppingBag,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  BookOpen,
  Receipt,
  Coins,
  Wallet as WalletIcon,
  Check,
  Clock,
} from 'lucide-react';

export type QuickActionType =
  | 'kasir_cepat'
  | 'topup_tf'
  | 'servis_cepat'
  | 'kulakan'
  | 'beli_hp'
  | 'jual_hp'
  | 'gadai_baru'
  | 'tanam_modal'
  | 'hutang_piutang'
  | 'biaya_toko'
  | 'gaji_pribadi'
  | 'dompet_pribadi';

interface QuickActionsHubProps {
  uid: string;
  wallets: Wallet[];
  phones: PhoneInventory[];
  presets: CatalogPreset[];
  customers: CustomerRecord[];
  onOpenReceipt?: (receipt: ReceiptPayload) => void;
  onNavigate: (tab: string) => void;
}

export const QuickActionsHub: React.FC<QuickActionsHubProps> = ({
  uid,
  wallets,
  phones,
  presets,
  customers,
  onOpenReceipt,
  onNavigate,
}) => {
  const [activeAction, setActiveAction] = useState<QuickActionType | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common Date State (Every transaction has a date input!)
  const [txDate, setTxDate] = useState(getTodayDateString());

  // 1. State Kasir Cepat (Voucher/Pulsa/Aksesoris/Servis)
  const [saleCategory, setSaleCategory] = useState<'voucher' | 'pulsa_data' | 'aksesoris' | 'servis'>('voucher');
  const [productName, setProductName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [receiveWalletId, setReceiveWalletId] = useState('');
  const [deductServerWallet, setDeductServerWallet] = useState(false);
  const [serverWalletId, setServerWalletId] = useState('');
  const [salePaymentStatus, setSalePaymentStatus] = useState<'lunas' | 'hutang'>('lunas');
  const [salePaidNow, setSalePaidNow] = useState('0');
  const [saleDueDate, setSaleDueDate] = useState(getTodayDateString());
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // 2. State Topup / Transfer / Tarik Tunai
  const [transferMode, setTransferMode] = useState<'kirim_topup' | 'tarik_tunai'>('kirim_topup');
  const [tfTitle, setTfTitle] = useState('');
  const [tfPrincipal, setTfPrincipal] = useState('');
  const [tfAdmin, setTfAdmin] = useState('5000');
  const [tfCashWalletId, setTfCashWalletId] = useState('');
  const [tfDigitalWalletId, setTfDigitalWalletId] = useState('');

  // 3. State Kulakan
  const [kulakTitle, setKulakTitle] = useState('');
  const [kulakAmount, setKulakAmount] = useState('');
  const [kulakNotes, setKulakNotes] = useState('');

  // 4. State Beli / Stok HP Masuk
  const [hpBrand, setHpBrand] = useState('');
  const [hpModel, setHpModel] = useState('');
  const [hpImei, setHpImei] = useState('');
  const [hpCondition, setHpCondition] = useState<PhoneCondition>('seken');
  const [hpCompleteness, setHpCompleteness] = useState<PhoneCompleteness>('fullset');
  const [hpMinus, setHpMinus] = useState('');
  const [hpBuyPrice, setHpBuyPrice] = useState('');
  const [hpServiceCost, setHpServiceCost] = useState('0');
  const [hpTargetSell, setHpTargetSell] = useState('');
  const [hpStatus, setHpStatus] = useState<PhoneStatus>('tersedia');
  const [hpRecordCash, setHpRecordCash] = useState(true);

  // 5. State Jual Unit HP dari Stok
  const [selectedPhoneId, setSelectedPhoneId] = useState('');
  const [hpSoldPrice, setHpSoldPrice] = useState('');
  const [hpSaleNotes, setHpSaleNotes] = useState('');

  // 6. State Gadai Barang Baru
  const [pawnCategory, setPawnCategory] = useState<PawnItemCategory>('hp');
  const [pawnItemName, setPawnItemName] = useState('');
  const [pawnCondition, setPawnCondition] = useState('');
  const [pawnLoan, setPawnLoan] = useState('');
  const [pawnFee, setPawnFee] = useState('');
  const [pawnScheme, setPawnScheme] = useState<PawnFeeScheme>('fleksibel');
  const [pawnDueDate, setPawnDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  // 7. State Tanam Modal
  const [invPartner, setInvPartner] = useState('');
  const [invBusiness, setInvBusiness] = useState('');
  const [invCapital, setInvCapital] = useState('');
  const [invNote, setInvNote] = useState('');
  const [invDeductNow, setInvDeductNow] = useState(true);

  // 8. State Hutang Piutang
  const [debtType, setDebtType] = useState<DebtType>('piutang');
  const [debtDesc, setDebtDesc] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtRecordCash, setDebtRecordCash] = useState(false);

  // 9. State Biaya Toko & Gaji Pribadi
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');

  // 10. State Dompet Pribadi
  const [personalFlow, setPersonalFlow] = useState<'keluar' | 'masuk'>('keluar');
  const [personalPriority, setPersonalPriority] = useState<PersonalExpensePriority>('kebutuhan');
  const [personalSourceMode, setPersonalSourceMode] = useState<'saldo_gaji' | 'potong_kantong'>('saldo_gaji');

  const availablePhones = useMemo(
    () => phones.filter((p) => p.status !== 'terjual'),
    [phones]
  );

  const selectedPhoneObj = useMemo(
    () => availablePhones.find((p) => p.id === selectedPhoneId) || null,
    [availablePhones, selectedPhoneId]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const openAction = (action: QuickActionType) => {
    const today = getTodayDateString();
    setTxDate(today);
    setSaleDueDate(today);
    setCustName('');
    setCustPhone('');
    setSalePaymentStatus('lunas');
    setSalePaidNow('0');

    const defaultCash = wallets.find((w) => w.type === 'tunai')?.id || wallets[0]?.id || '';
    const defaultDigital =
      wallets.find((w) => w.type === 'bank' || w.type === 'server' || w.type === 'ewallet')?.id ||
      wallets[1]?.id ||
      wallets[0]?.id ||
      '';

    setReceiveWalletId(defaultCash);
    setServerWalletId(defaultDigital);
    setTfCashWalletId(defaultCash);
    setTfDigitalWalletId(defaultDigital);

    if (action === 'kasir_cepat') {
      setSaleCategory('voucher');
      setProductName('');
      setCostPrice('');
      setSellPrice('');
      setDeductServerWallet(false);
    } else if (action === 'servis_cepat') {
      setSaleCategory('servis');
      setProductName('');
      setCostPrice('0');
      setSellPrice('');
      setDeductServerWallet(false);
    } else if (action === 'topup_tf') {
      setTransferMode('kirim_topup');
      setTfTitle('');
      setTfPrincipal('');
      setTfAdmin('5000');
    } else if (action === 'kulakan') {
      setKulakTitle('');
      setKulakAmount('');
      setKulakNotes('');
    } else if (action === 'beli_hp') {
      setHpBrand('');
      setHpModel('');
      setHpImei('');
      setHpCondition('seken');
      setHpCompleteness('fullset');
      setHpMinus('');
      setHpBuyPrice('');
      setHpServiceCost('0');
      setHpTargetSell('');
      setHpStatus('tersedia');
      setHpRecordCash(true);
    } else if (action === 'jual_hp') {
      const firstHp = availablePhones[0] || null;
      setSelectedPhoneId(firstHp?.id || '');
      setHpSoldPrice(
        firstHp ? String(firstHp.targetSellPrice || firstHp.buyPrice + firstHp.serviceCost) : ''
      );
      setHpSaleNotes('');
    } else if (action === 'gadai_baru') {
      setPawnCategory('hp');
      setPawnItemName('');
      setPawnCondition('');
      setPawnLoan('');
      setPawnFee('');
      setPawnScheme('fleksibel');
    } else if (action === 'tanam_modal') {
      setInvPartner('');
      setInvBusiness('');
      setInvCapital('');
      setInvNote('');
      setInvDeductNow(true);
    } else if (action === 'hutang_piutang') {
      setDebtType('piutang');
      setDebtDesc('');
      setDebtAmount('');
      setDebtRecordCash(false);
    } else if (action === 'biaya_toko' || action === 'gaji_pribadi') {
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
    } else if (action === 'dompet_pribadi') {
      setPersonalFlow('keluar');
      setPersonalPriority('kebutuhan');
      setPersonalSourceMode('saldo_gaji');
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
    }

    setActiveAction(action);
  };

  const handlePickPreset = (p: CatalogPreset) => {
    if (
      p.category === 'voucher' ||
      p.category === 'pulsa_data' ||
      p.category === 'aksesoris' ||
      p.category === 'servis'
    ) {
      setSaleCategory(p.category);
    }
    setProductName(p.name);
    setCostPrice(String(p.costPrice));
    setSellPrice(String(p.sellPrice));
    setDeductServerWallet(p.category === 'pulsa_data');
  };

  // Submit Handlers
  const handleSubmitSaleOrServis = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWallet = receiveWalletId || wallets[0]?.id;
    if (!productName.trim() || !targetWallet) return;

    const modal = Number(costPrice) || 0;
    const jual = Number(sellPrice) || 0;
    const untung = jual - modal;
    const isCredit = salePaymentStatus === 'hutang';
    const paidNow = isCredit ? Math.min(jual, Math.max(0, Number(salePaidNow) || 0)) : jual;
    const unpaid = Math.max(0, jual - paidNow);
    const finalCust = custName.trim() || (isCredit ? 'Pelanggan Kasbon' : 'Umum');

    setIsSubmitting(true);
    try {
      const txId = await createTransaction(uid, {
        category: saleCategory,
        flowType: 'masuk',
        title: unpaid > 0 ? `${productName} (Kasbon)` : productName,
        customerName: finalCust,
        walletId: targetWallet,
        secondaryWalletId: deductServerWallet && serverWalletId ? serverWalletId : '-',
        secondaryAmount: deductServerWallet ? modal : 0,
        amount: paidNow,
        costAmount: modal,
        profitAmount: untung,
        dateString: txDate,
        notes:
          unpaid > 0
            ? `Tagihan: Rp ${jual.toLocaleString('id-ID')} | Dibayar: Rp ${paidNow.toLocaleString('id-ID')} | Sisa Piutang: Rp ${unpaid.toLocaleString('id-ID')}`
            : `Modal Rp ${modal.toLocaleString('id-ID')}, Jual Rp ${jual.toLocaleString('id-ID')}`,
      });

      if (unpaid > 0) {
        await createDebtRecord(uid, {
          type: 'piutang',
          personName: finalCust,
          phone: custPhone.trim() || '-',
          description: `Kasbon ${productName} (Harga Rp ${jual.toLocaleString('id-ID')}, DP Rp ${paidNow.toLocaleString('id-ID')})`,
          totalAmount: unpaid,
          dueDate: saleDueDate || txDate,
          walletId: targetWallet,
          recordInitialCashFlow: false,
          dateString: txDate,
        });
      }

      setActiveAction(null);
      showToast(
        unpaid > 0
          ? `Disimpan! Piutang ${formatIDR(unpaid)} otomatis masuk ke Buku Piutang.`
          : `Transaksi ${productName} berhasil disimpan (Laba ${formatIDR(untung)})`
      );
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: txId.slice(-8).toUpperCase(),
          dateString: txDate,
          categoryLabel: CATEGORY_LABELS[saleCategory],
          title: productName,
          customerName: finalCust,
          customerPhone: custPhone || undefined,
          amount: jual,
          notes:
            unpaid > 0
              ? `STATUS: BELUM LUNAS (Sisa: ${formatIDR(unpaid)})`
              : 'STATUS: LUNAS',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTopupTf = async (e: React.FormEvent) => {
    e.preventDefault();
    const pokok = Number(tfPrincipal) || 0;
    const admin = Number(tfAdmin) || 0;
    if (!tfTitle.trim() || pokok <= 0 || !tfCashWalletId || !tfDigitalWalletId) return;

    const totalTagihan = transferMode === 'kirim_topup' ? pokok + admin : pokok;
    const isCredit = salePaymentStatus === 'hutang' && transferMode === 'kirim_topup';
    const paidNow = isCredit ? Math.min(totalTagihan, Math.max(0, Number(salePaidNow) || 0)) : totalTagihan;
    const unpaid = Math.max(0, totalTagihan - paidNow);
    const finalCust = custName.trim() || (isCredit ? 'Pelanggan Kasbon' : 'Umum');

    setIsSubmitting(true);
    try {
      if (transferMode === 'kirim_topup') {
        await createTransaction(uid, {
          category: 'topup_transfer',
          flowType: 'masuk',
          title: unpaid > 0 ? `Topup/TF (Kasbon): ${tfTitle}` : `Topup/Transfer: ${tfTitle}`,
          customerName: finalCust,
          walletId: tfCashWalletId,
          secondaryWalletId: tfDigitalWalletId,
          amount: paidNow,
          secondaryAmount: pokok,
          costAmount: pokok,
          profitAmount: admin,
          dateString: txDate,
          notes:
            unpaid > 0
              ? `Pokok Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')} | Piutang Rp ${unpaid.toLocaleString('id-ID')}`
              : `Nominal Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')}`,
        });

        if (unpaid > 0) {
          await createDebtRecord(uid, {
            type: 'piutang',
            personName: finalCust,
            phone: custPhone.trim() || '-',
            description: `Kasbon Topup/TF: ${tfTitle} (Pokok Rp ${pokok.toLocaleString('id-ID')} + Admin Rp ${admin.toLocaleString('id-ID')})`,
            totalAmount: unpaid,
            dueDate: saleDueDate || txDate,
            walletId: tfCashWalletId,
            recordInitialCashFlow: false,
            dateString: txDate,
          });
        }
      } else {
        await createTransaction(uid, {
          category: 'topup_transfer',
          flowType: 'masuk',
          title: `Tarik Tunai: ${tfTitle}`,
          customerName: finalCust,
          walletId: tfDigitalWalletId,
          secondaryWalletId: tfCashWalletId,
          amount: pokok,
          secondaryAmount: Math.max(0, pokok - admin),
          costAmount: Math.max(0, pokok - admin),
          profitAmount: admin,
          dateString: txDate,
          notes: `Tarik Tunai Rp ${pokok.toLocaleString('id-ID')}, Admin Rp ${admin.toLocaleString('id-ID')}`,
        });
      }

      setActiveAction(null);
      showToast(
        unpaid > 0
          ? `Topup ${tfTitle} disimpan & Piutang ${formatIDR(unpaid)} masuk Buku Piutang!`
          : `Topup/Transfer ${tfTitle} berhasil disimpan!`
      );
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: `TF-${Date.now().toString().slice(-6)}`,
          dateString: txDate,
          categoryLabel: 'Topup / Transfer / Tarik Tunai',
          title: tfTitle,
          customerName: finalCust,
          customerPhone: custPhone || undefined,
          amount: totalTagihan,
          notes: unpaid > 0 ? `BELUM LUNAS (Sisa: ${formatIDR(unpaid)})` : 'STATUS: LUNAS',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitKulakan = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(kulakAmount) || 0;
    const targetWallet = receiveWalletId || wallets[0]?.id;
    if (!kulakTitle.trim() || total <= 0 || !targetWallet) return;

    setIsSubmitting(true);
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
        dateString: txDate,
        notes: kulakNotes || 'Belanja kulakan modal voucher/aksesoris',
      });
      setActiveAction(null);
      showToast(`Catatan kulakan ${formatIDR(total)} berhasil disimpan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBeliHp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hpBrand.trim() || !hpModel.trim()) return;
    setIsSubmitting(true);
    try {
      await createPhoneInventory(uid, {
        brand: hpBrand,
        model: hpModel,
        imei: hpImei || '-',
        condition: hpCondition,
        completeness: hpCompleteness,
        minusNotes: hpMinus || (hpCondition === 'baru' ? 'Segel / Baru' : 'Normal Mulus'),
        buyPrice: Number(hpBuyPrice) || 0,
        serviceCost: Number(hpServiceCost) || 0,
        targetSellPrice: Number(hpTargetSell) || 0,
        status: hpStatus,
        sourceInfo: custPhone.trim()
          ? `${custName || 'User / Kulakan'} (${custPhone.trim()})`
          : custName || 'User / Kulakan',
        walletId: hpRecordCash ? receiveWalletId : receiveWalletId || '-',
        recordPurchaseTx: hpRecordCash,
        dateString: txDate,
      });
      setActiveAction(null);
      showToast(`Stok HP ${hpBrand} ${hpModel} berhasil ditambahkan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitJualHp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhoneObj || !receiveWalletId) return;
    const dealPrice = Number(hpSoldPrice) || 0;
    const isCredit = salePaymentStatus === 'hutang';
    const paidNowVal = isCredit ? Math.min(dealPrice, Math.max(0, Number(salePaidNow) || 0)) : dealPrice;
    const unpaidVal = Math.max(0, dealPrice - paidNowVal);
    const finalBuyer = custName.trim() || (isCredit ? 'Pembeli HP (Kasbon)' : 'Pembeli Umum');
    const buyerDisplay = custPhone.trim() ? `${finalBuyer} (${custPhone.trim()})` : finalBuyer;

    setIsSubmitting(true);
    try {
      await sellPhoneUnit(
        uid,
        selectedPhoneObj,
        dealPrice,
        buyerDisplay,
        receiveWalletId,
        hpSaleNotes,
        {
          isCredit,
          paidNow: paidNowVal,
          buyerPhone: custPhone.trim(),
          dueDate: saleDueDate,
          dateString: txDate,
        }
      );
      setActiveAction(null);
      showToast(`Unit ${selectedPhoneObj.brand} ${selectedPhoneObj.model} berhasil terjual!`);
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: `HP-${selectedPhoneObj.id.slice(-6).toUpperCase()}`,
          dateString: txDate,
          categoryLabel: 'Penjualan Unit HP',
          title: `${selectedPhoneObj.brand} ${selectedPhoneObj.model}`,
          customerName: finalBuyer,
          customerPhone: custPhone.trim() || undefined,
          amount: dealPrice,
          notes:
            unpaidVal > 0
              ? `BELUM LUNAS / DP (Sisa: ${formatIDR(unpaidVal)})`
              : hpSaleNotes || selectedPhoneObj.minusNotes,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGadaiBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !pawnItemName.trim() || !receiveWalletId) return;
    setIsSubmitting(true);
    try {
      await createPawnRecord(uid, {
        customerName: custName,
        customerPhone: custPhone || '-',
        itemCategory: pawnCategory,
        itemName: pawnItemName,
        itemCondition: pawnCondition || 'Lengkap Normal',
        loanAmount: Number(pawnLoan) || 0,
        feeAmount: Number(pawnFee) || 0,
        feeScheme: pawnScheme,
        dueDate: pawnDueDate,
        walletId: receiveWalletId,
        dateString: txDate,
      });
      setActiveAction(null);
      showToast(`Gadai ${pawnItemName} (${custName}) berhasil dicatat!`);
      if (onOpenReceipt) {
        onOpenReceipt({
          receiptNo: `GD-${Date.now().toString().slice(-6)}`,
          dateString: txDate,
          categoryLabel: 'Surat Bukti Gadai',
          title: `Gadai ${pawnItemName}`,
          customerName: custName,
          customerPhone: custPhone || undefined,
          amount: Number(pawnLoan) || 0,
          notes: `Jatuh Tempo: ${pawnDueDate}`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTanamModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invPartner.trim() || !invBusiness.trim()) return;
    setIsSubmitting(true);
    try {
      await createInvestmentRecord(uid, {
        partnerName: invPartner,
        businessName: invBusiness,
        capitalAmount: Number(invCapital) || 0,
        profitShareNote: invNote || 'Bagi hasil sesuai kesepakatan',
        walletId: invDeductNow ? receiveWalletId : receiveWalletId || '-',
        deductWalletNow: invDeductNow,
        dateString: txDate,
      });
      setActiveAction(null);
      showToast(`Tanam modal ke ${invPartner} berhasil disimpan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitHutangPiutang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !debtDesc.trim()) return;
    setIsSubmitting(true);
    try {
      await createDebtRecord(uid, {
        type: debtType,
        personName: custName,
        phone: custPhone || '-',
        description: debtDesc,
        totalAmount: Number(debtAmount) || 0,
        dueDate: saleDueDate,
        walletId: receiveWalletId,
        recordInitialCashFlow: debtRecordCash,
        dateString: txDate,
      });
      setActiveAction(null);
      showToast(`Catatan ${debtType === 'piutang' ? 'Piutang' : 'Hutang'} ${custName} berhasil disimpan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBiayaOrGaji = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount) || 0;
    const cat = activeAction === 'gaji_pribadi' ? 'gaji_pribadi' : 'pengeluaran_toko';
    if (!expTitle.trim() || amt <= 0 || !receiveWalletId) return;
    setIsSubmitting(true);
    try {
      await createTransaction(uid, {
        category: cat,
        flowType: 'keluar',
        title: expTitle,
        customerName: cat === 'gaji_pribadi' ? 'Pemilik (Prive)' : 'Operasional Konter',
        walletId: receiveWalletId,
        amount: amt,
        costAmount: amt,
        profitAmount: 0,
        dateString: txDate,
        notes: expNotes || '-',
      });
      setActiveAction(null);
      showToast(`Catatan ${cat === 'gaji_pribadi' ? 'Gaji Pribadi' : 'Biaya Toko'} ${formatIDR(amt)} disimpan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDompetPribadi = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount) || 0;
    if (!expTitle.trim() || amt <= 0) return;
    const useStoreWallet = personalSourceMode === 'potong_kantong' && receiveWalletId;
    setIsSubmitting(true);
    try {
      if (personalFlow === 'keluar') {
        const priorityLabel = PERSONAL_PRIORITY_LABELS[personalPriority];
        await createTransaction(uid, {
          category: 'pengeluaran_pribadi',
          flowType: 'keluar',
          title: expTitle,
          customerName: priorityLabel,
          walletId: useStoreWallet ? receiveWalletId : '-',
          amount: amt,
          costAmount: 0,
          profitAmount: 0,
          referenceId: personalPriority,
          dateString: txDate,
          notes:
            expNotes ||
            (useStoreWallet
              ? `Kategori: ${priorityLabel} (Potong Kas Toko)`
              : `Kategori: ${priorityLabel} (Dari Saldo Gaji Pribadi)`),
        });
      } else {
        await createTransaction(uid, {
          category: 'pemasukan_pribadi',
          flowType: 'masuk',
          title: expTitle,
          customerName: 'Pemasukan Pribadi',
          walletId: useStoreWallet ? receiveWalletId : '-',
          amount: amt,
          costAmount: 0,
          profitAmount: 0,
          referenceId: 'masuk_pribadi',
          dateString: txDate,
          notes: expNotes || 'Tambahan dana dompet pribadi',
        });
      }
      setActiveAction(null);
      showToast(`Catatan Dompet Pribadi ${formatIDR(amt)} berhasil disimpan!`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionGroups: Array<{
    groupTitle: string;
    items: Array<{
      id: QuickActionType;
      label: string;
      sub: string;
      icon: React.ComponentType<{ className?: string }>;
      iconColor: string;
    }>;
  }> = [
    {
      groupTitle: 'Kasir & Layanan Harian',
      items: [
        {
          id: 'kasir_cepat',
          label: 'Voucher & Pulsa',
          sub: 'Katalog / Input',
          icon: Zap,
          iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        },
        {
          id: 'topup_tf',
          label: 'Topup & TF',
          sub: 'E-Wallet / Bank',
          icon: ArrowUpRight,
          iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
        },
        {
          id: 'servis_cepat',
          label: 'Servis HP',
          sub: 'Jasa Perbaikan',
          icon: Wrench,
          iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
        },
        {
          id: 'kulakan',
          label: 'Kulakan',
          sub: 'Belanja Grosir',
          icon: ShoppingBag,
          iconColor: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
        },
      ],
    },
    {
      groupTitle: 'Unit HP, Gadai & Modal',
      items: [
        {
          id: 'beli_hp',
          label: 'Beli / Stok HP',
          sub: 'HP Masuk',
          icon: Smartphone,
          iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
        },
        {
          id: 'jual_hp',
          label: 'Jual Unit HP',
          sub: `${availablePhones.length} Unit Siap`,
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        },
        {
          id: 'gadai_baru',
          label: 'Gadai Barang',
          sub: 'Terima Gadai',
          icon: ShieldCheck,
          iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
        },
        {
          id: 'tanam_modal',
          label: 'Tanam Modal',
          sub: 'Investasi Mitra',
          icon: TrendingUp,
          iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
        },
      ],
    },
    {
      groupTitle: 'Piutang, Kas Toko & Pribadi',
      items: [
        {
          id: 'hutang_piutang',
          label: 'Hutang Piutang',
          sub: 'Catat Kasbon',
          icon: BookOpen,
          iconColor: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
        },
        {
          id: 'biaya_toko',
          label: 'Biaya Toko',
          sub: 'Listrik / Plastik',
          icon: Receipt,
          iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
        },
        {
          id: 'gaji_pribadi',
          label: 'Ambil Gaji',
          sub: 'Tarik Prive',
          icon: Coins,
          iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
        },
        {
          id: 'dompet_pribadi',
          label: 'Dompet Pribadi',
          sub: 'Pokok vs Foya',
          icon: WalletIcon,
          iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
        },
      ],
    },
  ];

  const saleUnpaidPreview =
    salePaymentStatus === 'hutang'
      ? Math.max(0, (Number(sellPrice) || 0) - (Number(salePaidNow) || 0))
      : 0;
  const tfTotalTagihan = (Number(tfPrincipal) || 0) + (Number(tfAdmin) || 0);
  const tfUnpaidPreview =
    salePaymentStatus === 'hutang' && transferMode === 'kirim_topup'
      ? Math.max(0, tfTotalTagihan - (Number(salePaidNow) || 0))
      : 0;
  const hpUnpaidPreview =
    salePaymentStatus === 'hutang'
      ? Math.max(0, (Number(hpSoldPrice) || 0) - (Number(salePaidNow) || 0))
      : 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-900">
            Menu Aksi Cepat Semua Transaksi
          </h2>
          <p className="text-[11px] text-slate-500">
            Ketuk icon di bawah untuk langsung input transaksi tanpa perlu pindah halaman
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
        >
          Riwayat & Edit
        </button>
      </div>

      {toastMsg && (
        <div className="bg-emerald-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Categorized 12-Icon Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {actionGroups.map((group) => (
          <div
            key={group.groupTitle}
            className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2"
          >
            <div className="text-[11px] font-semibold text-slate-600 px-0.5">
              {group.groupTitle}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={wallets.length === 0}
                    onClick={() => openAction(item.id)}
                    className="p-2 rounded-xl bg-white hover:bg-slate-100/80 border border-slate-200/80 transition-colors flex flex-col items-center text-center gap-1 min-h-[72px] justify-center cursor-pointer disabled:opacity-50"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-1">
                      {item.label}
                    </div>
                    <div className="text-[9px] text-slate-500 leading-tight line-clamp-1">
                      {item.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* UNIVERSAL QUICK ACTION MODAL */}
      {activeAction && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveAction(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {activeAction === 'kasir_cepat' && 'Input Cepat Voucher, Pulsa & Aksesoris'}
                {activeAction === 'servis_cepat' && 'Input Cepat Jasa Servis HP'}
                {activeAction === 'topup_tf' && 'Input Cepat Topup, Transfer & Tarik Tunai'}
                {activeAction === 'kulakan' && 'Catat Belanja Kulakan Grosir'}
                {activeAction === 'beli_hp' && 'Input Beli / Stok Unit HP Masuk'}
                {activeAction === 'jual_hp' && 'Jual Unit HP dari Stok Tersedia'}
                {activeAction === 'gadai_baru' && 'Terima Barang Gadai Baru'}
                {activeAction === 'tanam_modal' && 'Catat Tanam Modal / Investasi Mitra'}
                {activeAction === 'hutang_piutang' && 'Catat Hutang / Piutang (Kasbon)'}
                {activeAction === 'biaya_toko' && 'Catat Pengeluaran Operasional Toko'}
                {activeAction === 'gaji_pribadi' && 'Ambil Gaji Pribadi (Prive)'}
                {activeAction === 'dompet_pribadi' && 'Catat Pemakaian / Pemasukan Dompet Pribadi'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {/* 1. FORM KASIR CEPAT & SERVIS CEPAT */}
            {(activeAction === 'kasir_cepat' || activeAction === 'servis_cepat') && (
              <form onSubmit={handleSubmitSaleOrServis} className="space-y-3.5">
                {activeAction === 'kasir_cepat' && presets.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Pilih Cepat dari Katalog (Ketuk 1x untuk isi otomatis):
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {presets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePickPreset(p)}
                          className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition-colors cursor-pointer ${
                            productName === p.name
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="text-[11px] font-semibold whitespace-nowrap">{p.name}</div>
                          <div className="text-[10px] opacity-80 font-mono-tabular">
                            {formatIDR(p.sellPrice)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {activeAction === 'servis_cepat'
                        ? 'Nama Servis / Perbaikan HP'
                        : 'Nama Produk / Voucher / Pulsa'}
                    </label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder={
                        activeAction === 'servis_cepat'
                          ? 'Contoh: Ganti LCD Redmi 9C / Flasing'
                          : 'Contoh: Telkomsel 7GB / Pulsa 50rb'
                      }
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Modal / HPP (Sparepart)
                    </label>
                    <CurrencyInput
                      required
                      value={costPrice}
                      onChange={setCostPrice}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Harga Jual / Biaya Jasa
                    </label>
                    <CurrencyInput
                      required
                      value={sellPrice}
                      onChange={setSellPrice}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Uang Masuk Ke Kantong
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
                      <option value="pulsa_data">Pulsa & Paket</option>
                      <option value="aksesoris">Aksesoris HP</option>
                      <option value="servis">Jasa Servis HP</option>
                    </select>
                  </div>
                </div>

                {/* Status Pembayaran */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">Status Pembayaran</span>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSalePaymentStatus('lunas')}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                          salePaymentStatus === 'lunas' ? 'bg-emerald-600 text-white' : 'text-slate-700'
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
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                          salePaymentStatus === 'hutang' ? 'bg-amber-600 text-white' : 'text-slate-700'
                        }`}
                      >
                        Kasbon / Nanti
                      </button>
                    </div>
                  </div>
                  {salePaymentStatus === 'hutang' && (
                    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Dibayar Sekarang (DP)
                        </label>
                        <CurrencyInput value={salePaidNow} onChange={setSalePaidNow} placeholder="0" />
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
                  )}
                </div>

                <CustomerContactInput
                  uid={uid}
                  customers={customers}
                  nameValue={custName}
                  onNameChange={setCustName}
                  phoneValue={custPhone}
                  onPhoneChange={setCustPhone}
                  nameLabel={
                    salePaymentStatus === 'hutang'
                      ? 'Nama Pelanggan (Wajib untuk Kasbon)'
                      : 'Nama Pelanggan (Opsional)'
                  }
                  phoneLabel="Nomor HP / WA"
                  namePlaceholder="Contoh: Mas Budi"
                  phonePlaceholder="0812..."
                  nameRequired={salePaymentStatus === 'hutang'}
                />

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductServerWallet}
                    onChange={(e) => setDeductServerWallet(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Potong Saldo Server / Bank untuk modal transaksi ini</span>
                </label>
                {deductServerWallet && (
                  <select
                    value={serverWalletId}
                    onChange={(e) => setServerWalletId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        Potong Modal dari: {w.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : salePaymentStatus === 'hutang'
                    ? `Simpan & Catat Piutang (${formatIDR(saleUnpaidPreview)})`
                    : 'Simpan Transaksi'}
                </button>
              </form>
            )}

            {/* 2. FORM TOPUP / TRANSFER / TARIK TUNAI */}
            {activeAction === 'topup_tf' && (
              <form onSubmit={handleSubmitTopupTf} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTransferMode('kirim_topup')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg cursor-pointer ${
                      transferMode === 'kirim_topup'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Topup / Transfer (Saldo Keluar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferMode('tarik_tunai');
                      setSalePaymentStatus('lunas');
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg cursor-pointer ${
                      transferMode === 'tarik_tunai'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Tarik Tunai (Laci Keluar)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Layanan & Tujuan
                    </label>
                    <input
                      type="text"
                      required
                      value={tfTitle}
                      onChange={(e) => setTfTitle(e.target.value)}
                      placeholder="Contoh: Topup DANA 100rb / TF BRI"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nominal Pokok
                    </label>
                    <CurrencyInput
                      required
                      value={tfPrincipal}
                      onChange={setTfPrincipal}
                      placeholder="100.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Biaya Admin (Laba)
                    </label>
                    <CurrencyInput
                      required
                      value={tfAdmin}
                      onChange={setTfAdmin}
                      placeholder="5.000"
                    />
                  </div>
                </div>

                {transferMode === 'kirim_topup' && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Status Pembayaran ({formatIDR(tfTotalTagihan)})
                      </span>
                      <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setSalePaymentStatus('lunas')}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                            salePaymentStatus === 'lunas' ? 'bg-emerald-600 text-white' : 'text-slate-700'
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
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                            salePaymentStatus === 'hutang' ? 'bg-amber-600 text-white' : 'text-slate-700'
                          }`}
                        >
                          Bayar Nanti / Kasbon
                        </button>
                      </div>
                    </div>
                    {salePaymentStatus === 'hutang' && (
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">
                            Dibayar Sekarang (DP)
                          </label>
                          <CurrencyInput value={salePaidNow} onChange={setSalePaidNow} placeholder="0" />
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
                    )}
                  </div>
                )}

                <CustomerContactInput
                  uid={uid}
                  customers={customers}
                  nameValue={custName}
                  onNameChange={setCustName}
                  phoneValue={custPhone}
                  onPhoneChange={setCustPhone}
                  nameLabel={
                    salePaymentStatus === 'hutang'
                      ? 'Nama Pelanggan (Wajib untuk Kasbon)'
                      : 'Nama Pelanggan (Opsional)'
                  }
                  phoneLabel="Nomor HP / WA"
                  namePlaceholder="Contoh: Mbak Siti"
                  phonePlaceholder="0812..."
                  nameRequired={salePaymentStatus === 'hutang'}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kantong Kas Tunai
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
                      Kantong Bank / Server
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
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting
                    ? 'Memproses...'
                    : salePaymentStatus === 'hutang'
                    ? `Simpan & Catat Piutang (${formatIDR(tfUnpaidPreview)})`
                    : 'Simpan Transaksi Topup / Transfer'}
                </button>
              </form>
            )}

            {/* 3. FORM KULAKAN */}
            {activeAction === 'kulakan' && (
              <form onSubmit={handleSubmitKulakan} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama / Keterangan Kulakan
                  </label>
                  <input
                    type="text"
                    required
                    value={kulakTitle}
                    onChange={(e) => setKulakTitle(e.target.value)}
                    placeholder="Contoh: Kulakan Voucher Telkomsel & Aksesoris"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Total Nominal Kulakan
                    </label>
                    <CurrencyInput
                      required
                      value={kulakAmount}
                      onChange={setKulakAmount}
                      placeholder="500.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Potong Dari Kantong Kas
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catatan Rincian (Opsional)
                  </label>
                  <input
                    type="text"
                    value={kulakNotes}
                    onChange={(e) => setKulakNotes(e.target.value)}
                    placeholder="Contoh: Tsel 5GB 20pcs, TG 10pcs"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Kulakan'}
                </button>
              </form>
            )}

            {/* 4. FORM BELI / STOK HP MASUK */}
            {activeAction === 'beli_hp' && (
              <form onSubmit={handleSubmitBeliHp} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Merk HP</label>
                    <input
                      type="text"
                      required
                      value={hpBrand}
                      onChange={(e) => setHpBrand(e.target.value)}
                      placeholder="iPhone / Samsung / Oppo"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tipe & RAM/ROM
                    </label>
                    <input
                      type="text"
                      required
                      value={hpModel}
                      onChange={(e) => setHpModel(e.target.value)}
                      placeholder="13 Pro 128GB / A54"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kondisi</label>
                    <select
                      value={hpCondition}
                      onChange={(e) => setHpCondition(e.target.value as PhoneCondition)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="seken">Seken</option>
                      <option value="minusan">Minusan</option>
                      <option value="baru">Baru</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kelengkapan
                    </label>
                    <select
                      value={hpCompleteness}
                      onChange={(e) => setHpCompleteness(e.target.value as PhoneCompleteness)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="fullset">Fullset</option>
                      <option value="unit_cas">Unit + Cas</option>
                      <option value="batangan">Batangan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Beli
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Harga Beli (Modal)
                    </label>
                    <CurrencyInput
                      required
                      value={hpBuyPrice}
                      onChange={setHpBuyPrice}
                      placeholder="1.500.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Biaya Servis
                    </label>
                    <CurrencyInput
                      value={hpServiceCost}
                      onChange={setHpServiceCost}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Target Jual
                    </label>
                    <CurrencyInput
                      required
                      value={hpTargetSell}
                      onChange={setHpTargetSell}
                      placeholder="1.850.000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      IMEI (Opsional)
                    </label>
                    <input
                      type="text"
                      value={hpImei}
                      onChange={(e) => setHpImei(e.target.value)}
                      placeholder="3567..."
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Catatan Minus / Kondisi
                    </label>
                    <input
                      type="text"
                      value={hpMinus}
                      onChange={(e) => setHpMinus(e.target.value)}
                      placeholder="Normal mulus"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <CustomerContactInput
                  uid={uid}
                  customers={customers}
                  nameValue={custName}
                  onNameChange={setCustName}
                  phoneValue={custPhone}
                  onPhoneChange={setCustPhone}
                  nameLabel="Asal Barang / Penjual (Opsional)"
                  phoneLabel="Nomor WA Penjual"
                  namePlaceholder="Contoh: User Andi"
                  phonePlaceholder="0812..."
                  defaultCategory="supplier"
                />

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kantong Kas Modal
                    </label>
                    <select
                      value={receiveWalletId}
                      onChange={(e) => setReceiveWalletId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={hpRecordCash}
                      onChange={(e) => setHpRecordCash(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Potong saldo kas sekarang</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Unit HP ke Stok'}
                </button>
              </form>
            )}

            {/* 5. FORM JUAL UNIT HP DARI STOK */}
            {activeAction === 'jual_hp' && (
              <div className="space-y-3.5">
                {availablePhones.length === 0 ? (
                  <div className="p-6 text-center space-y-3">
                    <p className="text-xs text-slate-500">
                      Belum ada stok unit HP yang berstatus Siap Jual / Servis.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAction('beli_hp')}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      + Input Stok HP Masuk Dulu
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitJualHp} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Pilih Unit HP dari Stok ({availablePhones.length} Unit)
                      </label>
                      <select
                        value={selectedPhoneId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedPhoneId(id);
                          const found = availablePhones.find((p) => p.id === id);
                          if (found) {
                            setHpSoldPrice(
                              String(found.targetSellPrice || found.buyPrice + found.serviceCost)
                            );
                          }
                        }}
                        className="w-full px-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white"
                      >
                        {availablePhones.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.brand} {p.model} — Modal {formatIDR(p.buyPrice + p.serviceCost)} (Target{' '}
                            {formatIDR(p.targetSellPrice)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedPhoneObj && (
                      <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="text-slate-500">
                            Modal HPP: {formatIDR(selectedPhoneObj.buyPrice + selectedPhoneObj.serviceCost)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            IMEI: {selectedPhoneObj.imei} · {selectedPhoneObj.minusNotes}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500">Estimasi Untung</div>
                          <div className="font-mono-tabular font-bold text-emerald-600">
                            +{formatIDR(
                              (Number(hpSoldPrice) || 0) -
                                (selectedPhoneObj.buyPrice + selectedPhoneObj.serviceCost)
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Harga Terjual Deal
                        </label>
                        <CurrencyInput
                          required
                          value={hpSoldPrice}
                          onChange={setHpSoldPrice}
                          placeholder="1.850.000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tanggal Transaksi
                        </label>
                        <input
                          type="date"
                          required
                          value={txDate}
                          onChange={(e) => setTxDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">Status Pembayaran</span>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setSalePaymentStatus('lunas')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                              salePaymentStatus === 'lunas' ? 'bg-emerald-600 text-white' : 'text-slate-700'
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
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                              salePaymentStatus === 'hutang' ? 'bg-amber-600 text-white' : 'text-slate-700'
                            }`}
                          >
                            DP / Kasbon
                          </button>
                        </div>
                      </div>
                      {salePaymentStatus === 'hutang' && (
                        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">
                              Uang Masuk Sekarang (DP)
                            </label>
                            <CurrencyInput value={salePaidNow} onChange={setSalePaidNow} placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">
                              Jatuh Tempo
                            </label>
                            <input
                              type="date"
                              value={saleDueDate}
                              onChange={(e) => setSaleDueDate(e.target.value)}
                              className="w-full px-2.5 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <CustomerContactInput
                      uid={uid}
                      customers={customers}
                      nameValue={custName}
                      onNameChange={setCustName}
                      phoneValue={custPhone}
                      onPhoneChange={setCustPhone}
                      nameLabel={
                        salePaymentStatus === 'hutang'
                          ? 'Nama Pembeli (Wajib untuk DP/Kasbon)'
                          : 'Nama Pembeli'
                      }
                      phoneLabel="Nomor WA Pembeli"
                      namePlaceholder="Contoh: Mas Budi"
                      phonePlaceholder="0812..."
                      nameRequired={salePaymentStatus === 'hutang'}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Masuk Ke Kantong Kas
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
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Catatan / Garansi
                        </label>
                        <input
                          type="text"
                          value={hpSaleNotes}
                          onChange={(e) => setHpSaleNotes(e.target.value)}
                          placeholder="Garansi 3 hari"
                          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      {isSubmitting
                        ? 'Memproses...'
                        : salePaymentStatus === 'hutang'
                        ? `Simpan & Catat Piutang (${formatIDR(hpUnpaidPreview)})`
                        : 'Konfirmasi Unit Terjual'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 6. FORM GADAI BARANG BARU */}
            {activeAction === 'gadai_baru' && (
              <form onSubmit={handleSubmitGadaiBaru} className="space-y-3.5">
                <CustomerContactInput
                  uid={uid}
                  customers={customers}
                  nameValue={custName}
                  onNameChange={setCustName}
                  phoneValue={custPhone}
                  onPhoneChange={setCustPhone}
                  nameLabel="Nama Nasabah Gadai"
                  phoneLabel="Nomor WA Nasabah"
                  namePlaceholder="Contoh: Pak Hendra"
                  phonePlaceholder="0812..."
                  nameRequired
                  defaultCategory="gadai"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                    <select
                      value={pawnCategory}
                      onChange={(e) => setPawnCategory(e.target.value as PawnItemCategory)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="hp">HP / Smartphone</option>
                      <option value="motor">Motor</option>
                      <option value="laptop">Laptop</option>
                      <option value="elektronik">Elektronik</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama / Tipe Barang Jaminan
                    </label>
                    <input
                      type="text"
                      required
                      value={pawnItemName}
                      onChange={(e) => setPawnItemName(e.target.value)}
                      placeholder="Contoh: Oppo Reno 8 / Vario 150"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kelengkapan & Sandi/PIN
                    </label>
                    <input
                      type="text"
                      value={pawnCondition}
                      onChange={(e) => setPawnCondition(e.target.value)}
                      placeholder="Fullset, PIN 1234"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi Gadai
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Pinjaman (Rp)
                    </label>
                    <CurrencyInput
                      required
                      value={pawnLoan}
                      onChange={setPawnLoan}
                      placeholder="1.000.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Biaya Jasa
                    </label>
                    <CurrencyInput
                      required
                      value={pawnFee}
                      onChange={setPawnFee}
                      placeholder="100.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      required
                      value={pawnDueDate}
                      onChange={(e) => setPawnDueDate(e.target.value)}
                      className="w-full px-2.5 py-2.5 text-xs font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Skema Jasa
                    </label>
                    <select
                      value={pawnScheme}
                      onChange={(e) => setPawnScheme(e.target.value as PawnFeeScheme)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="fleksibel">Fleksibel (Saat Tebus)</option>
                      <option value="potong_awal">Potong di Awal</option>
                      <option value="bayar_akhir">Bayar di Akhir</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Cairkan Dari Kantong
                    </label>
                    <select
                      value={receiveWalletId}
                      onChange={(e) => setReceiveWalletId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan & Cairkan Gadai'}
                </button>
              </form>
            )}

            {/* 7. FORM TANAM MODAL */}
            {activeAction === 'tanam_modal' && (
              <form onSubmit={handleSubmitTanamModal} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Mitra / Penerima
                    </label>
                    <input
                      type="text"
                      required
                      value={invPartner}
                      onChange={(e) => setInvPartner(e.target.value)}
                      placeholder="Contoh: Mas Rian"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Bidang Usaha
                    </label>
                    <input
                      type="text"
                      required
                      value={invBusiness}
                      onChange={(e) => setInvBusiness(e.target.value)}
                      placeholder="Jual Beli HP / Konter"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nominal Modal (Rp)
                    </label>
                    <CurrencyInput
                      required
                      value={invCapital}
                      onChange={setInvCapital}
                      placeholder="5.000.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Sumber Kantong Kas
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kesepakatan Bagi Hasil
                    </label>
                    <input
                      type="text"
                      value={invNote}
                      onChange={(e) => setInvNote(e.target.value)}
                      placeholder="Bagi hasil 50:50"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invDeductNow}
                    onChange={(e) => setInvDeductNow(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Potong saldo kantong kas sekarang</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Tanam Modal'}
                </button>
              </form>
            )}

            {/* 8. FORM HUTANG PIUTANG */}
            {activeAction === 'hutang_piutang' && (
              <form onSubmit={handleSubmitHutangPiutang} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jenis Catatan
                    </label>
                    <select
                      value={debtType}
                      onChange={(e) => setDebtType(e.target.value as DebtType)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="piutang">Piutang (Pelanggan Kasbon)</option>
                      <option value="hutang">Hutang (Konter Hutang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <CustomerContactInput
                  uid={uid}
                  customers={customers}
                  nameValue={custName}
                  onNameChange={setCustName}
                  phoneValue={custPhone}
                  onPhoneChange={setCustPhone}
                  nameLabel="Nama Pelanggan / Supplier"
                  phoneLabel="Nomor WA"
                  namePlaceholder="Contoh: Mas Dani"
                  phonePlaceholder="0812..."
                  nameRequired
                />

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Keterangan Kasbon / Hutang
                  </label>
                  <input
                    type="text"
                    required
                    value={debtDesc}
                    onChange={(e) => setDebtDesc(e.target.value)}
                    placeholder="Contoh: Pinjam tunai / Kurang bayar servis"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Total Nominal
                    </label>
                    <CurrencyInput
                      required
                      value={debtAmount}
                      onChange={setDebtAmount}
                      placeholder="100.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      value={saleDueDate}
                      onChange={(e) => setSaleDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={debtRecordCash}
                    onChange={(e) => setDebtRecordCash(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Pinjaman uang tunai langsung (Potong / Tambah Kas sekarang)</span>
                </label>

                {debtRecordCash && (
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
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Hutang/Piutang'}
                </button>
              </form>
            )}

            {/* 9. FORM BIAYA TOKO & AMBIL GAJI PRIBADI */}
            {(activeAction === 'biaya_toko' || activeAction === 'gaji_pribadi') && (
              <form onSubmit={handleSubmitBiayaOrGaji} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {activeAction === 'gaji_pribadi'
                      ? 'Keterangan Ambil Gaji (Prive)'
                      : 'Nama Pengeluaran Operasional Toko'}
                  </label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder={
                      activeAction === 'gaji_pribadi'
                        ? 'Contoh: Ambil Gaji Mingguan'
                        : 'Contoh: Token Listrik / Plastik Nota'
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nominal</label>
                    <CurrencyInput
                      required
                      value={expAmount}
                      onChange={setExpAmount}
                      placeholder="100.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Potong Dari Kantong Kas
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={expNotes}
                    onChange={(e) => setExpNotes(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </form>
            )}

            {/* 10. FORM DOMPET PRIBADI */}
            {activeAction === 'dompet_pribadi' && (
              <form onSubmit={handleSubmitDompetPribadi} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPersonalFlow('keluar')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg cursor-pointer ${
                      personalFlow === 'keluar'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Pengeluaran Pribadi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonalFlow('masuk')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg cursor-pointer ${
                      personalFlow === 'masuk'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Pemasukan Pribadi
                  </button>
                </div>

                {personalFlow === 'keluar' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kategori Pemakaian Uang Pribadi
                    </label>
                    <select
                      value={personalPriority}
                      onChange={(e) =>
                        setPersonalPriority(e.target.value as PersonalExpensePriority)
                      }
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="kebutuhan">
                        Kebutuhan Pokok & Rumah (Makan, Listrik, Bensin)
                      </option>
                      <option value="foya">
                        Hiburan / Gaya Hidup / Foya-foya (Jajan, Nongkrong, Hobi)
                      </option>
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
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder={
                      personalFlow === 'keluar'
                        ? 'Contoh: Belanja Dapur / Ngopi Malam'
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
                      value={expAmount}
                      onChange={setExpAmount}
                      placeholder="50.000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-medium text-slate-700">Sumber Dana</label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={personalSourceMode === 'saldo_gaji'}
                        onChange={() => setPersonalSourceMode('saldo_gaji')}
                      />
                      <span>Dari Saldo Gaji Pribadi (Tidak potong kas toko lagi)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={personalSourceMode === 'potong_kantong'}
                        onChange={() => setPersonalSourceMode('potong_kantong')}
                      />
                      <span>Potong / Masuk langsung ke Kantong Kas Toko</span>
                    </label>
                  </div>
                  {personalSourceMode === 'potong_kantong' && (
                    <select
                      value={receiveWalletId}
                      onChange={(e) => setReceiveWalletId(e.target.value)}
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Dompet Pribadi'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
