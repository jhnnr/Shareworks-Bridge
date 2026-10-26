import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type ShareworksPortfolio,
  ShareworksPortfolioSchema,
} from '../types/equity';
import {
  BRIDGE_SOURCE,
  BridgeMessageSchema,
  type PongPayload,
} from '../types/messages';

const STORAGE_KEY = 'shareworks_portfolio_local_cache';

export interface UseShareworksBridgeState {
  portfolio: ShareworksPortfolio | null;
  isExtensionConnected: boolean;
  isSyncing: boolean;
  isAuthRequired: boolean;
  authMessage: string | null;
  syncError: string | null;
  lastUpdated: string | null;
  isMockMode: boolean;
  startSync: () => void;
  clearCache: () => void;
  toggleMockMode: () => void;
}

export function useShareworksBridge(): UseShareworksBridgeState {
  const [portfolio, setPortfolio] = useState<ShareworksPortfolio | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const result = ShareworksPortfolioSchema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
      }
    } catch {
      // LocalStorage error or corrupted cache
    }
    return null;
  });

  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAuthRequired, setIsAuthRequired] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initialize mock mode from environment or local toggle
  const [isMockMode, setIsMockMode] = useState<boolean>(() => {
    return import.meta.env.VITE_USE_MOCK_BRIDGE === 'true';
  });

  const pingIntervalRef = useRef<number | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  // Save portfolio to local storage whenever it updates, and remove when null
  useEffect(() => {
    if (portfolio) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
      } catch (err) {
        console.warn('Failed to save portfolio to local storage:', err);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignored
      }
    }
  }, [portfolio]);

  // Ping the extension companion script
  const pingExtension = useCallback(() => {
    if (isMockMode) {
      setIsExtensionConnected(true);
      return;
    }

    if (typeof window !== 'undefined') {
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: 'SW_BRIDGE_PING',
        },
        window.location.origin
      );
    }
  }, [isMockMode]);

  // Handle incoming postMessage events with strict origin verification
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Mandatory Origin check
      const isAllowedOrigin =
        event.origin === window.location.origin ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(event.origin);

      if (!isAllowedOrigin) {
        return;
      }

      // 2. Filter non-object data
      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      // 3. Validate envelope schema
      const parseResult = BridgeMessageSchema.safeParse(event.data);
      if (!parseResult.success) {
        return;
      }

      const message = parseResult.data;

      // 4. Type-safe switch/case handler
      switch (message.type) {
        case 'SW_BRIDGE_PONG': {
          const payload = message.payload as PongPayload;
          setIsExtensionConnected(payload.ready);
          break;
        }

        case 'SW_AUTH_REQUIRED': {
          if (syncTimeoutRef.current) {
            window.clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
          }
          setIsSyncing(false);
          setIsAuthRequired(true);
          setAuthMessage(
            message.payload?.message || 'Authentication or MFA required in Shareworks portal tab.'
          );
          setSyncError(null);
          break;
        }

        case 'SW_DATA_READY': {
          if (syncTimeoutRef.current) {
            window.clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
          }
          setIsSyncing(false);
          setIsAuthRequired(false);
          setAuthMessage(null);
          setSyncError(null);
          setPortfolio(message.payload);
          break;
        }

        case 'SW_ERROR': {
          if (syncTimeoutRef.current) {
            window.clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
          }
          setIsSyncing(false);
          setSyncError(message.payload.message || 'An error occurred during synchronization.');
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial fast pings & recurring keep-alive
    pingExtension();
    const timeoutId = window.setTimeout(pingExtension, 500);
    const intervalId = window.setInterval(pingExtension, 2500);
    pingIntervalRef.current = intervalId;

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
      }
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [pingExtension]);

  // Execute mock sync workflow (simulates 2-second delay + MFA transition)
  const runMockSync = useCallback(() => {
    setIsSyncing(true);
    setSyncError(null);
    setIsAuthRequired(false);
    setAuthMessage(null);

    // Step 1: Simulate 1-second login/verification check
    setTimeout(() => {
      setIsAuthRequired(true);
      setAuthMessage('Simulating Shareworks MFA verification...');

      // Step 2: Complete login after another 1 second (total 2 seconds as specified in SOP 02)
      setTimeout(() => {
        setIsAuthRequired(false);
        setAuthMessage(null);
        setIsSyncing(false);

        const mockData: ShareworksPortfolio = {
          holdings: [
            {
              symbol: 'ACME',
              companyName: 'Acme Technologies Inc.',
              totalShares: 14500,
              vestedShares: 8250,
              unvestedShares: 6250,
              currency: 'USD',
              currentPrice: 48.5,
              totalValue: 703250,
              costBasis: 114750,
            },
          ],
          grants: [
            {
              grantId: 'RSU-2023-001',
              grantDate: '2023-03-15',
              grantType: 'RSU',
              status: 'ACTIVE',
              totalGrantedShares: 8000,
              vestedShares: 4000,
              unvestedShares: 4000,
              exercisePrice: null,
              costBasis: 0,
              marketValue: 388000,
              vestingSchedule: [
                { date: '2024-03-15', shares: 2000, status: 'VESTED', projectedValue: 97000 },
                { date: '2024-09-15', shares: 2000, status: 'VESTED', projectedValue: 97000 },
                { date: '2025-03-15', shares: 2000, status: 'UNVESTED', projectedValue: 97000 },
                { date: '2025-09-15', shares: 2000, status: 'UNVESTED', projectedValue: 97000 },
              ],
            },
            {
              grantId: 'ISO-2022-042',
              grantDate: '2022-06-01',
              grantType: 'ISO',
              status: 'ACTIVE',
              totalGrantedShares: 5000,
              vestedShares: 3750,
              unvestedShares: 1250,
              exercisePrice: 12.0,
              costBasis: 60000,
              marketValue: 242500,
              vestingSchedule: [
                { date: '2023-06-01', shares: 1250, status: 'VESTED', projectedValue: 60625 },
                { date: '2024-06-01', shares: 1250, status: 'VESTED', projectedValue: 60625 },
                { date: '2024-12-01', shares: 1250, status: 'VESTED', projectedValue: 60625 },
                { date: '2025-06-01', shares: 1250, status: 'UNVESTED', projectedValue: 60625 },
              ],
            },
            {
              grantId: 'ESPP-2024-P1',
              grantDate: '2024-06-30',
              grantType: 'ESPP',
              status: 'FULLY_VESTED',
              totalGrantedShares: 1500,
              vestedShares: 1500,
              unvestedShares: 0,
              exercisePrice: 36.5,
              costBasis: 54750,
              marketValue: 72750,
              vestingSchedule: [
                { date: '2024-06-30', shares: 1500, status: 'VESTED', projectedValue: 72750 },
              ],
            },
          ],
          updatedAt: new Date().toISOString(),
        };

        setPortfolio(mockData);
      }, 1000);
    }, 1000);
  }, []);

  const startSync = useCallback(() => {
    if (isMockMode) {
      runMockSync();
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setIsAuthRequired(false);
    setAuthMessage(null);

    // Watchdog timeout to prevent infinite sync hanging
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      setIsSyncing(false);
      setSyncError(
        'Sync request timed out. Please ensure your Shareworks tab is active, authenticated, and on your Holdings or Portfolio Summary page, then click Sync Now again.'
      );
    }, 12000);

    window.postMessage(
      {
        source: BRIDGE_SOURCE,
        type: 'SW_START_SYNC',
      },
      window.location.origin
    );
  }, [isMockMode, runMockSync]);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      setPortfolio(null);
      setSyncError(null);
      setIsAuthRequired(false);

      // Notify the companion extension to clear background memory cache
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: 'SW_CLEAR_CACHE',
        },
        window.location.origin
      );
    } catch {
      // Ignored
    }
  }, []);

  const toggleMockMode = useCallback(() => {
    setIsMockMode((prev) => !prev);
  }, []);

  return {
    portfolio,
    isExtensionConnected,
    isSyncing,
    isAuthRequired,
    authMessage,
    syncError,
    lastUpdated: portfolio?.updatedAt || null,
    isMockMode,
    startSync,
    clearCache,
    toggleMockMode,
  };
}
