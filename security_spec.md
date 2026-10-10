# Security Specification — Kasir Konter & Gadai Pro

## 1. Data Invariants
1. **Strict Ownership Isolation:** Every document in `/wallets`, `/phones`, `/catalog_presets`, `/pawns`, `/investments`, `/debts`, and `/transactions` must have an `ownerId` strictly equal to `request.auth.uid`.
2. **Verified Identity:** All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Timestamps:** `ownerId` and `createdAt` can never be mutated during an `update` operation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
4. **Server Temporal Integrity:** `createdAt` on `create` must equal `request.time`, and `updatedAt` on `create` and `update` must equal `request.time`.
5. **Query Enforcer & PII Protection:** Every `get` and `list` rule must evaluate `resource.data.ownerId == request.auth.uid` so no user can ever read or query another user's financial, customer, or inventory records.
6. **Strict Schema & Size Bounds:** Every collection enforces `hasAll` and `hasOnly` on document keys, string length boundaries, numeric bounds, and enum allowlists via dedicated `isValid[Entity]()` functions.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on Create:** Creating a `/wallets/w1` document with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
2. **Unverified Email Write:** Writing to `/transactions/t1` with a token where `email_verified == false`.
3. **Shadow Field Injection on Create:** Creating a `/phones/p1` document with an extra undeclared field `"isAdmin": true`.
4. **Shadow Field Injection on Update:** Updating `/pawns/pw1` with an extra field `"hacked": 1`.
5. **Owner Reassignment on Update:** Updating `/investments/inv1` to change `ownerId` to another UID.
6. **Timestamp Forgery on Create:** Creating `/debts/d1` with a client-supplied past/future timestamp instead of `request.time`.
7. **CreatedAt Mutation on Update:** Updating `/wallets/w1` while altering `createdAt`.
8. **ID Poisoning Attack:** Creating a document with an invalid ID containing special characters or length > 128.
9. **Denial of Wallet / Oversized String:** Creating `/phones/p1` with `minusNotes` of 5,000 characters (exceeds maxLength 300).
10. **Invalid Enum Value:** Creating `/transactions/t1` with `flowType: "curi_saldo"` (not in `["masuk", "keluar", "mutasi"]`).
11. **Value Type Poisoning on Update:** Updating `/catalog_presets/cp1` where `sellPrice` is a string `"mahal"` instead of a `number`.
12. **Cross-Tenant List Scraping:** Executing a collection-wide `list` query on `/transactions` without filtering `ownerId == request.auth.uid`.
