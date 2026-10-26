import { describe, it, expect } from 'vitest';
import {
  BridgeMessageSchema,
  BRIDGE_SOURCE,
  type BridgeMessage,
} from '../src/types/messages';
import { ShareworksPortfolioSchema } from '../src/types/equity';

describe('useShareworksBridge & Message Safety Integration', () => {
  it('strictly validates schema and accepts valid SW_DATA_READY payload', () => {
    const validDataMessage: BridgeMessage = {
      source: BRIDGE_SOURCE,
      type: 'SW_DATA_READY',
      payload: {
        holdings: [
          {
            symbol: 'ACME',
            companyName: 'Acme Technologies Inc.',
            totalShares: 1000,
            vestedShares: 500,
            unvestedShares: 500,
            currency: 'USD',
            currentPrice: 50,
            totalValue: 50000,
          },
        ],
        grants: [
          {
            grantId: 'RSU-101',
            grantDate: '2024-01-01',
            grantType: 'RSU',
            status: 'ACTIVE',
            totalGrantedShares: 1000,
            vestedShares: 500,
            unvestedShares: 500,
            exercisePrice: null,
            marketValue: 50000,
            vestingSchedule: [
              { date: '2024-06-01', shares: 500, status: 'VESTED', projectedValue: 25000 },
              { date: '2024-12-01', shares: 500, status: 'UNVESTED', projectedValue: 25000 },
            ],
          },
        ],
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    };

    const result = BridgeMessageSchema.safeParse(validDataMessage);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'SW_DATA_READY') {
      expect(result.data.payload.holdings[0].symbol).toBe('ACME');
    }
  });

  it('validates SW_CLEAR_CACHE message schema', () => {
    const clearMsg = {
      source: BRIDGE_SOURCE,
      type: 'SW_CLEAR_CACHE',
    };
    const result = BridgeMessageSchema.safeParse(clearMsg);
    expect(result.success).toBe(true);
  });

  it('drops malformed payloads safely without crashing or throwing unhandled errors', () => {
    const malformedPayloads = [
      null,
      undefined,
      'malformed_string',
      12345,
      {},
      { type: 'SW_DATA_READY' }, // Missing source and payload
      { source: BRIDGE_SOURCE, type: 'SW_DATA_READY', payload: { corrupt: true } }, // Invalid portfolio schema
      { source: BRIDGE_SOURCE, type: 'SW_UNKNOWN_TYPE', payload: {} }, // Unrecognized event type
      { source: 'untrusted-source', type: 'SW_BRIDGE_PONG', payload: {} }, // Invalid source tag
      {
        source: BRIDGE_SOURCE,
        type: 'SW_DATA_READY',
        payload: {
          holdings: [{ symbol: 'ACME', totalShares: 'not_a_number' }], // Type violation
          grants: [],
          updatedAt: '2025-01-01',
        },
      },
    ];

    malformedPayloads.forEach((payload) => {
      const parseResult = BridgeMessageSchema.safeParse(payload);
      expect(parseResult.success).toBe(false);
    });
  });

  it('validates Portfolio Zod schema resilience against empty grant lists', () => {
    const minimalPortfolio = {
      holdings: [],
      grants: [],
      updatedAt: '2025-01-01T00:00:00Z',
    };

    const result = ShareworksPortfolioSchema.safeParse(minimalPortfolio);
    expect(result.success).toBe(true);
  });

  it('validates SW_ERROR message schema', () => {
    const errorMsg = {
      source: BRIDGE_SOURCE,
      type: 'SW_ERROR',
      payload: {
        code: 'NETWORK_TIMEOUT',
        message: 'Failed to connect to Shareworks tab.',
      },
    };

    const result = BridgeMessageSchema.safeParse(errorMsg);
    expect(result.success).toBe(true);
  });

  it('validates SW_AUTH_REQUIRED message schema', () => {
    const authMsg = {
      source: BRIDGE_SOURCE,
      type: 'SW_AUTH_REQUIRED',
      payload: {
        message: 'MFA challenge requested.',
      },
    };

    const result = BridgeMessageSchema.safeParse(authMsg);
    expect(result.success).toBe(true);
  });
});
