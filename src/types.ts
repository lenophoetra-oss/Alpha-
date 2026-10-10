import { Timestamp } from 'firebase/firestore';

export type WalletType = 'tunai' | 'bank' | 'server' | 'ewallet';

export interface Wallet {
  id: string;
  ownerId: string;
  name: string;
  type: WalletType;
  initialBalance: number;
  accountInfo: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PhoneCondition = 'baru' | 'seken' | 'minusan';
export type PhoneCompleteness = 'fullset' | 'unit_cas' | 'batangan';
export type PhoneStatus = 'tersedia' | 'servis' | 'terjual';

export interface PhoneInventory {
  id: string;
  ownerId: string;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PresetCategory = 'voucher' | 'pulsa_data' | 'aksesoris' | 'topup_transfer' | 'servis';

export interface CatalogPreset {
  id: string;
  ownerId: string;
  category: PresetCategory;
  name: string;
  costPrice: number;
  sellPrice: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PawnItemCategory = 'hp' | 'motor' | 'laptop' | 'elektronik' | 'lainnya';
export type PawnFeeScheme = 'potong_awal' | 'bayar_akhir' | 'fleksibel';
export type PawnStatus = 'aktif' | 'diperpanjang' | 'ditebus' | 'hangus_lelang';

export interface PawnRecord {
  id: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  itemCategory: PawnItemCategory;
  itemName: string;
  itemCondition: string;
  loanAmount: number;
  feeAmount: number;
  feeScheme: PawnFeeScheme;
  totalFeeCollected: number;
  dueDate: string;
  status: PawnStatus;
  walletId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type InvestmentStatus = 'aktif' | 'selesai';

export interface InvestmentRecord {
  id: string;
  ownerId: string;
  partnerName: string;
  businessName: string;
  capitalAmount: number;
  returnedCapital: number;
  totalProfitShared: number;
  profitShareNote: string;
  status: InvestmentStatus;
  walletId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type DebtType = 'piutang' | 'hutang';
export type DebtStatus = 'belum_lunas' | 'lunas';

export interface DebtRecord {
  id: string;
  ownerId: string;
  type: DebtType;
  personName: string;
  phone: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  status: DebtStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TransactionCategory =
  | 'jual_hp'
  | 'beli_hp'
  | 'voucher'
  | 'pulsa_data'
  | 'aksesoris'
  | 'topup_transfer'
  | 'servis'
  | 'kulakan_barang'
  | 'gadai_keluar'
  | 'gadai_masuk'
  | 'investasi_keluar'
  | 'investasi_masuk'
  | 'hutang_piutang'
  | 'pengeluaran_toko'
  | 'gaji_pribadi'
  | 'pengeluaran_pribadi'
  | 'pemasukan_pribadi'
  | 'mutasi_saldo';

export type PersonalExpensePriority = 'kebutuhan' | 'foya' | 'tabungan';

export const PERSONAL_PRIORITY_LABELS: Record<PersonalExpensePriority, string> = {
  kebutuhan: 'Kebutuhan Pokok & Rumah',
  foya: 'Hiburan / Gaya Hidup (Foya-foya)',
  tabungan: 'Tabungan / Keluarga / Sosial',
};

export const PERSONAL_GROUP_LABELS = PERSONAL_PRIORITY_LABELS;

export function parsePersonalExpenseNotes(
  notes: string,
  referenceId?: string
): { group: PersonalExpensePriority; cleanNotes: string } {
  if (referenceId === 'foya' || referenceId === 'tabungan' || referenceId === 'kebutuhan') {
    return { group: referenceId, cleanNotes: notes };
  }
  const raw = (notes || '').trim();
  if (raw.startsWith('[FOYA]')) {
    return { group: 'foya', cleanNotes: raw.replace('[FOYA]', '').trim() || '-' };
  }
  if (raw.startsWith('[TABUNGAN]')) {
    return { group: 'tabungan', cleanNotes: raw.replace('[TABUNGAN]', '').trim() || '-' };
  }
  if (raw.startsWith('[KEBUTUHAN]')) {
    return { group: 'kebutuhan', cleanNotes: raw.replace('[KEBUTUHAN]', '').trim() || '-' };
  }
  const lower = raw.toLowerCase();
  if (lower.includes('foya') || lower.includes('hiburan') || lower.includes('nongkrong')) {
    return { group: 'foya', cleanNotes: raw };
  }
  if (lower.includes('tabungan') || lower.includes('sosial')) {
    return { group: 'tabungan', cleanNotes: raw };
  }
  return { group: 'kebutuhan', cleanNotes: raw || '-' };
}

export type TransactionFlowType = 'masuk' | 'keluar' | 'mutasi';

export interface LedgerTransaction {
  id: string;
  ownerId: string;
  category: TransactionCategory;
  flowType: TransactionFlowType;
  title: string;
  customerName: string;
  walletId: string;
  secondaryWalletId: string;
  secondaryAmount: number;
  amount: number;
  costAmount: number;
  profitAmount: number;
  referenceId: string;
  dateString: string;
  notes: string;
  createdAt?: Timestamp;
}

export function formatIDR(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat('id-ID').format(abs);
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  jual_hp: 'Penjualan HP',
  beli_hp: 'Kulak / Servis HP',
  voucher: 'Voucher Data/Fisik',
  pulsa_data: 'Pulsa & Paket Data',
  aksesoris: 'Aksesoris HP',
  topup_transfer: 'Topup & Transfer',
  servis: 'Jasa Servis HP',
  kulakan_barang: 'Kulakan Voucher/Aksesoris',
  gadai_keluar: 'Pencairan Gadai',
  gadai_masuk: 'Tebus / Jasa Gadai',
  investasi_keluar: 'Tanam Modal Keluar',
  investasi_masuk: 'Bagi Hasil / Kembali Modal',
  hutang_piutang: 'Hutang & Piutang',
  pengeluaran_toko: 'Pengeluaran Toko',
  gaji_pribadi: 'Gaji Pribadi (Prive)',
  pengeluaran_pribadi: 'Pengeluaran Pribadi',
  pemasukan_pribadi: 'Pemasukan Pribadi',
  mutasi_saldo: 'Mutasi Antar Kantong',
};

export const CATEGORY_BADGE_STYLES: Record<TransactionCategory, string> = {
  jual_hp:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  beli_hp:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  voucher:
    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  pulsa_data:
    'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  aksesoris:
    'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  topup_transfer:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  servis:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  kulakan_barang:
    'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  gadai_keluar:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  gadai_masuk:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  investasi_keluar:
    'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  investasi_masuk:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  hutang_piutang:
    'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  pengeluaran_toko:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  gaji_pribadi:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  pengeluaran_pribadi:
    'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
  pemasukan_pribadi:
    'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  mutasi_saldo:
    'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
};

export const WALLET_TYPE_STYLES: Record<
  WalletType,
  { label: string; cardBg: string; badgeText: string; dotColor: string }
> = {
  tunai: {
    label: 'Kas Tunai',
    cardBg: 'wallet-card-dark border rounded-xl shadow-xs',
    badgeText: 'wallet-label-text',
    dotColor: '!text-emerald-400',
  },
  bank: {
    label: 'Rekening Bank',
    cardBg: 'wallet-card-dark border rounded-xl shadow-xs',
    badgeText: 'wallet-label-text',
    dotColor: '!text-sky-400',
  },
  ewallet: {
    label: 'E-Wallet',
    cardBg: 'wallet-card-dark border rounded-xl shadow-xs',
    badgeText: 'wallet-label-text',
    dotColor: '!text-indigo-400',
  },
  server: {
    label: 'Saldo Server',
    cardBg: 'wallet-card-dark border rounded-xl shadow-xs',
    badgeText: 'wallet-label-text',
    dotColor: '!text-amber-400',
  },
};

export const PRESET_CATEGORY_STYLES: Record<
  PresetCategory,
  { label: string; textClass: string; borderHover: string }
> = {
  voucher: {
    label: 'Voucher Data',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-500 dark:hover:border-blue-400',
  },
  pulsa_data: {
    label: 'Pulsa & Paket',
    textClass: 'text-violet-600 dark:text-violet-400',
    borderHover: 'hover:border-violet-500 dark:hover:border-violet-400',
  },
  aksesoris: {
    label: 'Aksesoris HP',
    textClass: 'text-teal-600 dark:text-teal-400',
    borderHover: 'hover:border-teal-500 dark:hover:border-teal-400',
  },
  topup_transfer: {
    label: 'Topup & TF',
    textClass: 'text-sky-600 dark:text-sky-400',
    borderHover: 'hover:border-sky-500 dark:hover:border-sky-400',
  },
  servis: {
    label: 'Jasa Servis',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderHover: 'hover:border-amber-500 dark:hover:border-amber-400',
  },
};

/**
 * Calculates the real-time balance of every wallet based on its initialBalance
 * and all recorded transactions.
 *
 * Rules of wallet flow:
 * - If tx.flowType === 'masuk':
 *   - walletId receives +tx.amount
 *   - if tx.secondaryWalletId !== '-' and tx.secondaryAmount > 0:
 *     secondaryWalletId is deducted -tx.secondaryAmount (e.g. Pulsa Elektrik / Topup where cash comes in to walletId and server/bank balance goes out from secondaryWalletId!)
 * - If tx.flowType === 'keluar':
 *   - walletId is deducted -tx.amount
 * - If tx.flowType === 'mutasi':
 *   - walletId (source wallet) is deducted -tx.amount
 *   - secondaryWalletId (destination wallet) receives +tx.secondaryAmount
 */
export function computeWalletBalances(
  wallets: Wallet[],
  transactions: LedgerTransaction[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const w of wallets) {
    balances[w.id] = w.initialBalance;
  }

  for (const tx of transactions) {
    if (tx.flowType === 'masuk') {
      if (balances[tx.walletId] !== undefined) {
        balances[tx.walletId] += tx.amount;
      }
      if (tx.secondaryWalletId && tx.secondaryWalletId !== '-' && tx.secondaryAmount > 0) {
        if (balances[tx.secondaryWalletId] !== undefined) {
          balances[tx.secondaryWalletId] -= tx.secondaryAmount;
        }
      }
    } else if (tx.flowType === 'keluar') {
      if (balances[tx.walletId] !== undefined) {
        balances[tx.walletId] -= tx.amount;
      }
    } else if (tx.flowType === 'mutasi') {
      if (balances[tx.walletId] !== undefined) {
        balances[tx.walletId] -= tx.amount;
      }
      if (tx.secondaryWalletId && tx.secondaryWalletId !== '-') {
        if (balances[tx.secondaryWalletId] !== undefined) {
          balances[tx.secondaryWalletId] += tx.secondaryAmount;
        }
      }
    }
  }

  return balances;
}

export type CustomerCategory = 'umum' | 'gadai' | 'langganan' | 'supplier';

export interface CustomerRecord {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  category: CustomerCategory;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type LicenseType = 'trial' | 'pro';
export type LicenseStatus = 'active' | 'expired';

export interface License {
  id: string;
  ownerId: string;
  customerPhone: string;
  licenseKey: string;
  type: LicenseType;
  expiryDate: Timestamp;
  status: LicenseStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const CUSTOMER_CATEGORY_LABELS: Record<CustomerCategory, string> = {
  umum: 'Pelanggan Umum',
  langganan: 'Langganan Konter',
  gadai: 'Nasabah Gadai',
  supplier: 'Supplier / Mitra',
};

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  paperSize: '58mm' | '80mm';
  showLogoOnReceipt: boolean;
  autoOpenReceiptAfterTx: boolean;
  themeMode: 'light' | 'dark';
  appPinEnabled: boolean;
  appPinCode: string;
  trialDurationMs: number;
}

export interface ReceiptPayload {
  receiptNo: string;
  dateString: string;
  timeString?: string;
  categoryLabel: string;
  title: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  flowType?: TransactionFlowType;
  walletName?: string;
  notes?: string;
  extraLines?: Array<{ label: string; value: string }>;
}

export function getDefaultStoreSettings(userEmail?: string | null): StoreSettings {
  return {
    storeName: 'Kasir Konter & Gadai Pro',
    ownerName: userEmail ? userEmail.split('@')[0] : 'Admin Konter',
    storeAddress: 'Pusat Jual Beli HP, Servis, Voucher, Topup & Gadai Resmi',
    storePhone: '081234567890',
    receiptFooter: 'Terima kasih atas kepercayaan Anda. Barang yang sudah dibeli/ditebus telah dicek bersama.',
    paperSize: '58mm',
    showLogoOnReceipt: true,
    autoOpenReceiptAfterTx: true,
    themeMode: 'light',
    appPinEnabled: false,
    appPinCode: '',
    trialDurationMs: 3 * 24 * 60 * 60 * 1000,
  };
}

export function loadStoreSettings(uid: string, userEmail?: string | null): StoreSettings {
  const defaults = getDefaultStoreSettings(userEmail);
  if (typeof window === 'undefined' || !uid) return defaults;
  try {
    const raw = window.localStorage.getItem(`konter_settings_${uid}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveStoreSettings(uid: string, settings: StoreSettings): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`konter_settings_${uid}`, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function formatPhoneForWA(rawPhone: string | undefined | null): string {
  const digits = (rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined | null, message: string): string {
  const cleanPhone = formatPhoneForWA(phone);
  const encoded = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

