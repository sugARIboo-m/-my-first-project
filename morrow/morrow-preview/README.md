# Morrow / 马马记账 — interactive Dashboard preview

This additive visual prototype leaves the legacy app and xiaoman-v1 storage untouched. It uses plain HTML/CSS/native modules for a reviewable preview, not the final React/TypeScript architecture. No dependency installation is required.

Run from this folder:

```sh
python3 -m http.server 3010 --bind 127.0.0.1
```

This is a local development server, not a public deployment. Do not infer a public preview URL from it.

Preview interactions: EN/ZH toggle, system/light/dark appearance, month selection, search by name/note/category/account, income/expense and category filters, account-summary dialog, create/edit transactions with calendar date/payment account/note, confirmed deletion with cancellation returning to the unsaved edit draft. Cmd/Ctrl+K opens a transaction and `/` focuses search. Navigation tracks the current section. Errors appear beside the form, with accessible invalid-field markers.

Changes recompute monthly metrics, category distribution and six-month charts. Cross-month edits update both months, zero-spending states are supported, and manual savings balances do not change. Amounts are integer minor units with exact decimal parsing and overflow checks; calendar dates are formatted without timezone shifts. Monthly fictional history includes earlier transactions beyond the recent rows, with those rows excluded from the history baseline to avoid double-counting.

Reload resets ledger demo changes and base language/theme preferences. A visible banner communicates this. The original illustrative account balances and sample goals are not bank connections. Eras Garden is now an additive, locally persisted real-goal module; its saved goals and motion preference survive reload. See [Garden scope and validation](eras/README.md). Garden goal-allocation transfers do not affect income or assets. Budget editing, persistent authenticated ledger/accounts and real cloud synchronization remain unimplemented. The old Xiaoman storage is not read or written automatically; optional JSON goal import requires explicit review and backup.

## Single-file delivery and commands

The module sources are authoritative. `morrow.html` is generated, not independently maintained; it embeds all CSS, translation catalogs, domain logic and interaction code with no imports or external resources. Regenerate after changes:

```sh
# From repository root:
npm run build:preview
npm run test:preview
npm test
npm run preview
```

The standalone can be opened in a modern browser on Mac without Node, Python, installation or an HTTP server. Local `file:` navigation is restricted in the managed testing browser; the actual standalone code is tested over HTTP with no dependent assets. Native Mac Safari opening still requires user/device verification. Do not present cloud workspace links as confirmed downloadable chat attachments.

## Validation

The unit/domain suite now contains 27 tests covering original finance rules, Garden, Collection, Wrapped and safe metadata migration. The four original legacy tests remain separate and pass. See ../MORROW_ERAS_DELIVERY.md for the current scope and unimplemented production dependencies.

`tests/browser.cjs` is a reusable Chromium smoke test. It requires Playwright (validated with 1.62.1) and an installed Chromium browser in the test environment; these are test prerequisites, not app runtime dependencies. With Playwright available and the server running, execute `node morrow-preview/tests/browser.cjs` from repository root. Optional configuration: `MORROW_PREVIEW_URL`, `MORROW_PREVIEW_ENTRY` (`morrow.html` or `index.html`), `MORROW_PLAYWRIGHT_MODULE` (module path) and `MORROW_CHROMIUM_PATH` (system Chromium path). Screenshots go to a new temporary folder per run.

Browser checks: 360/390/768/1440 widths, EN/ZH, light/dark, inline validation, date/account/note entry, search/category filters, cross-month and income/expense edits, delete/cancel, unchanged savings balances, empty states, keyboard shortcuts, reset after reload and no JavaScript errors. No real-device Safari/PWA validation, persistent migration, Supabase or production deployment is claimed.

The original application remains at ../index.html. The owner accepted the initial visual direction; this pass refines interactions while keeping the legacy implementation and storage separate.
