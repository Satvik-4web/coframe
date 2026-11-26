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

  const connectionLabel = isConnected ? 'Live' : 'Connecting';

  return (
    <header className="app-topbar h-12 glass-header px-5 flex items-center justify-between z-30 select-none sticky top-0">
      {/* Left: Project Breadcrumb & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-bold text-white tracking-tight">LedgerFlow</span>
          <span className="text-slate-700">/</span>
          <div
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(129,140,248,0.10)', border: '1px solid rgba(129,140,248,0.20)', color: '#A78BFA' }}
          >
            <GitBranch className="w-3 h-3" strokeWidth={1.75} />
            <span>main</span>
          </div>
        </div>

        <span className="hidden sm:inline text-slate-700 text-xs">·</span>

        <span className="hidden sm:inline text-xs text-slate-500 font-medium">
          {isCleanBaseline ? 'Clean baseline' : 'Demo scenario'}
        </span>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 text-xs font-medium pl-2 border-l border-white/[0.06]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? '' : 'animate-pulse'}`}
            style={isConnected
              ? { background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }
              : { background: '#FBBF24', boxShadow: '0 0 6px rgba(251,191,36,0.6)' }}
          />
          <span style={{ color: isConnected ? '#34D399' : '#FBBF24' }}>
            {connectionLabel}
          </span>
        </div>
      </div>

      {/* Center: Version Telemetry */}
      <div className="hidden lg:flex items-center relative">
        <div
          onMouseEnter={() => setShowVersionTooltip(true)}
          onMouseLeave={() => setShowVersionTooltip(false)}
          className="flex items-center gap-2 cursor-pointer px-3 py-1 rounded-full transition"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-1 text-[11px]">
            <Radio className="w-3 h-3" strokeWidth={1.75} style={{ color: '#818CF8' }} />
            <span className="font-mono font-semibold" style={{ color: '#A78BFA' }}>ctx v{project?.context_version ?? 1}</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1 text-[11px]">
            <Layers className="w-3 h-3" strokeWidth={1.75} style={{ color: '#22D3EE' }} />
            <span className="font-mono font-semibold" style={{ color: '#67E8F9' }}>art v{project?.artifact_version ?? 1}</span>
          </div>
        </div>

        {showVersionTooltip && (
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 w-64 rounded-xl p-4 z-50 text-xs"
            style={{
              background: 'rgba(13,17,23,0.95)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="font-semibold text-white mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" style={{ color: '#818CF8' }} />
              <span>Version Provenance</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              <strong className="text-slate-200">Context:</strong> Increments with approved PRDs and requirements.
            </p>
            <p className="text-[11px] mt-1 leading-relaxed text-slate-400">
              <strong className="text-slate-200">Artifact:</strong> Increments when code changes merge into LedgerFlow.
            </p>
          </div>
        )}
      </div>

      {/* Right: Controls & Identity */}
      <div className="flex items-center gap-2">
        {/* Avatar Stack */}
        <div className="hidden sm:flex items-center -space-x-1.5 mr-1" title="Workspace participants">
          {[
            { label: 'A', name: 'Alex', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', ring: 'rgba(96,165,250,0.3)' },
            { label: 'M', name: 'Maya', color: '#F472B6', bg: 'rgba(244,114,182,0.15)', ring: 'rgba(244,114,182,0.3)' },
            { label: 'N', name: 'NOVA', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', ring: 'rgba(167,139,250,0.3)' },
            { label: 'P', name: 'PIXEL', color: '#22D3EE', bg: 'rgba(34,211,238,0.15)', ring: 'rgba(34,211,238,0.3)' },
          ].map(({ label, name, color, bg, ring }) => (
            <div
              key={label}
              className="w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center"
              title={name}
              style={{
                background: bg,
                color,
                border: `1.5px solid ${ring}`,
                boxShadow: `0 0 8px ${ring}`,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Team Toggle */}
        {onToggleCollaboratorsPanel && (
          <button
            type="button"
            onClick={onToggleCollaboratorsPanel}
            className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer"
            style={isCollaboratorsPanelOpen
              ? { background: 'rgba(129,140,248,0.15)', color: '#A78BFA', border: '1px solid rgba(129,140,248,0.25)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Team ({onlineMembers.length > 0 ? onlineMembers.length : 4})</span>
          </button>
        )}

        {/* Guide Button */}
        {onToggleDemoGuide && (
          <button
            type="button"
            onClick={onToggleDemoGuide}
            className="h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            style={isDemoGuideOpen
              ? { background: 'linear-gradient(135deg,#818CF8,#A78BFA)', color: '#fff', boxShadow: '0 0 16px rgba(129,140,248,0.4)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Compass className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Guide</span>
          </button>
        )}

        {/* Identity Switcher */}
        <button
          type="button"
          onClick={onSwitchIdentity}
          className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer transition"
          style={{
            background: identity === 'alex' ? 'rgba(96,165,250,0.12)' : 'rgba(244,114,182,0.12)',
            color: identity === 'alex' ? '#60A5FA' : '#F472B6',
            border: `1px solid ${identity === 'alex' ? 'rgba(96,165,250,0.25)' : 'rgba(244,114,182,0.25)'}`,
          }}
          title="Switch collaborator role"
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: identity === 'alex' ? '#60A5FA' : '#F472B6',
              boxShadow: `0 0 6px ${identity === 'alex' ? 'rgba(96,165,250,0.8)' : 'rgba(244,114,182,0.8)'}`,
            }}
          />
          <span className="font-semibold">{identity === 'alex' ? 'Alex' : 'Maya'}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {/* Shield */}
        <button
          type="button"
          onClick={() => setShowPruneModal(true)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition cursor-pointer text-slate-600 hover:text-emerald-400"
          style={{ background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title="Prune Cryptographic Verification"
        >
          <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {/* Reset Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowResetMenu(!showResetMenu)}
            disabled={isResetting || isLoadingScenario}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition cursor-pointer text-slate-600 hover:text-slate-300"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Workspace Reset & Demo Scenarios"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isResetting || isLoadingScenario ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
              style={isResetting || isLoadingScenario ? { color: '#818CF8' } : {}}
            />
          </button>

          {showResetMenu && (
            <div
              className="absolute right-0 top-10 w-56 rounded-xl z-50 p-1.5 space-y-0.5 text-xs"
              style={{
                background: 'rgba(13,17,23,0.98)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <button
                type="button"
                onClick={() => { setShowResetMenu(false); onResetDemo(); }}
                className="w-full text-left p-2.5 rounded-lg transition cursor-pointer"
                style={{ color: '#F87171' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="font-semibold text-xs">Reset to Clean Baseline</div>
                <div className="text-[11px] opacity-60 font-normal mt-0.5">Restores baseline seed state</div>
              </button>
              <button
                type="button"
                onClick={handleLoadDemoScenario}
                className="w-full text-left p-2.5 rounded-lg transition cursor-pointer text-slate-300"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="font-semibold text-xs">Load Demo Scenario</div>
                <div className="text-[11px] opacity-50 font-normal mt-0.5">Seeds proposals for walkthrough</div>
              </button>
            </div>
          )}
        </div>
      </div>

      <PruneModal isOpen={showPruneModal} onClose={() => setShowPruneModal(false)} />
    </header>
  );
};
