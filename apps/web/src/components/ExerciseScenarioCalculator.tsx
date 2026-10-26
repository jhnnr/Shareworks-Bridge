import React, { useState } from 'react';
import { Calculator, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import type { Grant, Holding } from '../types/equity';

interface ExerciseScenarioCalculatorProps {
  grants: Grant[];
  holdings: Holding[];
}

export const ExerciseScenarioCalculator: React.FC<ExerciseScenarioCalculatorProps> = ({
  grants,
  holdings,
}) => {
  const optionGrants = grants.filter(
    (g) => (g.grantType === 'ISO' || g.grantType === 'NSO') && g.vestedShares > 0
  );

  const defaultHoldingPrice = holdings[0]?.currentPrice || 50;

  const [selectedGrantId, setSelectedGrantId] = useState<string>(
    optionGrants[0]?.grantId || ''
  );
  const [exerciseShares, setExerciseShares] = useState<number>(
    optionGrants[0]?.vestedShares || 1000
  );
  const [targetStockPrice, setTargetStockPrice] = useState<number>(defaultHoldingPrice);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(28);

  const selectedGrant = optionGrants.find((g) => g.grantId === selectedGrantId);
  const strikePrice = selectedGrant?.exercisePrice || 0;

  // Financial calculations
  const totalCost = exerciseShares * strikePrice;
  const targetMarketValue = exerciseShares * targetStockPrice;
  const grossSpread = Math.max(targetMarketValue - totalCost, 0);
  const estimatedTax = (grossSpread * taxRatePercent) / 100;
  const netGain = Math.max(grossSpread - estimatedTax, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (optionGrants.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 text-slate-400 text-xs flex items-center space-x-3">
        <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-slate-300">Exercise Modeling Not Applicable</h4>
          <p className="mt-0.5">
            No vested ISO or NSO stock option grants detected in your portfolio to model exercise scenarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 shadow-sm">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-800 mb-5">
        <Calculator className="w-4 h-4 text-emerald-400" />
        <h3 className="text-base font-bold text-slate-100">Stock Option Exercise Scenario Modeler</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls / Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Option Grant
            </label>
            <select
              value={selectedGrantId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedGrantId(id);
                const g = optionGrants.find((item) => item.grantId === id);
                if (g) setExerciseShares(g.vestedShares);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
            >
              {optionGrants.map((g) => (
                <option key={g.grantId} value={g.grantId}>
                  {g.grantId} ({g.grantType}) — Strike: {formatCurrency(g.exercisePrice || 0)} (Vested: {g.vestedShares})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Shares to Exercise</span>
              <span className="text-slate-400">Max: {selectedGrant?.vestedShares || 0}</span>
            </div>
            <input
              type="number"
              min={1}
              max={selectedGrant?.vestedShares || 10000}
              value={exerciseShares}
              onChange={(e) => setExerciseShares(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Target Share Price ($)</span>
              <span className="text-emerald-400">Current: {formatCurrency(defaultHoldingPrice)}</span>
            </div>
            <input
              type="number"
              step="0.5"
              min="1"
              value={targetStockPrice}
              onChange={(e) => setTargetStockPrice(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>Estimated Tax / AMT Rate (%)</span>
              <span className="text-slate-400">{taxRatePercent}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="50"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        {/* Financial Flow Visualization */}
        <div className="lg:col-span-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
              <span className="text-slate-400 font-medium">Cash Needed to Exercise</span>
              <div className="text-lg font-bold text-slate-100 mt-1">{formatCurrency(totalCost)}</div>
              <span className="text-[10px] text-slate-500">
                {exerciseShares} shares @ {formatCurrency(strikePrice)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
              <span className="text-slate-400 font-medium">Gross Stock Value</span>
              <div className="text-lg font-bold text-sky-400 mt-1">
                {formatCurrency(targetMarketValue)}
              </div>
              <span className="text-[10px] text-slate-500">
                {exerciseShares} shares @ {formatCurrency(targetStockPrice)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
              <span className="text-slate-400 font-medium">Est. Tax / AMT Spread</span>
              <div className="text-lg font-bold text-amber-400 mt-1">
                {formatCurrency(estimatedTax)}
              </div>
              <span className="text-[10px] text-slate-500">Spread: {formatCurrency(grossSpread)}</span>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  Projected Net Gain After Tax
                </span>
                <div className="text-2xl font-black text-slate-100 mt-0.5">{formatCurrency(netGain)}</div>
              </div>
            </div>
            <div className="hidden sm:flex items-center text-xs text-emerald-400 font-medium space-x-1">
              <span>{Math.round((netGain / (totalCost || 1)) * 100)}% ROI</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
