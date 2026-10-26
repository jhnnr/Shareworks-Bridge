import {
  type ShareworksPortfolio,
  type Holding,
  type Grant,
  type VestingMilestone,
} from '../types/equity.js';
import { sanitizeRawPortfolio } from './sanitizer.js';

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

// Converts date format '29-Jan-2025' to '2025-01-29'
function parseShareworksDate(rawDate: string): string {
  const cleaned = rawDate.trim();
  const match = cleaned.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = MONTH_MAP[match[2].toLowerCase()] || '01';
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

function parseCurrencyNumber(val: string): number {
  if (!val) return 0;
  const numStr = val.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses Shareworks Account Summary / Statement HTML document.
 * Returns a validated ShareworksPortfolio or null if the document does not contain statement tables.
 */
export function parseShareworksStatement(root: Document | Element): ShareworksPortfolio | null {
  // Check if this document contains statement tables
  const holdingsTables = Array.from(
    root.querySelectorAll('table[id="Summary of Stock/Shares Holdings_table"]')
  );
  const currentValueTables = Array.from(
    root.querySelectorAll('table[id="Current Value_table"]')
  );

  if (holdingsTables.length === 0 && currentValueTables.length === 0) {
    return null;
  }

  // 1. Extract Company Name
  let companyName = 'Shareworks Equity';
  const companyStrong = Array.from(root.querySelectorAll('strong')).find((el) =>
    el.textContent?.toLowerCase().includes('company')
  );
  if (companyStrong && companyStrong.parentElement) {
    const fullText = companyStrong.parentElement.textContent || '';
    const match = fullText.match(/Company\s*:\s*([^,\n\r\t]+)/i);
    if (match) {
      companyName = match[1].trim();
    }
  }

  // 2. Extract Stock Symbol and Current Market Price
  let symbol = 'EQUITY';
  let currentPrice = 0;

  const priceHistoryTable = root.querySelector(
    'table[id="Price History Over Statement Period_table"]'
  );
  if (priceHistoryTable) {
    const priceRows = Array.from(priceHistoryTable.querySelectorAll('tbody tr'));
    for (const row of priceRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 3) {
        const fundName = (cells[0].textContent || '').trim();
        if (fundName) {
          const parts = fundName.split(/\s*[-–]\s*/);
          symbol = parts[0].replace(/\s+(Inc|Corp|Ltd|LLC|PLC|SA)\.?$/i, '').trim() || 'EQUITY';
          currentPrice = parseCurrencyNumber(cells[2].textContent || '');
        }
      }
    }
  }

  // 3. Extract Plans, Grants, and Holdings
  const grants: Grant[] = [];
  let totalPortfolioShares = 0;
  let totalPortfolioVestedShares = 0;
  let totalPortfolioValue = 0;
  let totalPortfolioCostBasis = 0;

  // Find all Plan Sections (marked by <h3 class="titlebar">)
  const planHeadings = Array.from(root.querySelectorAll('h3.titlebar'));

  // If no plan headings, treat all holdings tables directly
  const sectionsToProcess =
    planHeadings.length > 0
      ? planHeadings
      : holdingsTables.map((_, idx) => ({ textContent: `Equity Plan ${idx + 1}` }));

  for (let sIdx = 0; sIdx < sectionsToProcess.length; sIdx++) {
    const heading = sectionsToProcess[sIdx];
    const rawPlanTitle = (heading.textContent || `Plan ${sIdx + 1}`).trim();
    const grantId = `PLAN-${rawPlanTitle.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || `P${sIdx + 1}`}`;

    // Get the holdings table for this section
    const holdingsTable = holdingsTables[sIdx];
    if (!holdingsTable) continue;

    let planShares = 0;
    let planCostBasis = 0;
    let planValue = 0;
    let planUnitCost = 0;

    const hRows = Array.from(holdingsTable.querySelectorAll('tbody tr'));
    for (const row of hRows) {
      // Ignore subtotal / highlight rows
      if (row.querySelector('.tmHighlightBold')) continue;

      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 6) {
        const fundText = (cells[0].textContent || '').trim();
        if (!fundText || fundText === 'blank') continue;

        if (symbol === 'EQUITY') {
          const parts = fundText.split(/\s*[-–]\s*/);
          symbol = parts[0].replace(/\s+(Inc|Corp|Ltd|LLC|PLC|SA)\.?$/i, '').trim();
        }

        const costBasis = parseCurrencyNumber(cells[1].textContent || '');
        const avgCost = parseCurrencyNumber(cells[2].textContent || '');
        const units = parseCurrencyNumber(cells[3].textContent || '');
        const price = parseCurrencyNumber(cells[4].textContent || '');
        const value = parseCurrencyNumber(cells[5].textContent || '');

        if (units > 0) {
          planShares += units;
          planCostBasis += costBasis;
          planValue += value;
          if (avgCost > 0) planUnitCost = avgCost;
          if (price > 0 && currentPrice === 0) currentPrice = price;
        }
      }
    }

    // Extract transaction purchase history from the Activity_table for this section
    const activityTables = Array.from(root.querySelectorAll('table[id="Activity_table"]'));
    const activityTable = activityTables[sIdx];
    const vestingSchedule: VestingMilestone[] = [];

    if (activityTable) {
      const actRows = Array.from(activityTable.querySelectorAll('tbody tr'));
      for (const row of actRows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 8) {
          const dateStr = (cells[0].textContent || '').trim();
          const activityStr = (cells[1].textContent || '').trim().toLowerCase();
          const units = parseCurrencyNumber(cells[4].textContent || '');
          const unitPrice = parseCurrencyNumber(cells[5].textContent || '');
          const bookValue = parseCurrencyNumber(cells[6].textContent || '');

          if (
            (activityStr.includes('bought') ||
              activityStr.includes('purchase') ||
              activityStr.includes('reinvest')) &&
            units > 0
          ) {
            vestingSchedule.push({
              date: parseShareworksDate(dateStr),
              shares: units,
              status: 'VESTED',
              projectedValue: bookValue || units * unitPrice,
            });
          }
        }
      }
    }

    // Sort schedule chronologically
    vestingSchedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (planShares > 0 || planValue > 0) {
      grants.push({
        grantId,
        grantDate: vestingSchedule[0]?.date || new Date().toISOString().split('T')[0],
        grantType: 'ESPP',
        status: 'ACTIVE',
        totalGrantedShares: planShares,
        vestedShares: planShares,
        unvestedShares: 0,
        exercisePrice: planUnitCost || (planShares > 0 ? planCostBasis / planShares : null),
        costBasis: planCostBasis > 0 ? planCostBasis : undefined,
        marketValue: planValue,
        vestingSchedule,
      });

      totalPortfolioShares += planShares;
      totalPortfolioVestedShares += planShares;
      totalPortfolioValue += planValue;
      totalPortfolioCostBasis += planCostBasis;
    }
  }

  // If no price found yet, derive from totalValue / totalShares
  if (currentPrice === 0 && totalPortfolioShares > 0) {
    currentPrice = totalPortfolioValue / totalPortfolioShares;
  }

  const holdings: Holding[] = [
    {
      symbol: symbol.toUpperCase(),
      companyName,
      totalShares: totalPortfolioShares,
      vestedShares: totalPortfolioVestedShares,
      unvestedShares: 0,
      currency: 'USD',
      currentPrice,
      totalValue: totalPortfolioValue,
      costBasis: totalPortfolioCostBasis > 0 ? totalPortfolioCostBasis : undefined,
    },
  ];

  const rawData = {
    holdings,
    grants,
    updatedAt: new Date().toISOString(),
  };

  return sanitizeRawPortfolio(rawData);
}
