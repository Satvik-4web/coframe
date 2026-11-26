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
  GitBranch,
  Menu,
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
  onToggleNavigation?: () => void;
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
  onToggleNavigation,
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

  const connectionLabel = isConnected ? 'Live' : 'Polling';

  return (
    <header className="h-[68px] shrink-0 border-b border-[#303A4B]/80 bg-[#1A202C]/90 backdrop-blur-2xl px-4 sm:px-7 flex items-center justify-between z-30 select-none sticky top-0 shadow-[0_3px_18px_rgba(21,43,76,.055)]">
      {/* 1. Left: Project Breadcrumb & Status */}
      <div className="flex items-center gap-3 sm:gap-5">
        <button type="button" aria-label="Open navigation" onClick={onToggleNavigation} className="md:hidden rounded-lg p-1.5 text-[#C6D2E4] hover:bg-[#1D2633]"><Menu className="h-5 w-5" /></button>
        {/* Project & Branch indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-[#EDF2FA]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="font-bold text-[#EDF2FA] tracking-tight">LedgerFlow</span>
          </div>
          <span className="hidden sm:inline text-slate-300">/</span>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#96A6BE] font-mono bg-[#1D2633]/70 px-1.5 py-0.5 rounded">
            <GitBranch className="w-3 h-3 text-[#8495AD]" />
            <span>main</span>
          </div>
        </div>

        {/* Baseline / Scenario indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#96A6BE] font-medium">
          <span className="text-slate-300">•</span>
          <span>{isCleanBaseline ? 'Clean Baseline' : 'Demo Scenario'}</span>
        </div>

        {/* Live WebSocket Connection */}
        <div
          className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
            isConnected
              ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/25'
              : 'text-amber-300 bg-amber-500/10 border border-amber-500/25'
          }`}
          title={isConnected ? 'Live WebSocket updates' : 'Live connection unavailable; checking for updates every 10 seconds'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
            }`}
          />
          <span>{connectionLabel}</span>
        </div>
      </div>

      {/* 2. Centre: Version Telemetry Anchors */}
      <div className="hidden lg:flex items-center gap-2 text-xs relative">
        <div
          onMouseEnter={() => setShowVersionTooltip(true)}
          onMouseLeave={() => setShowVersionTooltip(false)}
          className="flex items-center gap-1.5 cursor-pointer bg-[#141A24]/80 hover:bg-[#1D2633]/70 border border-[#303A4B]/70 px-2 py-0.5 rounded-md transition"
        >
          <div className="flex items-center gap-1 text-[11px] text-[#ACBAD0]">
            <Radio className="w-3 h-3 text-blue-400" />
            <span className="font-mono font-medium text-[#EDF2FA]">ctx:v{project?.context_version ?? 1}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1 text-[11px] text-[#ACBAD0]">
            <Layers className="w-3 h-3 text-sky-300" />
            <span className="font-mono font-medium text-[#EDF2FA]">art:v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {showVersionTooltip && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 w-64 bg-[#1A202C] rounded-lg border border-[#303A4B] p-3 shadow-lg z-50 text-xs text-[#ACBAD0] animate-in fade-in zoom-in-95 duration-100">
            <div className="font-semibold text-[#EDF2FA] mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Version Provenance</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              <strong className="text-blue-400">Context:</strong> Increments with approved PRDs and human requirements.
            </p>
            <p className="text-[11px] mt-1 leading-relaxed">
              <strong className="text-sky-300">Artifact:</strong> Increments when code changes merge into LedgerFlow.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right: Collaborators, Identity Switcher, Tools */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Collaborators Avatar Stack */}
        <div className="hidden sm:flex items-center -space-x-1" title="Active collaborators">
          <div
            className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="Alex (Founder / Decision Owner)"
          >
            A
          </div>
          <div
            className="w-6 h-6 rounded-full bg-slate-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="Maya (Product Designer)"
          >
            M
          </div>
          <div
            className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="NOVA (AI Product Strategist)"
          >
            N
          </div>
          <div
            className="w-6 h-6 rounded-full bg-sky-700 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="PIXEL (AI Software Engineer)"
          >
            P
          </div>
        </div>

        {/* Team Panel Toggle */}
        {onToggleCollaboratorsPanel && (
          <button
            onClick={onToggleCollaboratorsPanel}
            aria-label="Toggle team drawer"
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              isCollaboratorsPanelOpen
                ? 'bg-[#1D2633] text-[#EDF2FA]'
                : 'text-[#ACBAD0] hover:text-[#EDF2FA] hover:bg-[#141A24]'
            }`}
            title="Toggle Team Drawer"
          >
            <Users className="w-3.5 h-3.5 text-[#8495AD]" />
            <span className="hidden md:inline text-[11px]">Team ({onlineMembers.length > 0 ? onlineMembers.length : 4})</span>
          </button>
        )}

        {/* Guided Demo Button */}
        {onToggleDemoGuide && (
          <button
            onClick={onToggleDemoGuide}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              isDemoGuideOpen
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-blue-500/10 hover:bg-blue-500/10 text-blue-300 border border-blue-500/25'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        )}

        {/* Active Identity Switcher */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1D2633]/80 hover:bg-[#303D50]/80 text-xs font-medium text-[#DCE5F2] transition cursor-pointer border border-[#303A4B]/60"
          title="Click to switch collaborator role (Alex ↔ Maya)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              identity === 'alex' ? 'bg-blue-600' : 'bg-pink-600'
            }`}
          />
          <span className="font-semibold">{identity === 'alex' ? 'Alex' : 'Maya'}</span>
          <span className="hidden sm:inline text-[9px] text-[#8495AD] uppercase font-mono tracking-wider ml-0.5">Switch</span>
        </button>

        {/* Cryptographic Prune Shield */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="p-1 rounded-md text-[#8495AD] hover:text-emerald-300 hover:bg-emerald-500/10 transition cursor-pointer"
          title="Prune AI Cryptographic Seatbelts & Audit Receipts"
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        {/* Reset / Scenario Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="p-1 rounded-md text-[#8495AD] hover:text-[#DCE5F2] hover:bg-[#1D2633] transition cursor-pointer flex items-center"
            title="Workspace Reset & Demo Scenarios"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {showResetMenu && (
            <div className="absolute right-0 top-8 w-52 bg-[#1A202C] rounded-lg border border-[#303A4B] shadow-xl z-50 p-1 space-y-0.5 text-xs">
              <button
                onClick={() => {
                  setShowResetMenu(false);
                  onResetDemo();
                }}
                className="w-full text-left p-2 rounded-md hover:bg-rose-500/10 text-rose-300 transition"
              >
                <div className="font-medium text-xs">Reset to Clean Baseline</div>
                <div className="text-[10px] text-rose-500 font-normal">
                  Wipes proposals and starts fresh
                </div>
              </button>
              <button
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2 rounded-md hover:bg-indigo-500/10 text-indigo-300 transition"
              >
                <div className="font-medium text-xs">Load Demo Scenario</div>
                <div className="text-[10px] text-indigo-400 font-normal">
                  Seeds proposals for walkthrough
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
