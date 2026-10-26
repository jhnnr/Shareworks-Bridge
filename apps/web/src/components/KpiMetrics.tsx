import React from 'react';
import { DollarSign, Award, Clock, PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import type { ShareworksPortfolio } from '../types/equity';

interface KpiMetricsProps {
  portfolio: ShareworksPortfolio;
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({ portfolio }) => {
  // Aggregate portfolio totals
  const totalValue = portfolio.holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalShares = portfolio.holdings.reduce((sum, h) => sum + h.totalShares, 0);
  const totalVestedShares = portfolio.holdings.reduce((sum, h) => sum + h.vestedShares, 0);
  const totalUnvestedShares = portfolio.holdings.reduce((sum, h) => sum + h.unvestedShares, 0);

  // Calculate Total Cost Basis across holdings or grants
  const holdingsCostBasis = portfolio.holdings.reduce((sum, h) => sum + (h.costBasis || 0), 0);
  const grantsCostBasis = portfolio.grants.reduce(
    (sum, g) => sum + (g.costBasis || (g.exercisePrice ? g.totalGrantedShares * g.exercisePrice : 0)),
    0
  );
  const totalCostBasis = holdingsCostBasis > 0 ? holdingsCostBasis : grantsCostBasis;

  // Calculate Total PnL and PnL Percentage
  const totalPnl = totalValue - totalCostBasis;
  const pnlPercentage =
    totalCostBasis > 0
      ? (totalPnl / totalCostBasis) * 100
      : totalValue > 0 && totalCostBasis === 0
      ? 100
      : 0;
  const isPnlPositive = totalPnl >= 0;

  // Compute vested / unvested value proportion based on share price
  const avgPrice = totalShares > 0 ? totalValue / totalShares : 0;
  const vestedValue = totalVestedShares * avgPrice;
  const unvestedValue = totalUnvestedShares * avgPrice;
  const vestedPercentage = totalShares > 0 ? (totalVestedShares / totalShares) * 100 : 0;

  const formatCurrency = (amount: number, showSign = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    if (showSign) {
      return amount >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
    }).format(num);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* 1. Total Valuation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Total Portfolio Value</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalValue)}</div>
        <div className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
          <span>{formatNumber(totalShares)} shares across {portfolio.grants.length} grants</span>
        </div>
      </div>

      {/* 2. Total PnL & Return % */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Total PnL & Return</span>
          <div
            className={`p-2 rounded-lg ${
              isPnlPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {isPnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div
          className={`text-2xl font-bold ${
            isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {formatCurrency(totalPnl, true)}
        </div>
        <div className="mt-1 flex items-center space-x-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              isPnlPositive
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
            }`}
          >
            {pnlPercentage >= 0 ? `+${pnlPercentage.toFixed(2)}%` : `${pnlPercentage.toFixed(2)}%`}
          </span>
          {totalCostBasis > 0 && (
            <span className="text-[11px] text-slate-500">
              Cost: {formatCurrency(totalCostBasis)}
            </span>
          )}
        </div>
      </div>

      {/* 3. Vested Value */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Vested Value</span>
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">{formatCurrency(vestedValue)}</div>
        <div className="text-xs text-emerald-400 font-medium mt-1">
          {vestedPercentage.toFixed(1)}% vested ({formatNumber(totalVestedShares)} shares)
        </div>
      </div>

      {/* 4. Unvested Value */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Unvested Value</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">{formatCurrency(unvestedValue)}</div>
        <div className="text-xs text-slate-400 mt-1">
          {(100 - vestedPercentage).toFixed(1)}% unvested ({formatNumber(totalUnvestedShares)} shares)
        </div>
      </div>

      {/* 5. Primary Security / Share Price */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Market Price</span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100">
          {formatCurrency(portfolio.holdings[0]?.currentPrice || avgPrice)}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {portfolio.holdings[0]?.symbol || 'EQUITY'} &bull; {portfolio.holdings[0]?.currency || 'USD'}
        </div>
      </div>
    </div>
  );
};
