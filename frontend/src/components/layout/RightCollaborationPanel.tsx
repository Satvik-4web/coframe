import React from 'react';
import {
  Users,
  Bot,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  Layers,
  X,
} from 'lucide-react';
import { AgentRun, HumanIdentity } from '../../types';

interface RightCollaborationPanelProps {
  agentRuns: AgentRun[];
  onlineMembers: string[];
  identity: HumanIdentity;
  onRestartAgent: (agentId: string) => Promise<void>;
  onNavigateTab: (tab: any) => void;
  isOpen: boolean;
  onClose: () => void;
  restartingAgent: string | null;
}

export const RightCollaborationPanel: React.FC<RightCollaborationPanelProps> = ({
  agentRuns,
  onlineMembers,
  identity,
  onRestartAgent,
  onNavigateTab,
  isOpen,
  onClose,
  restartingAgent,
}) => {
  if (!isOpen) return null;

  const isAlexOnline = onlineMembers.includes('alex');
  const isMayaOnline = onlineMembers.includes('maya');

  const novaRun = agentRuns.find((r) => r.agent_id === 'nova');
  const pixelRun = agentRuns.find((r) => r.agent_id === 'pixel');

  const getLifecycleStateBadge = (lifecycle?: string, status?: string) => {
    const s = lifecycle || status || 'idle';
    switch (s) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Working
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <Clock className="w-2.5 h-2.5" /> Awaiting Decision
          </span>
        );
      case 'recovering_context':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/25">
            Recovering
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-300 border border-red-500/25">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready
          </span>
        );
    }
  };

  return (
    <aside className="fixed right-0 top-[68px] bottom-0 z-50 w-[min(22rem,100vw)] md:relative md:top-auto md:bottom-auto md:z-auto md:w-[340px] border-l border-[#e2e8f1] bg-[#1A202C] flex flex-col justify-between shrink-0 select-none shadow-[-12px_0_35px_rgba(15,23,42,.08)] md:h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#303A4B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E7EDF7]">
            Collaborators (4)
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#A3B0C4] hover:text-[#E7EDF7] hover:bg-[#1D2633] transition"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Collaborator Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Section 1: Humans */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3B0C4] block mb-2 px-1">
            Human Creators
          </span>
          <div className="space-y-2.5">
            {/* Alex Card */}
            <div className="p-3 rounded-xl border border-[#303A4B] bg-[#141A24] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-300 font-bold text-xs flex items-center justify-center">
                      A
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                        isAlexOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#E7EDF7] flex items-center gap-1.5">
                      Alex
                      {identity === 'alex' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/25">
                          YOU
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-blue-400 font-medium">Founder · Decision Owner</p>
                  </div>
                </div>
                <span className="text-[10px] text-[#A3B0C4] font-medium">
                  {isAlexOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-[#A3B0C4] pl-9">
                Directs product strategy & signs off on high-impact proposals.
              </p>
            </div>

            {/* Maya Card */}
            <div className="p-3 rounded-xl border border-[#303A4B] bg-[#141A24] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-300 font-bold text-xs flex items-center justify-center">
                      M
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                        isMayaOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#E7EDF7] flex items-center gap-1.5">
                      Maya
                      {identity === 'maya' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25">
                          YOU
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-purple-400 font-medium">Product Designer</p>
                  </div>
                </div>
                <span className="text-[10px] text-[#A3B0C4] font-medium">
                  {isMayaOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-[#A3B0C4] pl-9">
                Refines UI components, resolves conflicts, and reviews proposals.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: AI Agents */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3B0C4] block mb-2 px-1">
            Autonomous AI Agents
          </span>
          <div className="space-y-2.5">
            {/* NOVA Card */}
            <div className="p-3 rounded-xl border border-violet-500/25 bg-violet-500/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-300 font-bold text-xs flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#E7EDF7]">NOVA</h4>
                    <p className="text-[11px] text-violet-400 font-medium">Product Strategist</p>
                  </div>
                </div>
                {getLifecycleStateBadge(novaRun?.lifecycle_state, novaRun?.status)}
              </div>

              <div className="text-[11px] text-[#A3B0C4] bg-[#1A202C] p-2 rounded-lg border border-violet-500/25">
                <span className="font-semibold text-[#E7EDF7] block mb-0.5">Current Task</span>
                <span className="line-clamp-2">
                  {novaRun?.current_task || novaRun?.task_description || 'Synthesizing market positioning & requirement dependencies'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  onClick={() => onNavigateTab('agents')}
                  className="text-violet-300 hover:underline font-semibold flex items-center gap-1"
                >
                  View Details <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onRestartAgent('nova')}
                  disabled={restartingAgent === 'nova'}
                  className="p-1 rounded text-[#8495AD] hover:text-violet-300 hover:bg-violet-500/10 transition"
                  title="Restart NOVA"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'nova' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* PIXEL Card */}
            <div className="p-3 rounded-xl border border-teal-500/25 bg-teal-500/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-300 font-bold text-xs flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#E7EDF7]">PIXEL</h4>
                    <p className="text-[11px] text-teal-400 font-medium">Prototype Engineer</p>
                  </div>
                </div>
                {getLifecycleStateBadge(pixelRun?.lifecycle_state, pixelRun?.status)}
              </div>

              <div className="text-[11px] text-[#A3B0C4] bg-[#1A202C] p-2 rounded-lg border border-teal-500/25">
                <span className="font-semibold text-[#E7EDF7] block mb-0.5">Current Task</span>
                <span className="line-clamp-2">
                  {pixelRun?.current_task || pixelRun?.task_description || 'Evolving LedgerFlow React UI components & approval queue'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  onClick={() => onNavigateTab('agents')}
                  className="text-teal-300 hover:underline font-semibold flex items-center gap-1"
                >
                  View Details <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onRestartAgent('pixel')}
                  disabled={restartingAgent === 'pixel'}
                  className="p-1 rounded text-[#8495AD] hover:text-teal-300 hover:bg-teal-500/10 transition"
                  title="Restart PIXEL"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'pixel' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Shortcut */}
      <div className="p-4 border-t border-[#303A4B] bg-[#141A24]">
        <button
          onClick={() => onNavigateTab('agents')}
          className="w-full py-2 px-3 rounded-xl bg-[#1A202C] border border-[#303A4B] hover:border-teal-500/25 text-xs font-semibold text-[#E7EDF7] hover:text-teal-300 transition flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          <span>Inspect Full AI Team & Delegation</span>
        </button>
      </div>
    </aside>
  );
};
