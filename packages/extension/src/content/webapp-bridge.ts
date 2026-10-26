import {
  parseInboundMessage,
  sendSecurePostMessage,
} from '../utils/messaging.js';
import {
  BRIDGE_SOURCE,
  type PongMessage,
  type DataReadyMessage,
  type AuthRequiredMessage,
  type ErrorMessage,
} from '../types/messages.js';

const EXTENSION_VERSION = '1.0.0';

// Announce presence to web dashboard window
function announceReadiness(): void {
  try {
    const targetOrigin = window.location.origin;

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'CHECK_STATUS' }, (response) => {
        // If runtime error or background worker initializing, still report ready
        if (chrome.runtime.lastError) {
          const pong: PongMessage = {
            source: BRIDGE_SOURCE,
            type: 'SW_BRIDGE_PONG',
            payload: {
              version: EXTENSION_VERSION,
              ready: true,
              activeTabDetected: false,
            },
          };
          sendSecurePostMessage(window, targetOrigin, pong);
          return;
        }

        const activeTabDetected = Boolean(response?.activeTabDetected);
        const pong: PongMessage = {
          source: BRIDGE_SOURCE,
          type: 'SW_BRIDGE_PONG',
          payload: {
            version: EXTENSION_VERSION,
            ready: true,
            activeTabDetected,
          },
        };
        sendSecurePostMessage(window, targetOrigin, pong);
      });
    } else {
      const pong: PongMessage = {
        source: BRIDGE_SOURCE,
        type: 'SW_BRIDGE_PONG',
        payload: {
          version: EXTENSION_VERSION,
          ready: true,
          activeTabDetected: false,
        },
      };
      sendSecurePostMessage(window, targetOrigin, pong);
    }
  } catch (err) {
    console.warn('[Shareworks Bridge] Error announcing readiness:', err);
  }
}

// Listen for messages from the Web Dashboard
window.addEventListener('message', (event: MessageEvent) => {
  const message = parseInboundMessage(event);
  if (!message) return;

  const targetOrigin = event.origin;

  if (message.type === 'SW_BRIDGE_PING') {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'CHECK_STATUS' }, (response) => {
        const activeTabDetected = Boolean(response?.activeTabDetected);

        const pong: PongMessage = {
          source: BRIDGE_SOURCE,
          type: 'SW_BRIDGE_PONG',
          payload: {
            version: EXTENSION_VERSION,
            ready: true,
            activeTabDetected,
          },
        };
        sendSecurePostMessage(window, targetOrigin, pong);
      });
    } else {
      const pong: PongMessage = {
        source: BRIDGE_SOURCE,
        type: 'SW_BRIDGE_PONG',
        payload: {
          version: EXTENSION_VERSION,
          ready: true,
          activeTabDetected: false,
        },
      };
      sendSecurePostMessage(window, targetOrigin, pong);
    }
  }

  if (message.type === 'SW_CLEAR_CACHE') {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' });
    }
  }

  if (message.type === 'SW_START_SYNC') {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'START_SYNC' }, (response) => {
        if (response?.error) {
          const errMsg: ErrorMessage = {
            source: BRIDGE_SOURCE,
            type: 'SW_ERROR',
            payload: {
              code: 'SYNC_INITIATION_FAILED',
              message: String(response.error),
            },
          };
          sendSecurePostMessage(window, targetOrigin, errMsg);
        }
      });
    }
  }
});

// Listen for messages pushed from the background service worker
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((runtimeMsg) => {
    if (!runtimeMsg || typeof runtimeMsg !== 'object') return;

    const currentOrigin = window.location.origin;

    if (runtimeMsg.type === 'SW_AUTH_REQUIRED') {
      const authMsg: AuthRequiredMessage = {
        source: BRIDGE_SOURCE,
        type: 'SW_AUTH_REQUIRED',
        payload: runtimeMsg.payload,
      };
      sendSecurePostMessage(window, currentOrigin, authMsg);
    }

    if (runtimeMsg.type === 'SW_DATA_READY') {
      const dataMsg: DataReadyMessage = {
        source: BRIDGE_SOURCE,
        type: 'SW_DATA_READY',
        payload: runtimeMsg.payload,
      };
      sendSecurePostMessage(window, currentOrigin, dataMsg);
    }

    if (runtimeMsg.type === 'SW_ERROR') {
      const errMsg: ErrorMessage = {
        source: BRIDGE_SOURCE,
        type: 'SW_ERROR',
        payload: runtimeMsg.payload,
      };
      sendSecurePostMessage(window, currentOrigin, errMsg);
    }
  });
}

// Announce upon injection
announceReadiness();
