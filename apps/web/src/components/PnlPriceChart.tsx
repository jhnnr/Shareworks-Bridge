import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, Activity } from 'lucide-react';
import type { ShareworksPortfolio } from '../types/equity';

interface PnlPriceChartProps {
  portfolio: ShareworksPortfolio;
}

interface TimelinePoint {
  date: string;
  formattedDate: string;
  timestamp: number;
  stockPrice: number;
  cumulativeShares: number;
  cumulativeCostBasis: number;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
}

export const PnlPriceChart: React.FC<PnlPriceChartProps> = ({ portfolio }) => {
  const [activeMetric, setActiveMetric] = useState<'BOTH' | 'PNL_DOLLAR' | 'PNL_PERCENT' | 'PRICE'>('BOTH');
  const [hoveredPoint, setHoveredPoint] = useState<TimelinePoint | null>(null);

  const currentPrice = portfolio.holdings[0]?.currentPrice || 50;
  const currentSymbol = portfolio.holdings[0]?.symbol || 'EQUITY';

  // Build chronological data points from grants and milestones
  const timelineData = useMemo<TimelinePoint[]>(() => {
    // 1. Gather all events from vesting schedules
    const events: Array<{
      date: string;
      shares: number;
      price: number;
      cost: number;
    }> = [];

    portfolio.grants.forEach((grant) => {
      const grantUnitPrice =
        grant.exercisePrice ||
        (grant.costBasis && grant.totalGrantedShares > 0
          ? grant.costBasis / grant.totalGrantedShares
          : currentPrice * 0.7);

      if (grant.vestingSchedule.length > 0) {
        grant.vestingSchedule.forEach((m) => {
          const milestonePrice =
            m.projectedValue && m.shares > 0
              ? m.projectedValue / m.shares
              : grantUnitPrice;

          events.push({
            date: m.date,
            shares: m.shares,
            price: milestonePrice,
            cost: m.shares * grantUnitPrice,
          });
        });
      } else {
        // Fallback for grants without discrete milestones
        events.push({
          date: grant.grantDate,
          shares: grant.totalGrantedShares,
          price: grantUnitPrice,
          cost: grant.costBasis || grant.totalGrantedShares * grantUnitPrice,
        });
      }
    });

    // 2. Sort events chronologically
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Accumulate points over time
    let runningShares = 0;
    let runningCost = 0;
    const pointsMap = new Map<string, TimelinePoint>();

    events.forEach((ev) => {
      runningShares += ev.shares;
      runningCost += ev.cost;
      const stockPrice = ev.price || currentPrice;
      const portfolioValue = runningShares * stockPrice;
      const pnl = portfolioValue - runningCost;
      const pnlPercent = runningCost > 0 ? (pnl / runningCost) * 100 : 0;

      const d = new Date(ev.date);
      const formattedDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      pointsMap.set(ev.date, {
        date: ev.date,
        formattedDate,
        timestamp: d.getTime(),
        stockPrice: Math.round(stockPrice * 100) / 100,
        cumulativeShares: Math.round(runningShares * 10000) / 10000,
        cumulativeCostBasis: Math.round(runningCost * 100) / 100,
        portfolioValue: Math.round(portfolioValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      });
    });

    // 4. Ensure current point (latest updated date / today) is included
    const todayStr = (portfolio.updatedAt || new Date().toISOString()).split('T')[0];
    const totalHoldingCost =
      portfolio.holdings[0]?.costBasis ||
      (runningCost > 0 ? runningCost : portfolio.grants.reduce((s, g) => s + (g.costBasis || 0), 0));
    const totalHoldingShares = portfolio.holdings.reduce((s, h) => s + h.totalShares, 0) || runningShares;
    const finalVal = totalHoldingShares * currentPrice;
    const finalPnl = finalVal - totalHoldingCost;
    const finalPnlPercent = totalHoldingCost > 0 ? (finalPnl / totalHoldingCost) * 100 : 0;

    const todayDate = new Date(todayStr);
    pointsMap.set(todayStr, {
      date: todayStr,
      formattedDate: todayDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      timestamp: todayDate.getTime(),
      stockPrice: currentPrice,
      cumulativeShares: totalHoldingShares,
      cumulativeCostBasis: totalHoldingCost,
      portfolioValue: finalVal,
      pnl: Math.round(finalPnl * 100) / 100,
      pnlPercent: Math.round(finalPnlPercent * 100) / 100,
    });

    const points = Array.from(pointsMap.values());
    points.sort((a, b) => a.timestamp - b.timestamp);

    // If fewer than 2 points, add a synthetic starting baseline
    if (points.length === 1) {
      const p = points[0];
      const startTimestamp = p.timestamp - 90 * 24 * 60 * 60 * 1000;
      const startDate = new Date(startTimestamp);
      const startPrice = p.stockPrice * 0.9;
      points.unshift({
        date: startDate.toISOString().split('T')[0],
        formattedDate: startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        timestamp: startTimestamp,
        stockPrice: Math.round(startPrice * 100) / 100,
        cumulativeShares: 0,
        cumulativeCostBasis: 0,
        portfolioValue: 0,
        pnl: 0,
        pnlPercent: 0,
      });
    }

    return points;
  }, [portfolio, currentPrice]);

  // Chart coordinate calculations
  const svgWidth = 800;
  const svgHeight = 280;
  const padding = { top: 20, right: 50, bottom: 40, left: 60 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Min/Max calculations
  const prices = timelineData.map((d) => d.stockPrice);
  const pnls = timelineData.map((d) => d.pnl);
  const pnlPercents = timelineData.map((d) => d.pnlPercent);

  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;

  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 100) * 1.1;

  const minPnlPercent = Math.min(...pnlPercents, 0);
  const maxPnlPercent = Math.max(...pnlPercents, 10) * 1.1;

  // Coordinate scales
  const getX = (idx: number) => {
    if (timelineData.length <= 1) return padding.left;
    return padding.left + (idx / (timelineData.length - 1)) * innerWidth;
  };

  const getYPrice = (val: number) => {
    const range = maxPrice - minPrice || 1;
    return padding.top + innerHeight - ((val - minPrice) / range) * innerHeight;
  };

  const getYPnl = (val: number) => {
    const range = maxPnl - minPnl || 1;
    return padding.top + innerHeight - ((val - minPnl) / range) * innerHeight;
  };

  const getYPnlPercent = (val: number) => {
    const range = maxPnlPercent - minPnlPercent || 1;
    return padding.top + innerHeight - ((val - minPnlPercent) / range) * innerHeight;
  };

  // Build SVG Path strings
  const pnlPath = useMemo(() => {
    if (timelineData.length === 0) return '';
    return timelineData
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)},${getYPnl(d.pnl)}`)
      .join(' ');
  }, [timelineData, minPnl, maxPnl]);

  const pnlAreaPath = useMemo(() => {
    if (timelineData.length === 0) return '';
    const zeroY = getYPnl(0);
    const linePart = timelineData
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)},${getYPnl(d.pnl)}`)
      .join(' ');
    const lastX = getX(timelineData.length - 1);
    const firstX = getX(0);
    return `${linePart} L ${lastX},${zeroY} L ${firstX},${zeroY} Z`;
  }, [timelineData, minPnl, maxPnl]);

  const pricePath = useMemo(() => {
    if (timelineData.length === 0) return '';
    return timelineData
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)},${getYPrice(d.stockPrice)}`)
      .join(' ');
  }, [timelineData, minPrice, maxPrice]);

  const pnlPercentPath = useMemo(() => {
    if (timelineData.length === 0) return '';
    return timelineData
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)},${getYPnlPercent(d.pnlPercent)}`)
      .join(' ');
  }, [timelineData, minPnlPercent, maxPnlPercent]);

  const latestPoint = timelineData[timelineData.length - 1] || timelineData[0];
  const activeDisplay = hoveredPoint || latestPoint;
  const isPnlPositive = (activeDisplay?.pnl ?? 0) >= 0;

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-8 shadow-sm">
      {/* Chart Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">Historical Performance & Price</h3>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {currentSymbol}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Portfolio Return ($ / %) and Stock Price progression across transaction dates
          </p>
        </div>

        {/* Metric Toggles */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveMetric('BOTH')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeMetric === 'BOTH'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dual View
          </button>
          <button
            onClick={() => setActiveMetric('PNL_DOLLAR')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeMetric === 'PNL_DOLLAR'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PnL ($)
          </button>
          <button
            onClick={() => setActiveMetric('PNL_PERCENT')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeMetric === 'PNL_PERCENT'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Return (%)
          </button>
          <button
            onClick={() => setActiveMetric('PRICE')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeMetric === 'PRICE'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stock Price
          </button>
        </div>
      </div>

      {/* Snapshot Bar of active/hovered data point */}
      {activeDisplay && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Timeline Date</span>
            <span className="font-semibold text-slate-200 mt-0.5 flex items-center">
              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
              {activeDisplay.formattedDate}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Stock Price</span>
            <span className="font-semibold text-sky-400 mt-0.5 block">
              {formatCurrency(activeDisplay.stockPrice)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Cumulative PnL ($)</span>
            <span
              className={`font-semibold mt-0.5 flex items-center ${
                isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPnlPositive ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {formatCurrency(activeDisplay.pnl, true)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Total Return (%)</span>
            <span
              className={`font-semibold mt-0.5 block ${
                isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activeDisplay.pnlPercent >= 0
                ? `+${activeDisplay.pnlPercent.toFixed(2)}%`
                : `${activeDisplay.pnlPercent.toFixed(2)}%`}
            </span>
          </div>
        </div>
      )}

      {/* SVG Interactive Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Green PnL Gradient */}
            <linearGradient id="pnlGreenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Price Glow Filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={svgWidth - padding.right}
            y2={padding.top}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight / 2}
            x2={svgWidth - padding.right}
            y2={padding.top + innerHeight / 2}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={svgWidth - padding.right}
            y2={padding.top + innerHeight}
            stroke="#334155"
          />

          {/* Zero baseline for PnL */}
          {(activeMetric === 'BOTH' || activeMetric === 'PNL_DOLLAR') && (
            <line
              x1={padding.left}
              y1={getYPnl(0)}
              x2={svgWidth - padding.right}
              y2={getYPnl(0)}
              stroke="#64748b"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          )}

          {/* 1. PnL Area & Line (Green) */}
          {(activeMetric === 'BOTH' || activeMetric === 'PNL_DOLLAR') && (
            <>
              <path d={pnlAreaPath} fill="url(#pnlGreenGrad)" />
              <path
                d={pnlPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* 2. PnL Percent Line (Purple) */}
          {activeMetric === 'PNL_PERCENT' && (
            <path
              d={pnlPercentPath}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 3. Stock Price Line (Sky Blue) */}
          {(activeMetric === 'BOTH' || activeMetric === 'PRICE') && (
            <path
              d={pricePath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray={activeMetric === 'BOTH' ? '5 3' : undefined}
              filter={activeMetric === 'PRICE' ? 'url(#glow)' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data point circles & hover targets */}
          {timelineData.map((pt, idx) => {
            const cx = getX(idx);
            const cy =
              activeMetric === 'PRICE'
                ? getYPrice(pt.stockPrice)
                : activeMetric === 'PNL_PERCENT'
                ? getYPnlPercent(pt.pnlPercent)
                : getYPnl(pt.pnl);

            const isHovered = hoveredPoint?.timestamp === pt.timestamp;

            return (
              <g key={idx}>
                {/* Vertical tracking hover line */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={padding.top}
                    x2={cx}
                    y2={padding.top + innerHeight}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}

                {/* Visible dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? '#ffffff' : activeMetric === 'PRICE' ? '#38bdf8' : '#10b981'}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* Invisible wide hit area for easy mouse hover */}
                <rect
                  x={cx - innerWidth / (timelineData.length * 2)}
                  y={padding.top}
                  width={innerWidth / timelineData.length}
                  height={innerHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(pt)}
                />
              </g>
            );
          })}

          {/* Left Y-Axis Labels (PnL or Price) */}
          <text
            x={padding.left - 8}
            y={padding.top + 4}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="end"
            fontFamily="monospace"
          >
            {activeMetric === 'PRICE'
              ? formatCurrency(maxPrice)
              : activeMetric === 'PNL_PERCENT'
              ? `+${maxPnlPercent.toFixed(1)}%`
              : formatCurrency(maxPnl)}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + innerHeight}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="end"
            fontFamily="monospace"
          >
            {activeMetric === 'PRICE'
              ? formatCurrency(minPrice)
              : activeMetric === 'PNL_PERCENT'
              ? `${minPnlPercent.toFixed(1)}%`
              : formatCurrency(minPnl)}
          </text>

          {/* Right Y-Axis Label (Stock Price in Dual Mode) */}
          {activeMetric === 'BOTH' && (
            <>
              <text
                x={svgWidth - padding.right + 8}
                y={padding.top + 4}
                fill="#38bdf8"
                fontSize="10"
                textAnchor="start"
                fontFamily="monospace"
              >
                {formatCurrency(maxPrice)}
              </text>
              <text
                x={svgWidth - padding.right + 8}
                y={padding.top + innerHeight}
                fill="#38bdf8"
                fontSize="10"
                textAnchor="start"
                fontFamily="monospace"
              >
                {formatCurrency(minPrice)}
              </text>
            </>
          )}

          {/* X-Axis Date Labels */}
          {timelineData.length > 0 && (
            <>
              <text
                x={padding.left}
                y={svgHeight - 12}
                fill="#64748b"
                fontSize="10"
                textAnchor="start"
              >
                {timelineData[0].formattedDate}
              </text>
              <text
                x={svgWidth - padding.right}
                y={svgHeight - 12}
                fill="#64748b"
                fontSize="10"
                textAnchor="end"
              >
                {timelineData[timelineData.length - 1].formattedDate}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400 mt-2">
        <div className="flex items-center space-x-4">
          {(activeMetric === 'BOTH' || activeMetric === 'PNL_DOLLAR') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span>Cumulative PnL ($)</span>
            </div>
          )}
          {(activeMetric === 'BOTH' || activeMetric === 'PRICE') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
              <span>Stock Price ($)</span>
            </div>
          )}
          {activeMetric === 'PNL_PERCENT' && (
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
              <span>Return Percentage (%)</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          Hover over data points to inspect historical price and PnL
        </div>
      </div>
    </div>
  );
};
