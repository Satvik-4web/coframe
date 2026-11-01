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
  Shield,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { loadDemoScenario } from '../../lib/api';

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
  isCleanBaseline?: boolean;
  onRefresh?: () => void;
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
  isCleanBaseline = false,
  onRefresh,
}) => {
  const [showPruneModal, setShowPruneModal] = useState(false);
  const [showVersionTooltip, setShowVersionTooltip] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);

  const handleLoadDemoScenario = async () => {
    setShowResetMenu(false);
    setIsLoadingScenario(true);
    try {
      await loadDemoScenario();
      if (onRefresh) onRefresh();
    } catch {
      alert('Failed to load demo scenario');
    } finally {
      setIsLoadingScenario(false);
    }
  };

  // Derive real connection label
  const connectionLabel = isConnected ? 'Connected' : 'Reconnecting...';

  return (
    <header className="h-14 border-b border-[#E8EAF2] bg-white/95 backdrop-blur-md px-5 flex items-center justify-between z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)] sticky top-0">
      {/* 1. Left: Active Project Selector, Scenario State & Live Connection Status */}
      <div className="flex items-center gap-3">
        {/* Project Selector */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#F7F8FC] border border-[#E8EAF2] hover:border-slate-300 transition cursor-pointer">
          <span className="w-2 h-2 rounded-full bg-indigo-600" />
          <span className="text-xs font-bold text-[#172033]">LedgerFlow</span>
          <span className="text-[10px] text-[#657189] font-medium hidden sm:inline">v2</span>
        </div>

        {/* Scenario Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-[#E8EAF2] bg-[#F7F8FC]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isCleanBaseline ? 'bg-emerald-500' : 'bg-violet-600 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-semibold text-[#172033]">
            {isCleanBaseline ? 'Clean Baseline' : 'Demo Scenario'}
          </span>
        </div>

        {/* Live WebSocket Connection Status (Real state, never hardcoded) */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-800'
              : 'bg-amber-50/80 border-amber-200/80 text-amber-800'
          }`}
          title={isConnected ? 'Real-time WebSocket connected' : 'WebSocket connecting or recovering'}
        >
          {isConnected ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          )}
          <span className="text-[11px]">{connectionLabel}</span>
        </div>
      </div>

      {/* 2. Centre: Context & Artifact Version Anchors */}
      <div className="hidden lg:flex items-center gap-2 text-xs relative">
        <div
          onMouseEnter={() => setShowVersionTooltip(true)}
          onMouseLeave={() => setShowVersionTooltip(false)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F8FC] border border-[#E8EAF2] text-[#657189] hover:border-blue-300 transition">
            <Radio className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[11px] font-medium">Context:</span>
            <span className="font-mono font-bold text-[#2563EB]">v{project?.context_version ?? 1}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F8FC] border border-[#E8EAF2] text-[#657189] hover:border-teal-300 transition">
            <Layers className="w-3.5 h-3.5 text-[#0D9488]" />
            <span className="text-[11px] font-medium">Artifact:</span>
            <span className="font-mono font-bold text-[#0D9488]">v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {showVersionTooltip && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl border border-[#E8EAF2] p-3 shadow-xl z-50 text-xs text-[#657189] animate-in fade-in zoom-in-95 duration-100">
            <div className="font-bold text-[#172033] mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>Version Provenance</span>
            </div>
            <p className="leading-relaxed">
              <strong className="text-[#2563EB]">Context Version:</strong> Increments with approved requirements, product decisions, and PRDs.
            </p>
            <p className="mt-1 leading-relaxed">
              <strong className="text-[#0D9488]">Artifact Version:</strong> Increments when code or section changes are committed to LedgerFlow.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right: Participant Avatars, Guided Demo, Identity Switcher, Reset Actions */}
      <div className="flex items-center gap-2">
        {/* 4 Participant Avatars: Alex, Maya, NOVA, PIXEL */}
        <div className="hidden sm:flex items-center -space-x-1.5 mr-1" title="COFRAME Active Collaborators">
          <div
            className="w-7 h-7 rounded-full bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xs"
            title="Alex (Founder / Decision Owner)"
          >
            A
          </div>
          <div
            className="w-7 h-7 rounded-full bg-[#D946A1] text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xs"
            title="Maya (Product Designer)"
          >
            M
          </div>
          <div
            className="w-7 h-7 rounded-full bg-[#7C3AED] text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xs"
            title="NOVA (AI Product Strategist)"
          >
            N
          </div>
          <div
            className="w-7 h-7 rounded-full bg-[#0D9488] text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xs"
            title="PIXEL (AI Software Engineer)"
          >
            P
          </div>
        </div>

        {/* Collaborators Panel Toggle Pill */}
        {onToggleCollaboratorsPanel && (
          <button
            onClick={onToggleCollaboratorsPanel}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              isCollaboratorsPanelOpen
                ? 'bg-violet-50 border-violet-200 text-violet-900 font-semibold'
                : 'bg-white border-[#E8EAF2] text-[#657189] hover:bg-[#F7F8FC] hover:text-[#172033]'
            }`}
            title="Toggle Team & Collaborators Drawer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">Team ({onlineMembers.length > 0 ? onlineMembers.length : 4})</span>
          </button>
        )}

        {/* Guided Demo Button */}
        {onToggleDemoGuide && (
          <button
            onClick={onToggleDemoGuide}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              isDemoGuideOpen
                ? 'bg-violet-700 text-white'
                : 'bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-violet-600" />
            <span>Guided Demo</span>
          </button>
        )}

        {/* Active Identity Switcher */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7F8FC] hover:bg-slate-100 border border-[#E8EAF2] text-xs font-semibold text-[#172033] transition cursor-pointer"
          title="Click to switch collaborator role (Alex ↔ Maya)"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              identity === 'alex' ? 'bg-[#2563EB]' : 'bg-[#D946A1]'
            }`}
          />
          <span>{identity === 'alex' ? 'Alex' : 'Maya'}</span>
          <span className="text-[10px] text-[#657189] uppercase tracking-wider font-bold">Switch</span>
        </button>

        {/* Prune AI Security Shield */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="p-1.5 rounded-xl text-emerald-800 hover:bg-emerald-50 transition border border-transparent hover:border-emerald-200 cursor-pointer"
          title="Prune AI Cryptographic Seatbelt & Audit Receipts"
        >
          <Shield className="w-4 h-4 text-emerald-600" />
        </button>

        {/* Reset / Scenario Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="p-1.5 rounded-xl text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition border border-transparent hover:border-slate-200 cursor-pointer flex items-center gap-0.5"
            title="Workspace Reset & Demo Scenarios"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin text-violet-600' : ''}`} />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showResetMenu && (
            <div className="absolute right-0 top-10 w-56 bg-white rounded-xl border border-[#E8EAF2] shadow-xl z-50 p-1.5 space-y-1 text-xs">
              <button
                onClick={() => {
                  setShowResetMenu(false);
                  onResetDemo();
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-red-50 text-red-700 font-semibold transition"
              >
                <div className="font-bold text-xs">Reset to Clean Baseline</div>
                <div className="text-[10px] text-red-500 font-normal mt-0.5">
                  Wipes proposals and starts fresh
                </div>
              </button>
              <button
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2.5 rounded-lg hover:bg-violet-50 text-violet-800 font-semibold transition"
              >
                <div className="font-bold text-xs">Load Demo Scenario</div>
                <div className="text-[10px] text-violet-600 font-normal mt-0.5">
                  Seeds 3 initial proposals for walkthrough
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <PruneModal isOpen={showPruneModal} onClose={() => setShowPruneModal(false)} />
    </header>
  );
};
