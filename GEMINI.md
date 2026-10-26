# Shareworks Bridge — AI Developer Guide & Architecture Context

## 1. Project Overview & Architecture
Shareworks Bridge is a dual-component client application designed to export and visualize equity holdings from Morgan Stanley Shareworks (formerly Solium).

Because Shareworks enforces strict Content Security Policies (`frame-ancestors 'none'`) and mandatory Multi-Factor Authentication (MFA), this project decouples authentication from automation using a companion browser extension:
1. **Web Dashboard (`/apps/web`)**: A local-first client dashboard (React + TypeScript + Vite) displaying equity grants, vesting schedules, historical PnL, stock price charts, exercise metrics, and valuations. Can be run locally or deployed as a static SPA to GitHub Pages.
2. **Companion Extension (`/packages/extension`)**: A Manifest V3 Chrome extension that acts as a secure data bridge. It opens/monitors the official Shareworks portal, allows the user to log in and satisfy 2FA manually, intercepts authenticated portfolio API responses, parses full account statements (`userStatement.do`), and forwards sanitized JSON payloads to the web dashboard before automatically closing the portal tab.

```text
+-----------------------------+        window.postMessage         +--------------------------+
|        Web Dashboard        | <-------------------------------> | Extension Content Script |
| (localhost & *.github.io)   |        (Origin Validated)         |    (webapp-bridge.ts)    |
+-----------------------------+                                   +--------------------------+
                                                                               ^
                                                                               | chrome.runtime
                                                                               v
+-----------------------------+         MAIN World Hook           +--------------------------+
|      Shareworks Portal      | <-------------------------------- | Main World Interceptor   |
|   (*.solium.com / sw-ptpapi)|   (Hooks window.fetch & XHR)      |(shareworks-interceptor.js|
|                             |                                   +--------------------------+
|                             |         Session-Auth Fetch / DOM               ^
|                             | <--------------------------------              |
|                             |   (statement-parser & userPK)     +--------------------------+
|                             |                                   | Extension Content Script |
|                             |                                   |  (shareworks-bridge.ts)  |
+-----------------------------+                                   +--------------------------+
```

---

## 2. Directory Structure

```text
shareworks-bridge/
├── .github/
│   └── workflows/
│       └── deploy-release.yml       # Deploys dashboard to Pages & releases extension ZIP
├── GEMINI.md                        # Context & design guidelines for Gemini
├── AGENTS.md                        # Multi-agent role definitions & workflows
├── package.json                     # Monorepo workspaces config & SINGLE SOURCE OF TRUTH FOR VERSION
├── apps/
│   └── web/                         # React/Tailwind frontend dashboard
│       ├── index.html
│       ├── src/
│       │   ├── components/
│       │   │   ├── BridgeStatusBanner.tsx
│       │   │   ├── ExerciseScenarioCalculator.tsx
│       │   │   ├── GrantsTable.tsx
│       │   │   ├── Header.tsx
│       │   │   ├── HoldingsSummary.tsx
│       │   │   ├── KpiMetrics.tsx
│       │   │   ├── PnlPriceChart.tsx  # Dual-axis SVG PnL & stock price chart
│       │   │   └── VestingChart.tsx
│       │   ├── hooks/
│       │   │   └── useShareworksBridge.ts
│       │   ├── types/               # Zod schemas for equity data & messages
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── test/
│       │   └── bridge.test.ts
│       └── vite.config.ts           # Configured with base: './' for GitHub Pages
└── packages/
    └── extension/                   # Chrome Manifest V3 extension
        ├── manifest.json            # Scoped host permissions & MAIN world interceptor
        ├── build.js                 # Independent IIFE compiler & manifest version syncer
        ├── src/
        │   ├── background/
        │   │   └── index.ts         # Tab monitoring, watchdog, & auto-close logic
        │   ├── content/
        │   │   ├── shareworks-interceptor.ts # MAIN world fetch & XHR hook
        │   │   ├── shareworks-bridge.ts      # ISOLATED content script for *.solium.com
        │   │   └── webapp-bridge.ts          # Relays messages to/from Web Dashboard
        │   ├── popup/
        │   │   ├── index.html
        │   │   └── popup.ts
        │   ├── types/
        │   │   ├── equity.ts        # Zod schemas for holdings, grants, & costBasis
        │   │   └── messages.ts      # Discriminated union message schemas
        │   └── utils/
        │       ├── messaging.ts     # Origin verification & secure dispatch
        │       ├── sanitizer.ts     # PII scrubber & assertZeroPii validation
        │       └── statement-parser.ts # Full Shareworks statement HTML parser
        ├── test/
        │   ├── fixtures/
        │   │   └── shareworks-mock-portfolio.json
        │   ├── messages.test.ts
        │   ├── sanitizer.test.ts
        │   └── statement-parser.test.ts
        └── vite.config.ts
```

---

## 3. Strict Security & Privacy Guidelines

When generating or refactoring code, adhere to these non-negotiable rules:
* **Zero Credential Handling:** The application must NEVER request, handle, store, or autofill Shareworks passwords or MFA codes. Authentication happens solely in the user-controlled browser tab.
* **Origin Verification:** Content scripts communicating via `window.postMessage` must strictly enforce `isAllowedOrigin(event.origin)` permitting only localhost origins and `https://*.github.io`. Wildcard `*` targets on outgoing messages containing financial data are strictly forbidden.
* **Data Sanitization:** Strip all PII (Social Security numbers, participant names, employee IDs, home addresses, bank routing numbers) inside `sanitizer.ts` and `statement-parser.ts` before forwarding payloads across the bridge. Only equity holdings, grant IDs, grant dates, vesting schedules, share counts, cost basis, and valuations are permitted.
* **Local-First Storage:** Store all synced financial state exclusively in browser-local storage (`IndexedDB` or `localStorage`) on the dashboard side. No remote telemetry, analytics, or external database syncing.
* **Automated Portal Tab Closure:** Once data extraction succeeds, the extension immediately re-focuses the web dashboard and automatically closes the Shareworks tab to minimize open authenticated session exposure.

---

## 4. Message Protocol Specification

All communication between the Web App and the Extension must use this structured format:

| Event Type | Direction | Payload Description |
| :--- | :--- | :--- |
| `SW_BRIDGE_PING` | Web App &rarr; Extension | Healthcheck to verify the extension is installed and listening. |
| `SW_BRIDGE_PONG` | Extension &rarr; Web App | Returns `{ version: string, ready: boolean, activeTabDetected: boolean }`. |
| `SW_START_SYNC` | Web App &rarr; Extension | Requests extension to focus or open the Shareworks portal tab. |
| `SW_CLEAR_CACHE` | Web App &rarr; Extension | Requests extension to purge memory cache and `chrome.storage.local`. |
| `SW_AUTH_REQUIRED` | Extension &rarr; Web App | Emitted when user is redirected to the login/MFA portal. |
| `SW_DATA_READY` | Extension &rarr; Web App | Emitted with validated `{ holdings: Holding[], grants: Grant[], updatedAt: string }`. |
| `SW_ERROR` | Extension &rarr; Web App | Emitted when extraction fails `{ code: string, message: string }`. |

---

## 5. Shareworks DOM & Endpoint Interception Strategy

### Target Domains
* `*.solium.com`
* `*.shareworks.com`

### Extraction Priorities
1. **Direct Statement DOM Parsing (`userStatement.do`):** If the active tab is displaying a Shareworks statement, `statement-parser.ts` extracts holdings, prices, cost basis, and purchase transactions directly from the page DOM.
2. **Session-Authenticated Statement Fetch:**
   - Queries `/sw-ptpapi/v1/linkedAccount/portfolio` to extract `accounts[0].userPK`.
   - Computes `employee_id = (BigInt(userPK) + 10n).toString()`.
   - Fetches `/solium/servlet/userStatement.do?output_format=HTML&state=run_report&employee_id=${employee_id}&popupMode=true&embed=true&start_date=&end_date=&date_select=clear_dates&view_as_radio_buttons=view_as_radio_buttons_web&pdf_paper_size=LETTER&statement_type=statement_type_full`.
   - Parses the HTML statement into structured equity models.
3. **Main-World Network Interception (`shareworks-interceptor.js`):** Hooks `window.fetch` and `XMLHttpRequest` in the page context (`world: "MAIN"`) to capture responses from internal APIs (such as `/sw-ptpapi` and `/solium/api/v1/portfolio/*`).
4. **Generic Fallback Table & Card Parser:** If statement tables are absent, dynamically inspects table headers (`Symbol`, `Company`, `Total Shares`, `Vested`, `Unvested`, `Price`, `Value`, `Grant ID`) across any table on the page.

---

## 6. Coding & Tooling Standards

* **Runtime & Tooling:** Node.js (v20+) using npm workspaces.
* **Single Source of Truth for Versioning:** All releases, Git tags, build zip archives, and extension manifest versions derive exclusively from `"version"` in the root `./package.json`.
* **Content Script Bundling:** Content scripts must be bundled as standalone IIFE scripts via `packages/extension/build.js` to prevent classic content script ES module chunk syntax errors (`Cannot use import statement outside a module`).
* **Language:** TypeScript 5+ in strict mode (`"strict": true`, no `any` types).
* **Validation:** All external payloads intercepted from Shareworks must be parsed and validated through Zod schemas before reaching the UI components.
* **Styling:** Tailwind CSS for the frontend dashboard.
* **CI/CD:** GitHub Actions workflow (`deploy-release.yml`) builds, tests, deploys the web app to GitHub Pages, and publishes release ZIPs with automated commit compare notes.
