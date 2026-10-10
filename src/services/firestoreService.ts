import {
  doc,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  serverTimestamp,
  writeBatch as fbWriteBatch,
  DocumentReference,
  Firestore,
  Timestamp,
} from 'firebase/firestore';
import {
  db,
  OperationType,
  handleFirestoreError,
  cleanStr,
  cleanNum,
} from '../firebase';
import {
  isLocalAndroidMode,
  localSetDoc,
  localUpdateDoc,
  localDeleteDoc,
  localWriteBatch,
} from './localDb';
import { LicenseType, LicenseStatus } from '../types';

async function setDoc(ref: DocumentReference, data: Record<string, any>): Promise<void> {
  if (isLocalAndroidMode()) {
    return localSetDoc(ref, data);
  }
  return fbSetDoc(ref, data);
}

async function updateDoc(ref: DocumentReference, data: Record<string, any>): Promise<void> {
  if (isLocalAndroidMode()) {
    return localUpdateDoc(ref, data);
  }
  return fbUpdateDoc(ref, data);
}

async function deleteDoc(ref: DocumentReference): Promise<void> {
  if (isLocalAndroidMode()) {
    return localDeleteDoc(ref);
  }
  return fbDeleteDoc(ref);
}

function writeBatch(firestoreDb: Firestore) {
  if (isLocalAndroidMode()) {
    return localWriteBatch();
  }
  return fbWriteBatch(firestoreDb);
}
import {
  WalletType,
  PhoneCondition,
  PhoneCompleteness,
  PhoneStatus,
  PhoneInventory,
  PresetCategory,
  PawnItemCategory,
  PawnFeeScheme,
  PawnRecord,
  InvestmentRecord,
  DebtType,
  DebtRecord,
  TransactionCategory,
  TransactionFlowType,
  CustomerCategory,
  CustomerRecord,
  Wallet,
  CatalogPreset,
  LedgerTransaction,
  getTodayDateString,
} from '../types';

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function bootstrapStarterData(uid: string): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  const walletsData: Array<{ id: string; name: string; type: WalletType; initialBalance: number; accountInfo: string }> = [
    {
      id: makeId('w_tunai'),
      name: 'Kas Tunai (Laci)',
      type: 'tunai',
      initialBalance: 0,
      accountInfo: 'Uang tunai kasir konter',
    },
    {
      id: makeId('w_bank'),
      name: 'Rekening Bank (M-Banking)',
      type: 'bank',
      initialBalance: 0,
      accountInfo: 'Rekening transfer & kulakan',
    },
    {
      id: makeId('w_server'),
      name: 'Saldo Server & E-Wallet',
      type: 'server',
      initialBalance: 0,
      accountInfo: 'Deposit pulsa, kuota & topup',
    },
  ];

  for (const w of walletsData) {
    batch.set(doc(db, 'wallets', w.id), {
      ownerId: uid,
      name: w.name,
      type: w.type,
      initialBalance: w.initialBalance,
      accountInfo: w.accountInfo,
      createdAt: now,
      updatedAt: now,
    });
  }

  const presetsData: Array<{ category: PresetCategory; name: string; costPrice: number; sellPrice: number }> = [
    { category: 'voucher', name: 'Telkomsel 5GB', costPrice: 13000, sellPrice: 20000 },
    { category: 'voucher', name: 'Telkomsel 7GB', costPrice: 25000, sellPrice: 32000 },
    { category: 'voucher', name: 'Indosat Freedom 6GB', costPrice: 18000, sellPrice: 25000 },
    { category: 'voucher', name: 'Smartfren Unlimited 7 Hari', costPrice: 22000, sellPrice: 28000 },
    { category: 'pulsa_data', name: 'Pulsa Reguler 20.000', costPrice: 20200, sellPrice: 23000 },
    { category: 'pulsa_data', name: 'Pulsa Reguler 50.000', costPrice: 50100, sellPrice: 53000 },
    { category: 'aksesoris', name: 'Tempered Glass Ceramic', costPrice: 6000, sellPrice: 20000 },
    { category: 'aksesoris', name: 'Kabel Data Fast Charging', costPrice: 12000, sellPrice: 25000 },
  ];

  for (const p of presetsData) {
    batch.set(doc(db, 'catalog_presets', makeId('preset')), {
      ownerId: uid,
      category: p.category,
      name: p.name,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'wallets/catalog_presets');
  }
}

export async function createWallet(
  uid: string,
  input: { name: string; type: WalletType; initialBalance: number; accountInfo: string }
): Promise<string> {
  const walletId = makeId('wallet');
  const path = `wallets/${walletId}`;
  try {
    await setDoc(doc(db, 'wallets', walletId), {
      ownerId: uid,
      name: cleanStr(input.name, 80, 'Kantong Kas'),
      type: input.type,
      initialBalance: cleanNum(input.initialBalance, -100000000000, 100000000000),
      accountInfo: cleanStr(input.accountInfo, 120, '-'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return walletId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWallet(
  walletId: string,
  input: { name: string; type: WalletType; initialBalance: number; accountInfo: string }
): Promise<void> {
  const path = `wallets/${walletId}`;
  try {
    await updateDoc(doc(db, 'wallets', walletId), {
      name: cleanStr(input.name, 80, 'Kantong Kas'),
      type: input.type,
      initialBalance: cleanNum(input.initialBalance, -100000000000, 100000000000),
      accountInfo: cleanStr(input.accountInfo, 120, '-'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWallet(walletId: string): Promise<void> {
  const path = `wallets/${walletId}`;
  try {
    await deleteDoc(doc(db, 'wallets', walletId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createTransaction(
  uid: string,
  input: {
    category: TransactionCategory;
    flowType: TransactionFlowType;
    title: string;
    customerName?: string;
    walletId: string;
    secondaryWalletId?: string;
    secondaryAmount?: number;
    amount: number;
    costAmount?: number;
    profitAmount?: number;
    referenceId?: string;
    dateString?: string;
    notes?: string;
  }
): Promise<string> {
  const txId = makeId('tx');
  const path = `transactions/${txId}`;
  try {
    await setDoc(doc(db, 'transactions', txId), {
      ownerId: uid,
      category: input.category,
      flowType: input.flowType,
      title: cleanStr(input.title, 150, 'Transaksi'),
      customerName: cleanStr(input.customerName, 100, 'Umum'),
      walletId: cleanStr(input.walletId, 128, '-'),
      secondaryWalletId: cleanStr(input.secondaryWalletId, 128, '-'),
      secondaryAmount: cleanNum(input.secondaryAmount ?? 0, 0, 100000000000),
      amount: cleanNum(input.amount, 0, 100000000000),
      costAmount: cleanNum(input.costAmount ?? 0, 0, 100000000000),
      profitAmount: cleanNum(input.profitAmount ?? 0, -100000000000, 100000000000),
      referenceId: cleanStr(input.referenceId, 128, '-'),
      dateString: cleanStr(input.dateString ?? getTodayDateString(), 20, getTodayDateString()),
      notes: cleanStr(input.notes, 300, '-'),
      createdAt: serverTimestamp(),
    });
    return txId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTransaction(
  txId: string,
  input: {
    category?: TransactionCategory;
    flowType?: TransactionFlowType;
    title: string;
    customerName?: string;
    walletId: string;
    secondaryWalletId?: string;
    secondaryAmount?: number;
    amount: number;
    costAmount?: number;
    profitAmount?: number;
    dateString?: string;
    notes?: string;
  }
): Promise<void> {
  const path = `transactions/${txId}`;
  try {
    const payload: Record<string, any> = {
      title: cleanStr(input.title, 150, 'Transaksi'),
      customerName: cleanStr(input.customerName, 100, 'Umum'),
      walletId: cleanStr(input.walletId, 128, '-'),
      amount: cleanNum(input.amount, 0, 100000000000),
      notes: cleanStr(input.notes, 300, '-'),
    };
    if (input.category) payload.category = input.category;
    if (input.flowType) payload.flowType = input.flowType;
    if (input.secondaryWalletId !== undefined) {
      payload.secondaryWalletId = cleanStr(input.secondaryWalletId, 128, '-');
    }
    if (input.secondaryAmount !== undefined) {
      payload.secondaryAmount = cleanNum(input.secondaryAmount, 0, 100000000000);
    }
    if (input.costAmount !== undefined) {
      payload.costAmount = cleanNum(input.costAmount, 0, 100000000000);
    }
    if (input.profitAmount !== undefined) {
      payload.profitAmount = cleanNum(input.profitAmount, -100000000000, 100000000000);
    }
    if (input.dateString !== undefined) {
      payload.dateString = cleanStr(input.dateString, 20, getTodayDateString());
    }
    await updateDoc(doc(db, 'transactions', txId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTransaction(txId: string): Promise<void> {
  const path = `transactions/${txId}`;
  try {
    await deleteDoc(doc(db, 'transactions', txId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updatePhoneInventory(
  phone: PhoneInventory,
  input: {
    brand: string;
    model: string;
    imei: string;
    condition: PhoneCondition;
    completeness: PhoneCompleteness;
    minusNotes: string;
    buyPrice: number;
    serviceCost: number;
    targetSellPrice: number;
    soldPrice: number;
    status: PhoneStatus;
    sourceInfo: string;
    buyerInfo: string;
    walletId: string;
  },
  relatedTransactions: LedgerTransaction[] = []
): Promise<void> {
  const buyPrice = cleanNum(input.buyPrice, 0, 10000000000);
  const serviceCost = cleanNum(input.serviceCost, 0, 10000000000);
  const targetSellPrice = cleanNum(input.targetSellPrice, 0, 10000000000);
  const soldPrice = cleanNum(input.soldPrice, 0, 10000000000);
  const totalCost = buyPrice + serviceCost;

  try {
    await updateDoc(doc(db, 'phones', phone.id), {
      brand: cleanStr(input.brand, 60, 'HP'),
      model: cleanStr(input.model, 120, 'Unit'),
      imei: cleanStr(input.imei, 60, '-'),
      condition: input.condition,
      completeness: input.completeness,
      minusNotes: cleanStr(input.minusNotes, 300, 'Normal'),
      buyPrice,
      serviceCost,
      targetSellPrice,
      soldPrice,
      status: input.status,
      sourceInfo: cleanStr(input.sourceInfo, 120, 'Kulakan / User'),
      buyerInfo: cleanStr(input.buyerInfo, 120, '-'),
      walletId: cleanStr(input.walletId, 128, '-'),
      updatedAt: serverTimestamp(),
    });

    // Sync linked purchase or sale transactions so wallet balances & profit stay accurate
    for (const tx of relatedTransactions) {
      if (tx.referenceId !== phone.id) continue;
      if (tx.category === 'beli_hp' && tx.title.startsWith('Beli HP')) {
        await updateTransaction(tx.id, {
          category: tx.category,
          flowType: tx.flowType,
          title: `Beli HP ${cleanStr(input.brand, 30)} ${cleanStr(input.model, 60)} (${input.condition.toUpperCase()})`,
          customerName: cleanStr(input.sourceInfo, 100, tx.customerName),
          walletId: input.walletId || tx.walletId,
          secondaryWalletId: tx.secondaryWalletId,
          secondaryAmount: tx.secondaryAmount,
          amount: totalCost,
          costAmount: totalCost,
          profitAmount: 0,
          dateString: tx.dateString,
          notes: `Kondisi: ${input.condition}, Minus: ${cleanStr(input.minusNotes, 150, 'Normal')}`,
        });
      } else if (tx.category === 'jual_hp') {
        const effectiveSold = soldPrice > 0 ? soldPrice : tx.amount;
        await updateTransaction(tx.id, {
          category: tx.category,
          flowType: tx.flowType,
          title: `Jual HP ${cleanStr(input.brand, 30)} ${cleanStr(input.model, 60)} (${input.condition.toUpperCase()})`,
          customerName: cleanStr(input.buyerInfo, 100, tx.customerName),
          walletId: tx.walletId,
          secondaryWalletId: tx.secondaryWalletId,
          secondaryAmount: tx.secondaryAmount,
          amount: effectiveSold,
          costAmount: totalCost,
          profitAmount: effectiveSold - totalCost,
          dateString: tx.dateString,
          notes: tx.notes,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `phones/${phone.id}`);
  }
}

export async function createPhoneInventory(
  uid: string,
  input: {
    brand: string;
    model: string;
    imei: string;
    condition: PhoneCondition;
    completeness: PhoneCompleteness;
    minusNotes: string;
    buyPrice: number;
    serviceCost: number;
    targetSellPrice: number;
    status: PhoneStatus;
    sourceInfo: string;
    walletId: string;
    recordPurchaseTx: boolean;
    dateString?: string;
  }
): Promise<void> {
  const phoneId = makeId('hp');
  const now = serverTimestamp();
  const buyPrice = cleanNum(input.buyPrice, 0, 10000000000);
  const serviceCost = cleanNum(input.serviceCost, 0, 10000000000);
  const totalOut = buyPrice + serviceCost;

  try {
    await setDoc(doc(db, 'phones', phoneId), {
      ownerId: uid,
      brand: cleanStr(input.brand, 60, 'HP'),
      model: cleanStr(input.model, 120, 'Unit'),
      imei: cleanStr(input.imei, 60, '-'),
      condition: input.condition,
      completeness: input.completeness,
      minusNotes: cleanStr(input.minusNotes, 300, 'Normal'),
      buyPrice,
      serviceCost,
      targetSellPrice: cleanNum(input.targetSellPrice, 0, 10000000000),
      soldPrice: 0,
      status: input.status,
      sourceInfo: cleanStr(input.sourceInfo, 120, 'Kulakan / User'),
      buyerInfo: '-',
      walletId: cleanStr(input.walletId, 128, '-'),
      createdAt: now,
      updatedAt: now,
    });

    if (input.recordPurchaseTx && totalOut > 0) {
      await createTransaction(uid, {
        category: 'beli_hp',
        flowType: 'keluar',
        title: `Beli HP ${cleanStr(input.brand, 30)} ${cleanStr(input.model, 60)} (${input.condition.toUpperCase()})`,
        customerName: cleanStr(input.sourceInfo, 100, 'Supplier/User'),
        walletId: input.walletId,
        amount: totalOut,
        costAmount: totalOut,
        profitAmount: 0,
        referenceId: phoneId,
        dateString: input.dateString || getTodayDateString(),
        notes: `Kondisi: ${input.condition}, Minus: ${cleanStr(input.minusNotes, 150, 'Normal')}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `phones/${phoneId}`);
  }
}

export async function addPhoneServiceExpense(
  uid: string,
  phone: PhoneInventory,
  addedCost: number,
  serviceNotes: string,
  walletId: string,
  newStatus: 'tersedia' | 'servis',
  dateString?: string
): Promise<void> {
  const cost = cleanNum(addedCost, 0, 10000000000);
  const updatedServiceCost = cleanNum(phone.serviceCost + cost, 0, 10000000000);
  const updatedNotes = serviceNotes.trim()
    ? `${phone.minusNotes} | Servis: ${serviceNotes.trim()}`
    : phone.minusNotes;

  try {
    await updateDoc(doc(db, 'phones', phone.id), {
      serviceCost: updatedServiceCost,
      minusNotes: cleanStr(updatedNotes, 300, 'Normal'),
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    if (cost > 0) {
      await createTransaction(uid, {
        category: 'beli_hp',
        flowType: 'keluar',
        title: `Biaya Servis/Part ${phone.brand} ${phone.model}`,
        customerName: 'Teknisi / Sparepart',
        walletId,
        amount: cost,
        costAmount: cost,
        profitAmount: 0,
        referenceId: phone.id,
        dateString: dateString || getTodayDateString(),
        notes: cleanStr(serviceNotes, 250, 'Perbaikan unit HP'),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `phones/${phone.id}`);
  }
}

export async function sellPhoneUnit(
  uid: string,
  phone: PhoneInventory,
  soldPrice: number,
  buyerInfo: string,
  walletId: string,
  notes?: string,
  paymentOptions?: {
    isCredit?: boolean;
    paidNow?: number;
    buyerPhone?: string;
    dueDate?: string;
    dateString?: string;
  }
): Promise<void> {
  const cleanSold = cleanNum(soldPrice, 0, 10000000000);
  const totalCost = phone.buyPrice + phone.serviceCost;
  const profit = cleanSold - totalCost;
  const isCredit = Boolean(paymentOptions?.isCredit);
  const paidNow = isCredit
    ? cleanNum(paymentOptions?.paidNow ?? 0, 0, cleanSold)
    : cleanSold;
  const unpaidAmount = Math.max(0, cleanSold - paidNow);
  const txDate = paymentOptions?.dateString || getTodayDateString();

  try {
    await updateDoc(doc(db, 'phones', phone.id), {
      soldPrice: cleanSold,
      status: 'terjual',
      buyerInfo: cleanStr(buyerInfo, 120, 'Pembeli Umum'),
      walletId: cleanStr(walletId, 128, phone.walletId),
      updatedAt: serverTimestamp(),
    });

    await createTransaction(uid, {
      category: 'jual_hp',
      flowType: 'masuk',
      title:
        unpaidAmount > 0
          ? `Jual HP (Kasbon/DP) ${phone.brand} ${phone.model}`
          : `Jual HP ${phone.brand} ${phone.model} (${phone.condition.toUpperCase()})`,
      customerName: cleanStr(buyerInfo, 100, 'Pembeli Umum'),
      walletId,
      amount: paidNow,
      costAmount: totalCost,
      profitAmount: profit,
      referenceId: phone.id,
      dateString: txDate,
      notes: cleanStr(
        unpaidAmount > 0
          ? `Harga Deal: Rp ${cleanSold.toLocaleString('id-ID')} | Dibayar Sekarang: Rp ${paidNow.toLocaleString('id-ID')} | Sisa Piutang: Rp ${unpaidAmount.toLocaleString('id-ID')}`
          : notes || `Modal Beli: Rp ${phone.buyPrice.toLocaleString('id-ID')} + Servis: Rp ${phone.serviceCost.toLocaleString('id-ID')}`,
        300,
        '-'
      ),
    });

    if (unpaidAmount > 0) {
      await createDebtRecord(uid, {
        type: 'piutang',
        personName: cleanStr(buyerInfo, 100, 'Pembeli HP'),
        phone: cleanStr(paymentOptions?.buyerPhone, 60, '-'),
        description: `Sisa Pembayaran HP ${phone.brand} ${phone.model} (Deal Rp ${cleanSold.toLocaleString('id-ID')}, DP Rp ${paidNow.toLocaleString('id-ID')})`,
        totalAmount: unpaidAmount,
        dueDate: paymentOptions?.dueDate || getTodayDateString(),
        walletId,
        recordInitialCashFlow: false,
        dateString: txDate,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `phones/${phone.id}`);
  }
}

export async function deletePhoneInventory(phoneId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'phones', phoneId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `phones/${phoneId}`);
  }
}

export async function saveCatalogPreset(
  uid: string,
  input: { category: PresetCategory; name: string; costPrice: number; sellPrice: number },
  existingId?: string
): Promise<void> {
  const id = existingId || makeId('preset');
  try {
    if (existingId) {
      await updateDoc(doc(db, 'catalog_presets', id), {
        category: input.category,
        name: cleanStr(input.name, 120, 'Produk'),
        costPrice: cleanNum(input.costPrice, 0, 1000000000),
        sellPrice: cleanNum(input.sellPrice, 0, 1000000000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'catalog_presets', id), {
        ownerId: uid,
        category: input.category,
        name: cleanStr(input.name, 120, 'Produk'),
        costPrice: cleanNum(input.costPrice, 0, 1000000000),
        sellPrice: cleanNum(input.sellPrice, 0, 1000000000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `catalog_presets/${id}`);
  }
}

export async function deleteCatalogPreset(presetId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'catalog_presets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `catalog_presets/${presetId}`);
  }
}

export async function createPawnRecord(
  uid: string,
  input: {
    customerName: string;
    customerPhone: string;
    itemCategory: PawnItemCategory;
    itemName: string;
    itemCondition: string;
    loanAmount: number;
    feeAmount: number;
    feeScheme: PawnFeeScheme;
    dueDate: string;
    walletId: string;
    dateString?: string;
  }
): Promise<void> {
  const pawnId = makeId('gadai');
  const loan = cleanNum(input.loanAmount, 0, 10000000000);
  const fee = cleanNum(input.feeAmount, 0, 10000000000);
  const upfrontCollected = input.feeScheme === 'potong_awal' ? fee : 0;
  const txDate = input.dateString || getTodayDateString();

  try {
    await setDoc(doc(db, 'pawns', pawnId), {
      ownerId: uid,
      customerName: cleanStr(input.customerName, 100, 'Nasabah'),
      customerPhone: cleanStr(input.customerPhone, 60, '-'),
      itemCategory: input.itemCategory,
      itemName: cleanStr(input.itemName, 120, 'Barang Gadai'),
      itemCondition: cleanStr(input.itemCondition, 300, 'Lengkap'),
      loanAmount: loan,
      feeAmount: fee,
      feeScheme: input.feeScheme,
      totalFeeCollected: upfrontCollected,
      dueDate: cleanStr(input.dueDate, 30, getTodayDateString()),
      status: 'aktif',
      walletId: cleanStr(input.walletId, 128, '-'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Record loan disbursement
    await createTransaction(uid, {
      category: 'gadai_keluar',
      flowType: 'keluar',
      title: `Pencairan Gadai ${cleanStr(input.itemName, 80)}`,
      customerName: cleanStr(input.customerName, 100, 'Nasabah'),
      walletId: input.walletId,
      amount: loan,
      costAmount: 0,
      profitAmount: 0,
      referenceId: pawnId,
      dateString: txDate,
      notes: `Barang: ${input.itemName} (${input.itemCondition}) | Jatuh Tempo: ${input.dueDate}`,
    });

    // If fee is deducted upfront (potong_awal), immediately record the fee income & profit
    if (input.feeScheme === 'potong_awal' && fee > 0) {
      await createTransaction(uid, {
        category: 'gadai_masuk',
        flowType: 'masuk',
        title: `Biaya Jasa Gadai (Potong Awal) - ${cleanStr(input.itemName, 60)}`,
        customerName: cleanStr(input.customerName, 100, 'Nasabah'),
        walletId: input.walletId,
        amount: fee,
        costAmount: 0,
        profitAmount: fee,
        referenceId: pawnId,
        dateString: txDate,
        notes: 'Potong biaya admin/jasa gadai di awal pencairan',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `pawns/${pawnId}`);
  }
}

export async function updatePawnRecord(
  pawnId: string,
  input: {
    customerName: string;
    customerPhone: string;
    itemCategory: PawnItemCategory;
    itemName: string;
    itemCondition: string;
    loanAmount: number;
    feeAmount: number;
    feeScheme: PawnFeeScheme;
    dueDate: string;
    walletId: string;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'pawns', pawnId), {
      customerName: cleanStr(input.customerName, 100, 'Nasabah'),
      customerPhone: cleanStr(input.customerPhone, 60, '-'),
      itemCategory: input.itemCategory,
      itemName: cleanStr(input.itemName, 120, 'Barang Gadai'),
      itemCondition: cleanStr(input.itemCondition, 300, 'Lengkap'),
      loanAmount: cleanNum(input.loanAmount, 0, 10000000000),
      feeAmount: cleanNum(input.feeAmount, 0, 10000000000),
      feeScheme: input.feeScheme,
      dueDate: cleanStr(input.dueDate, 30, getTodayDateString()),
      walletId: cleanStr(input.walletId, 128, '-'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pawns/${pawnId}`);
  }
}

export async function extendPawnRecord(
  uid: string,
  pawn: PawnRecord,
  paidFee: number,
  newDueDate: string,
  walletId: string,
  dateString?: string
): Promise<void> {
  const fee = cleanNum(paidFee, 0, 10000000000);
  try {
    await updateDoc(doc(db, 'pawns', pawn.id), {
      totalFeeCollected: cleanNum(pawn.totalFeeCollected + fee, 0, 10000000000),
      dueDate: cleanStr(newDueDate, 30, pawn.dueDate),
      status: 'diperpanjang',
      updatedAt: serverTimestamp(),
    });

    if (fee > 0) {
      await createTransaction(uid, {
        category: 'gadai_masuk',
        flowType: 'masuk',
        title: `Perpanjang Gadai ${pawn.itemName}`,
        customerName: pawn.customerName,
        walletId,
        amount: fee,
        costAmount: 0,
        profitAmount: fee,
        referenceId: pawn.id,
        dateString: dateString || getTodayDateString(),
        notes: `Perpanjang jatuh tempo ke ${newDueDate}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pawns/${pawn.id}`);
  }
}

export async function redeemPawnRecord(
  uid: string,
  pawn: PawnRecord,
  additionalFeePaid: number,
  walletId: string,
  dateString?: string
): Promise<void> {
  const extraFee = cleanNum(additionalFeePaid, 0, 10000000000);
  const totalIn = pawn.loanAmount + extraFee;

  try {
    await updateDoc(doc(db, 'pawns', pawn.id), {
      totalFeeCollected: cleanNum(pawn.totalFeeCollected + extraFee, 0, 10000000000),
      status: 'ditebus',
      updatedAt: serverTimestamp(),
    });

    await createTransaction(uid, {
      category: 'gadai_masuk',
      flowType: 'masuk',
      title: `Tebus Lunas Gadai ${pawn.itemName}`,
      customerName: pawn.customerName,
      walletId,
      amount: totalIn,
      costAmount: pawn.loanAmount,
      profitAmount: extraFee,
      referenceId: pawn.id,
      dateString: dateString || getTodayDateString(),
      notes: `Pokok kembali: Rp ${pawn.loanAmount.toLocaleString('id-ID')}, Jasa tebus: Rp ${extraFee.toLocaleString('id-ID')}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pawns/${pawn.id}`);
  }
}

export async function forfeitPawnRecord(
  uid: string,
  pawn: PawnRecord,
  moveToPhoneInventory: boolean,
  targetSellPrice: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'pawns', pawn.id), {
      totalFeeCollected: pawn.totalFeeCollected,
      status: 'hangus_lelang',
      updatedAt: serverTimestamp(),
    });

    if (moveToPhoneInventory) {
      await createPhoneInventory(uid, {
        brand: pawn.itemCategory === 'hp' ? 'HP Lelang Gadai' : pawn.itemCategory.toUpperCase(),
        model: pawn.itemName,
        imei: '-',
        condition: 'seken',
        completeness: 'batangan',
        minusNotes: `Eks Gadai ${pawn.customerName}: ${pawn.itemCondition}`,
        buyPrice: pawn.loanAmount,
        serviceCost: 0,
        targetSellPrice: targetSellPrice > 0 ? targetSellPrice : pawn.loanAmount + pawn.feeAmount,
        status: 'tersedia',
        sourceInfo: `Lelang Gadai (${pawn.customerName})`,
        walletId: pawn.walletId,
        recordPurchaseTx: false, // Money already went out when pawn was disbursed
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `pawns/${pawn.id}`);
  }
}

export async function deletePawnRecord(pawnId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'pawns', pawnId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `pawns/${pawnId}`);
  }
}

export async function createInvestmentRecord(
  uid: string,
  input: {
    partnerName: string;
    businessName: string;
    capitalAmount: number;
    profitShareNote: string;
    walletId: string;
    deductWalletNow: boolean;
    dateString?: string;
  }
): Promise<void> {
  const invId = makeId('inv');
  const cap = cleanNum(input.capitalAmount, 0, 100000000000);
  try {
    await setDoc(doc(db, 'investments', invId), {
      ownerId: uid,
      partnerName: cleanStr(input.partnerName, 100, 'Mitra'),
      businessName: cleanStr(input.businessName, 150, 'Usaha Mitra'),
      capitalAmount: cap,
      returnedCapital: 0,
      totalProfitShared: 0,
      profitShareNote: cleanStr(input.profitShareNote, 250, 'Bagi hasil sesuai kesepakatan'),
      status: 'aktif',
      walletId: cleanStr(input.walletId, 128, '-'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.deductWalletNow && cap > 0) {
      await createTransaction(uid, {
        category: 'investasi_keluar',
        flowType: 'keluar',
        title: `Tanam Modal ke ${cleanStr(input.partnerName, 60)} (${cleanStr(input.businessName, 60)})`,
        customerName: cleanStr(input.partnerName, 100, 'Mitra'),
        walletId: input.walletId,
        amount: cap,
        costAmount: cap,
        profitAmount: 0,
        referenceId: invId,
        dateString: input.dateString || getTodayDateString(),
        notes: cleanStr(input.profitShareNote, 250, '-'),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `investments/${invId}`);
  }
}

export async function updateInvestmentRecord(
  invId: string,
  input: {
    partnerName: string;
    businessName: string;
    capitalAmount: number;
    profitShareNote: string;
    walletId: string;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'investments', invId), {
      partnerName: cleanStr(input.partnerName, 100, 'Mitra'),
      businessName: cleanStr(input.businessName, 150, 'Usaha Mitra'),
      capitalAmount: cleanNum(input.capitalAmount, 0, 100000000000),
      profitShareNote: cleanStr(input.profitShareNote, 250, 'Bagi hasil sesuai kesepakatan'),
      walletId: cleanStr(input.walletId, 128, '-'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `investments/${invId}`);
  }
}

export async function recordInvestmentProfitOrReturn(
  uid: string,
  inv: InvestmentRecord,
  profitAmount: number,
  capitalReturnedAmount: number,
  walletId: string,
  markCompleted: boolean,
  notes?: string,
  dateString?: string
): Promise<void> {
  const profit = cleanNum(profitAmount, 0, 100000000000);
  const capRet = cleanNum(capitalReturnedAmount, 0, 100000000000);
  const newReturned = cleanNum(inv.returnedCapital + capRet, 0, 100000000000);
  const newProfit = cleanNum(inv.totalProfitShared + profit, 0, 100000000000);
  const isDone = markCompleted || newReturned >= inv.capitalAmount;

  try {
    await updateDoc(doc(db, 'investments', inv.id), {
      capitalAmount: inv.capitalAmount,
      returnedCapital: newReturned,
      totalProfitShared: newProfit,
      profitShareNote: inv.profitShareNote,
      status: isDone ? 'selesai' : 'aktif',
      updatedAt: serverTimestamp(),
    });

    const totalCashIn = profit + capRet;
    if (totalCashIn > 0) {
      await createTransaction(uid, {
        category: 'investasi_masuk',
        flowType: 'masuk',
        title:
          profit > 0 && capRet > 0
            ? `Bagi Hasil & Pengembalian Modal - ${inv.partnerName}`
            : profit > 0
            ? `Setoran Bagi Hasil Investasi - ${inv.partnerName}`
            : `Pengembalian Pokok Modal - ${inv.partnerName}`,
        customerName: inv.partnerName,
        walletId,
        amount: totalCashIn,
        costAmount: capRet,
        profitAmount: profit,
        referenceId: inv.id,
        dateString: dateString || getTodayDateString(),
        notes: cleanStr(
          notes || `Bagi Hasil: Rp ${profit.toLocaleString('id-ID')}, Kembali Modal: Rp ${capRet.toLocaleString('id-ID')}`,
          300,
          '-'
        ),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `investments/${inv.id}`);
  }
}

export async function deleteInvestmentRecord(invId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'investments', invId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `investments/${invId}`);
  }
}

export async function createDebtRecord(
  uid: string,
  input: {
    type: DebtType;
    personName: string;
    phone: string;
    description: string;
    totalAmount: number;
    dueDate: string;
    walletId?: string;
    recordInitialCashFlow: boolean;
    dateString?: string;
  }
): Promise<void> {
  const debtId = makeId('debt');
  const total = cleanNum(input.totalAmount, 0, 100000000000);

  try {
    await setDoc(doc(db, 'debts', debtId), {
      ownerId: uid,
      type: input.type,
      personName: cleanStr(input.personName, 100, 'Pelanggan/Supplier'),
      phone: cleanStr(input.phone, 60, '-'),
      description: cleanStr(input.description, 250, 'Catatan Hutang/Piutang'),
      totalAmount: total,
      paidAmount: 0,
      dueDate: cleanStr(input.dueDate, 30, '-'),
      status: 'belum_lunas',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.recordInitialCashFlow && input.walletId && total > 0) {
      // If piutang (money lent out from cash), flowType = 'keluar'; if hutang (borrowed cash in), flowType = 'masuk'
      await createTransaction(uid, {
        category: 'hutang_piutang',
        flowType: input.type === 'piutang' ? 'keluar' : 'masuk',
        title: input.type === 'piutang' ? `Kasbon / Piutang Baru: ${input.personName}` : `Pinjaman / Hutang Masuk: ${input.personName}`,
        customerName: input.personName,
        walletId: input.walletId,
        amount: total,
        costAmount: 0,
        profitAmount: 0,
        referenceId: debtId,
        dateString: input.dateString || getTodayDateString(),
        notes: input.description,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `debts/${debtId}`);
  }
}

export async function payDebtInstallment(
  uid: string,
  debt: DebtRecord,
  paymentAmount: number,
  walletId: string,
  notes?: string,
  dateString?: string
): Promise<void> {
  const pay = cleanNum(paymentAmount, 0, 100000000000);
  const newPaid = cleanNum(debt.paidAmount + pay, 0, 100000000000);
  const isLunas = newPaid >= debt.totalAmount;

  try {
    await updateDoc(doc(db, 'debts', debt.id), {
      personName: debt.personName,
      phone: debt.phone,
      description: debt.description,
      totalAmount: debt.totalAmount,
      paidAmount: newPaid,
      dueDate: debt.dueDate,
      status: isLunas ? 'lunas' : 'belum_lunas',
      updatedAt: serverTimestamp(),
    });

    if (pay > 0 && walletId) {
      await createTransaction(uid, {
        category: 'hutang_piutang',
        flowType: debt.type === 'piutang' ? 'masuk' : 'keluar',
        title:
          debt.type === 'piutang'
            ? `Terima Bayaran Piutang: ${debt.personName}`
            : `Bayar Cicilan Hutang: ${debt.personName}`,
        customerName: debt.personName,
        walletId,
        amount: pay,
        costAmount: 0,
        profitAmount: 0,
        referenceId: debt.id,
        dateString: dateString || getTodayDateString(),
        notes: cleanStr(notes || debt.description, 300, '-'),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `debts/${debt.id}`);
  }
}

export async function deleteDebtRecord(debtId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'debts', debtId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `debts/${debtId}`);
  }
}

export async function saveCustomerRecord(
  uid: string,
  input: {
    name: string;
    phone: string;
    category: CustomerCategory;
    notes: string;
  },
  existingId?: string
): Promise<string> {
  const id = existingId || makeId('cust');
  try {
    if (existingId) {
      await updateDoc(doc(db, 'customers', id), {
        name: cleanStr(input.name, 100, 'Pelanggan'),
        phone: cleanStr(input.phone, 60, '-'),
        category: input.category,
        notes: cleanStr(input.notes, 300, '-'),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'customers', id), {
        ownerId: uid,
        name: cleanStr(input.name, 100, 'Pelanggan'),
        phone: cleanStr(input.phone, 60, '-'),
        category: input.category,
        notes: cleanStr(input.notes, 300, '-'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `customers/${id}`);
  }
}

export async function deleteCustomerRecord(customerId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customers/${customerId}`);
  }
}

export async function addLicense(
  uid: string,
  input: {
    customerPhone: string;
    licenseKey: string;
    type: LicenseType;
    expiryDate: Timestamp;
    status: LicenseStatus;
  }
): Promise<string> {
  const licenseId = makeId('license');
  const path = `licenses/${licenseId}`;
  try {
    await setDoc(doc(db, 'licenses', licenseId), {
      ownerId: uid,
      customerPhone: cleanStr(input.customerPhone, 60, '-'),
      licenseKey: cleanStr(input.licenseKey, 60, '-'),
      type: input.type,
      expiryDate: input.expiryDate,
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return licenseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface BackupDataPayload {
  wallets?: Array<Partial<Wallet>>;
  presets?: Array<Partial<CatalogPreset>>;
  customers?: Array<Partial<CustomerRecord>>;
  phones?: Array<Partial<PhoneInventory>>;
  pawns?: Array<Partial<PawnRecord>>;
  investments?: Array<Partial<InvestmentRecord>>;
  debts?: Array<Partial<DebtRecord>>;
  transactions?: Array<Partial<LedgerTransaction>>;
}

export async function restoreBackupData(uid: string, payload: BackupDataPayload): Promise<void> {
  const now = serverTimestamp();

  // Step 1: Restore Wallets, Presets, Customers, Debts first so walletId references exist
  const firstBatch = writeBatch(db);
  for (const w of payload.wallets || []) {
    const id = w.id && /^[a-zA-Z0-9_-]+$/.test(w.id) ? w.id : makeId('wallet');
    firstBatch.set(doc(db, 'wallets', id), {
      ownerId: uid,
      name: cleanStr(w.name, 80, 'Kantong Kas'),
      type: w.type && ['tunai', 'bank', 'server', 'ewallet'].includes(w.type) ? w.type : 'tunai',
      initialBalance: cleanNum(w.initialBalance ?? 0, -100000000000, 100000000000),
      accountInfo: cleanStr(w.accountInfo, 120, '-'),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const p of payload.presets || []) {
    const id = p.id && /^[a-zA-Z0-9_-]+$/.test(p.id) ? p.id : makeId('preset');
    firstBatch.set(doc(db, 'catalog_presets', id), {
      ownerId: uid,
      category:
        p.category && ['voucher', 'pulsa_data', 'aksesoris', 'topup_transfer', 'servis'].includes(p.category)
          ? p.category
          : 'voucher',
      name: cleanStr(p.name, 120, 'Produk'),
      costPrice: cleanNum(p.costPrice ?? 0, 0, 1000000000),
      sellPrice: cleanNum(p.sellPrice ?? 0, 0, 1000000000),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const c of payload.customers || []) {
    const id = c.id && /^[a-zA-Z0-9_-]+$/.test(c.id) ? c.id : makeId('cust');
    firstBatch.set(doc(db, 'customers', id), {
      ownerId: uid,
      name: cleanStr(c.name, 100, 'Pelanggan'),
      phone: cleanStr(c.phone, 60, '-'),
      category:
        c.category && ['umum', 'gadai', 'langganan', 'supplier'].includes(c.category)
          ? c.category
          : 'umum',
      notes: cleanStr(c.notes, 300, '-'),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const d of payload.debts || []) {
    const id = d.id && /^[a-zA-Z0-9_-]+$/.test(d.id) ? d.id : makeId('debt');
    firstBatch.set(doc(db, 'debts', id), {
      ownerId: uid,
      type: d.type === 'hutang' ? 'hutang' : 'piutang',
      personName: cleanStr(d.personName, 100, 'Pelanggan'),
      phone: cleanStr(d.phone, 60, '-'),
      description: cleanStr(d.description, 250, 'Catatan'),
      totalAmount: cleanNum(d.totalAmount ?? 0, 0, 100000000000),
      paidAmount: cleanNum(d.paidAmount ?? 0, 0, 100000000000),
      dueDate: cleanStr(d.dueDate, 30, '-'),
      status: d.status === 'lunas' ? 'lunas' : 'belum_lunas',
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await firstBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'restore_step_1');
  }

  // Step 2: Restore Phones, Pawns, Investments, Transactions
  const secondBatch = writeBatch(db);
  for (const ph of payload.phones || []) {
    const id = ph.id && /^[a-zA-Z0-9_-]+$/.test(ph.id) ? ph.id : makeId('hp');
    secondBatch.set(doc(db, 'phones', id), {
      ownerId: uid,
      brand: cleanStr(ph.brand, 60, 'HP'),
      model: cleanStr(ph.model, 120, 'Unit'),
      imei: cleanStr(ph.imei, 60, '-'),
      condition: ph.condition && ['baru', 'seken', 'minusan'].includes(ph.condition) ? ph.condition : 'seken',
      completeness:
        ph.completeness && ['fullset', 'unit_cas', 'batangan'].includes(ph.completeness)
          ? ph.completeness
          : 'fullset',
      minusNotes: cleanStr(ph.minusNotes, 300, 'Normal'),
      buyPrice: cleanNum(ph.buyPrice ?? 0, 0, 10000000000),
      serviceCost: cleanNum(ph.serviceCost ?? 0, 0, 10000000000),
      targetSellPrice: cleanNum(ph.targetSellPrice ?? 0, 0, 10000000000),
      soldPrice: cleanNum(ph.soldPrice ?? 0, 0, 10000000000),
      status: ph.status && ['tersedia', 'servis', 'terjual'].includes(ph.status) ? ph.status : 'tersedia',
      sourceInfo: cleanStr(ph.sourceInfo, 120, 'Kulakan'),
      buyerInfo: cleanStr(ph.buyerInfo, 120, '-'),
      walletId: '-',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const pw of payload.pawns || []) {
    const id = pw.id && /^[a-zA-Z0-9_-]+$/.test(pw.id) ? pw.id : makeId('gadai');
    secondBatch.set(doc(db, 'pawns', id), {
      ownerId: uid,
      customerName: cleanStr(pw.customerName, 100, 'Nasabah'),
      customerPhone: cleanStr(pw.customerPhone, 60, '-'),
      itemCategory:
        pw.itemCategory && ['hp', 'motor', 'laptop', 'elektronik', 'lainnya'].includes(pw.itemCategory)
          ? pw.itemCategory
          : 'hp',
      itemName: cleanStr(pw.itemName, 120, 'Barang Gadai'),
      itemCondition: cleanStr(pw.itemCondition, 300, 'Lengkap'),
      loanAmount: cleanNum(pw.loanAmount ?? 0, 0, 10000000000),
      feeAmount: cleanNum(pw.feeAmount ?? 0, 0, 10000000000),
      feeScheme:
        pw.feeScheme && ['potong_awal', 'bayar_akhir', 'fleksibel'].includes(pw.feeScheme)
          ? pw.feeScheme
          : 'potong_awal',
      totalFeeCollected: cleanNum(pw.totalFeeCollected ?? 0, 0, 10000000000),
      dueDate: cleanStr(pw.dueDate, 30, getTodayDateString()),
      status:
        pw.status && ['aktif', 'diperpanjang', 'ditebus', 'hangus_lelang'].includes(pw.status)
          ? pw.status
          : 'aktif',
      walletId: '-',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const inv of payload.investments || []) {
    const id = inv.id && /^[a-zA-Z0-9_-]+$/.test(inv.id) ? inv.id : makeId('inv');
    secondBatch.set(doc(db, 'investments', id), {
      ownerId: uid,
      partnerName: cleanStr(inv.partnerName, 100, 'Mitra'),
      businessName: cleanStr(inv.businessName, 150, 'Usaha Mitra'),
      capitalAmount: cleanNum(inv.capitalAmount ?? 0, 0, 100000000000),
      returnedCapital: cleanNum(inv.returnedCapital ?? 0, 0, 100000000000),
      totalProfitShared: cleanNum(inv.totalProfitShared ?? 0, 0, 100000000000),
      profitShareNote: cleanStr(inv.profitShareNote, 250, 'Bagi hasil'),
      status: inv.status === 'selesai' ? 'selesai' : 'aktif',
      walletId: '-',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const tx of payload.transactions || []) {
    const id = tx.id && /^[a-zA-Z0-9_-]+$/.test(tx.id) ? tx.id : makeId('tx');
    secondBatch.set(doc(db, 'transactions', id), {
      ownerId: uid,
      category: tx.category || 'voucher',
      flowType: tx.flowType && ['masuk', 'keluar', 'mutasi'].includes(tx.flowType) ? tx.flowType : 'masuk',
      title: cleanStr(tx.title, 150, 'Transaksi'),
      customerName: cleanStr(tx.customerName, 100, 'Umum'),
      walletId: '-',
      secondaryWalletId: '-',
      secondaryAmount: cleanNum(tx.secondaryAmount ?? 0, 0, 100000000000),
      amount: cleanNum(tx.amount ?? 0, 0, 100000000000),
      costAmount: cleanNum(tx.costAmount ?? 0, 0, 100000000000),
      profitAmount: cleanNum(tx.profitAmount ?? 0, -100000000000, 100000000000),
      referenceId: cleanStr(tx.referenceId, 128, '-'),
      dateString: cleanStr(tx.dateString ?? getTodayDateString(), 20, getTodayDateString()),
      notes: cleanStr(tx.notes, 300, '-'),
      createdAt: now,
    });
  }

  try {
    await secondBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'restore_step_2');
  }
}

export async function resetUserData(
  items: {
    transactions?: LedgerTransaction[];
    phones?: PhoneInventory[];
    pawns?: PawnRecord[];
    investments?: InvestmentRecord[];
    debts?: DebtRecord[];
    customers?: CustomerRecord[];
    presets?: CatalogPreset[];
    wallets?: Wallet[];
  }
): Promise<void> {
  const docsToDelete: Array<{ col: string; id: string }> = [];
  for (const t of items.transactions || []) docsToDelete.push({ col: 'transactions', id: t.id });
  for (const p of items.phones || []) docsToDelete.push({ col: 'phones', id: p.id });
  for (const pw of items.pawns || []) docsToDelete.push({ col: 'pawns', id: pw.id });
  for (const inv of items.investments || []) docsToDelete.push({ col: 'investments', id: inv.id });
  for (const d of items.debts || []) docsToDelete.push({ col: 'debts', id: d.id });
  for (const c of items.customers || []) docsToDelete.push({ col: 'customers', id: c.id });
  for (const pr of items.presets || []) docsToDelete.push({ col: 'catalog_presets', id: pr.id });
  for (const w of items.wallets || []) docsToDelete.push({ col: 'wallets', id: w.id });

  // Commit in chunks of 400 to respect Firestore batch limit (500)
  for (let i = 0; i < docsToDelete.length; i += 400) {
    const chunk = docsToDelete.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.delete(doc(db, item.col, item.id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'reset_data');
    }
  }
}

