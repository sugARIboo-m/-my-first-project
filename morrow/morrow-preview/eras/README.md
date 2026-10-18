# Morrow Eras — Garden visual-review milestone

The owner approved the Garden visual direction. Collection and Wrapped have since been added as local-data experiences. The current delivery status, limitations and cloud prerequisites are recorded in ../../MORROW_ERAS_DELIVERY.md; the initial Garden notes below describe its foundation.

## What is connected today

- Garden is mounted inside the existing Morrow app, with a desktop Eras entry, a compact mobile Eras entry, a Dashboard summary and animation settings.
- Actual Garden goals live in the new IndexedDB `morrow-garden-v1`, independent from the old `xiaoman-v1` key. Saving resolves only after the IDB transaction completes. Storage errors never silently fall back to volatile data.
- Each goal stores integer minor-unit target/saved amounts, CNY/USD/EUR/GBP currency, theme, target date, pause state, revision and first-full-bloom timestamp/theme. Manually entered savings are not bank-verified funds.
- Saving/editing updates the same record used by the Garden and Dashboard. Stage artwork has no separate financial progress counter. Seed/Sprout/Growing/Blooming/Full Bloom thresholds are 0/25/50/75/100 percent. Invalid targets do not generate NaN/Infinity.
- Goal allocation transfers are atomic, same-currency, idempotent and conserve the combined amount. They never create income or update manually recorded account balances. Paused/imported-total goals cannot transfer. Historical first-bloom memory is retained after withdrawals and preserves its original theme.
- The rest of the Dashboard/ledger remains the previously disclosed in-memory demo. Demo transactions do not grow real Garden goals. There is not yet a persistent, authenticated transaction/account/budget system to link; doing so is a prerequisite for production-wide Eras integration. No real bank, WeChat or Alipay connection exists.
- Target dates are user-chosen dates. A completion forecast is not fabricated when contribution history is insufficient.

## Four themes and original assets

`art.js` generates twenty original SVG assets in `assets/`: each of Eternal Bloom, Pink Pony Garden, Charm Garden and Blue Hour Garden has five distinct growth stages. Assets use no artist portraits, covers, lyrics, audio, logos or remote images.

- Eternal Bloom: lavender, pearl light, cloud ellipses and rounded petals.
- Pink Pony Garden: muted rose/burgundy, quiet spotlights, six-point floral forms.
- Charm Garden: sage/oat, wild daisies and warm natural light; **Intimate, Warm, Effortless**, following the corrected brief.
- Blue Hour Garden: dust-blue dusk, moonlight, rose-gray blooms and a cinematic horizon.

The artwork studio and complete 4×5 contact sheet are labeled nonfinancial samples. Changing a sample stage never changes a goal. Era color variables remain local to Garden artwork/cards; the base app retains Mist Blue and neutral colors. System reduced-motion and an explicit Garden animation setting suppress animation. No wilting, punishments or streak resets exist.

## Backup, restore and legacy compatibility

Garden export is a versioned JSON envelope with the entire local Garden state. Restore/import requires downloading the current backup and an explicit confirmation; the old local state is also captured in the IDB `recovery` store atomically before replacement. Restoration affects only Garden, never the old app's storage.

Import the original Xiaoman JSON file via the UI. The original browser must export it; app source does not contain those records. The importer validates the goal, account values and real calendar dates, then previews original account count, transaction count and savings total. It imports one read-only-balance `legacy-total` goal whose progress preserves the old sum-of-all-savings-accounts rule. It does not replay or mutate transactions/accounts. Original JSON bytes are retained in a receipt and the source file remains with the user. SHA-256 receipt checks prevent exact-file duplicate imports. A second different old backup cannot silently overwrite the first goal.

The user can restore the downloaded pre-import Garden backup to roll back. Recovery snapshots are additionally retained internally; the prototype does not yet expose a snapshot browser. Private backups are not share cards.

Full-bloom memory cards export as PNG without a goal name, money amounts, accounts or notes, and never auto-post. These are per-goal keepsakes, not the unimplemented Collection achievement system.

## Cloud and SQL status

No database, Supabase project, Auth binding or schema previously existed in this repository. `../../supabase/migrations/202610170001_garden_foundation.sql` is a **not-applied Garden-only schema proposal**, in a dedicated namespace. It includes themes, savings goals, goal-theme associations, unique operation IDs, owner RLS and a composite ownership foreign key. The follow-up 202610180001_collection_wrapped.sql adds Collection/Wrapped definitions and owner-isolated storage after visual approval; both migrations remain unapplied.

No SQL server is available in the current environment; SQL/RLS is **unexecuted and unverified**. A configured hosted project must be inspected before applying it. The front end does not yet authenticate, send operations, reconcile remote revisions or retry a remote outbox. Local cross-tab BroadcastChannel refresh and revision conflict detection are implemented; cross-device synchronization is not. Offline-created local records survive reload, but hosted sync/PWA-shell offline installation are not claimed. Production needs Auth, transactional transfer/CAS RPCs, server checks, tombstones, persistent sync queues and cross-user RLS integration tests. Never put service-role credentials in the browser or chat.

## Running and reproducible delivery

From repository root:

```sh
node morrow-preview/eras/generate-assets.mjs
npm run build:preview
npm run preview
npm test
npm run test:preview
```

`index.html` is the module app; generated `morrow.html` is the self-contained app, and `eras-review.html` is the same app opening at Garden. No external fonts/images or runtime packages are needed. Persistent data belongs to a browser and origin; changing hosts, ports, browser or local-file location may change storage scope. Export before switching. Native Mac/iPhone browser storage and locally opened file behavior still require actual-device verification. Do not treat internal workspace file links as published downloadable attachments.

Browser regression commands require Playwright and a Chromium binary, as described in the parent README. `tests/eras-browser.cjs` checks create/edit/reload persistence, stage changes, PNG export, goal-transfer conservation, historical memory, isolation from demo ledger, bilingual mobile layout and persistent reduced-motion settings. Browser API module/system Chromium paths can be supplied through `MORROW_PLAYWRIGHT_MODULE` and `MORROW_CHROMIUM_PATH`.

## Validation at this milestone

- 4 original tests passed.
- 17 preview/domain tests passed, including 11 new Garden tests: thresholds, bad targets, idempotency, historical bloom, conflict rejection, conservation, currency/pause restrictions, migration and SVG coverage.
- Chromium: all 20 artwork samples rendered; no horizontal overflow at 360/390/768/1500 widths; EN/ZH and the visual-review page loaded without JS errors.
- Chromium functional flow: actual locally saved goals survived reload, edit reached Full Bloom, PNG exported, transfer conserved funds, demo transactions left Garden unchanged, and reduced-motion preference survived reload.
- Unrun: native iPhone/macOS Safari, installable PWA, SQL/RLS execution, Supabase cross-device sync, Collection and Wrapped.

Visual approval was received. Collection/Wrapped local implementation and tests are now documented in ../../MORROW_ERAS_DELIVERY.md. Actual cloud integration remains blocked by the absent Supabase project and production financial foundation.
