import React, { useState } from 'react';
import { ProjectInfo, HumanIdentity } from '../../types';
import { PruneModal } from '../prune/PruneModal';
import {
  RotateCcw,
  Compass,
  Radio,
  Layers,
  Users,
  Info,
  Shield,
  GitBranch,
  ChevronDown,
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
    <header className="h-13 border-b border-slate-900/[0.075] glass-header px-5 flex items-center justify-between z-30 select-none sticky top-0">
      {/* Left: Project Breadcrumb & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-slate-900 tracking-tight">LedgerFlow</span>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono bg-slate-100/80 border border-slate-900/[0.06] px-2 py-0.5 rounded-md">
            <GitBranch className="w-3 h-3 text-slate-400" strokeWidth={1.75} />
            <span>main</span>
          </div>
        </div>

        <span className="hidden sm:inline text-slate-300 text-xs">·</span>

        <span className="hidden sm:inline text-xs text-slate-500 font-medium">
          {isCleanBaseline ? 'Clean baseline' : 'Demo scenario'}
        </span>

        <div
          className="flex items-center gap-1.5 text-xs font-medium pl-2 border-l border-slate-900/[0.08]"
          title={isConnected ? 'WebSocket real-time connection active' : 'Connecting to backend'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className={isConnected ? 'text-slate-700' : 'text-amber-700'}>
            {connectionLabel}
          </span>
        </div>
      </div>

      {/* Center: Version Telemetry */}
      <div className="hidden lg:flex items-center relative">
        <div
          onMouseEnter={() => setShowVersionTooltip(true)}
          onMouseLeave={() => setShowVersionTooltip(false)}
          className="flex items-center gap-2 cursor-pointer bg-slate-100/75 hover:bg-slate-100 border border-slate-900/[0.06] px-2.5 py-1 rounded-full transition"
        >
          <div className="flex items-center gap-1 text-[11px] text-slate-600">
            <Radio className="w-3 h-3 text-[#2563EB]" strokeWidth={1.75} />
            <span className="font-mono font-medium text-slate-800">ctx v{project?.context_version ?? 1}</span>
          </div>
          <span className="text-slate-300">·</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-600">
            <Layers className="w-3 h-3 text-[#0F766E]" strokeWidth={1.75} />
            <span className="font-mono font-medium text-slate-800">art v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {showVersionTooltip && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 w-64 bg-white rounded-xl border border-slate-900/[0.08] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] z-50 text-xs text-slate-600">
            <div className="font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Version Provenance</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              <strong className="text-slate-900">Context:</strong> Increments with approved PRDs and requirements.
            </p>
            <p className="text-[11px] mt-1 leading-relaxed">
              <strong className="text-slate-900">Artifact:</strong> Increments when code changes merge into LedgerFlow.
            </p>
          </div>
        )}
      </div>

      {/* Right: Collaborators, Controls & Identity */}
      <div className="flex items-center gap-2">
        {/* Clean Avatar Stack */}
        <div className="hidden sm:flex items-center -space-x-1.5 mr-1" title="Workspace participants">
          <div
            className="w-6 h-6 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/80 font-semibold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="Alex (Founder)"
          >
            A
          </div>
          <div
            className="w-6 h-6 rounded-full bg-pink-50 text-[#BE185D] border border-pink-200/80 font-semibold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="Maya (Product Designer)"
          >
            M
          </div>
          <div
            className="w-6 h-6 rounded-full bg-violet-50 text-[#6D28D9] border border-violet-200/80 font-semibold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="NOVA (AI Strategist)"
          >
            N
          </div>
          <div
            className="w-6 h-6 rounded-full bg-teal-50 text-[#0F766E] border border-teal-200/80 font-semibold text-[10px] flex items-center justify-center ring-2 ring-white"
            title="PIXEL (AI Engineer)"
          >
            P
          </div>
        </div>

        {/* Team Drawer Toggle */}
        {onToggleCollaboratorsPanel && (
          <button
            type="button"
            onClick={onToggleCollaboratorsPanel}
            className={`hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              isCollaboratorsPanelOpen
                ? 'bg-slate-900/[0.06] text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.04]'
            }`}
            title="Toggle team panel"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Team ({onlineMembers.length > 0 ? onlineMembers.length : 4})</span>
          </button>
        )}

        {/* Guide Button */}
        {onToggleDemoGuide && (
          <button
            type="button"
            onClick={onToggleDemoGuide}
            className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              isDemoGuideOpen
                ? 'btn-obsidian'
                : 'btn-apple-secondary'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Guide</span>
          </button>
        )}

        {/* Identity Switcher */}
        <button
          type="button"
          onClick={onSwitchIdentity}
          className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg btn-apple-secondary text-xs font-medium cursor-pointer"
          title="Switch collaborator role (Alex ↔ Maya)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              identity === 'alex' ? 'bg-[#2563EB]' : 'bg-[#BE185D]'
            }`}
          />
          <span className="font-medium text-slate-900">{identity === 'alex' ? 'Alex' : 'Maya'}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Prune Audit Shield */}
        <button
          type="button"
          onClick={() => setShowPruneModal(true)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/70 transition cursor-pointer"
          title="Prune Cryptographic Verification"
        >
          <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {/* Reset / Demo Scenario Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-900/[0.04] transition cursor-pointer"
            title="Workspace Reset & Demo Scenarios"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin text-[#2563EB]' : ''}`} strokeWidth={1.75} />
          </button>

          {showResetMenu && (
            <div className="absolute right-0 top-10 w-56 bg-white rounded-xl border border-slate-900/[0.08] shadow-[0_10px_30px_rgba(15,23,42,0.1)] z-50 p-1.5 space-y-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowResetMenu(false);
                  onResetDemo();
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-rose-50/70 text-rose-700 transition cursor-pointer"
              >
                <div className="font-medium text-xs">Reset to Clean Baseline</div>
                <div className="text-[11px] text-rose-500 font-normal mt-0.5">
                  Restores baseline seed state
                </div>
              </button>
              <button
                type="button"
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 text-slate-800 transition cursor-pointer"
              >
                <div className="font-medium text-xs">Load Demo Scenario</div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
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
