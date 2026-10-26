import { describe, it, expect } from 'vitest';
import { sanitizeRawPortfolio, assertZeroPii } from '../src/utils/sanitizer.js';
import mockPortfolio from './fixtures/shareworks-mock-portfolio.json';

describe('Sanitizer & PII Scrubbing', () => {
  it('successfully sanitizes a valid mock portfolio', () => {
    const result = sanitizeRawPortfolio(mockPortfolio);
    expect(result.holdings.length).toBe(1);
    expect(result.holdings[0].symbol).toBe('ACME');
    expect(result.grants.length).toBe(3);
    expect(result.grants[0].grantType).toBe('RSU');
    expect(result.grants[1].grantType).toBe('ISO');
    expect(result.grants[2].grantType).toBe('ESPP');
  });

  it('rejects payloads containing explicit PII property names', () => {
    const dirtyPayload = {
      ...mockPortfolio,
      ssn: '123-45-6789',
      legalName: 'Jane Doe',
    };

    // sanitizeRawPortfolio strips extra keys, but assertZeroPii catches any direct PII structure
    expect(() => assertZeroPii(dirtyPayload)).toThrow(/PII Violation/);
  });

  it('rejects payloads containing SSN string patterns in field values', () => {
    const dirtyWithSsn = {
      ...mockPortfolio,
      holdings: [
        {
          ...mockPortfolio.holdings[0],
          companyName: 'Acme Corp 000-12-3456',
        },
      ],
    };

    expect(() => sanitizeRawPortfolio(dirtyWithSsn)).toThrow(/PII Violation/);
  });

  it('rejects payloads containing email addresses', () => {
    const dirtyWithEmail = {
      ...mockPortfolio,
      holdings: [
        {
          ...mockPortfolio.holdings[0],
          companyName: 'employee@solium.com',
        },
      ],
    };

    expect(() => sanitizeRawPortfolio(dirtyWithEmail)).toThrow(/PII Violation/);
  });

  it('handles empty or malformed inputs without crashing', () => {
    expect(() => sanitizeRawPortfolio(null)).toThrow();
    expect(() => sanitizeRawPortfolio(undefined)).toThrow();
    expect(() => sanitizeRawPortfolio('string')).toThrow();
  });
});
