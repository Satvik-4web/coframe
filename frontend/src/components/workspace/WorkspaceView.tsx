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
  ShieldCheck,
  GitFork,
  Layers,
  Activity,
  Play,
  AlertTriangle,
  FileCode2,
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
  const totalNeedingAttention = pendingProposals.length + attentionProposals.length;

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

  const getLifecycleBadge = (lifecycle?: string, status?: string) => {
    const s = lifecycle || status || 'idle';
    switch (s) {
      case 'working':
        return (
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            Working
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Awaiting Sign-off
          </span>
        );
      case 'recovering_context':
        return (
          <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
            Recovering Context
          </span>
        );
      case 'failed':
        return (
          <span className="font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Idle / Ready
          </span>
        );
    }
  };

  const pendingApprovalsCount = (state.approvals || []).filter((a) => a.status === 'pending').length;
  const delegationsCount = (state.delegations || []).length;
  const resourcesCount = (state.resources || []).length;
  const humanName = identity === 'alex' ? 'Alex' : 'Maya';

  return (
    <div className="space-y-6">
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-white border border-[#E5EAF0] rounded-2xl p-6 lg:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] relative overflow-hidden">
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>Shared Workspace Active</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold text-[#172033] tracking-tight">
            Good afternoon, {humanName}
          </h1>
          <p className="text-sm text-[#657189] mt-2 leading-relaxed">
            Your team is building <span className="font-semibold text-[#172033]">LedgerFlow</span> together. NOVA formulates product strategy, PIXEL implements interactive UI components, and human decisions guide the outcome.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleStartCollab}
              disabled={starting}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${starting ? 'animate-spin' : ''}`} />
              <span>{starting ? 'Running NOVA & PIXEL...' : 'Start Collaboration (Run Agents)'}</span>
            </button>

            <button
              onClick={() => onNavigateTab('canvas')}
              className="px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#172033] border border-[#E5EAF0] font-medium text-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <span>Inspect LedgerFlow Canvas</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#657189]" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Status Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5EAF0] rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Team Members</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-[#172033]">4</span>
            <span className="text-xs text-[#657189]">Active</span>
          </div>
          <div className="mt-1 text-[11px] text-[#657189]">2 Humans · 2 AI Agents</div>
        </div>

        <div className="bg-white border border-[#E5EAF0] rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Needs Review</span>
            <GitPullRequest className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-[#172033]">{pendingProposals.length}</span>
            <span className="text-xs text-[#657189]">Pending</span>
          </div>
          <div className="mt-1 text-[11px] text-[#657189]">
            {attentionProposals.length} conflict/stale alerts
          </div>
        </div>

        <div className="bg-white border border-[#E5EAF0] rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Product Version</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#172033] font-mono">
              v{state.project.artifact_version}
            </span>
            <span className="text-xs text-[#657189] font-mono">
              (Ctx v{state.project.context_version})
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[#657189]">Immutable LedgerFlow state</div>
        </div>

        <div className="bg-white border border-[#E5EAF0] rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Event Log</span>
            <Activity className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-[#172033] font-mono">
              {state.events.length}
            </span>
            <span className="text-xs text-[#657189]">Events</span>
          </div>
          <div className="mt-1 text-[11px] text-[#657189]">Append-only audit trail</div>
        </div>
      </div>

      {/* 3. Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Needs Your Attention */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E5EAF0] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2">
                <GitPullRequest className="w-4 h-4 text-teal-600" />
                <h2 className="font-bold text-sm text-[#172033] tracking-tight">
                  Needs Your Attention ({totalNeedingAttention})
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('proposals')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition"
              >
                View all proposals →
              </button>
            </div>

            {totalNeedingAttention === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[#E5EAF0] bg-slate-50/50">
                <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-[#172033]">All caught up!</p>
                <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
                  No proposals require your attention right now. Click "Start Collaboration (Run Agents)" to trigger NOVA and PIXEL.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...attentionProposals, ...pendingProposals].slice(0, 4).map((p) => {
                  const isNova = p.agent_id === 'nova';
                  const isConflict = p.status === 'conflict';
                  const isStale = p.status === 'stale';

                  return (
                    <div
                      key={p.proposal_id}
                      onClick={() => onNavigateTab('proposals')}
                      className="p-4 rounded-xl border border-[#E5EAF0] hover:border-teal-300 hover:shadow-sm bg-white cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isNova
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {p.agent_id.toUpperCase()}
                          </span>
                          <span className="font-semibold text-xs text-[#172033] truncate">
                            {p.summary}
                          </span>
                        </div>
                        <p className="text-xs text-[#657189] line-clamp-1">
                          {p.reasoning || 'Proposed enhancement to LedgerFlow.'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isConflict && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            CONFLICT
                          </span>
                        )}
                        {isStale && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            STALE
                          </span>
                        )}
                        {!isConflict && !isStale && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            PENDING REVIEW
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-[#657189]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Your AI Team */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E5EAF0] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-[#E5EAF0]">
              <Bot className="w-4 h-4 text-teal-600" />
              <h2 className="font-bold text-sm text-[#172033] tracking-tight">Your AI Team</h2>
            </div>

            {/* Agent Card 1: NOVA */}
            <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                    N
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#172033]">NOVA</h4>
                    <p className="text-[11px] text-violet-600 font-medium">Product Strategist</p>
                  </div>
                </div>

                <button
                  onClick={() => handleRestart('nova')}
                  disabled={restartingAgent === 'nova'}
                  className="p-1.5 rounded-lg bg-white border border-violet-200 hover:bg-violet-50 text-[#657189] hover:text-violet-700 transition shadow-xs cursor-pointer"
                  title="Restart NOVA"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'nova' ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#657189]">Lifecycle State</span>
                  {getLifecycleBadge(novaRun?.lifecycle_state, novaRun?.status)}
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-violet-100 text-[11px] text-[#657189] leading-relaxed">
                  <span className="font-semibold text-[#172033] block mb-0.5">Current Scope</span>
                  {novaRun?.current_task || novaRun?.task_description || 'Analyze market positioning & requirement dependencies'}
                </div>
              </div>
            </div>

            {/* Agent Card 2: PIXEL */}
            <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                    P
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#172033]">PIXEL</h4>
                    <p className="text-[11px] text-teal-600 font-medium">Prototype Engineer</p>
                  </div>
                </div>

                <button
                  onClick={() => handleRestart('pixel')}
                  disabled={restartingAgent === 'pixel'}
                  className="p-1.5 rounded-lg bg-white border border-teal-200 hover:bg-teal-50 text-[#657189] hover:text-teal-700 transition shadow-xs cursor-pointer"
                  title="Restart PIXEL"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'pixel' ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#657189]">Lifecycle State</span>
                  {getLifecycleBadge(pixelRun?.lifecycle_state, pixelRun?.status)}
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-teal-100 text-[11px] text-[#657189] leading-relaxed">
                  <span className="font-semibold text-[#172033] block mb-0.5">Current Scope</span>
                  {pixelRun?.current_task || pixelRun?.task_description || 'Evolve LedgerFlow React components & approval queues'}
                </div>
              </div>
            </div>

            {/* OpenAgents Collaboration Quick Links */}
            <div className="pt-2 border-t border-[#E5EAF0] space-y-2.5">
              <button
                onClick={() => onNavigateTab('governance')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-100 transition text-left group"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <div>
                    <h5 className="text-xs font-bold text-[#172033]">Governance & Handoffs</h5>
                    <p className="text-[11px] text-[#657189]">
                      {pendingApprovalsCount} pending sign-off · {delegationsCount} delegations
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#657189] group-hover:text-[#172033] group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onNavigateTab('resources')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-teal-50/50 hover:bg-teal-50 border border-teal-100 transition text-left group"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <div>
                    <h5 className="text-xs font-bold text-[#172033]">Shared Creation Shelf</h5>
                    <p className="text-[11px] text-[#657189]">{resourcesCount} workspace resources</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#657189] group-hover:text-[#172033] group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
