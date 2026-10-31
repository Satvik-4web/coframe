import React, { useState } from 'react';
import { ProjectInfo, HumanIdentity } from '../../types';
import { PruneModal } from '../prune/PruneModal';
import {
  RotateCcw,
  Sparkles,
  Compass,
  MoreVertical,
  Radio,
  Layers,
  CheckCircle2,
  ChevronDown,
  UserCheck,
} from 'lucide-react';

interface TopBarProps {
  project?: ProjectInfo;
  identity: HumanIdentity;
  onlineMembers: string[];
  isConnected: boolean;
  onResetDemo: () => void;
  onSwitchIdentity: () => void;
  isResetting: boolean;
  onToggleDemoGuide?: () => void;
  isDemoGuideOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  identity,
  onlineMembers,
  isConnected,
  onResetDemo,
  onSwitchIdentity,
  isResetting,
  onToggleDemoGuide,
  isDemoGuideOpen = false,
}) => {
  const isAlexOnline = onlineMembers.includes('alex');
  const isMayaOnline = onlineMembers.includes('maya');
  const [showMenu, setShowMenu] = useState(false);
  const [showPruneModal, setShowPruneModal] = useState(false);

  return (
    <header className="h-16 border-b border-[#E5EAF0] bg-white px-6 flex items-center justify-between z-30 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* 1. Left: Brand, Workspace & Live Sync */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-violet-600 flex items-center justify-center font-black text-white text-sm shadow-sm">
            C
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-base text-[#172033]">COFRAME</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#172033] border border-slate-200">
                LedgerFlow
              </span>
            </div>
          </div>
        </div>

        {/* Sync indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-[#657189]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="text-[11px] font-medium">{isConnected ? 'Synced' : 'Connecting...'}</span>
        </div>
      </div>

      {/* 2. Center: Compact Version Chips */}
      <div className="hidden lg:flex items-center space-x-2 text-xs">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#657189]">
          <Radio className="w-3.5 h-3.5 text-blue-600" />
          <span>Context:</span>
          <span className="font-mono font-bold text-blue-700">v{project?.context_version ?? 1}</span>
        </div>
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#657189]">
          <Layers className="w-3.5 h-3.5 text-teal-600" />
          <span>Artifact:</span>
          <span className="font-mono font-bold text-teal-700">v{project?.artifact_version ?? 1}</span>
        </div>
      </div>

      {/* 3. Right: Presences, Identity, Guided Demo & Actions */}
      <div className="flex items-center space-x-3">
        {/* Collaborators Active Presence */}
        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
          {/* Alex Avatar */}
          <div
            className="flex items-center space-x-1.5 cursor-help"
            title={isAlexOnline ? 'Alex (Founder) is active' : 'Alex is offline'}
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                  isAlexOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            </div>
            <span className="text-xs font-medium text-[#172033]">Alex</span>
          </div>

          <span className="text-slate-300">•</span>

          {/* Maya Avatar */}
          <div
            className="flex items-center space-x-1.5 cursor-help"
            title={isMayaOnline ? 'Maya (Designer) is active' : 'Maya is offline'}
          >
            <div className="relative">
              <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                M
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                  isMayaOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            </div>
            <span className="text-xs font-medium text-[#172033]">Maya</span>
          </div>
        </div>

        {/* Guided Demo Button */}
        {onToggleDemoGuide && (
          <button
            onClick={onToggleDemoGuide}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm ${
              isDemoGuideOpen
                ? 'bg-teal-700 text-white shadow'
                : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-teal-600" />
            <span>Guided Demo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          </button>
        )}

        {/* Current Active Identity Pill with Switcher */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-medium text-[#172033] transition"
          title="Click to switch collaborator identity"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              identity === 'alex' ? 'bg-blue-600' : 'bg-violet-600'
            }`}
          />
          <span>{identity === 'alex' ? 'Alex (Founder)' : 'Maya (Designer)'}</span>
          <span className="text-[11px] text-[#657189] hover:underline">Switch</span>
        </button>

        {/* Prune AI Seatbelt Pill & Modal Trigger */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300"
          title="Prune AI Seatbelt (BIOS V2 Workshop) — Vault, Shield & Signed Receipts"
        >
          <span className="text-sm">🛡️</span>
          <span className="hidden sm:inline">Prune Seatbelt</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        {/* Reset Demo Secondary Action */}
        <button
          onClick={onResetDemo}
          disabled={isResetting}
          className="p-2 rounded-lg text-[#657189] hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
          title="Reset Demo to Baseline State"
        >
          <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin text-red-500' : ''}`} />
        </button>
      </div>

      <PruneModal isOpen={showPruneModal} onClose={() => setShowPruneModal(false)} />
    </header>
  );
};
