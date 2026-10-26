import { z } from 'zod';

export const VestingMilestoneSchema = z.object({
  date: z.string().min(1),
  shares: z.number().nonnegative(),
  status: z.enum(['VESTED', 'UNVESTED']),
  projectedValue: z.number().nonnegative().optional(),
});
export type VestingMilestone = z.infer<typeof VestingMilestoneSchema>;

export const HoldingSchema = z.object({
  symbol: z.string().min(1),
  companyName: z.string().min(1),
  totalShares: z.number().nonnegative(),
  vestedShares: z.number().nonnegative(),
  unvestedShares: z.number().nonnegative(),
  currency: z.string().default('USD'),
  currentPrice: z.number().nonnegative(),
  totalValue: z.number().nonnegative(),
  costBasis: z.number().nonnegative().optional(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const GrantSchema = z.object({
  grantId: z.string().min(1),
  grantDate: z.string().min(1),
  grantType: z.enum(['RSU', 'ISO', 'NSO', 'ESPP']),
  status: z.enum(['ACTIVE', 'FULLY_VESTED', 'EXERCISED', 'CANCELLED']),
  totalGrantedShares: z.number().nonnegative(),
  vestedShares: z.number().nonnegative(),
  unvestedShares: z.number().nonnegative(),
  exercisePrice: z.number().nonnegative().nullable().optional(),
  costBasis: z.number().nonnegative().optional(),
  marketValue: z.number().nonnegative(),
  vestingSchedule: z.array(VestingMilestoneSchema),
});
export type Grant = z.infer<typeof GrantSchema>;

export const ShareworksPortfolioSchema = z.object({
  holdings: z.array(HoldingSchema),
  grants: z.array(GrantSchema),
  updatedAt: z.string().min(1),
});
export type ShareworksPortfolio = z.infer<typeof ShareworksPortfolioSchema>;
