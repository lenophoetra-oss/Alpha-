import {
  collection,
  query,
  where,
  onSnapshot,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';

export const LOCAL_ANDROID_UID = 'local_android_kasir';
const LOCAL_AUTH_MODE_KEY = 'kasir_auth_mode_v1';
const LOCAL_DB_STORAGE_KEY = 'kasir_android_local_db_v1';

type CollectionMap = Record<string, Record<string, any>>;
type ListenerCallback = (docs: Array<{ id: string; [key: string]: any }>) => void;

const listeners: Record<string, Set<ListenerCallback>> = {};

export function isRunningInAndroidApk(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'file:' ||
    Boolean((window as any).__IS_ANDROID_APK__)
  );
}

export function isLocalAndroidMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (isRunningInAndroidApk()) return true;
  try {
    return localStorage.getItem(LOCAL_AUTH_MODE_KEY) === 'local';
  } catch {
    return false;
  }
}

export function setLocalAndroidMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(LOCAL_AUTH_MODE_KEY, 'local');
    } else {
      localStorage.removeItem(LOCAL_AUTH_MODE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function makeMockTimestamp(ms: number) {
  return {
    _ms: ms,
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

function getDefaultStarterDb(): CollectionMap {
  const now = Date.now();
  return {
    wallets: {
      w_tunai_starter: {
        ownerId: LOCAL_ANDROID_UID,
        name: 'Kas Tunai (Laci)',
        type: 'tunai',
        initialBalance: 0,
        accountInfo: 'Uang tunai kasir konter',
        createdAt: { _ms: now - 3000 },
        updatedAt: { _ms: now - 3000 },
      },
      w_bank_starter: {
        ownerId: LOCAL_ANDROID_UID,
        name: 'Rekening Bank (M-Banking)',
        type: 'bank',
        initialBalance: 0,
        accountInfo: 'Rekening transfer & kulakan',
        createdAt: { _ms: now - 2000 },
        updatedAt: { _ms: now - 2000 },
      },
      w_server_starter: {
        ownerId: LOCAL_ANDROID_UID,
        name: 'Saldo Server & E-Wallet',
        type: 'server',
        initialBalance: 0,
        accountInfo: 'Deposit pulsa, kuota & topup',
        createdAt: { _ms: now - 1000 },
        updatedAt: { _ms: now - 1000 },
      },
    },
    catalog_presets: {
      preset_starter_1: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'voucher',
        name: 'Telkomsel 5GB',
        costPrice: 13000,
        sellPrice: 20000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_2: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'voucher',
        name: 'Telkomsel 7GB',
        costPrice: 25000,
        sellPrice: 32000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_3: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'voucher',
        name: 'Indosat Freedom 6GB',
        costPrice: 18000,
        sellPrice: 25000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_4: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'voucher',
        name: 'Smartfren Unlimited 7 Hari',
        costPrice: 22000,
        sellPrice: 28000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_5: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'pulsa_data',
        name: 'Pulsa Reguler 20.000',
        costPrice: 20200,
        sellPrice: 23000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_6: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'pulsa_data',
        name: 'Pulsa Reguler 50.000',
        costPrice: 50100,
        sellPrice: 53000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_7: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'aksesoris',
        name: 'Tempered Glass Ceramic',
        costPrice: 6000,
        sellPrice: 20000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
      preset_starter_8: {
        ownerId: LOCAL_ANDROID_UID,
        category: 'aksesoris',
        name: 'Kabel Data Fast Charging',
        costPrice: 12000,
        sellPrice: 25000,
        createdAt: { _ms: now },
        updatedAt: { _ms: now },
      },
    },
    phones: {},
    pawns: {},
    investments: {},
    debts: {},
    customers: {},
    transactions: {},
  };
}

let memoryDb: CollectionMap | null = null;

function loadDb(): CollectionMap {
  if (memoryDb) return memoryDb;
  try {
    const raw = localStorage.getItem(LOCAL_DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryDb = parsed;
        return memoryDb!;
      }
    }
  } catch {
    // fallback to default starter db
  }
  memoryDb = getDefaultStarterDb();
  saveDb(memoryDb);
  return memoryDb;
}

function saveDb(state: CollectionMap): void {
  memoryDb = state;
  try {
    localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function serializeData(data: Record<string, any>): Record<string, any> {
  const now = Date.now();
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof v._ms === 'number') {
        out[k] = { _ms: v._ms };
      } else if (typeof v.toMillis === 'function') {
        out[k] = { _ms: v.toMillis() };
      } else {
        // Firestore FieldValue sentinel (serverTimestamp)
        out[k] = { _ms: now };
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function hydrateDoc(id: string, raw: Record<string, any>): { id: string; [key: string]: any } {
  const out: Record<string, any> = { id };
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object' && typeof v._ms === 'number') {
      out[k] = makeMockTimestamp(v._ms);
    } else if ((k === 'createdAt' || k === 'updatedAt') && typeof v === 'number') {
      out[k] = makeMockTimestamp(v);
    } else {
      out[k] = v;
    }
  }
  if (!out.createdAt) {
    out.createdAt = makeMockTimestamp(Date.now());
  }
  if (!out.updatedAt) {
    out.updatedAt = makeMockTimestamp(Date.now());
  }
  return out as { id: string; [key: string]: any };
}

function getCollectionDocs(colName: string): Array<{ id: string; [key: string]: any }> {
  const state = loadDb();
  const col = state[colName] || {};
  return Object.entries(col).map(([id, docData]) => hydrateDoc(id, docData));
}

function notifyCollection(colName: string): void {
  const colListeners = listeners[colName];
  if (!colListeners || colListeners.size === 0) return;
  const docs = getCollectionDocs(colName);
  colListeners.forEach((cb) => cb(docs));
}

function parseRef(ref: DocumentReference): { colName: string; docId: string } {
  const parts = ref.path.split('/');
  return {
    colName: parts[0],
    docId: parts[1],
  };
}

export async function localSetDoc(ref: DocumentReference, data: Record<string, any>): Promise<void> {
  const { colName, docId } = parseRef(ref);
  const state = loadDb();
  if (!state[colName]) state[colName] = {};
  state[colName][docId] = serializeData(data);
  saveDb(state);
  notifyCollection(colName);
}

export async function localUpdateDoc(ref: DocumentReference, data: Record<string, any>): Promise<void> {
  const { colName, docId } = parseRef(ref);
  const state = loadDb();
  if (!state[colName]) state[colName] = {};
  const existing = state[colName][docId] || {};
  state[colName][docId] = {
    ...existing,
    ...serializeData(data),
  };
  saveDb(state);
  notifyCollection(colName);
}

export async function localDeleteDoc(ref: DocumentReference): Promise<void> {
  const { colName, docId } = parseRef(ref);
  const state = loadDb();
  if (state[colName] && state[colName][docId]) {
    delete state[colName][docId];
    saveDb(state);
    notifyCollection(colName);
  }
}

export function localWriteBatch() {
  const ops: Array<{ type: 'set' | 'delete'; colName: string; docId: string; data?: Record<string, any> }> = [];
  return {
    set(ref: DocumentReference, data: Record<string, any>) {
      const { colName, docId } = parseRef(ref);
      ops.push({ type: 'set', colName, docId, data });
    },
    delete(ref: DocumentReference) {
      const { colName, docId } = parseRef(ref);
      ops.push({ type: 'delete', colName, docId });
    },
    async commit(): Promise<void> {
      const state = loadDb();
      const touched = new Set<string>();
      for (const op of ops) {
        if (!state[op.colName]) state[op.colName] = {};
        if (op.type === 'set' && op.data) {
          state[op.colName][op.docId] = serializeData(op.data);
          touched.add(op.colName);
        } else if (op.type === 'delete') {
          delete state[op.colName][op.docId];
          touched.add(op.colName);
        }
      }
      saveDb(state);
      touched.forEach((c) => notifyCollection(c));
    },
  };
}

export function subscribeCollection<T>(
  colName: string,
  uid: string,
  onData: (items: T[]) => void,
  onError: (err: unknown) => void
): () => void {
  if (uid === LOCAL_ANDROID_UID || isLocalAndroidMode()) {
    if (!listeners[colName]) {
      listeners[colName] = new Set();
    }
    const handler: ListenerCallback = (docs) => {
      onData(docs as unknown as T[]);
    };
    listeners[colName].add(handler);
    // Emit initial state immediately
    handler(getCollectionDocs(colName));
    return () => {
      listeners[colName]?.delete(handler);
    };
  }

  return onSnapshot(
    query(collection(db, colName), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, any>),
      })) as unknown as T[];
      onData(list);
    },
    onError
  );
}
