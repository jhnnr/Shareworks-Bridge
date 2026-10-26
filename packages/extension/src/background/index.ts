// Target domains strictly scoped as per security requirements
const SHAREWORKS_DOMAINS = ['solium.com', 'shareworks.com'];

const EXACT_STATEMENT_QUERY =
  'output_format=HTML&state=run_report&employee_id=414707411010&popupMode=true&embed=true&start_date=&end_date=&date_select=clear_dates&view_as_radio_buttons=view_as_radio_buttons_web&pdf_paper_size=LETTER&statement_type=statement_type_full';

let lastSyncedPortfolio: unknown | null = null;
let currentAuthState: 'AUTHENTICATED' | 'MFA_REQUIRED' | 'DISCONNECTED' = 'DISCONNECTED';

// Query all open Shareworks tabs
async function findShareworksTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const matched = tabs.filter((t) => {
        if (!t.url) return false;
        try {
          const urlObj = new URL(t.url);
          return SHAREWORKS_DOMAINS.some((domain) => urlObj.hostname.endsWith(domain));
        } catch {
          return false;
        }
      });
      resolve(matched);
    });
  });
}

// Forward message to all dashboard webapp tabs (e.g. localhost)
function broadcastToWebDashboard(message: unknown): void {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (
        tab.id &&
        tab.url &&
        (tab.url.startsWith('http://localhost') ||
          tab.url.startsWith('http://127.0.0.1') ||
          tab.url.startsWith('https://localhost') ||
          tab.url.startsWith('https://127.0.0.1') ||
          tab.url.includes('.github.io'))
      ) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script injected yet
        });
      }
    });
  });
}

// Monitor tab updates declaratively to detect navigation away from login/MFA to authenticated views
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;

  try {
    const urlObj = new URL(tab.url);
    const isShareworks = SHAREWORKS_DOMAINS.some((domain) => urlObj.hostname.endsWith(domain));
    if (!isShareworks) return;

    // Check if the tab completed loading
    if (changeInfo.status === 'complete') {
      const path = urlObj.pathname.toLowerCase();
      const isLoginOrMfa =
        path.includes('/login') ||
        path.includes('/auth') ||
        path.includes('/mfa') ||
        path.includes('/signin');

      if (isLoginOrMfa) {
        currentAuthState = 'MFA_REQUIRED';
        broadcastToWebDashboard({
          type: 'SW_AUTH_REQUIRED',
          payload: {
            message: 'User authentication or 2FA required on Shareworks tab.',
            loginUrl: tab.url,
          },
        });
      } else {
        currentAuthState = 'AUTHENTICATED';
        // Trigger extraction in the authenticated Shareworks tab
        chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_NOW' }).catch(() => {
          if (chrome.scripting) {
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['shareworks-bridge.js'],
            }).catch(() => {});
          }
        });
      }
    }
  } catch {
    // Ignore invalid URLs
  }
});

// Refocus web dashboard tab and close Shareworks portal tab upon successful sync
function closeShareworksTabAndFocusDashboard(tabIdToClose?: number): void {
  chrome.tabs.query({}, (tabs) => {
    // 1. Re-focus the web dashboard tab and window
    const dashboardTab = tabs.find(
      (t) =>
        t.url &&
        (t.url.startsWith('http://localhost') ||
          t.url.startsWith('http://127.0.0.1') ||
          t.url.startsWith('https://localhost') ||
          t.url.startsWith('https://127.0.0.1'))
    );

    if (dashboardTab?.id) {
      chrome.tabs.update(dashboardTab.id, { active: true });
      if (dashboardTab.windowId) {
        chrome.windows.update(dashboardTab.windowId, { focused: true });
      }
    }

    // 2. Smoothly close the Shareworks tab
    setTimeout(() => {
      if (tabIdToClose) {
        chrome.tabs.remove(tabIdToClose).catch(() => {});
      } else {
        findShareworksTabs().then((swTabs) => {
          swTabs.forEach((swTab) => {
            if (swTab.id) {
              chrome.tabs.remove(swTab.id).catch(() => {});
            }
          });
        });
      }
    }, 600);
  });
}

// Handle incoming messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== 'object') return false;

  // Status check from webapp bridge or popup
  if (request.action === 'CHECK_STATUS') {
    findShareworksTabs().then((tabs) => {
      sendResponse({
        ready: true,
        activeTabDetected: tabs.length > 0,
        authState: currentAuthState,
        cachedData: lastSyncedPortfolio,
      });
    });
    return true; // Keep response channel open for async response
  }

  // Clear memory and storage caches
  if (request.action === 'CLEAR_CACHE') {
    lastSyncedPortfolio = null;
    currentAuthState = 'DISCONNECTED';
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.clear();
    }
    sendResponse({ cleared: true });
    return false;
  }

  // Request from dashboard to focus or open Shareworks tab
  if (request.action === 'START_SYNC') {
    findShareworksTabs().then((tabs) => {
      const statementUrl = `https://shareworks.solium.com/solium/servlet/userStatement.do?${EXACT_STATEMENT_QUERY}`;

      if (tabs.length > 0 && tabs[0].id) {
        const targetTab = tabs[0];
        const tabId = targetTab.id!;

        // Focus existing tab and window
        chrome.tabs.update(tabId, { active: true });
        if (targetTab.windowId) {
          chrome.windows.update(targetTab.windowId, { focused: true });
        }

        // If tab is not currently on userStatement.do, navigate it directly to the statement
        const isStatementPage = targetTab.url?.includes('userStatement.do');
        if (!isStatementPage) {
          chrome.tabs.update(tabId, { url: statementUrl });
        } else {
          // Send extract command with script injection fallback
          chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_NOW' }).catch(() => {
            if (chrome.scripting) {
              chrome.scripting
                .executeScript({
                  target: { tabId },
                  files: ['shareworks-bridge.js'],
                })
                .then(() => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_NOW' }).catch(() => {});
                  }, 300);
                })
                .catch(() => {});
            }
          });
        }

        // Background watchdog timeout: if tab does not respond in 10 seconds, notify web dashboard
        setTimeout(() => {
          if (!lastSyncedPortfolio) {
            broadcastToWebDashboard({
              type: 'SW_ERROR',
              payload: {
                code: 'PORTAL_RESPONSE_TIMEOUT',
                message:
                  'Shareworks tab did not return equity data. Please ensure you are logged in and on your Holdings or Statement page, then try again.',
              },
            });
          }
        }, 10000);

        sendResponse({ status: 'focusing_existing_tab' });
      } else {
        // Open new tab directly to userStatement.do report
        chrome.tabs.create({ url: statementUrl }, (newTab) => {
          broadcastToWebDashboard({
            type: 'SW_AUTH_REQUIRED',
            payload: {
              message: 'Opened Shareworks statement portal tab. Please sign in and complete 2FA.',
              loginUrl: statementUrl,
            },
          });
          sendResponse({ status: 'opened_new_tab', tabId: newTab.id });
        });
      }
    });
    return true;
  }

  // Intercepted data received from shareworks-bridge.ts
  if (request.type === 'SW_DATA_READY') {
    lastSyncedPortfolio = request.payload;
    currentAuthState = 'AUTHENTICATED';
    broadcastToWebDashboard({
      type: 'SW_DATA_READY',
      payload: request.payload,
    });

    // Automatically close the Shareworks tab and re-focus the dashboard
    closeShareworksTabAndFocusDashboard(sender?.tab?.id);

    sendResponse({ received: true });
    return false;
  }

  // MFA or login challenge detected
  if (request.type === 'SW_AUTH_REQUIRED') {
    currentAuthState = 'MFA_REQUIRED';
    broadcastToWebDashboard({
      type: 'SW_AUTH_REQUIRED',
      payload: request.payload,
    });
    sendResponse({ received: true });
    return false;
  }

  // Error during extraction
  if (request.type === 'SW_ERROR') {
    broadcastToWebDashboard({
      type: 'SW_ERROR',
      payload: request.payload,
    });
    sendResponse({ received: true });
    return false;
  }

  return false;
});
