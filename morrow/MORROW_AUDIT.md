# Morrow — Phase 1 audit and upgrade plan

Audit date: 2026-10-17. Scope: all application, stylesheet, markup, tests and documentation in the existing checkout, plus the generated standalone HTML. Application files and stored user data have not been modified by this audit.

## 1. Source inventory

```text
/workspace/-my-first-project/
  README.md                 repository title only
  DEVELOPMENT.md            current capabilities and startup notes
  package.json              start/test commands; no dependencies
  index.html                complete interface and dialogs
  style.css                 complete responsive light theme
  finance.js                amount conversion, totals, CSV parser
  app.js                    UI, local persistence, import/export
  tests/finance.test.js     four existing financial/CSV tests
/workspace/xiaoman.html     standalone bundle matching the above source
```

The standalone artifact was compared against a fresh in-memory bundle: exact match. Git currently tracks only README.md; application files are present but untracked. They must be included in version control or a verified source archive before relying on Git for rollback. No commit or push was performed.

## 2. Actual stack

Native HTML, CSS, JavaScript ES modules. No React, TypeScript, Vite, Tailwind, third-party runtime dependencies, database, authentication or backend. npm start invokes Python's development HTTP server on port 3000. npm test invokes Node's built-in test runner. No lockfile is needed for the current dependency-free package. No service worker, manifest, installable PWA, deployment configuration or CI exists.

The UI is Chinese-only. Currency formatting is CNY-like yuan display with zh-CN formatting; there is no stored currency code. Current desktop navigation uses a fixed sidebar; mobile navigation is a top navigation row, not a bottom tab bar. No system/dark theme or reduced-motion handling exists.

## 3. Existing functionality and invariants

| Area | Implemented behavior | Preserve during upgrade |
|---|---|---|
| Ledger | Add income/expense; date; free-text category; five payment labels; note; confirmed deletion | IDs, dates, integer amounts, text and income/expense meaning |
| Summary | Selected-month income, expense, difference; category expense proportions | Local calendar month filtering; no transfer counted as income/expense |
| Savings accounts | Add, rename, update manual balance; zero allowed; confirmed deletion | Manual balances are independent from transaction records |
| Savings goal | One name and positive target; progress from all savings balances | Legacy progress must remain tied to total savings unless user explicitly changes funding mode |
| CSV | Download UTF-8 BOM template; parse six Chinese headers; quoted fields and CRLF; import | Original format remains importable |
| Import deduplication | Exact tuple of date, type, category, amount, account and note | Same-file repeat import adds no identical rows; preserve legitimate duplicates in JSON |
| Backup | Export complete state as JSON; validate/confirm replacement restore | Keep legacy JSON compatibility and explicit destructive-action confirmation |
| Persistence | Save locally; refuse writes after initial read failure; error on failed write | No silent loss when storage is unavailable |
| Responsive | Cards, tables and dialogs adapt to desktop/tablet/mobile | Preserve all operations across breakpoints |

Not implemented: editing ledger entries, transfers, separate category management, budgets, multiple goals, explicit goal contributions, goal dates/notes/covers, search, category filtering, trend charts, English, settings, auth, cloud sync, cross-device data transfer except JSON, PWA, bank/Alipay/WeChat connections. The existing connection section is explanatory text only.

## 4. Exact legacy storage contract

Browser localStorage key: `xiaoman-v1`.

```ts
type LegacyState = {
  transactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amount: number; // integer minor units: CNY fen
    date: string;   // YYYY-MM-DD local calendar date, not an instant
    category: string;
    account: string; // payment label, NOT a savings-account foreign key
    note: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    amount: number;  // integer minor units, zero permitted
    updated: string; // local calendar date, no time-of-day
  }>;
  goal: null | {
    name: string;
    amount: number; // target only; no saved current amount or ID
  };
};
```

There is no schema-version field, login owner, account type, currency, per-record revision, deletion history, sync queue or migration history. `v1` is part of the storage key only. Do not invent timestamps for historical events: migration timestamps must be distinguished from dates of original user actions.

Source and standalone HTML do not contain the owner's browser financial data. Mac/iPhone/browser/site origins have separate storage. A new deployment cannot read localStorage on an old origin, nor assume access to a locally opened file's storage. Export JSON from the original browser and original app location first; preserve the original file/site until migration has been verified. No real user dataset was supplied or inspected during this audit.

## 5. Confirmed risks and audit evidence

### High priority: data integrity and migration

1. JSON restore only checks a date regex, whereas CSV additionally checks actual calendar validity. An isolated probe confirms JSON accepts 2026-02-30. Preserve raw input and report invalid records before migration; do not silently normalize dates.
2. JSON restore accepts duplicate record IDs and zero-valued transactions, though the add form rejects zero transactions. Duplicate IDs can cause edit/delete to affect multiple entries. Report collisions and assign stable migration mappings, retaining all records; never discard them merely for having identical content.
3. Ledger account values are display labels unrelated to manual savings-account IDs. Never infer a bank link from similar names, and never replay historical transactions against saved balances.
4. Legacy goal progress is computed from all accounts. Copying it into an independent zero-funded goal changes behavior. Model an explicit total-savings funding mode for the legacy goal.
5. Current JSON restore replaces everything after confirmation, without mandatory pre-restore backup, dry-run report or rollback journal. The new flow needs all three.
6. There is no origin-independent storage, cloud recovery or storage encryption. Users must back up before switching app location or browser.

### Other confirmed implementation limitations

7. Category totals use a plain object. Probes with constructor, toString and __proto__ produce nonnumeric results. Replace with Map or an object without a prototype, backed by regression tests.
8. Integer minor units are a sound existing invariant, but aggregate totals are not checked for safe-integer overflow. SQL bigint serialization must not accidentally reintroduce floating-point precision loss. Use validated decimal parsing, bounded safe-integer client amounts and server constraints, or a consistent bigint representation at boundaries.
9. Ordinary ledger edits do not exist. Text is Chinese and distributed throughout markup and JS. The current money formatter must not be repurposed as implicit currency conversion.
10. Raw legacy JSON has no version or integrity digest. CSV import uses six fixed Chinese headers; BOM/quoted-field handling must remain compatible. Exact-tuple deduplication can suppress two genuinely identical payments; JSON migration must instead preserve all records and identify migrations separately.
11. Restore validates selected known fields, not a strict versioned schema or uniqueness/relational constraints. Error handling must distinguish corrupt data, unavailable storage and invalid imports, and keep original bytes for recovery.
12. localStorage full-state writes do not provide cross-tab transactional concurrency. Read-modify-write in two tabs can lose changes. Use IndexedDB transactions and cross-tab invalidation in the new version.
13. Arbitrary text is escaped before current innerHTML rendering. Retain that protection when replacing rendering. Future goal-cover uploads need user-scoped storage policies, type/size constraints and cache controls.
14. The Python HTTP server is a development server, not production hosting. HTTPS, security headers, authentication redirect URLs, deployment and recovery procedures remain to be configured.
15. Existing tests do not establish cloud or native Apple behavior. Desktop Chromium emulation does not replace real iPhone Safari/macOS Safari/PWA tests.

## 6. Validation performed in Phase 1

- Read all eight application/documentation/test files in the inventory.
- Confirmed standalone HTML matches the module sources.
- Re-ran npm test: 4 passed, 0 failed, 0 skipped.
- Isolated validator probes: invalid calendar date, duplicate account IDs and zero transaction amount are accepted by the legacy JSON validator.
- Isolated aggregation probes: constructor/toString/__proto__ fail numeric accumulation.
- No live Supabase, production deployment, real user migration or fresh Safari/iPhone validation was performed. The prior development server was not reachable in this audit; no current live-server readiness claim is made.
- Application source, old storage key, original HTML and user data were not modified. This report is the only new audit artifact.

## 7. Proposed architecture and migration cost

The application is small and dependency-free, so there is no mature framework investment to preserve. React + TypeScript + Vite is reasonable for the requested multi-screen product. It adds a build pipeline and dependency lifecycle; adopt it incrementally alongside the unchanged legacy entry point. Preserve behavior through a typed legacy adapter and characterization tests rather than treating the current UI code as a reusable component library.

Suggested layers:

```text
src/
  app/                 routes, shell, providers
  components/          shared accessible controls and cards
  features/            dashboard, transactions, accounts, budgets,
                       goals, analytics, settings, auth
  domain/              money, local dates, ledger invariants
  data/                IndexedDB repositories, sync queue, migrations
  i18n/                typed en and zh-CN catalogs
  styles/              semantic tokens, themes, reduced motion
public/                manifest, m. icons, offline shell assets
supabase/migrations/   schema, RLS, atomic sync functions
tests/                 unit, migration, browser, RLS/sync integration
```

Use Tailwind for layout where useful, semantic CSS variables for the design system, Lucide for consistent icons, Supabase Auth/PostgreSQL for cloud persistence, and Vercel for HTTPS deployment. Pin dependencies and commit the resulting lockfile. IndexedDB keeps data and an outbox durable offline; localStorage may hold non-sensitive UI preferences and untouched legacy data only.

Proposed tables: accounts, transactions, categories, monthly_budgets, savings_goals, goal_contributions, migration_batches and user_preferences. Every financial row needs owner_id, currency, stable client-generated ID, server revision, created/updated timestamps and a deleted tombstone where applicable. Transactions distinguish income/expense/transfer. A transfer has explicit source/destination IDs and is an atomic operation excluded from income/expense totals. Manual opening/observed balances remain separate from new balance-affecting entries; no historical replay. Cross-currency transfers require explicit exchange amounts and are not assumed to be supported by the first version.

Budgets are spending limits for a month and optional category. New goals may use independent recorded contributions; the migrated goal uses the preserved total-savings mode. Changing display currency must not relabel existing CNY amounts; aggregate by currency until a deliberate exchange-rate design exists.

## 8. Safe migration procedure

1. Export JSON in the original browser via Backup Data. If original storage cannot be read, stop and provide recovery diagnosis; do not replace it with an empty dataset.
2. Preserve original bytes, generate a SHA-256 digest and a separate versioned backup envelope. Verify backup parsing before enabling migration.
3. Validate all legacy fields. Produce a dry-run report: counts, unique IDs/collisions, monthly income/expense totals, category totals, every account balance, total savings and goal target/progress. Invalid or ambiguous rows remain in the backup and require explicit resolution.
4. Generate stable source-to-target IDs and a migration-batch identity. Preserve original transaction text and IDs as provenance. Keep payment labels even if they do not map to an account. Reimporting the same batch must not create duplicates; matching file digest alone must not silently assign financial records to another owner.
5. Commit the local converted data plus migration journal atomically to a new IndexedDB database. Never overwrite/remove xiaoman-v1 or modify the old standalone file.
6. Recompute reconciliation totals and compare with the legacy baseline. Block completion on mismatch. Test reopening the converted data before declaring success.
7. Cloud upload requires an explicitly selected authenticated owner and user confirmation. Idempotent server writes and a migration receipt protect retries. Cloud acknowledgement plus full reconciliation is required before marking the cloud migration complete.
8. Retain the original JSON and old app for rollback. Exports from Morrow include a schema version and all financial/preferences data. Restore is previewed, backed up and confirmed; merge and replacement have separate semantics. Replacement in a synced account must propagate explicit deletions, not let old cloud rows reappear.

## 9. Sync and security contract

- Never remove an outbox mutation before a server acknowledgement. Apply local changes and enqueue them in one IndexedDB transaction. Show local-only, pending, syncing, synced, offline, conflict and failure states accurately.
- Stable mutation IDs plus server uniqueness make retries idempotent. Acknowledge and pull authoritative revisions; Realtime notifications are a refresh signal, not durable delivery.
- Server-assigned revisions and compare-and-swap writes detect conflicts. Preserve both versions of conflicting financial edits and ask the user to resolve; never silently use device-clock last-write-wins. Tombstones prevent stale devices from resurrecting deleted entries.
- Multi-row transfers and consequential balance updates must be one database transaction. Reject inconsistent account ownership/currency and self-transfer.
- Enforce owner_id = auth.uid() RLS for select/insert/update/delete; prevent owner reassignment, test cross-user access and scope goal-cover storage too. Only public Supabase URL/publishable client key belong in the browser; no service-role key.
- Separate local datasets and outboxes by authenticated user. Never upload one user's local data under a different login. Signing out with pending work must preserve it safely and explain the situation.
- Cache the application shell for offline use, not authenticated API responses. Handle worker upgrades and IndexedDB migrations without destroying queued data. Do not promise background synchronization while an iPhone PWA is closed; resume and retry on launch/focus/connectivity recovery.
- Session expiry, auth email flow, redirect URLs, logs, backups and restoration require explicit tests. RLS isolates users but is not end-to-end encryption.

## 10. Phased implementation and acceptance gates

| Phase | Work | Completion evidence |
|---|---|---|
| 1 Audit | Source, invariants, risks, plan | This report; baseline tests; no source/data replacement |
| 2 Design system | React/Vite scaffold alongside legacy; m. identity; semantic color/type/spacing/radius/shadow tokens; EN default + complete ZH catalog for implemented UI; light/dark/system; reduced motion; accessible controls; desktop sidebar/mobile safe-area bottom navigation; runnable Dashboard | Real interactions and fixture/empty/local-derived states clearly identified; 390/768/1440 layouts; theme/language/keyboard checks; Dashboard presented for user confirmation before broad UI rollout |
| 3 Functional migration | Amount/date domain and legacy adapter first; ledger, account, CSV/JSON and legacy goal parity; then editing/search/transfers, budgets, multiple goals and analytics | Characterization and module tests; legacy import/export round trips; no old data deletion; zero unexplained reconciliation differences |
| 4 Cloud | SQL migrations, Auth, RLS, durable outbox, revision protocol, conflict UI, migration receipts, versioned backup/restore | Local Supabase integration tests where available plus a configured test project; two real sessions; create/edit/delete/conflict/offline/retry/auth-isolation tests. Without credentials only implementation/local evidence can be claimed |
| 5 Device/PWA | Manifest/icons/worker, offline shell, safe areas/touch targets, keyboard/focus and update flow | Real macOS Safari and iPhone Safari/Home Screen checks; reconnect/relaunch and device-to-device reconciliation |
| 6 Delivery | Production configuration, documentation, CI, regression/a11y/responsive/sync suite, recovery drill | Complete source, lockfile, env example, SQL/RLS scripts, run/deploy guides, migration/backup guide and explicit passed/failed/unrun report |

Phase 2 comes next after communicating the audit. The user requested Dashboard visual review; present a runnable Dashboard before expanding the full visual redesign. Do not report a mocked sync status as working cloud sync.

## 11. Naming and external prerequisites

The owner confirmed the final Chinese name is 马马记账. Use Morrow in English and 马马记账 in Simplified Chinese. 小满/Xiaoman remain legacy names only. Keep all legacy data identifiers stable regardless of the display-name change.

No further source upload is required if the existing checkout is the intended baseline. If the user edited a local copy, obtain that full HTML or source archive and compare it before migrating. An actual legacy JSON export is needed later for owner-specific migration; provide it securely and avoid logging its contents. Initial tests can use synthetic fixtures.

Phase 2 needs no cloud credentials. A real hosted sync/deployment acceptance test later requires a Supabase project with authorized schema access, configured Auth redirect/email settings, and Vercel/domain configuration. Inspect available bindings then; do not request or place secret values in chat. Native device testing requires access to the actual devices or the owner's test results.

Cloud synchronization is distinct from financial-platform connectivity. Official read-only Alipay/WeChat/bank access remains unimplemented and depends on each provider's available API and access conditions; login to Morrow does not grant it.
