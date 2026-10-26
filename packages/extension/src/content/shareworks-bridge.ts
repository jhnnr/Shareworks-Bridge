import { sanitizeRawPortfolio } from '../utils/sanitizer.js';
import { parseShareworksStatement } from '../utils/statement-parser.js';
import type { ShareworksPortfolio, Holding, Grant } from '../types/equity.js';

let cachedInterceptedData: unknown | null = null;
let capturedUserPK: string | number | null = null;

// Listen for intercepted network responses from MAIN world interceptor
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.data?.source === 'shareworks-page-interceptor') {
    const payload = event.data.data;
    if (payload && typeof payload === 'object') {
      cachedInterceptedData = payload;

      // Check if accounts[0].userPK is present in the intercepted payload
      const accounts = (payload as { accounts?: Array<{ userPK?: string | number }> })?.accounts;
      if (Array.isArray(accounts) && accounts[0]?.userPK !== undefined) {
        capturedUserPK = accounts[0].userPK;
      }

      // Proactively try sanitizing and sending if valid
      try {
        const sanitized = sanitizeRawPortfolio(payload);
        if (sanitized.holdings.length > 0 || sanitized.grants.length > 0) {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'SW_DATA_READY',
              payload: sanitized,
            });
          }
        }
      } catch {
        // Not a full portfolio yet, ignore
      }
    }
  }
});

// Detect whether the current page is an MFA or Login challenge
function isAuthenticationPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const isAuthPath =
    path.includes('/login') ||
    path.includes('/auth') ||
    path.includes('/mfa') ||
    path.includes('/signin') ||
    search.includes('mfa=') ||
    search.includes('login');

  const hasLoginForm =
    document.querySelector('input[type="password"]') !== null ||
    document.querySelector('form[action*="login"]') !== null;

  return isAuthPath || hasLoginForm;
}

// Fetch userPK from /sw-ptpapi/v1/linkedAccount/portfolio
async function fetchUserPKFromLinkedAccount(): Promise<string | number | null> {
  if (capturedUserPK !== null && capturedUserPK !== undefined) {
    return capturedUserPK;
  }

  try {
    const res = await fetch('/sw-ptpapi/v1/linkedAccount/portfolio', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
    });

    if (res.ok) {
      const data = await res.json();
      const userPK = data?.accounts?.[0]?.userPK;
      if (userPK !== undefined && userPK !== null) {
        capturedUserPK = userPK;
        return userPK;
      }
    }
  } catch (err) {
    console.warn('[Shareworks Bridge] Error querying linkedAccount/portfolio:', err);
  }

  return null;
}

// Build statement query string given an employee_id
function buildStatementQuery(employeeId: string): string {
  return `output_format=HTML&state=run_report&employee_id=${employeeId}&popupMode=true&embed=true&start_date=&end_date=&date_select=clear_dates&view_as_radio_buttons=view_as_radio_buttons_web&pdf_paper_size=LETTER&statement_type=statement_type_full`;
}

// Fetch userStatement.do HTML directly using active session cookies and dynamic employee_id
async function fetchUserStatementHtml(): Promise<ShareworksPortfolio | null> {
  // 1. Obtain userPK from /sw-ptpapi/v1/linkedAccount/portfolio
  const userPK = await fetchUserPKFromLinkedAccount();

  const employeeIdCandidates: string[] = [];

  if (userPK !== null && userPK !== undefined) {
    try {
      // Add 10 to numeric userPK as requested
      const numericPlus10 = (BigInt(userPK) + 10n).toString();
      employeeIdCandidates.push(numericPlus10);
    } catch {
      const num = Number(userPK);
      if (!isNaN(num)) {
        employeeIdCandidates.push(String(num + 10));
      }
    }

    // Also support string appending '10' if different
    const appended = `${userPK}10`;
    if (!employeeIdCandidates.includes(appended)) {
      employeeIdCandidates.push(appended);
    }
  }

  // Check URL query parameters
  const currentParams = new URLSearchParams(window.location.search);
  const currentEmpId = currentParams.get('employee_id');
  if (currentEmpId && !employeeIdCandidates.includes(currentEmpId)) {
    employeeIdCandidates.push(currentEmpId);
  }

  // Fallback candidate
  if (!employeeIdCandidates.includes('414707411010')) {
    employeeIdCandidates.push('414707411010');
  }

  for (const empId of employeeIdCandidates) {
    const query = buildStatementQuery(empId);
    const url = `/solium/servlet/userStatement.do?${query}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
        },
        credentials: 'same-origin',
      });

      if (response.ok) {
        const html = await response.text();
        if (
          html.includes('Summary of Stock/Shares Holdings_table') ||
          html.includes('Current Value_table')
        ) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const portfolio = parseShareworksStatement(doc);
          if (portfolio) {
            return portfolio;
          }
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

// Extraction Priority 2: Session-authenticated fetch to internal Shareworks endpoints
async function fetchPortfolioFromApi(): Promise<unknown | null> {
  const endpoints = [
    '/solium/api/v1/portfolio/accounts/default/holdings',
    '/solium/api/v1/portfolio/accounts/default/grants',
    '/solium/api/v1/portfolio/holdings',
    '/solium/api/v1/portfolio/grants',
    '/solium/api/v1/portfolio/summary',
    '/solium/api/v1/equity/summary',
    '/api/v1/equity/portfolio',
    '/api/v1/portfolio',
  ];

  // Try querying account IDs if available
  try {
    const accRes = await fetch('/solium/api/v1/portfolio/accounts', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    });
    if (accRes.ok) {
      const accData = await accRes.json();
      const accounts = Array.isArray(accData) ? accData : accData?.accounts;
      if (Array.isArray(accounts)) {
        for (const acc of accounts) {
          const accId = acc.id || acc.accountId;
          if (accId) {
            endpoints.unshift(`/solium/api/v1/portfolio/accounts/${accId}/holdings`);
            endpoints.unshift(`/solium/api/v1/portfolio/accounts/${accId}/grants`);
          }
        }
      }
    }
  } catch {
    // Continue with static endpoints
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object') {
          if (data.holdings || data.grants || data.items || Array.isArray(data)) {
            return data;
          }
        }
      }
    } catch {
      // Continue to next endpoint or fallback
    }
  }

  return null;
}

// Dynamic header-driven generic DOM table parser
function parseGenericPortfolioFromDom(): unknown | null {
  const tables = Array.from(document.querySelectorAll('table'));
  if (tables.length === 0) return null;

  const foundHoldings: Holding[] = [];
  const foundGrants: Grant[] = [];

  for (const table of tables) {
    const headerCells = Array.from(table.querySelectorAll('th, thead td'));
    const headers: string[] = headerCells.map((th) =>
      (th.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    if (headers.length === 0) continue;

    // Build column index lookup
    const findCol = (keywords: string[]) =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    const colSymbol = findCol(['symbol', 'ticker', 'security', 'stock']);
    const colCompany = findCol(['company', 'issuer']);
    const colTotal = findCol(['totalshares', 'sharesgranted', 'quantity', 'units', 'shares']);
    const colVested = findCol(['vestedshares', 'vested', 'sharesvested']);
    const colUnvested = findCol(['unvestedshares', 'unvested', 'sharesunvested']);
    const colPrice = findCol(['price', 'marketprice', 'grantprice', 'strikeprice']);
    const colValue = findCol(['marketvalue', 'totalvalue', 'value', 'currentvalue']);
    const colGrantId = findCol(['grantid', 'grantnumber', 'grantno', 'grant', 'awardid']);
    const colGrantDate = findCol(['grantdate', 'awarddate', 'date']);
    const colGrantType = findCol(['granttype', 'awardtype', 'plan', 'type']);
    const colStatus = findCol(['status', 'state']);

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const cells = Array.from(row.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
      if (cells.length < 2) continue;

      const parseNum = (idx: number) =>
        idx >= 0 && idx < cells.length ? parseFloat(cells[idx].replace(/[^0-9.-]/g, '') || '0') : 0;

      // Check if row is a Grant
      if (colGrantId >= 0 || colGrantType >= 0) {
        const grantId = colGrantId >= 0 ? cells[colGrantId] : `GRANT-${rIdx + 1}`;
        const rawType = colGrantType >= 0 ? cells[colGrantType].toUpperCase() : 'RSU';
        const grantType: 'RSU' | 'ISO' | 'NSO' | 'ESPP' =
          rawType.includes('ISO') ? 'ISO' : rawType.includes('ESPP') ? 'ESPP' : rawType.includes('NSO') ? 'NSO' : 'RSU';
        const totalShares = parseNum(colTotal);
        const vestedShares = parseNum(colVested);
        const unvestedShares = colUnvested >= 0 ? parseNum(colUnvested) : Math.max(0, totalShares - vestedShares);
        const marketValue = parseNum(colValue);
        const exercisePrice = colPrice >= 0 ? parseNum(colPrice) : null;

        if (totalShares > 0 || marketValue > 0) {
          foundGrants.push({
            grantId: grantId || `GRANT-${rIdx + 1}`,
            grantDate: colGrantDate >= 0 ? cells[colGrantDate] || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            grantType,
            status: colStatus >= 0 && cells[colStatus].toLowerCase().includes('vested') ? 'FULLY_VESTED' : 'ACTIVE',
            totalGrantedShares: totalShares,
            vestedShares,
            unvestedShares,
            exercisePrice,
            marketValue,
            vestingSchedule: [],
          });
        }
      }

      // Check if row is a Holding
      if (colTotal >= 0 && (colSymbol >= 0 || colCompany >= 0 || colValue >= 0)) {
        const totalShares = parseNum(colTotal);
        const vestedShares = colVested >= 0 ? parseNum(colVested) : totalShares;
        const unvestedShares = colUnvested >= 0 ? parseNum(colUnvested) : Math.max(0, totalShares - vestedShares);
        const currentPrice = parseNum(colPrice);
        const totalValue = colValue >= 0 ? parseNum(colValue) : totalShares * currentPrice;

        if (totalShares > 0 || totalValue > 0) {
          foundHoldings.push({
            symbol: colSymbol >= 0 ? cells[colSymbol] || 'STOCK' : 'STOCK',
            companyName: colCompany >= 0 ? cells[colCompany] || 'Company Equity' : 'Company Equity',
            totalShares,
            vestedShares,
            unvestedShares,
            currency: 'USD',
            currentPrice: currentPrice || (totalShares > 0 ? totalValue / totalShares : 0),
            totalValue,
          });
        }
      }
    }
  }

  if (foundHoldings.length === 0 && foundGrants.length === 0) {
    return null;
  }

  return {
    holdings: foundHoldings,
    grants: foundGrants,
    updatedAt: new Date().toISOString(),
  };
}

// Execute portfolio extraction and notify extension
async function executeExtraction(): Promise<void> {
  if (isAuthenticationPage()) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SW_AUTH_REQUIRED',
        payload: {
          message: 'Shareworks authentication or MFA verification in progress.',
          loginUrl: window.location.href,
        },
      });
    }
    return;
  }

  try {
    // 1. Direct Statement DOM Extraction (matches userStatement.do if tab is already on statement)
    let directPortfolio = parseShareworksStatement(document);
    if (directPortfolio) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SW_DATA_READY',
          payload: directPortfolio,
        });
      }
      return;
    }

    // 2. Fetch userStatement.do HTML via session cookies with dynamic userPK+10
    directPortfolio = await fetchUserStatementHtml();
    if (directPortfolio) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SW_DATA_READY',
          payload: directPortfolio,
        });
      }
      return;
    }

    // 3. Try cached network intercept from page
    let rawData: unknown | null = cachedInterceptedData;

    // 4. Try session-authenticated API fetch
    if (!rawData) {
      rawData = await fetchPortfolioFromApi();
    }

    // 5. Fall back to generic DOM parsing
    if (!rawData) {
      rawData = parseGenericPortfolioFromDom();
    }

    // 6. If nothing was detected, send explicit error so dashboard does not hang
    if (!rawData) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SW_ERROR',
          payload: {
            code: 'NO_PORTFOLIO_DETECTED',
            message:
              'Connected to Shareworks, but could not detect portfolio data on the current page. Please ensure you are logged in and navigate to Statements or your Holdings summary page in Shareworks, then click Sync Now again.',
          },
        });
      }
      return;
    }

    // Sanitize and scrub PII before sending
    const sanitizedPortfolio: ShareworksPortfolio = sanitizeRawPortfolio(rawData);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SW_DATA_READY',
        payload: sanitizedPortfolio,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown extraction error';
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SW_ERROR',
        payload: {
          code: 'EXTRACTION_ERROR',
          message: errorMsg,
        },
      });
    }
  }
}

// Observe URL / state changes on Single Page Applications (SPA)
function initializeWatcher(): void {
  // Initial check
  executeExtraction();

  // Listen for background trigger
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.action === 'EXTRACT_NOW') {
        executeExtraction().then(() => sendResponse({ status: 'done' }));
        return true; // Keep message channel open for async response
      }
      return false;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWatcher);
} else {
  initializeWatcher();
}
