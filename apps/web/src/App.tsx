import React, { useState } from 'react';
import { useShareworksBridge } from './hooks/useShareworksBridge';
import { Header } from './components/Header';
import { BridgeStatusBanner } from './components/BridgeStatusBanner';
import { KpiMetrics } from './components/KpiMetrics';
import { PnlPriceChart } from './components/PnlPriceChart';
import { GrantsTable } from './components/GrantsTable';
import { VestingChart } from './components/VestingChart';
import { ExerciseScenarioCalculator } from './components/ExerciseScenarioCalculator';
import { HoldingsSummary } from './components/HoldingsSummary';
import { ShieldCheck, RefreshCw, Layers, Calendar, Calculator, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const {
    portfolio,
    isExtensionConnected,
    isSyncing,
    isAuthRequired,
    authMessage,
    syncError,
    lastUpdated,
    isMockMode,
    startSync,
    clearCache,
    toggleMockMode,
  } = useShareworksBridge();

  const [activeTab, setActiveTab] = useState<'GRANTS' | 'TIMELINE' | 'EXERCISE'>('GRANTS');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        isExtensionConnected={isExtensionConnected}
        isSyncing={isSyncing}
        isMockMode={isMockMode}
        lastUpdated={lastUpdated}
        onStartSync={startSync}
        onClearCache={clearCache}
        onToggleMockMode={toggleMockMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BridgeStatusBanner
          isExtensionConnected={isExtensionConnected}
          isSyncing={isSyncing}
          isAuthRequired={isAuthRequired}
          authMessage={authMessage}
          syncError={syncError}
          isMockMode={isMockMode}
        />

        {/* Empty State */}
        {!portfolio ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-sm my-12">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">No Equity Data Synced Yet</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              Connect to your Shareworks portal through the companion Chrome extension or load sample data to explore your equity grants and vesting schedules.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <button
                onClick={startSync}
                disabled={isSyncing}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Connecting to Shareworks...' : 'Start Shareworks Sync'}</span>
              </button>

              <button
                onClick={toggleMockMode}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                <span>{isMockMode ? 'Disable Mock Mode' : 'Load Demo Equity Portfolio'}</span>
              </button>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Strict local-first privacy: credentials are never handled; all data stays on your device.</span>
            </div>
          </div>
        ) : (
          /* Portfolio Dashboard */
          <div>
            {/* KPI Metrics */}
            <KpiMetrics portfolio={portfolio} />

            {/* Historical PnL & Stock Price Over Time Chart */}
            <PnlPriceChart portfolio={portfolio} />

            {/* Holdings Summary */}
            <HoldingsSummary holdings={portfolio.holdings} />

            {/* View Navigation Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-6">
              <button
                onClick={() => setActiveTab('GRANTS')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'GRANTS'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Grants & Vesting Breakdown</span>
              </button>

              <button
                onClick={() => setActiveTab('TIMELINE')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'TIMELINE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Vesting Milestones Timeline</span>
              </button>

              <button
                onClick={() => setActiveTab('EXERCISE')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'EXERCISE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Option Exercise Modeler</span>
              </button>
            </div>

            {/* Active Tab View */}
            {activeTab === 'GRANTS' && <GrantsTable grants={portfolio.grants} />}
            {activeTab === 'TIMELINE' && <VestingChart grants={portfolio.grants} />}
            {activeTab === 'EXERCISE' && (
              <ExerciseScenarioCalculator grants={portfolio.grants} holdings={portfolio.holdings} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Zero Credential Handling &bull; Origin Verified postMessage &bull; Local-First Storage</span>
          </div>
          <div>Shareworks Bridge &mdash; Designed for Morgan Stanley Shareworks (Solium)</div>
        </div>
      </footer>
    </div>
  );
};
