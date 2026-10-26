import React from 'react';
import { KeyRound, AlertTriangle, Info, PlugZap, Loader2 } from 'lucide-react';

interface BridgeStatusBannerProps {
  isExtensionConnected: boolean;
  isSyncing: boolean;
  isAuthRequired: boolean;
  authMessage: string | null;
  syncError: string | null;
  isMockMode: boolean;
}

export const BridgeStatusBanner: React.FC<BridgeStatusBannerProps> = ({
  isExtensionConnected,
  isSyncing,
  isAuthRequired,
  authMessage,
  syncError,
  isMockMode,
}) => {
  if (syncError) {
    return (
      <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 mb-6 flex items-start space-x-3 text-rose-200">
        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-rose-300">Synchronization Error</h3>
          <p className="text-xs text-rose-300/80 mt-0.5">{syncError}</p>
        </div>
      </div>
    );
  }

  if (isAuthRequired) {
    return (
      <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 mb-6 flex items-start space-x-3 text-amber-200">
        <KeyRound className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
        <div>
          <h3 className="text-sm font-semibold text-amber-300">Authentication / MFA Required</h3>
          <p className="text-xs text-amber-300/80 mt-0.5">
            {authMessage || 'Please complete login and 2FA in the open Shareworks browser tab.'} The companion extension will automatically capture and forward your portfolio upon completion.
          </p>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="bg-sky-950/40 border border-sky-800/80 rounded-xl p-4 mb-6 flex items-center space-x-3 text-sky-200">
        <Loader2 className="w-5 h-5 text-sky-400 flex-shrink-0 animate-spin" />
        <div>
          <h3 className="text-sm font-semibold text-sky-300">Extracting Equity Data</h3>
          <p className="text-xs text-sky-300/80">Connecting to Shareworks session and sanitizing portfolio structures...</p>
        </div>
      </div>
    );
  }

  if (!isExtensionConnected && !isMockMode) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex items-start space-x-3 text-slate-300">
        <PlugZap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Companion Chrome Extension Not Detected</h3>
          <p className="text-xs text-slate-400 mt-1">
            To automatically sync your live Shareworks equity without exposing credentials:
          </p>
          <ol className="text-xs text-slate-400 mt-1 list-decimal list-inside space-y-0.5">
            <li>Build the extension: <code className="text-emerald-400 font-mono">npm run build -w extension</code></li>
            <li>In Chrome, navigate to <code className="text-slate-300 font-mono">chrome://extensions</code>, enable Developer mode, and click <strong>Load unpacked</strong> selecting <code className="text-slate-300 font-mono">packages/extension/dist</code></li>
            <li>Or click <strong>Mock: ON</strong> above to test with local sample data.</li>
          </ol>
        </div>
      </div>
    );
  }

  if (isMockMode) {
    return (
      <div className="bg-purple-950/30 border border-purple-800/60 rounded-xl p-3.5 mb-6 flex items-center space-x-3 text-purple-200">
        <Info className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <div className="text-xs">
          <span className="font-semibold text-purple-300">Local Development Mock Mode Active:</span> Synchronizing with mock fixtures simulating realistic multi-grant models (RSUs, ISOs, ESPP) and a 2-second MFA transition.
        </div>
      </div>
    );
  }

  return null;
};
