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

  const connectionLabel = isConnected ? 'Connected' : 'Connecting';

  return (
    <header className="h-12 border-b border-[#1A223D] bg-[#0C1021]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none sticky top-0">
      {/* 1. Left: Project Breadcrumb & Status */}
      <div className="flex items-center gap-3">
        {/* Project & Branch indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
            <span className="font-semibold text-white">LedgerFlow</span>
          </div>
          <span className="text-[#3A476F]">/</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono bg-[#141A33] border border-[#222C52] px-1.5 py-0.5 rounded">
            <GitBranch className="w-3 h-3 text-slate-400" />
            <span>main</span>
          </div>
        </div>

        {/* Baseline / Scenario indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <span className="text-[#3A476F]">•</span>
          <span>{isCleanBaseline ? 'Clean Baseline' : 'Demo Scenario'}</span>
        </div>

        {/* Live WebSocket Connection */}
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
            isConnected
              ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
              : 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
          }`}
          title={isConnected ? 'WebSocket connection active' : 'Connecting to real-time server'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
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
          className="flex items-center gap-1.5 cursor-pointer bg-[#141A33] hover:bg-[#19213F] border border-[#222C52] px-2 py-0.5 rounded-md transition"
        >
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            <Radio className="w-3 h-3 text-blue-400" />
            <span className="font-mono font-medium text-white">ctx:v{project?.context_version ?? 1}</span>
          </div>
          <span className="text-[#3A476F]">•</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            <Layers className="w-3 h-3 text-teal-400" />
            <span className="font-mono font-medium text-white">art:v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {showVersionTooltip && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 w-64 bg-[#0F1528] rounded-lg border border-[#222C52] p-3 shadow-xl z-50 text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100">
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Version Provenance</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              <strong className="text-blue-400">Context:</strong> Increments with approved PRDs and human requirements.
            </p>
            <p className="text-[11px] mt-1 leading-relaxed">
              <strong className="text-teal-400">Artifact:</strong> Increments when code changes merge into LedgerFlow.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right: Collaborators, Identity Switcher, Tools */}
      <div className="flex items-center gap-2">
        {/* Collaborators Avatar Stack */}
        <div className="hidden sm:flex items-center -space-x-1" title="Active collaborators">
          <div
            className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-[#0C1021]"
            title="Alex (Founder / Decision Owner)"
          >
            A
          </div>
          <div
            className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-[#0C1021]"
            title="Maya (Product Designer)"
          >
            M
          </div>
          <div
            className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-[#0C1021]"
            title="NOVA (AI Product Strategist)"
          >
            N
          </div>
          <div
            className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-[#0C1021]"
            title="PIXEL (AI Software Engineer)"
          >
            P
          </div>
        </div>

        {/* Team Panel Toggle */}
        {onToggleCollaboratorsPanel && (
          <button
            onClick={onToggleCollaboratorsPanel}
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              isCollaboratorsPanelOpen
                ? 'bg-[#19213F] text-white'
                : 'text-slate-300 hover:text-white hover:bg-[#141A33]'
            }`}
            title="Toggle Team Drawer"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">Team ({onlineMembers.length > 0 ? onlineMembers.length : 4})</span>
          </button>
        )}

        {/* Guided Demo Button */}
        {onToggleDemoGuide && (
          <button
            onClick={onToggleDemoGuide}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
              isDemoGuideOpen
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>
        )}

        {/* Active Identity Switcher */}
        <button
          onClick={onSwitchIdentity}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141A33] hover:bg-[#19213F] text-xs font-medium text-white transition cursor-pointer border border-[#222C52]"
          title="Click to switch collaborator role (Alex ↔ Maya)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              identity === 'alex' ? 'bg-blue-400' : 'bg-pink-400'
            }`}
          />
          <span className="font-semibold">{identity === 'alex' ? 'Alex' : 'Maya'}</span>
          <span className="text-[9px] text-[#7888AB] uppercase font-mono tracking-wider ml-0.5">Switch</span>
        </button>

        {/* Cryptographic Prune Shield */}
        <button
          onClick={() => setShowPruneModal(true)}
          className="p-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-[#141A33] transition cursor-pointer"
          title="Prune AI Cryptographic Seatbelts & Audit Receipts"
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        </button>

        {/* Reset / Scenario Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#141A33] transition cursor-pointer flex items-center"
            title="Workspace Reset & Demo Scenarios"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {showResetMenu && (
            <div className="absolute right-0 top-8 w-52 bg-[#0F1528] rounded-lg border border-[#222C52] shadow-2xl z-50 p-1 space-y-0.5 text-xs">
              <button
                onClick={() => {
                  setShowResetMenu(false);
                  onResetDemo();
                }}
                className="w-full text-left p-2 rounded-md hover:bg-rose-500/15 text-rose-300 transition"
              >
                <div className="font-medium text-xs">Reset to Clean Baseline</div>
                <div className="text-[10px] text-rose-400 font-normal">
                  Wipes proposals and starts fresh
                </div>
              </button>
              <button
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2 rounded-md hover:bg-indigo-500/15 text-indigo-300 transition"
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
