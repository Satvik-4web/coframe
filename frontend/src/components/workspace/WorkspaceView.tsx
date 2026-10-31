import React from 'react';
import {
  FullProjectState,
  HumanIdentity,
  AgentRun,
  Proposal,
} from '../../types';
import {
  Users,
  Bot,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
  Shield,
  Layers,
  Activity,
  Play,
} from 'lucide-react';
import { restartAgent, startCollaboration } from '../../lib/api';

interface WorkspaceViewProps {
  state: FullProjectState;
  identity: HumanIdentity;
  onRefresh: () => void;
  onNavigateTab: (tab: any) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  state,
  identity,
  onRefresh,
  onNavigateTab,
}) => {
  const [starting, setStarting] = React.useState(false);
  const [restartingAgent, setRestartingAgent] = React.useState<string | null>(null);

  const novaRun = state.agent_runs.find((r) => r.agent_id === 'nova');
  const pixelRun = state.agent_runs.find((r) => r.agent_id === 'pixel');

  const pendingProposals = state.proposals.filter((p) => p.status === 'pending_review');
  const attentionProposals = state.proposals.filter(
    (p) => p.status === 'stale' || p.status === 'conflict'
  );

  const handleStartCollab = async () => {
    setStarting(true);
    try {
      await startCollaboration('demo-ledgerflow');
      onRefresh();
      onNavigateTab('proposals');
    } catch {
      alert('Failed to start agent collaboration');
    } finally {
      setStarting(false);
    }
  };

  const handleRestart = async (agentId: string) => {
    setRestartingAgent(agentId);
    try {
      await restartAgent('demo-ledgerflow', agentId);
      onRefresh();
    } catch {
      alert(`Failed to restart ${agentId}`);
    } finally {
      setRestartingAgent(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Launch & Collaboration Status Hero */}
      <div className="bg-gradient-to-r from-[#151B29] to-[#182338] border border-[#263244] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Multiplayer Workspace Active</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F4F7FB] tracking-tight">
            Human + AI, One Shared LedgerFlow Creation
          </h1>
          <p className="text-xs text-[#98A5B7] mt-2 leading-relaxed">
            Collaborate across strategy, requirements, and live React prototype engineering. NOVA formulates product strategy; PIXEL engineers structured prototype sections; Alex & Maya retain absolute human direction.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleStartCollab}
              disabled={starting}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-teal-700/20 transition cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${starting ? 'animate-spin' : ''}`} />
              <span>{starting ? 'Running NOVA & PIXEL...' : 'Start Collaboration (Run Agents)'}</span>
            </button>

            <button
              onClick={() => onNavigateTab('canvas')}
              className="px-5 py-2.5 rounded-xl bg-[#1B2433] hover:bg-[#253247] text-[#F4F7FB] border border-[#263244] font-medium text-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <span>Inspect LedgerFlow Canvas</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#98A5B7]" />
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Left (Quick Status & Pending Queue), Right (Collaborator Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pending Queue & Activity Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#151B29] border border-[#263244] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <GitPullRequest className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#F4F7FB]">
                  Active Proposals Requiring Human Attention ({pendingProposals.length + attentionProposals.length})
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('proposals')}
                className="text-xs text-teal-400 hover:underline font-medium"
              >
                View all proposals →
              </button>
            </div>

            {pendingProposals.length === 0 && attentionProposals.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#98A5B7]">
                No pending proposals right now. Click 'Start Collaboration' to dispatch agents.
              </div>
            ) : (
              <div className="space-y-3">
                {[...attentionProposals, ...pendingProposals].slice(0, 3).map((p) => (
                  <div
                    key={p.proposal_id}
                    onClick={() => onNavigateTab('proposals')}
                    className="p-3.5 rounded-lg bg-[#1B2433] border border-[#263244] hover:border-slate-500 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            p.agent_id === 'nova' ? 'bg-violet-950/60 text-violet-300' : 'bg-teal-950/60 text-teal-300'
                          }`}
                        >
                          {p.agent_id.toUpperCase()}
                        </span>
                        <span className="font-bold text-xs text-[#F4F7FB]">{p.summary}</span>
                      </div>
                      <p className="text-[11px] text-[#98A5B7] mt-1 line-clamp-1">{p.reasoning}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {p.status === 'conflict' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-700/50">
                          CONFLICT
                        </span>
                      )}
                      {p.status === 'stale' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-700/50">
                          STALE
                        </span>
                      )}
                      {p.status === 'pending_review' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/50">
                          PENDING
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-[#98A5B7]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#151B29] border border-[#263244] p-3.5 rounded-xl">
              <span className="text-[10px] text-[#98A5B7] uppercase font-bold block">Context Version</span>
              <span className="text-xl font-bold text-blue-400 font-mono mt-0.5 block">
                v{state.project.context_version}
              </span>
            </div>
            <div className="bg-[#151B29] border border-[#263244] p-3.5 rounded-xl">
              <span className="text-[10px] text-[#98A5B7] uppercase font-bold block">Artifact Version</span>
              <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block">
                v{state.project.artifact_version}
              </span>
            </div>
            <div className="bg-[#151B29] border border-[#263244] p-3.5 rounded-xl">
              <span className="text-[10px] text-[#98A5B7] uppercase font-bold block">Total Proposals</span>
              <span className="text-xl font-bold text-teal-400 font-mono mt-0.5 block">
                {state.proposals.length}
              </span>
            </div>
            <div className="bg-[#151B29] border border-[#263244] p-3.5 rounded-xl">
              <span className="text-[10px] text-[#98A5B7] uppercase font-bold block">Event History</span>
              <span className="text-xl font-bold text-[#F4F7FB] font-mono mt-0.5 block">
                {state.events.length}
              </span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: The 2 Dedicated Agent Cards */}
        <div className="space-y-4">
          {/* Agent Card 1: NOVA */}
          <div className="bg-[#151B29] border border-violet-500/30 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/40 flex items-center justify-center font-bold text-sm">
                  N
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#F4F7FB]">NOVA</h4>
                  <p className="text-[11px] text-violet-300">Product Strategist</p>
                </div>
              </div>

              <button
                onClick={() => handleRestart('nova')}
                disabled={restartingAgent === 'nova'}
                className="p-1.5 rounded-lg bg-[#1B2433] hover:bg-[#253247] text-[#98A5B7] hover:text-white transition"
                title="Restart NOVA"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'nova' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-[#1B2433] border border-[#263244]">
                <span className="text-[11px] text-[#98A5B7]">State</span>
                <span className="font-semibold text-emerald-400">
                  {novaRun?.status || 'idle'}
                </span>
              </div>
              <div className="p-2 rounded bg-[#1B2433] border border-[#263244] text-[11px] text-[#98A5B7]">
                <span className="block font-bold text-[#F4F7FB] mb-0.5">Task Stream</span>
                {novaRun?.task_description || 'Analyze market positioning & requirement dependencies'}
              </div>
            </div>
          </div>

          {/* Agent Card 2: PIXEL */}
          <div className="bg-[#151B29] border border-teal-500/30 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center font-bold text-sm">
                  P
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#F4F7FB]">PIXEL</h4>
                  <p className="text-[11px] text-teal-300">Prototype Engineer</p>
                </div>
              </div>

              <button
                onClick={() => handleRestart('pixel')}
                disabled={restartingAgent === 'pixel'}
                className="p-1.5 rounded-lg bg-[#1B2433] hover:bg-[#253247] text-[#98A5B7] hover:text-white transition"
                title="Restart PIXEL"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'pixel' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-[#1B2433] border border-[#263244]">
                <span className="text-[11px] text-[#98A5B7]">State</span>
                <span className="font-semibold text-emerald-400">
                  {pixelRun?.status || 'idle'}
                </span>
              </div>
              <div className="p-2 rounded bg-[#1B2433] border border-[#263244] text-[11px] text-[#98A5B7]">
                <span className="block font-bold text-[#F4F7FB] mb-0.5">Task Stream</span>
                {pixelRun?.task_description || 'Evolve LedgerFlow React components & approval queues'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
