# Agent Operating Guidelines & Autonomous Workflows

This document outlines roles, operational boundaries, and verification procedures for autonomous AI agents implementing the Shareworks Bridge.

---

## 1. Agent Roles & Specializations

### `frontend-engineer`
* **Domain:** `apps/web`
* **Responsibilities:**
  * Implement dashboard views for grants, vesting milestones, taxable events, and exercise scenarios.
  * Maintain top-level KPI metrics calculating Total Portfolio Value, Total PnL ($), and Return Percentage (%).
  * Maintain the interactive dual-axis `PnlPriceChart` visualizing historical PnL and stock price progression over time.
  * Maintain the `useShareworksBridge` hook listening for `postMessage` protocol events.
  * Handle edge states: extension disconnected, login/MFA in progress, sync active, sync error, empty state, and exact Last Synced timestamp formatting.
  * Support static SPA deployment on GitHub Pages (`base: './'`).
* **Prohibited:** Never write custom scraping logic or browser tab management code inside `apps/web`.

### `extension-engineer`
* **Domain:** `packages/extension`
* **Responsibilities:**
  * Maintain `manifest.json` ensuring adherence to Manifest V3 standards.
  * Maintain declarative tab monitoring in `background.ts` to detect user completion of Shareworks MFA.
  * Maintain `shareworks-interceptor.ts` running in `world: 'MAIN'` to hook `window.fetch` and `XMLHttpRequest` in the page context.
  * Dynamically resolve `employee_id` by querying `/sw-ptpapi/v1/linkedAccount/portfolio` (`accounts.0.userPK + 10`).
  * Implement automated extraction of the full Shareworks statement from `/solium/servlet/userStatement.do`.
  * Automatically focus the web dashboard and close the Shareworks portal tab upon successful synchronization.
  * Maintain `build.js` compiling standalone IIFE scripts (preventing ES module chunk syntax errors in classic content scripts) and syncing `manifest.json` version from root `package.json`.
* **Prohibited:** Never add broad host permissions like `<all_urls>`. Scope permissions strictly to `https://*.solium.com/*` and `https://*.shareworks.com/*`.

### `security-data-auditor`
* **Domain:** Shared / `packages/extension/src/utils`
* **Responsibilities:**
  * Define and validate Zod schemas for intercepted equity structures (including `costBasis`, `holdings`, `grants`, and milestones).
  * Implement and maintain data scrubbers (`assertZeroPii`) ensuring zero personal identifiers (tax IDs, names, employee IDs, addresses, bank accounts) pass across the bridge.
  * Enforce strict origin validation (`isAllowedOrigin`) permitting only local dashboard origins and `https://*.github.io`.
  * Maintain the `SW_CLEAR_CACHE` protocol ensuring local storage and extension background memory are purged on user request.

---

## 2. Standard Operating Procedures (SOPs)

### SOP 01: Implementing a New Extension-to-Web Message
1. Add the message type string to the unified union type in `packages/extension/src/types/messages.ts` and `apps/web/src/types/messages.ts`.
2. Define the Zod schema for the payload and envelope.
3. Update `shareworks-bridge.ts` / `webapp-bridge.ts` to handle and emit the message.
4. Update `useShareworksBridge.ts` in `apps/web` with a type-safe switch/case handler.
5. Write an automated integration test verifying malformed payloads are dropped without crashing the dashboard.

### SOP 02: Mocking Shareworks Data for Local Development
Do not execute live scraping during development iterations to prevent IP rate-limiting and account lockout:
1. Use the fixtures located in `packages/extension/test/fixtures/shareworks-mock-portfolio.json`.
2. Enable development mode via `VITE_USE_MOCK_BRIDGE=true` in `apps/web/.env.example` or click the **Mock: ON** toggle in the dashboard header.
3. The mock adapter simulates login delay (2 seconds), realistic multi-grant models (RSUs, ISOs, ESPP), cost basis, and PnL calculations.

### SOP 03: Extracting Statement Data from `userStatement.do` & `sw-ptpapi`
1. Query `/sw-ptpapi/v1/linkedAccount/portfolio` to obtain `accounts[0].userPK`.
2. Calculate the numeric `employee_id` by adding `10` to `userPK` (`(BigInt(userPK) + 10n).toString()`).
3. Construct the statement request query:
   `output_format=HTML&state=run_report&employee_id=${computedId}&popupMode=true&embed=true&start_date=&end_date=&date_select=clear_dates&view_as_radio_buttons=view_as_radio_buttons_web&pdf_paper_size=LETTER&statement_type=statement_type_full`
4. Parse the returned HTML through `statement-parser.ts`:
   - Extract company name, ticker, and current share price from `Price History Over Statement Period_table` and `Summary of Stock/Shares Holdings_table`.
   - Extract vested/unvested balances and cost basis from `Current Value_table`.
   - Parse individual purchases from `Activity_table` into chronological vesting milestones.
5. Scrub all PII through `sanitizeRawPortfolio` before dispatching `SW_DATA_READY`.

### SOP 04: Versioning, Releasing & Deploying via GitHub Actions
All releases and deployments are automated through `.github/workflows/deploy-release.yml`:
1. Versioning is driven exclusively by the `"version"` field in the root `package.json`.
2. Pushing to `main` automatically:
   - Runs workspace typecheck and automated test suites.
   - Deploys `apps/web` to GitHub Pages.
   - Compiles and zips `packages/extension/dist` into `shareworks-bridge-extension-vX.Y.Z.zip`.
   - Publishes a GitHub Release tagged `vX.Y.Z` with automated git commit logs and full compare diff links (e.g. `https://github.com/<owner>/<repo>/compare/v...`).

---

## 3. Definition of Done (DoD) Checklist
Before any agent declares a feature complete, verify:
- [ ] No `any` types introduced in TypeScript modules.
- [ ] Zod schema validation wraps all raw data extracted from DOM or network intercepts.
- [ ] Origin verification check is present on every `window.addEventListener('message')` listener.
- [ ] Extension builds cleanly under `npm run build --workspace=extension` as self-contained IIFE bundles with zero Manifest V3 linter warnings.
- [ ] Web dashboard builds cleanly under `npm run build --workspace=web`.
- [ ] Automated test suites pass across all workspaces (`npm run test`).
- [ ] No hardcoded authentication tokens, secrets, or test credentials exist in repository files.
