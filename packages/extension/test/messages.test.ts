import { describe, it, expect } from 'vitest';
import {
  isAllowedOrigin,
  parseInboundMessage,
  sendSecurePostMessage,
} from '../src/utils/messaging.js';
import { BRIDGE_SOURCE, type PingMessage } from '../src/types/messages.js';

describe('Messaging Protocol & Origin Verification', () => {
  it('validates allowed localhost and github.io origins', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedOrigin('https://johndoe.github.io')).toBe(true);
  });

  it('rejects unverified and third-party origins', () => {
    expect(isAllowedOrigin('https://malicious-site.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost.attacker.com')).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('rejects outgoing postMessage targeting wildcard *', () => {
    const fakeWindow = { postMessage: () => {} } as unknown as Window;
    const pingMsg: PingMessage = {
      source: BRIDGE_SOURCE,
      type: 'SW_BRIDGE_PING',
    };

    expect(() => {
      sendSecurePostMessage(fakeWindow, '*', pingMsg);
    }).toThrow(/Wildcard \(\*\) target origin is prohibited/);
  });

  it('rejects outgoing postMessage targeting disallowed origin', () => {
    const fakeWindow = { postMessage: () => {} } as unknown as Window;
    const pingMsg: PingMessage = {
      source: BRIDGE_SOURCE,
      type: 'SW_BRIDGE_PING',
    };

    expect(() => {
      sendSecurePostMessage(fakeWindow, 'https://evil.com', pingMsg);
    }).toThrow(/not whitelisted/);
  });

  it('drops malformed or untrusted inbound message events gracefully', () => {
    // Malicious origin
    const badOriginEvent = new MessageEvent('message', {
      origin: 'https://evil.com',
      data: { type: 'SW_BRIDGE_PING' },
    });
    expect(parseInboundMessage(badOriginEvent)).toBeNull();

    // Invalid schema
    const badSchemaEvent = new MessageEvent('message', {
      origin: 'http://localhost:5173',
      data: { type: 'SW_UNKNOWN_TYPE', foo: 'bar' },
    });
    expect(parseInboundMessage(badSchemaEvent)).toBeNull();

    // Valid ping message
    const validPingEvent = new MessageEvent('message', {
      origin: 'http://localhost:5173',
      data: { source: BRIDGE_SOURCE, type: 'SW_BRIDGE_PING' },
    });
    const parsed = parseInboundMessage(validPingEvent);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('SW_BRIDGE_PING');
  });
});
