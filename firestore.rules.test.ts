/**
 * Security Rules Dirty Dozen Specification Test Runner
 * Verifies that all 12 adversarial payloads defined in security_spec.md
 * are rejected with PERMISSION_DENIED by firestore.rules.
 */

export interface SecurityPayloadTest {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'list';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityPayloadTest[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create',
    collection: 'wallets',
    docId: 'w1',
    operation: 'create',
    authUid: 'attacker_uid',
    emailVerified: true,
    payload: { ownerId: 'victim_uid', name: 'Kas Tunai', type: 'tunai', initialBalance: 0, accountInfo: '-' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collection: 'transactions',
    docId: 't1',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: false,
    payload: { ownerId: 'user_1', category: 'voucher', flowType: 'masuk', title: 'Test', amount: 10000 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    collection: 'phones',
    docId: 'p1',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_1', brand: 'iPhone', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Update',
    collection: 'pawns',
    docId: 'pw1',
    operation: 'update',
    authUid: 'user_1',
    emailVerified: true,
    payload: { status: 'diperpanjang', hacked: 1 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Reassignment on Update',
    collection: 'investments',
    docId: 'inv1',
    operation: 'update',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'other_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Timestamp Forgery on Create',
    collection: 'debts',
    docId: 'd1',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_1', createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'CreatedAt Mutation on Update',
    collection: 'wallets',
    docId: 'w1',
    operation: 'update',
    authUid: 'user_1',
    emailVerified: true,
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collection: 'wallets',
    docId: 'invalid/id$#$%',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_1' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Denial of Wallet / Oversized String',
    collection: 'phones',
    docId: 'p1',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_1', minusNotes: 'A'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid Enum Value',
    collection: 'transactions',
    docId: 't1',
    operation: 'create',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_1', flowType: 'curi_saldo' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Type Poisoning on Update',
    collection: 'catalog_presets',
    docId: 'cp1',
    operation: 'update',
    authUid: 'user_1',
    emailVerified: true,
    payload: { sellPrice: 'mahal' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-Tenant List Scraping',
    collection: 'transactions',
    docId: '*',
    operation: 'list',
    authUid: 'attacker_uid',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
