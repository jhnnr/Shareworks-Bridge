import {
  ShareworksPortfolioSchema,
  type ShareworksPortfolio,
  type Holding,
  type Grant,
  type VestingMilestone,
} from '../types/equity.js';

// Regex patterns to detect potential PII in values
const SSN_REGEX = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const BANK_ACCOUNT_REGEX = /\b\d{8,17}\b/;

// Disallowed property names that represent PII
const PII_KEYS = new Set([
  'ssn',
  'socialsecuritynumber',
  'taxid',
  'tax_id',
  'tin',
  'sin',
  'firstname',
  'lastname',
  'fullname',
  'legalname',
  'address',
  'addressline1',
  'addressline2',
  'street',
  'city',
  'state',
  'zip',
  'zipcode',
  'postalcode',
  'bankaccount',
  'accountnumber',
  'routingnumber',
  'iban',
  'swift',
  'email',
  'phone',
  'phonenumber',
  'dateofbirth',
  'dob',
]);

/**
 * Recursively scans an object to ensure no PII fields or values are present.
 * Throws an Error if potential PII is identified.
 */
export function assertZeroPii(obj: unknown, path = ''): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'string') {
    if (SSN_REGEX.test(obj)) {
      throw new Error(`PII Violation: Potential SSN/Tax ID pattern detected at path '${path}'`);
    }
    if (EMAIL_REGEX.test(obj)) {
      throw new Error(`PII Violation: Email address detected at path '${path}'`);
    }
    if (/account|routing|bank|iban/i.test(path) && BANK_ACCOUNT_REGEX.test(obj)) {
      throw new Error(`PII Violation: Banking/Account pattern detected at path '${path}'`);
    }
    return;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => assertZeroPii(item, `${path}[${index}]`));
    return;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (PII_KEYS.has(normalizedKey)) {
        throw new Error(`PII Violation: Disallowed PII field '${key}' detected at path '${path}'`);
      }
      assertZeroPii(value, path ? `${path}.${key}` : key);
    }
  }
}

/**
 * Sanitizes and extracts raw intercepted Shareworks data into a strictly validated ShareworksPortfolio.
 * Strips all untrusted / non-whitelisted keys and guarantees zero PII before output.
 */
export function sanitizeRawPortfolio(rawData: unknown): ShareworksPortfolio {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid raw portfolio data: expected non-null object');
  }

  const record = rawData as Record<string, unknown>;

  // Extract and sanitize holdings
  const rawHoldings = Array.isArray(record.holdings) ? record.holdings : [];
  const holdings: Holding[] = rawHoldings.map((h: unknown, idx: number) => {
    if (!h || typeof h !== 'object') {
      throw new Error(`Invalid holding item at index ${idx}`);
    }
    const item = h as Record<string, unknown>;
    return {
      symbol: String(item.symbol ?? 'UNKNOWN').trim().toUpperCase(),
      companyName: String(item.companyName ?? item.company ?? 'Unknown Company').trim(),
      totalShares: Number(item.totalShares ?? item.shares ?? 0),
      vestedShares: Number(item.vestedShares ?? 0),
      unvestedShares: Number(item.unvestedShares ?? 0),
      currency: String(item.currency ?? 'USD').toUpperCase(),
      currentPrice: Number(item.currentPrice ?? item.price ?? 0),
      totalValue: Number(item.totalValue ?? item.value ?? 0),
    };
  });

  // Extract and sanitize grants
  const rawGrants = Array.isArray(record.grants) ? record.grants : [];
  const grants: Grant[] = rawGrants.map((g: unknown, idx: number) => {
    if (!g || typeof g !== 'object') {
      throw new Error(`Invalid grant item at index ${idx}`);
    }
    const item = g as Record<string, unknown>;

    const rawSchedule = Array.isArray(item.vestingSchedule) ? item.vestingSchedule : [];
    const vestingSchedule: VestingMilestone[] = rawSchedule.map((m: unknown, mIdx: number) => {
      if (!m || typeof m !== 'object') {
        throw new Error(`Invalid milestone item at index ${mIdx} of grant ${idx}`);
      }
      const mItem = m as Record<string, unknown>;
      return {
        date: String(mItem.date ?? new Date().toISOString().split('T')[0]),
        shares: Number(mItem.shares ?? 0),
        status: mItem.status === 'VESTED' ? 'VESTED' : 'UNVESTED',
        projectedValue: mItem.projectedValue !== undefined ? Number(mItem.projectedValue) : undefined,
      };
    });

    const grantTypeRaw = String(item.grantType ?? 'RSU').toUpperCase();
    const grantType: 'RSU' | 'ISO' | 'NSO' | 'ESPP' =
      grantTypeRaw === 'ISO' || grantTypeRaw === 'NSO' || grantTypeRaw === 'ESPP'
        ? grantTypeRaw
        : 'RSU';

    const statusRaw = String(item.status ?? 'ACTIVE').toUpperCase();
    const status: 'ACTIVE' | 'FULLY_VESTED' | 'EXERCISED' | 'CANCELLED' =
      statusRaw === 'FULLY_VESTED' || statusRaw === 'EXERCISED' || statusRaw === 'CANCELLED'
        ? statusRaw
        : 'ACTIVE';

    return {
      grantId: String(item.grantId ?? `GRANT-${idx + 1}`),
      grantDate: String(item.grantDate ?? new Date().toISOString().split('T')[0]),
      grantType,
      status,
      totalGrantedShares: Number(item.totalGrantedShares ?? item.totalShares ?? 0),
      vestedShares: Number(item.vestedShares ?? 0),
      unvestedShares: Number(item.unvestedShares ?? 0),
      exercisePrice: item.exercisePrice !== undefined && item.exercisePrice !== null ? Number(item.exercisePrice) : null,
      marketValue: Number(item.marketValue ?? 0),
      vestingSchedule,
    };
  });

  const portfolioCandidate = {
    holdings,
    grants,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };

  // 1. Zod schema validation
  const validated = ShareworksPortfolioSchema.parse(portfolioCandidate);

  // 2. Strict PII check on the validated object
  assertZeroPii(validated);

  return validated;
}
