import React, { useState } from 'react';
import { ProjectInfo, HumanIdentity } from '../../types';
import { PruneModal } from '../prune/PruneModal';
import {
  RotateCcw,
  Sparkles,
  Compass,
  Radio,
  Layers,
  Users,
  Info,
  ChevronDown,
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
  onToggleCollaboratorsPanel?: () => void;
  isCollaboratorsPanelOpen?: boolean;
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
  onToggleCollaboratorsPanel,
  isCollaboratorsPanelOpen = false,
}) => {
  const isAlexOnline = onlineMembers.includes('alex');
  const isMayaOnline = onlineMembers.includes('maya');
  const [showPruneModal, setShowPruneModal] = useState(false);
  const [showVersionTooltip, setShowVersionTooltip] = useState(false);

  return (
    <header className="h-16 border-b border-[#E7ECF2] bg-white px-6 flex items-center justify-between z-30 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* 1. Left: Brand & Active Project */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-700 to-violet-600 flex items-center justify-center font-bold text-white text-sm shadow-2xs">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm text-[#172033]">COFRAME</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-[#172033]">
                LedgerFlow
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Connection Status Dot */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F8FAFC] border border-[#E7ECF2] text-xs text-[#657189]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="text-[11px] font-medium">{isConnected ? 'Live Sync' : 'Connecting...'}</span>
        </div>
      </div>

      {/* 2. Middle: Provenance Versions Chips with Explain Popover */}
      <div className="hidden lg:flex items-center gap-2 text-xs relative">
        <div
          onMouseEnter={() => setShowVersionTooltip(true)}
          onMouseLeave={() => setShowVersionTooltip(false)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E7ECF2] text-[#657189] hover:border-blue-300 transition">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-medium">Context:</span>
            <span className="font-mono font-bold text-blue-700">v{project?.context_version ?? 1}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E7ECF2] text-[#657189] hover:border-teal-300 transition">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] font-medium">Artifact:</span>
            <span className="font-mono font-bold text-teal-700">v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {/* Provenance Explainer Tooltip */}
        {showVersionTooltip && (
          <div className="absolute top-10 left-0 w-72 bg-white rounded-xl border border-[#E7ECF2] p-3 shadow-xl z-50 text-xs text-[#657189] animate-in fade-in zoom-in-95 duration-100">
            <div className="font-bold text-[#172033] mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-teal-600" />
              <span>Version Provenance</span>
            </div>
            <p className="leading-relaxed">
              <strong className="text-blue-700">Context Version</strong> tracks verified requirements and decisions.
            </p>
            <p className="mt-1 leading-relaxed">
              <strong className="text-teal-700">Artifact Version</strong> tracks the canonical LedgerFlow product release.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right: Collaborators Presence, Guided Demo, Identity & Reset */}
      <div className="flex items-center gap-3">
        {/* Collaborators Toggle Pill */}
        {onToggleCollaboratorsPanel && (
          <button
            onClick={onToggleCollaboratorsPanel}
            className={`hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              isCollaboratorsPanelOpen
                ? 'bg-teal-50 border-teal-200 text-teal-900 shadow-2xs font-semibold'
                : 'bg-white border-[#E7ECF2] text-[#657189] hover:bg-[#F8FAFC] hover:text-[#172033]'
            }`}
            title="Toggle Collaborators Panel"
          >
            <div className="flex items-center -space-x-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center border border-white">
                A
              </div>
              <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center border border-white">
                M
              </div>
              <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold text-[10px] flex items-center justify-center border border-white">
                N
              </div>
              <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 font-bold text-[10px] flex items-center justify-center border border-white">
                P
              </div>
            </div>
            <span className="text-[11px]">Team (4)</span>
          </button>
        )}

        {/* Guided Demo Button */}
        {onToggleDemoGuide && (
          <button
            onClick={onToggleDemoGuide}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              isDemoGuideOpen
                ? 'bg-teal-700 text-white'
                : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-teal-600" />
            <span>Guided Demo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          </button>
        )}

        {/* Active Identity Pill & Switcher */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E7ECF2] text-xs font-semibold text-[#172033] transition cursor-pointer"
          title="Click to switch collaborator identity"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              identity === 'alex' ? 'bg-blue-600' : 'bg-purple-600'
            }`}
          />
          <span>{identity === 'alex' ? 'Alex (Founder)' : 'Maya (Designer)'}</span>
          <span className="text-[10px] text-[#657189] uppercase tracking-wider font-bold">Switch</span>
        </button>

        {/* Prune AI Seatbelt Pill */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer"
          title="Prune AI Seatbelt (BIOS V2 Workshop) — Vault, Shield & Signed Receipts"
        >
          <span>🛡️</span>
          <span className="hidden sm:inline">Prune Seatbelt</span>
        </button>

        {/* Reset Demo Secondary Action */}
        <button
          onClick={onResetDemo}
          disabled={isResetting}
          className="p-2 rounded-xl text-[#657189] hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200 cursor-pointer"
          title="Reset Demo to Baseline State"
        >
          <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin text-red-500' : ''}`} />
        </button>
      </div>

      <PruneModal isOpen={showPruneModal} onClose={() => setShowPruneModal(false)} />
    </header>
  );
};
