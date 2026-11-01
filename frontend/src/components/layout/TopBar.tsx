import React, { useState } from 'react';
import { ProjectInfo, HumanIdentity } from '../../types';
import { PruneModal } from '../prune/PruneModal';
import { ResetConfirmModal } from './ResetConfirmModal';
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
  Database,
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
  pendingProposalsCount?: number;
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
  pendingProposalsCount = 0,
}) => {
  const [showPruneModal, setShowPruneModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showVersionPopover, setShowVersionPopover] = useState(false);
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

  // Presence states for Alex & Maya
  const isAlexOnline = onlineMembers.map((m) => m.toLowerCase()).includes('alex') || identity === 'alex';
  const isMayaOnline = onlineMembers.map((m) => m.toLowerCase()).includes('maya') || identity === 'maya';

  return (
    <header className="h-14 border-b border-[#E8EAF2] bg-white/95 backdrop-blur-md px-5 flex items-center justify-between z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)] sticky top-0">
      {/* 1. Left: Active Project Selector, Scenario State & Live Connection Status */}
      <div className="flex items-center gap-3">
        {/* Project Selector */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#F7F8FC] border border-[#E8EAF2] hover:border-slate-300 transition cursor-pointer">
          <span className="w-2 h-2 rounded-full bg-indigo-600" />
          <span className="text-xs font-bold text-[#172033]">LedgerFlow</span>
          <span className="text-[10px] text-[#657189] font-medium hidden sm:inline">v1.0</span>
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

        {/* Live WebSocket Connection Status */}
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

      {/* 2. Centre: Unified Clean Version Popover */}
      <div className="hidden md:flex items-center text-xs relative">
        <button
          type="button"
          onClick={() => setShowVersionPopover(!showVersionPopover)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7F8FC] hover:bg-slate-100 border border-[#E8EAF2] text-[#172033] font-semibold transition cursor-pointer shadow-2xs"
          title="Click to view detailed version breakdown"
        >
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span>LedgerFlow v1.0</span>
          <span>·</span>
          <span className={pendingProposalsCount > 0 ? 'text-amber-700' : 'text-slate-500'}>
            {pendingProposalsCount > 0
              ? `${pendingProposalsCount} update${pendingProposalsCount !== 1 ? 's' : ''} pending`
              : 'Synchronized'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {showVersionPopover && (
          <div className="absolute top-11 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl border border-[#E8EAF2] p-4 shadow-2xl z-50 text-xs text-[#657189] animate-fadeIn space-y-3">
            <div className="font-bold text-[#172033] flex items-center justify-between pb-2 border-b border-[#F0F3F7]">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>Version Breakdown</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionPopover(false)}
                className="text-2xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <span className="font-medium text-[#172033]">Prototype Artifact</span>
                </div>
                <span className="font-mono font-bold text-teal-700">v{project?.artifact_version ?? 1}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-[#172033]">Strategic Requirements</span>
                </div>
                <span className="font-mono font-bold text-blue-700">v{project?.context_version ?? 1}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-[#172033]">Storage Ledger</span>
                </div>
                <span className="font-mono text-2xs text-slate-600">SQLite Monotonic Log</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
              Base versions are automatically stamped on all agent proposals to detect concurrent human changes and enforce strict governance.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right: Presence Dots, Collaborators, Identity Switcher, Reset Actions */}
      <div className="flex items-center gap-2">
        {/* Presence Avatars for Alex & Maya with Live Presence Indicator Dots */}
        <div className="hidden sm:flex items-center space-x-2 mr-1">
          {/* Alex Avatar + Presence Dot */}
          <div className="relative" title={`Alex (Founder / Decision Owner): ${isAlexOnline ? 'Active' : 'Offline'}`}>
            <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center shadow-2xs border border-white">
              A
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                isAlexOnline ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            />
          </div>

          {/* Maya Avatar + Presence Dot */}
          <div className="relative" title={`Maya (Product Designer): ${isMayaOnline ? 'Active' : 'Offline'}`}>
            <div className="w-7 h-7 rounded-full bg-[#D946A1] text-white font-bold text-xs flex items-center justify-center shadow-2xs border border-white">
              M
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                isMayaOnline ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            />
          </div>

          {/* AI Agents Avatars */}
          <div className="w-7 h-7 rounded-full bg-[#7C3AED] text-white font-bold text-xs flex items-center justify-center shadow-2xs border border-white" title="NOVA (AI Product Strategist)">
            N
          </div>
          <div className="w-7 h-7 rounded-full bg-[#0D9488] text-white font-bold text-xs flex items-center justify-center shadow-2xs border border-white" title="PIXEL (AI Software Engineer)">
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

        {/* Prune AI Security Shield with explanatory tooltip */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="p-1.5 rounded-xl text-emerald-800 hover:bg-emerald-50 transition border border-transparent hover:border-emerald-200 cursor-pointer"
          title="Governance mode: strict — Cryptographic Prune AI seatbelt & audit receipts"
        >
          <Shield className="w-4 h-4 text-emerald-600" />
        </button>

        {/* Reset / Scenario Dropdown Menu with tooltip */}
        <div className="relative">
          <button
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="p-1.5 rounded-xl text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition border border-transparent hover:border-slate-200 cursor-pointer flex items-center gap-0.5"
            title="Reset workspace to clean demo state or load scenario"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin text-violet-600' : ''}`} />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showResetMenu && (
            <div className="absolute right-0 top-10 w-56 bg-white rounded-2xl border border-[#E8EAF2] shadow-xl z-50 p-1.5 space-y-1 text-xs animate-fadeIn">
              <button
                onClick={() => {
                  setShowResetMenu(false);
                  setShowResetConfirmModal(true);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-red-50 text-red-700 font-semibold transition cursor-pointer"
              >
                <div className="font-bold text-xs">Reset LedgerFlow Demo</div>
                <div className="text-[10px] text-red-500 font-normal mt-0.5">
                  Prompts for confirmation to restore v1
                </div>
              </button>
              <button
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2.5 rounded-xl hover:bg-violet-50 text-violet-800 font-semibold transition cursor-pointer"
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
      <ResetConfirmModal
        isOpen={showResetConfirmModal}
        onClose={() => setShowResetConfirmModal(false)}
        onConfirm={() => {
          setShowResetConfirmModal(false);
          onResetDemo();
        }}
        isResetting={isResetting}
      />
    </header>
  );
};
