import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';
import type { Grant } from '../types/equity';

interface VestingChartProps {
  grants: Grant[];
}

interface FlattenedMilestone {
  grantId: string;
  grantType: string;
  date: string;
  shares: number;
  status: 'VESTED' | 'UNVESTED';
  projectedValue?: number;
}

export const VestingChart: React.FC<VestingChartProps> = ({ grants }) => {
  const [filter, setFilter] = useState<'ALL' | 'UNVESTED'>('UNVESTED');

  // Flatten all vesting schedules from all grants
  const allMilestones: FlattenedMilestone[] = grants.flatMap((grant) =>
    grant.vestingSchedule.map((m) => ({
      grantId: grant.grantId,
      grantType: grant.grantType,
      date: m.date,
      shares: m.shares,
      status: m.status,
      projectedValue: m.projectedValue,
    }))
  );

  // Sort milestones chronologically
  allMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const displayedMilestones =
    filter === 'UNVESTED'
      ? allMilestones.filter((m) => m.status === 'UNVESTED')
      : allMilestones;

  const maxShares = Math.max(...displayedMilestones.map((m) => m.shares), 1);

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-4 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">Vesting Timeline & Milestones</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Projection of share distributions across chronological vesting dates
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('UNVESTED')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'UNVESTED'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Upcoming Only
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'ALL'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Milestones
          </button>
        </div>
      </div>

      {displayedMilestones.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          No vesting milestones to display for the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {displayedMilestones.map((m, idx) => {
            const barWidthPercent = Math.max((m.shares / maxShares) * 100, 8);
            const isVested = m.status === 'VESTED';

            return (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3 md:w-56 flex-shrink-0">
                  <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]">
                    {m.date}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                      <span>{m.grantId}</span>
                      <span className="text-[10px] text-slate-400">({m.grantType})</span>
                    </div>
                    <div className="flex items-center text-[10px] mt-0.5">
                      {isVested ? (
                        <span className="flex items-center text-emerald-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Vested
                        </span>
                      ) : (
                        <span className="flex items-center text-amber-400">
                          <Clock className="w-3 h-3 mr-1" /> Unvested
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar visualizer */}
                <div className="flex-1 max-w-xl">
                  <div className="h-4 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded ${
                        isVested
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                          : 'bg-gradient-to-r from-amber-600 to-amber-400'
                      }`}
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                </div>

                {/* Shares & Projected Dollar Value */}
                <div className="text-right md:w-44 flex-shrink-0">
                  <div className="font-bold text-slate-200">{formatNumber(m.shares)} shares</div>
                  {m.projectedValue !== undefined && (
                    <div className="text-[11px] text-slate-400">{formatCurrency(m.projectedValue)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
