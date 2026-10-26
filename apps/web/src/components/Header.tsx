import React from 'react';
import { RefreshCw, ShieldCheck, AlertCircle, Trash2, Cpu, Clock } from 'lucide-react';

interface HeaderProps {
  isExtensionConnected: boolean;
  isSyncing: boolean;
  isMockMode: boolean;
  lastUpdated: string | null;
  onStartSync: () => void;
  onClearCache: () => void;
  onToggleMockMode: () => void;
}

function formatLastSync(isoStr: string | null): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

export const Header: React.FC<HeaderProps> = ({
  isExtensionConnected,
  isSyncing,
  isMockMode,
  lastUpdated,
  onStartSync,
  onClearCache,
  onToggleMockMode,
}) => {
  const syncTime = formatLastSync(lastUpdated);

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
            SW
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">Shareworks Bridge</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                Local-First
              </span>
            </div>
            <p className="text-xs text-slate-400">Secure Morgan Stanley Equity Hold & Vesting Visualizer</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Last Synced Timestamp Indicator */}
          {syncTime && (
            <div
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-400"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Last Synced: <strong className="text-slate-200 font-medium">{syncTime}</strong>
              </span>
            </div>
          )}

          {/* Extension Status Badge */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isExtensionConnected
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
            }`}
          >
            {isExtensionConnected ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isMockMode ? 'Mock Bridge Active' : 'Extension Ready'}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Extension Disconnected</span>
              </>
            )}
          </div>

          {/* Toggle Mock Adapter Button */}
          <button
            onClick={onToggleMockMode}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isMockMode
                ? 'bg-purple-950/60 text-purple-300 border-purple-800 hover:bg-purple-900/60'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
            title="Toggle mock development mode simulating 2s MFA login delay and fixture data"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{isMockMode ? 'Mock: ON' : 'Mock: OFF'}</span>
          </button>

          {/* Clear Cache */}
          {lastUpdated && (
            <button
              onClick={onClearCache}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/60 rounded-lg transition-colors"
              title="Clear cached equity state from browser storage and extension memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Clear Cache</span>
            </button>
          )}

          {/* Sync Trigger Button */}
          <button
            onClick={onStartSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-xs shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
