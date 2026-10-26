import React from 'react';
import { Building2, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import type { Holding } from '../types/equity';

interface HoldingsSummaryProps {
  holdings: Holding[];
}

export const HoldingsSummary: React.FC<HoldingsSummaryProps> = ({ holdings }) => {
  const formatCurrency = (val: number, showSign = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(Math.abs(val));

    if (showSign) {
      return val >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return val < 0 ? `-${formatted}` : formatted;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 4,
    }).format(num);
  };

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-3">
        Equity Holdings Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {holdings.map((h, idx) => {
          const costBasis = h.costBasis;
          const pnl = costBasis !== undefined ? h.totalValue - costBasis : undefined;
          const pnlPercent =
            costBasis && costBasis > 0
              ? (pnl! / costBasis) * 100
              : pnl !== undefined && costBasis === 0
              ? 100
              : undefined;
          const isPnlPositive = pnl !== undefined ? pnl >= 0 : true;

          return (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">{h.symbol}</h4>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{h.companyName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    {formatCurrency(h.currentPrice)}
                  </span>
                  {pnlPercent !== undefined && (
                    <div
                      className={`text-[10px] font-semibold mt-1 flex items-center justify-end ${
                        isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPnlPositive ? (
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-0.5" />
                      )}
                      <span>
                        {pnlPercent >= 0
                          ? `+${pnlPercent.toFixed(2)}%`
                          : `${pnlPercent.toFixed(2)}%`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 flex items-center">
                    <Layers className="w-3 h-3 mr-1" /> Total Shares
                  </span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">
                    {formatNumber(h.totalShares)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" /> Total Value
                  </span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">
                    {formatCurrency(h.totalValue)}
                  </span>
                </div>

                {costBasis !== undefined ? (
                  <>
                    <div className="mt-1">
                      <span className="text-slate-500">Cost Basis</span>
                      <span className="font-medium text-slate-300 block">
                        {formatCurrency(costBasis)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-500">Total PnL</span>
                      <span
                        className={`font-semibold block ${
                          isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(pnl!, true)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1">
                      <span className="text-slate-500">Vested Shares</span>
                      <span className="font-medium text-emerald-400 block">
                        {formatNumber(h.vestedShares)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-500">Unvested Shares</span>
                      <span className="font-medium text-amber-400 block">
                        {formatNumber(h.unvestedShares)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
