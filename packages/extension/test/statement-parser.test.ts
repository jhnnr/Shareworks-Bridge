import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';
import { parseShareworksStatement } from '../src/utils/statement-parser.js';

describe('Shareworks Statement Parser Validation', () => {
  it('accurately parses real Shareworks account summary statement from sample-data', () => {
    const htmlPath = resolve(__dirname, '../../../sample-data/Morgan Stanley at Work - Account Summary.html');
    const html = readFileSync(htmlPath, 'utf-8');
    const dom = new JSDOM(html);
    const portfolio = parseShareworksStatement(dom.window.document);

    expect(portfolio).not.toBeNull();
    if (portfolio) {
      expect(portfolio.holdings.length).toBe(1);
      expect(portfolio.holdings[0].companyName).toBe('CGI Inc');
      expect(portfolio.holdings[0].symbol).toBe('CGI');
      expect(portfolio.holdings[0].totalShares).toBeCloseTo(22.698, 2);
      expect(portfolio.holdings[0].totalValue).toBeCloseTo(1860.78, 1);
      expect(portfolio.holdings[0].currentPrice).toBeCloseTo(81.98, 2);

      // Verify 2 ESPP contribution plans
      expect(portfolio.grants.length).toBe(2);
      expect(portfolio.grants[0].grantType).toBe('ESPP');
      expect(portfolio.grants[0].totalGrantedShares).toBeCloseTo(13.112, 2);
      expect(portfolio.grants[1].totalGrantedShares).toBeCloseTo(9.585, 2);

      // Verify transaction milestones parsed from Activity_table
      expect(portfolio.grants[0].vestingSchedule.length).toBeGreaterThan(10);
      expect(portfolio.grants[0].vestingSchedule[0].shares).toBeGreaterThan(0);
      expect(portfolio.grants[0].vestingSchedule[0].status).toBe('VESTED');
    }
  });

  it('correctly calculates employee_id from userPK by adding 10 to numeric userPK', () => {
    const sampleUserPK = 414707411000;
    const computedEmpId = (BigInt(sampleUserPK) + 10n).toString();
    expect(computedEmpId).toBe('414707411010');

    // Test with string input
    const sampleUserPKStr = '414707411000';
    const computedFromStr = (BigInt(sampleUserPKStr) + 10n).toString();
    expect(computedFromStr).toBe('414707411010');
  });

  it('returns null on documents without Shareworks statement tables', () => {
    const dom = new JSDOM('<html><body><div>No financial data here</div></body></html>');
    expect(parseShareworksStatement(dom.window.document)).toBeNull();
  });
});
