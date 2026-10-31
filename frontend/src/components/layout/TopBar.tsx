import React from 'react';
import { ProjectInfo, ProjectMember, HumanIdentity } from '../../types';
import { RotateCcw, User, Shield, Layers, Radio, Sparkles } from 'lucide-react';

interface TopBarProps {
  project?: ProjectInfo;
  identity: HumanIdentity;
  onlineMembers: string[];
  isConnected: boolean;
  onResetDemo: () => void;
  onSwitchIdentity: () => void;
  isResetting: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  identity,
  onlineMembers,
  isConnected,
  onResetDemo,
  onSwitchIdentity,
  isResetting,
}) => {
  const isAlexOnline = onlineMembers.includes('alex');
  const isMayaOnline = onlineMembers.includes('maya');

  return (
    <header className="h-16 border-b border-[#263244] bg-[#0E1322] px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Project Identity */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-teal-400 flex items-center justify-center font-black text-white text-base shadow-lg shadow-violet-900/30">
            C
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wider text-sm text-[#F4F7FB]">COFRAME</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1B2433] text-teal-400 border border-teal-500/30">
                LedgerFlow
              </span>
            </div>
            <p className="text-[11px] text-[#98A5B7]">Human + AI Shared Creation</p>
          </div>
        </div>

        {/* Live sync badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#151B29] border border-[#263244] text-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[#98A5B7]">{isConnected ? 'Live Sync' : 'Reconnecting...'}</span>
        </div>
      </div>

      {/* Center: Version Badges */}
      <div className="hidden lg:flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#151B29] border border-[#263244] text-xs">
          <Radio className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[#98A5B7]">Context:</span>
          <span className="font-mono font-semibold text-blue-400">v{project?.context_version ?? 1}</span>
        </div>
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#151B29] border border-[#263244] text-xs">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[#98A5B7]">Artifact:</span>
          <span className="font-mono font-semibold text-emerald-400">v{project?.artifact_version ?? 1}</span>
        </div>
      </div>

      {/* Right Controls: Collaborator Presences & Identity */}
      <div className="flex items-center space-x-4">
        {/* Human Presence Indicators */}
        <div className="flex items-center space-x-2 bg-[#151B29] px-3 py-1 rounded-full border border-[#263244]">
          <div className="flex items-center space-x-1" title={isAlexOnline ? 'Alex is active online' : 'Alex offline'}>
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-[11px] font-bold text-blue-300">
                A
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0E1322] ${isAlexOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            </div>
            <span className="text-xs text-[#98A5B7]">Alex</span>
          </div>

          <span className="text-[#263244]">•</span>

          <div className="flex items-center space-x-1" title={isMayaOnline ? 'Maya is active online' : 'Maya offline'}>
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-[11px] font-bold text-purple-300">
                M
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0E1322] ${isMayaOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            </div>
            <span className="text-xs text-[#98A5B7]">Maya</span>
          </div>
        </div>

        {/* Current Active Human Identity */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#1B2433] hover:bg-[#263244] border border-[#263244] text-xs transition"
          title="Click to switch between Alex and Maya"
        >
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[#F4F7FB] font-medium">
            {identity === 'alex' ? 'Alex (Founder)' : identity === 'maya' ? 'Maya (Designer)' : 'Select Identity'}
          </span>
          <span className="text-[10px] text-[#98A5B7] underline">switch</span>
        </button>

        {/* Reset Demo Button */}
        <button
          onClick={onResetDemo}
          disabled={isResetting}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-800/40 text-xs font-medium transition disabled:opacity-50"
          title="Restore project and LedgerFlow artifact to baseline seed state"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reset Demo</span>
        </button>
      </div>
    </header>
  );
};
