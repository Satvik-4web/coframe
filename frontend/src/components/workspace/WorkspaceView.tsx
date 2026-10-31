import React, { useState } from 'react';
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
  ShieldAlert,
  ShieldCheck,
  Layers,
  Activity,
  Play,
  AlertTriangle,
  FileCode2,
  Radio,
  FileText,
  CornerUpRight,
  Eye,
} from 'lucide-react';
import { restartAgent, startCollaboration } from '../../lib/api';
import { StartCollaborationModal } from './StartCollaborationModal';

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
  const [starting, setStarting] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);

  const novaRun = state.agent_runs.find((r) => r.agent_id === 'nova');
  const pixelRun = state.agent_runs.find((r) => r.agent_id === 'pixel');

  const pendingProposals = state.proposals.filter((p) => p.status === 'pending_review');
  const staleProposals = state.proposals.filter((p) => p.status === 'stale');
  const conflictProposals = state.proposals.filter((p) => p.status === 'conflict');
  const attentionItems = [...conflictProposals, ...staleProposals, ...pendingProposals];

  const handleStartCollab = async (objective?: string) => {
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
          <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            Working
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 text-[11px]">
            Awaiting Sign-off
          </span>
        );
      case 'recovering_context':
        return (
          <span className="font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200 text-[11px]">
            Recovering Context
          </span>
        );
      case 'failed':
        return (
          <span className="font-semibold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 text-[11px]">
            Failed
          </span>
        );
      default:
        return (
          <span className="font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
            Idle / Ready
          </span>
        );
    }
  };

  const humanName = identity === 'alex' ? 'Alex' : 'Maya';
  const summary = state.observer_summary;

  return (
    <div className="space-y-6">
      {/* 1. Welcoming Header */}
      <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 lg:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>Shared Workspace Active</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold text-[#172033] tracking-tight">
            Good afternoon, {humanName}.
          </h1>
          <p className="text-sm font-medium text-[#172033] mt-1">
            Here's what's happening with LedgerFlow.
          </p>
          <p className="text-xs text-[#657189] mt-1 leading-relaxed">
            Enterprise expense management platform built collaboratively by your team and AI agents.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleStartCollab()}
              disabled={starting}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${starting ? 'animate-spin' : ''}`} />
              <span>{starting ? 'Running NOVA & PIXEL...' : 'Start Collaboration (Run Agents)'}</span>
            </button>

            <button
              onClick={() => onNavigateTab('preview')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#172033] border border-[#E7ECF2] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-teal-600" />
              <span>View Product Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Latest Collaboration Update (Observer Summary) */}
      <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-teal-50 border border-teal-100">
              <Activity className="w-4 h-4 text-teal-700" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              Latest collaboration update
            </h2>
          </div>
          <span className="text-[11px] text-[#657189] font-medium">
            Derived from persisted event audit trail
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* WHAT CHANGED */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block mb-1">
                What Changed
              </span>
              <p className="text-xs text-[#172033] font-medium leading-relaxed">
                {summary?.what_changed ||
                  'The project audience was changed from small businesses to enterprise finance teams.'}
              </p>
            </div>
            <span className="text-[10px] text-[#657189] mt-3 font-mono">
              Context v{summary?.context_version || state.project.context_version}
            </span>
          </div>

          {/* WHY */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
                Why
              </span>
              <p className="text-xs text-[#172033] font-medium leading-relaxed">
                {summary?.why ||
                  'Alex updated the product direction to support enterprise approval workflows.'}
              </p>
            </div>
            <span className="text-[10px] text-[#657189] mt-3 font-mono">
              Strategic Rationale
            </span>
          </div>

          {/* WHAT HAPPENS NEXT */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block mb-1">
                What Happens Next
              </span>
              <p className="text-xs text-[#172033] font-medium leading-relaxed">
                {summary?.what_happens_next ||
                  "PIXEL's updated approval-queue proposal is ready for review."}
              </p>
            </div>
            <span className="text-[10px] text-[#657189] mt-3 font-mono">
              Next Action
            </span>
          </div>
        </div>
      </div>

      {/* 3. Attention Required — The Most Prominent Actionable Section */}
      <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-50 border border-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </span>
            <h2 className="text-sm font-bold text-[#172033]">
              Attention Required ({attentionItems.length})
            </h2>
          </div>
          {attentionItems.length > 0 && (
            <button
              onClick={() => onNavigateTab('proposals')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View all proposals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {attentionItems.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-[#E7ECF2] bg-[#F8FAFC]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-[#172033]">All caught up!</p>
            <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
              No contributions currently require review or conflict reconciliation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attentionItems.slice(0, 4).map((p) => {
              const isConflict = p.status === 'conflict';
              const isStale = p.status === 'stale';
              const isPending = p.status === 'pending_review';
              const isNova = p.agent_id === 'nova';

              let what = p.summary;
              let why = p.reasoning;
              let who = p.assigned_decider_id ? `${p.assigned_decider_id.toUpperCase()} (Founder)` : 'Any Collaborator';
              let actionLabel = 'Review Proposal';

              if (isConflict) {
                actionLabel = 'Resolve Conflict';
                why = p.conflict_reason || 'Maya edited this section concurrently.';
              } else if (isStale) {
                actionLabel = 'Inspect Staleness';
                why = p.stale_reason || 'Outdated requirements detected.';
              } else if (p.requires_decision) {
                actionLabel = 'Sign-off Required';
                who = 'Alex (Exclusive Authority)';
              }

              return (
                <div
                  key={p.proposal_id}
                  onClick={() => onNavigateTab('proposals')}
                  className="p-4 rounded-xl border border-[#E7ECF2] hover:border-teal-300 hover:shadow-xs bg-[#F8FAFC] cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isNova
                            ? 'bg-violet-50 text-violet-700 border border-violet-200'
                            : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}
                      >
                        {p.agent_id.toUpperCase()}
                      </span>
                      <h4 className="font-bold text-xs text-[#172033] group-hover:text-teal-700 transition truncate">
                        {what}
                      </h4>
                      {isConflict && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          CONFLICT
                        </span>
                      )}
                      {isStale && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          STALE
                        </span>
                      )}
                      {p.requires_decision && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          HIGH IMPACT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#657189] line-clamp-1">
                      <strong className="text-[#172033]">Trigger: </strong>
                      {why}
                    </p>
                    <p className="text-[11px] text-[#657189]">
                      Responsible: <span className="font-semibold text-[#172033]">{who}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-teal-700 group-hover:translate-x-0.5 transition flex items-center gap-1">
                      {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Project Overview Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7ECF2] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Artifact Version</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#172033] font-mono">
              v{state.project.artifact_version}
            </span>
          </div>
          <p className="text-[11px] text-[#657189] mt-1">Compiled LedgerFlow state</p>
        </div>

        <div className="bg-white border border-[#E7ECF2] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Context Version</span>
            <Radio className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#172033] font-mono">
              v{state.project.context_version}
            </span>
          </div>
          <p className="text-[11px] text-[#657189] mt-1">Verified requirements state</p>
        </div>

        <div className="bg-white border border-[#E7ECF2] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Proposals Pending</span>
            <GitPullRequest className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#172033]">{pendingProposals.length}</span>
            <span className="text-xs text-[#657189]">for review</span>
          </div>
          <p className="text-[11px] text-[#657189] mt-1">
            {staleProposals.length + conflictProposals.length} stale/conflict alerts
          </p>
        </div>

        <div className="bg-white border border-[#E7ECF2] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#657189]">Collaborators</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#172033]">4</span>
            <span className="text-xs text-[#657189]">Active</span>
          </div>
          <p className="text-[11px] text-[#657189] mt-1">2 Humans · 2 AI Agents</p>
        </div>
      </div>

      {/* 5. Two-Column Lower Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Current Collaboration Activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Current Collaboration Activity
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('activity')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <span>Full history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {state.events.slice(0, 5).map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${
                        evt.actor_id === 'alex'
                          ? 'bg-blue-100 text-blue-700'
                          : evt.actor_id === 'maya'
                          ? 'bg-purple-100 text-purple-700'
                          : evt.actor_id === 'nova'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {evt.actor_id.substring(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-[#172033]">
                        {evt.actor_id.toUpperCase()} · <span className="font-mono text-[#657189]">{evt.event_type}</span>
                      </p>
                      <p className="text-[11px] text-[#657189]">
                        {evt.payload?.summary || evt.payload?.title || evt.payload?.task || JSON.stringify(evt.payload).slice(0, 70)}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right (1 col): AI Collaborators Preview */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Your AI Team
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('agents')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <span>View AI team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* NOVA Preview */}
            <div className="p-3.5 rounded-xl border border-violet-100 bg-violet-50/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">
                    N
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#172033]">NOVA</h4>
                    <p className="text-[11px] text-violet-600 font-medium">Product Strategist</p>
                  </div>
                </div>
                {getLifecycleBadge(novaRun?.lifecycle_state, novaRun?.status)}
              </div>
              <p className="text-xs text-[#657189] leading-relaxed bg-white p-2.5 rounded-lg border border-violet-100">
                {novaRun?.current_task || novaRun?.task_description || 'Analyze market positioning & requirement dependencies'}
              </p>
            </div>

            {/* PIXEL Preview */}
            <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
                    P
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#172033]">PIXEL</h4>
                    <p className="text-[11px] text-teal-600 font-medium">Prototype Engineer</p>
                  </div>
                </div>
                {getLifecycleBadge(pixelRun?.lifecycle_state, pixelRun?.status)}
              </div>
              <p className="text-xs text-[#657189] leading-relaxed bg-white p-2.5 rounded-lg border border-teal-100">
                {pixelRun?.current_task || pixelRun?.task_description || 'Evolve LedgerFlow React components & approval queues'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <StartCollaborationModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={handleStartCollab}
        starting={starting}
        identity={identity}
      />
    </div>
  );
};
