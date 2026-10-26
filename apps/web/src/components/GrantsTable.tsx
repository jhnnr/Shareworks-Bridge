import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import type { Grant } from '../types/equity';

interface GrantsTableProps {
  grants: Grant[];
}

export const GrantsTable: React.FC<GrantsTableProps> = ({ grants }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedGrantId, setExpandedGrantId] = useState<string | null>(null);

  const filteredGrants = grants.filter((grant) => {
    const matchesSearch = grant.grantId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || grant.grantType === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || grant.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const formatCurrency = (val: number | null | undefined, showSign = false) => {
    if (val === null || val === undefined) return '—';
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

  const toggleExpand = (id: string) => {
    setExpandedGrantId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm mb-8">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Equity Grants & Vesting Schedules</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filteredGrants.length} of {grants.length} grants displayed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search grant ID..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 w-44"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">All Types</option>
            <option value="RSU">RSU</option>
            <option value="ISO">ISO</option>
            <option value="NSO">NSO</option>
            <option value="ESPP">ESPP</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="FULLY_VESTED">FULLY VESTED</option>
            <option value="EXERCISED">EXERCISED</option>
          </select>
        </div>
      </div>

      {/* Grants Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-8"></th>
              <th className="py-3 px-4">Grant ID</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Total Granted</th>
              <th className="py-3 px-4">Vested / Unvested</th>
              <th className="py-3 px-4">Vesting Progress</th>
              <th className="py-3 px-4">Strike / Cost</th>
              <th className="py-3 px-4">Market Value</th>
              <th className="py-3 px-4">PnL / Return</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredGrants.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500">
                  No equity grants match the current filters.
                </td>
              </tr>
            ) : (
              filteredGrants.map((grant) => {
                const isExpanded = expandedGrantId === grant.grantId;
                const vestPercent =
                  grant.totalGrantedShares > 0
                    ? Math.round((grant.vestedShares / grant.totalGrantedShares) * 100)
                    : 0;

                const costBasis =
                  grant.costBasis ??
                  (grant.exercisePrice ? grant.totalGrantedShares * grant.exercisePrice : 0);
                const pnl = grant.marketValue - costBasis;
                const pnlPercent =
                  costBasis > 0
                    ? (pnl / costBasis) * 100
                    : grant.marketValue > 0 && costBasis === 0
                    ? 100
                    : 0;
                const isPnlPositive = pnl >= 0;

                return (
                  <React.Fragment key={grant.grantId}>
                    <tr
                      onClick={() => toggleExpand(grant.grantId)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-300" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                        {grant.grantId}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{grant.grantDate}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            grant.grantType === 'RSU'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : grant.grantType === 'ISO'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {grant.grantType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {formatNumber(grant.totalGrantedShares)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="text-emerald-400 font-medium">
                          {formatNumber(grant.vestedShares)}
                        </span>{' '}
                        /{' '}
                        <span className="text-slate-400 font-medium">
                          {formatNumber(grant.unvestedShares)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 w-36">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${vestPercent}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {vestPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {formatCurrency(grant.exercisePrice)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {formatCurrency(grant.marketValue)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div
                          className={`font-semibold text-xs ${
                            isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatCurrency(pnl, true)}
                        </div>
                        <div
                          className={`text-[10px] font-medium ${
                            isPnlPositive ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {pnlPercent >= 0 ? `+${pnlPercent.toFixed(1)}%` : `${pnlPercent.toFixed(1)}%`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            grant.status === 'FULLY_VESTED'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800'
                              : grant.status === 'ACTIVE'
                              ? 'bg-blue-950/40 text-blue-400 border border-blue-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {grant.status}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Schedule Detail */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70">
                        <td colSpan={11} className="p-4 pl-12 border-b border-slate-800">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-semibold text-slate-300">
                              Vesting & Purchase Details for {grant.grantId}
                            </h4>
                            {costBasis > 0 && (
                              <div className="text-[11px] text-slate-400 flex items-center space-x-3">
                                <span>Cost Basis: <strong className="text-slate-200">{formatCurrency(costBasis)}</strong></span>
                                <span>Net PnL: <strong className={isPnlPositive ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(pnl, true)} ({pnlPercent.toFixed(2)}%)</strong></span>
                              </div>
                            )}
                          </div>
                          {grant.vestingSchedule.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">No milestone breakdown available.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              {grant.vestingSchedule.map((milestone, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 text-xs"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-slate-400 text-[11px]">{milestone.date}</span>
                                    {milestone.status === 'VESTED' ? (
                                      <span className="flex items-center text-emerald-400 text-[10px] font-medium">
                                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Vested
                                      </span>
                                    ) : (
                                      <span className="flex items-center text-amber-400 text-[10px] font-medium">
                                        <Clock className="w-3 h-3 mr-0.5" /> Unvested
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-semibold text-slate-200">
                                    {formatNumber(milestone.shares)} shares
                                  </div>
                                  {milestone.projectedValue !== undefined && (
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {formatCurrency(milestone.projectedValue)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
