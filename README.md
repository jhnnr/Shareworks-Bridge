# Shareworks Bridge

> **Secure, local-first bridge and dashboard for Morgan Stanley Shareworks equity holdings, vesting schedules, and exercise modeling.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local--First-10B981)](#security--privacy-guarantees)

---

## Table of Contents

- [Overview](#overview)
  - [Why Shareworks Bridge?](#why-shareworks-bridge)
  - [How It Works](#how-it-works)
- [Core Features](#core-features)
- [Architecture & Data Flow](#architecture--data-flow)
- [Security & Privacy Guarantees](#security--privacy-guarantees)
- [Message Protocol Specification](#message-protocol-specification)
- [Repository Structure](#repository-structure)
- [Getting Started & Development](#getting-started--development)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Web Dashboard](#running-the-web-dashboard)
  - [Building & Installing the Chrome Extension](#building--installing-the-chrome-extension)
  - [Running Tests & Typechecking](#running-tests--typechecking)
  - [Mock / Demo Mode](#mock--demo-mode)
- [User Walkthrough](#user-walkthrough)
- [Disclaimer](#disclaimer)

---

## Overview

### Why Shareworks Bridge?

Morgan Stanley Shareworks (formerly Solium) is widely used by companies to manage employee equity (RSUs, ISOs, NSOs, ESPP). However, exporting and monitoring equity data from Shareworks poses significant technical hurdles:

1. **No Public Personal API:** Shareworks does not provide public REST/GraphQL APIs for personal equity tracking.
2. **Strict Content Security Policy (CSP):** The portal enforces `frame-ancestors 'none'`, prohibiting iframes or embedded viewers.
3. **Mandatory Multi-Factor Authentication (MFA):** Automated background scraping is blocked by multi-step login challenges and SMS/authenticator prompts.
4. **Data Fragmentation:** Crucial financial information (tax cost basis, future vesting dates, historical purchases, and current valuations) is distributed across multiple sub-pages and dynamic reports.

### How It Works

**Shareworks Bridge** solves this challenge by decoupling **authentication** from **data extraction**:

- **Web Dashboard (`apps/web`):** A modern, responsive React 19 application running locally or statically on GitHub Pages. It renders portfolio analytics, vesting projections, interactive PnL charts, and exercise tax modeling.
- **Companion Extension (`packages/extension`):** A secure Manifest V3 browser extension. It opens or navigates to the official Shareworks portal, allows you to authenticate and complete MFA naturally, intercepts authenticated portfolio API responses, fetches the official statement report (`userStatement.do`), scrubs all personally identifiable information (PII), transmits sanitized equity data to the dashboard, and automatically closes the portal tab to minimize session exposure.

---

## Core Features

### 📊 Comprehensive Executive Dashboard
- **Top-Level KPI Metrics:** Instant display of **Total Portfolio Value**, **Total Cost Basis**, **Net PnL ($)**, **Return Percentage (%)**, and **Vested vs. Unvested** distribution.
- **Holdings Summary:** Real-time summary by equity instrument, share price, currency, vested shares, and total valuation.

### 📈 Interactive Dual-Axis PnL & Price Chart
- Custom SVG visualization comparing historical equity value, cost basis, cumulative profit/loss, and stock price over time.
- Interactive hover tooltips inspecting individual historical milestone dates and valuations.
- Metric toggle filters: **Both (PnL & Price)**, **PnL ($)**, **PnL (%)**, or **Stock Price ($)**.

### 🗓️ Grants Breakdown & Vesting Schedule
- **Multi-Grant Support:** Handles RSUs, ISOs, NSOs, and ESPP plans.
- **Chronological Milestones:** Visual schedule of past and upcoming vesting tranches with projected values and remaining share counts.
- **Status Badges & Progress Bars:** Visual vesting progress tracked per grant.

### 🧮 Option Exercise Scenario Calculator
- Model ISO and NSO stock option exercises before execution.
- Configurable inputs for **Number of Options to Exercise**, **Target Stock Price**, and **Estimated Tax Bracket (%)**.
- Computes **Total Exercise Cost**, **Gross Spread**, **Estimated Tax Liability**, and **Net Estimated Gain**.

### 🔒 Local-First & Zero-PII
- Credentials are never seen, stored, or processed by the application.
- All personal identifiers (SSNs, names, employee IDs, addresses) are scrubbed before reaching the UI.
- All equity state is saved exclusively in browser-local storage (`localStorage`). No cloud databases or tracking servers.

### 🧪 Built-In Mock Mode
- Test and explore the dashboard immediately with realistic sample portfolios (multi-grant RSUs, ISOs, ESPP) without logging into Shareworks.

---

## Architecture & Data Flow

```text
+-------------------------------------------------------------------------------+
|                                  USER BROWSER                                 |
|                                                                               |
|  +----------------------------+             +-------------------------------+ |
|  |       Web Dashboard        |             |   Companion Extension (MV3)   | |
|  |        (apps/web)          |             |     (packages/extension)      | |
|  |                            |             |                               | |
|  |  * React 19 + TypeScript   |             |  * Background Service Worker  | |
|  |  * Tailwind CSS            |             |  * Declarative Tab Watchdog   | |
|  |  * SVG PnL Charts          |             |  * Isolated Content Scripts   | |
|  |  * Scenario Calculator     |             |  * Popup Status Monitor       | |
|  +----------------------------+             +-------------------------------+ |
|                ^                                            ^                 |
|                |                                            |                 |
|                | window.postMessage (Origin Validated)      | chrome.runtime  |
|                v                                            v                 |
|  +----------------------------+             +-------------------------------+ |
|  |       webapp-bridge.js     | <---------> |      background.js (Worker)   | |
|  |   (Content Script on Web)  |             +-------------------------------+ |
|  +----------------------------+                             ^                 |
|                                                             |                 |
|                                                             v                 |
|                                             +-------------------------------+ |
|                                             |     shareworks-bridge.js      | |
|                                             |  (Content Script on Solium)   | |
|                                             +-------------------------------+ |
|                                                             ^                 |
|                                                             | window.postMsg  |
|                                                             v                 |
|  +-------------------------------------+    +-------------------------------+ |
|  |     Shareworks / Solium Portal      | <- |  shareworks-interceptor.js    | |
|  |  * User completes Login / MFA       |    |  * MAIN Execution World       | |
|  |  * Authenticated userStatement.do   |    |  * Hooks window.fetch & XHR   | |
|  |  * /sw-ptpapi/v1/linkedAccount      |    +-------------------------------+ |
|  +-------------------------------------+                                      |
+-------------------------------------------------------------------------------+
```

### Data Pipeline Sequence

1. **Handshake:** The web dashboard pings `webapp-bridge.js` via `window.postMessage` (`SW_BRIDGE_PING`). The extension responds with status (`SW_BRIDGE_PONG`).
2. **Trigger:** User clicks **Start Shareworks Sync** on the dashboard (`SW_START_SYNC`).
3. **Portal Monitoring:** The background service worker finds or launches a Shareworks tab (`*.solium.com` / `*.shareworks.com`).
4. **User Auth:** User logs in and passes MFA directly on the official Shareworks site.
5. **Interception & Extraction:**
   - `shareworks-interceptor.js` (running in the page's `MAIN` world) intercepts authenticated portfolio queries and captures `accounts[0].userPK`.
   - `shareworks-bridge.js` computes `employee_id = (BigInt(userPK) + 10n).toString()` and fetches the complete official account statement from `/solium/servlet/userStatement.do`.
   - `statement-parser.ts` parses the HTML statement, aggregating stock price, holdings, cost basis, and vesting schedules.
6. **PII Scrubbing:** `sanitizer.ts` strips all names, employee IDs, and sensitive data via strict Zod validation (`assertZeroPii`).
7. **Delivery & Auto-Close:** The extension broadcasts `SW_DATA_READY` to the web dashboard, focuses the dashboard tab, and automatically closes the authenticated Shareworks tab.

---

## Security & Privacy Guarantees

Security and personal privacy are foundational architectural requirements:

| Guarantee | Implementation Detail |
| :--- | :--- |
| **Zero Credential Access** | The application never prompts for, reads, stores, or transmits your Morgan Stanley credentials, passwords, or 2FA codes. All authentication occurs directly on the official Morgan Stanley portal. |
| **Zero PII Transmission** | The sanitizer strictly strips participant names, addresses, Social Security numbers, employee IDs, and banking information. The bridge payload strictly passes financial amounts, share counts, vesting dates, and ticker symbols. |
| **Strict Origin Validation** | Content scripts communicating across `window.postMessage` validate `event.origin` against strict origin allowlists (`localhost`, `127.0.0.1`, and `https://*.github.io`). Wildcard targets (`*`) for financial payloads are blocked. |
| **Minimal Extension Permissions** | Host permissions in `manifest.json` are strictly scoped to `https://*.solium.com/*` and `https://*.shareworks.com/*`. No broad `<all_urls>` permission. |
| **Local-First Storage** | Portfolio data is stored purely in the user's browser `localStorage`. No telemetry, analytics tracking, or remote database synchronization. |
| **Automatic Session Cleanup** | Upon completing extraction, the extension immediately re-focuses your dashboard and closes the Shareworks browser tab, minimizing authenticated session exposure. |

---

## Message Protocol Specification

All communication between the Web Dashboard and the Companion Extension uses strongly typed, schema-validated messages:

| Event Type | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `SW_BRIDGE_PING` | Web App &rarr; Extension | `{ timestamp: number }` | Heartbeat to check if extension is installed and active. |
| `SW_BRIDGE_PONG` | Extension &rarr; Web App | `{ version: string, ready: boolean, activeTabDetected: boolean }` | Acknowledges presence and current extension readiness. |
| `SW_START_SYNC` | Web App &rarr; Extension | `{}` | Requests extension to focus or open the Shareworks portal tab. |
| `SW_AUTH_REQUIRED` | Extension &rarr; Web App | `{ message: string, loginUrl?: string }` | Emitted when user must complete login or MFA challenge. |
| `SW_DATA_READY` | Extension &rarr; Web App | `{ holdings: Holding[], grants: Grant[], updatedAt: string }` | Dispatches sanitized, validated equity portfolio payload. |
| `SW_CLEAR_CACHE` | Web App &rarr; Extension | `{}` | Purges local extension memory and cached session state. |
| `SW_ERROR` | Extension &rarr; Web App | `{ code: string, message: string }` | Dispatched if statement retrieval or parsing fails. |

---

## Repository Structure

```text
shareworks-bridge/
├── .github/
│   └── workflows/
│       └── deploy-release.yml       # Automated GitHub Pages deploy & extension release packaging
├── apps/
│   └── web/                         # React 19 Frontend Web Dashboard
│       ├── src/
│       │   ├── components/
│       │   │   ├── BridgeStatusBanner.tsx        # Extension connection & sync status bar
│       │   │   ├── ExerciseScenarioCalculator.tsx # Stock option exercise & tax calculator
│       │   │   ├── GrantsTable.tsx               # Detailed grants & vesting schedules
│       │   │   ├── Header.tsx                    # Top navigation, sync action, and mock toggle
│       │   │   ├── HoldingsSummary.tsx           # Company shares & value summary cards
│       │   │   ├── KpiMetrics.tsx                # Portfolio value, cost basis, and PnL metrics
│       │   │   ├── PnlPriceChart.tsx             # Interactive dual-axis SVG chart
│       │   │   └── VestingChart.tsx              # Vesting milestone timeline view
│       │   ├── hooks/
│       │   │   └── useShareworksBridge.ts        # React hook handling postMessage protocol
│       │   ├── types/
│       │   │   ├── equity.ts                     # Zod equity schemas (Holding, Grant, Portfolio)
│       │   │   └── messages.ts                   # Protocol message contracts
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── test/
│       │   └── bridge.test.ts                    # Web bridge and schema safety tests
│       ├── vite.config.ts                       # Configured with base: './' for GitHub Pages
│       └── package.json
├── packages/
│   └── extension/                   # Manifest V3 Chrome Companion Extension
│       ├── manifest.json            # Extension manifest with scoped permissions
│       ├── build.js                 # Standalone IIFE builder for content scripts
│       ├── src/
│       │   ├── background/
│       │   │   └── index.ts         # Service worker tab watcher, state, and auto-close
│       │   ├── content/
│       │   │   ├── shareworks-interceptor.ts # MAIN execution world fetch & XHR interceptor
│       │   │   ├── shareworks-bridge.ts      # Solium tab content script & statement fetcher
│       │   │   └── webapp-bridge.ts          # Web app content script & postMessage relay
│       │   ├── popup/
│       │   │   ├── index.html       # Extension popup UI
│       │   │   └── popup.ts
│       │   ├── types/
│       │   │   ├── equity.ts        # Zod equity schemas
│       │   │   └── messages.ts      # Shared protocol message types
│       │   └── utils/
│       │       ├── messaging.ts     # Origin verification & postMessage utilities
│       │       ├── sanitizer.ts     # Zero-PII scrubbing & validation logic
│       │       └── statement-parser.ts # Full Shareworks statement HTML parser
│       ├── test/
│       │   ├── fixtures/
│       │   │   └── shareworks-mock-portfolio.json # Offline mock equity fixture
│       │   ├── messages.test.ts
│       │   ├── sanitizer.test.ts
│       │   └── statement-parser.test.ts
│       └── package.json
├── AGENTS.md                        # Autonomous AI agent operating guidelines
├── GEMINI.md                        # Architectural context & engineering standards
├── package.json                     # Root monorepo workspace & single source of truth for version
└── tsconfig.json
```

---

## Getting Started & Development

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Browser**: Google Chrome, Brave, Microsoft Edge, or any Chromium-based browser

### Installation

Clone the repository and install all workspace dependencies:

```bash
git clone https://github.com/JohnnyH/Shareworks-Bridge.git
cd Shareworks-Bridge
npm install
```

### Running the Web Dashboard

Start the Vite development server for the web app:

```bash
npm run dev:web
```

The web dashboard will be available at:
```text
http://localhost:5173
```

### Building & Installing the Chrome Extension

Compile the companion extension into standalone IIFE bundles:

```bash
npm run build:ext
```

The compiled extension will be output to `packages/extension/dist`.

#### Load the Extension into Chrome:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** on (top-right corner).
3. Click the **Load unpacked** button (top-left corner).
4. Select the `packages/extension/dist` folder from this repository.
5. The **Shareworks Bridge** extension icon will appear in your extensions toolbar.

*(For active extension development with automatic rebuilding, run `npm run dev --workspace=extension`)*.

### Running Tests & Typechecking

Run automated Vitest suites across both workspaces:

```bash
npm test
```

Perform strict TypeScript typechecking:

```bash
npm run typecheck
```

Build all workspaces for production:

```bash
npm run build
```

### Mock / Demo Mode

You can run the web dashboard without needing the extension or a live Shareworks account:

1. **Option A (UI Toggle):** Open the dashboard and click the **Mock: OFF** button in the header (or click **Load Demo Equity Portfolio** in the empty state).
2. **Option B (Environment Variable):** Create `apps/web/.env.local`:
   ```bash
   VITE_USE_MOCK_BRIDGE=true
   ```

Mock mode simulates multi-grant RSUs, ISOs, ESPP purchases, realistic cost bases, and vesting timelines.

---

## User Walkthrough

1. **Launch the Dashboard:** Open `http://localhost:5173` (or the deployed GitHub Pages URL).
2. **Connect the Extension:** Ensure the extension is loaded in Chrome. The header indicator will change to **Bridge Connected**.
3. **Initiate Sync:** Click **Start Shareworks Sync**.
4. **Authenticate:** If not already logged into Shareworks, the extension brings up the Shareworks login tab. Enter your credentials and complete 2FA.
5. **Automatic Processing:** Once authenticated, the extension extracts the statement, cleanses personal data, forwards the portfolio to your dashboard, and automatically closes the portal tab.
6. **Analyze Holdings:**
   - Review your **Total Portfolio Value** and **Net Return**.
   - Track your growth trajectory in the **Historical PnL & Stock Price** chart.
   - Inspect upcoming vesting dates in the **Grants & Vesting** tab.
   - Experiment with potential exit prices and tax rates in the **Exercise Scenario Calculator**.

---

## Disclaimer

*Shareworks Bridge is an independent, open-source project and is not affiliated with, endorsed by, or sponsored by Morgan Stanley, Solium Capital, or any of their affiliates. "Shareworks" and "Solium" are registered trademarks of Morgan Stanley. This software is provided for personal financial tracking and visualization purposes only and does not constitute financial, investment, or tax advice.*
