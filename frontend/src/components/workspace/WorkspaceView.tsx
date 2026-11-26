import React, { useState, useEffect } from 'react';
import {
  FullProjectState,
  HumanIdentity,
  PRD,
  ImplementationPlan,
  WorkflowStageInfo,
} from '../../types';
import {
  Users,
  Cpu,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Layers,
  FileText,
  Radio,
  Eye,
  Code2,
  Plus,
} from 'lucide-react';
import {
  fetchLatestPRD,
  fetchLatestPlan,
  fetchWorkflowStage,
} from '../../lib/api';
import { ProductPromptModal } from './ProductPromptModal';
import { PRDReviewModal } from './PRDReviewModal';
import { ImplementationPlanCard } from './ImplementationPlanCard';
import { OverviewQuickChat } from '../chat/OverviewQuickChat';

interface WorkspaceViewProps {
  state: FullProjectState;
  identity: HumanIdentity;
  onRefresh: () => void;
  onNavigateTab: (tab: any, param?: string) => void;
}

const LIFECYCLE_STEPS = [
  'Idea',
  'NOVA PRD',
  'Human Confirm',
  'PIXEL Plan',
  'Execution',
  'Final Review',
];

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  state,
  identity,
  onRefresh,
  onNavigateTab,
}) => {
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showPRDModal, setShowPRDModal] = useState(false);
  const [activePRD, setActivePRD] = useState<PRD | null>(null);
  const [activePlan, setActivePlan] = useState<ImplementationPlan | null>(null);
  const [stageInfo, setStageInfo] = useState<WorkflowStageInfo | undefined>(undefined);

  const novaRun = state.agent_runs.find((r) => r.agent_id === 'nova');
  const pixelRun = state.agent_runs.find((r) => r.agent_id === 'pixel');

  const pendingProposals = state.proposals.filter((p) => p.status === 'pending_review');
  const staleProposals = state.proposals.filter((p) => p.status === 'stale');
  const conflictProposals = state.proposals.filter((p) => p.status === 'conflict');
  const highImpactProposals = pendingProposals.filter((p) => p.requires_decision);

  const pendingPRDs = state.proposals.filter(
    (p) => p.proposal_type === 'prd_requirement' && p.status === 'pending_review'
  );

  const loadWorkflowData = async () => {
    try {
      const [prdRes, planRes, stageRes] = await Promise.all([
        fetchLatestPRD('demo-ledgerflow').catch(() => ({ prd: null })),
        fetchLatestPlan('demo-ledgerflow').catch(() => ({ plan: null })),
        fetchWorkflowStage('demo-ledgerflow').catch(() => ({ stage: null })),
      ]);
      if (prdRes.prd) setActivePRD(prdRes.prd);
      if (planRes.plan) setActivePlan(planRes.plan);
      if (stageRes.stage) setStageInfo(stageRes.stage);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadWorkflowData();
  }, [state.project.context_version, state.proposals.length]);

  const handleAnalysisComplete = (prd: PRD) => {
    setActivePRD(prd);
    setShowPRDModal(true);
    loadWorkflowData();
    onRefresh();
  };

  const attentionItems: Array<{
    id: string;
    type: 'prd' | 'conflict' | 'stale' | 'high_impact' | 'proposal';
    title: string;
    description: string;
    actionLabel: string;
    badge: string;
    badgeColor: string;
    action: () => void;
  }> = [];

  if (activePRD && activePRD.status === 'awaiting_confirmation') {
    attentionItems.push({
      id: activePRD.id,
      type: 'prd',
      title: `PRD v${activePRD.version}: ${activePRD.title}`,
      description: 'NOVA completed product requirements. Confirmation required before PIXEL begins work.',
      actionLabel: 'Review PRD',
      badge: 'PRD Review',
      badgeColor: 'bg-blue-50 text-[#2563EB] border-blue-200/70',
      action: () => setShowPRDModal(true),
    });
  }

  conflictProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'conflict',
      title: `Conflict on '${p.target_sections[0] || 'hero'}'`,
      description: p.conflict_reason || 'Concurrent edits detected. Compare changes side-by-side.',
      actionLabel: 'Resolve',
      badge: 'Conflict',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/70',
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  staleProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'stale',
      title: `Outdated: ${p.summary}`,
      description: p.stale_reason || 'Requirements changed after this proposal was generated.',
      actionLabel: 'Inspect',
      badge: 'Stale',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/70',
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  highImpactProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'high_impact',
      title: p.summary,
      description: 'High-impact change requiring Alex authorization.',
      actionLabel: 'Review',
      badge: 'Approval Required',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  const activeStageIdx = Math.min(stageInfo?.active_index ?? 0, LIFECYCLE_STEPS.length - 1);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span>Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">LedgerFlow</span>
          </div>
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-[-0.025em] leading-tight">
            Product Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Coordinated delivery between {identity === 'alex' ? 'Alex' : 'Maya'}, NOVA, and PIXEL.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="h-9 px-3.5 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>New Brief</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('preview')}
            className="h-9 px-3.5 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>Preview Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('chat')}
            className="h-9 px-4 rounded-lg btn-obsidian text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-300" />
            <span>Open Chat</span>
          </button>
        </div>
      </div>

      {/* Compact Sequential Lifecycle Rail */}
      <div className="bg-white/90 border border-slate-900/[0.08] rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
          <span className="text-xs font-medium text-slate-900">
            {stageInfo?.stage_label || 'Product Discovery'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {LIFECYCLE_STEPS.map((label, idx) => {
            const isDone = idx < activeStageIdx;
            const isCurrent = idx === activeStageIdx;
            return (
              <React.Fragment key={label}>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition ${
                    isCurrent
                      ? 'bg-[#0F172A] text-white'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'text-slate-400'
                  }`}
                >
                  {idx + 1}. {label}
                </span>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <span className="text-slate-300 text-[10px]">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Focused Dispatch Console */}
      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {/* 4 Clean Stripe Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="coframe-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Context version</span>
            <Radio className="w-4 h-4 text-[#2563EB]" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 text-[28px] font-medium text-slate-900 font-mono leading-none tracking-tight">
            v{state.project.context_version}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Approved PRDs & rules</p>
        </div>

        <div className="coframe-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Artifact version</span>
            <Layers className="w-4 h-4 text-[#0F766E]" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 text-[28px] font-medium text-slate-900 font-mono leading-none tracking-tight">
            v{state.project.artifact_version}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Merged canvas build</p>
        </div>

        <div className="coframe-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending PRDs</span>
            <FileText className="w-4 h-4 text-[#6D28D9]" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-[28px] font-medium text-slate-900 font-mono leading-none tracking-tight">
              {pendingPRDs.length}
            </span>
            <span className="text-xs text-slate-500">awaiting sign-off</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">NOVA specifications</p>
        </div>

        <div className="coframe-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Team active</span>
            <Users className="w-4 h-4 text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-[28px] font-medium text-slate-900 font-mono leading-none tracking-tight">
              {state.online_members.length > 0 ? state.online_members.length : 4}
            </span>
            <span className="text-xs font-medium text-emerald-700">online</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Alex, Maya, NOVA, PIXEL</p>
        </div>
      </div>

      {/* Asymmetric Bento Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7/12): Attention Queue & Recent Activity */}
        <div className="lg:col-span-7 space-y-5">
          {/* Attention Queue */}
          <div className="coframe-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.06]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold text-slate-900">
                  Needs attention ({attentionItems.length})
                </h2>
              </div>
              {attentionItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('proposals')}
                  className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-900/[0.1] bg-slate-50/60">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" strokeWidth={1.75} />
                <p className="text-xs font-semibold text-slate-900">Everything is up to date</p>
                <p className="text-xs text-slate-500 mt-1">
                  All specifications, engineering plans, and section edits are settled.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item, idx) => (
                  <div
                    key={item.id || ('attn_' + idx)}
                    onClick={item.action}
                    className="p-3.5 rounded-xl border border-slate-900/[0.07] hover:border-[#2563EB]/35 hover:bg-blue-50/20 bg-slate-50/50 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium px-2 py-0.2 rounded-md border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        <h4 className="font-medium text-xs text-slate-900 group-hover:text-[#2563EB] transition truncate">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-xs font-medium text-[#2563EB] group-hover:translate-x-0.5 transition-transform">
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Plan Card if present */}
          {activePlan && (
            <ImplementationPlanCard
              plan={activePlan}
              onViewProposal={(pid) => onNavigateTab('proposals', pid)}
            />
          )}

          {/* Recent Activity Log */}
          <div className="coframe-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.06]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent activity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('activity')}
                className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
              >
                <span>Audit log</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-900/[0.05]">
              {state.events.slice(0, 5).map((ev, idx) => (
                <div
                  key={ev.id || ev.event_id || ('ev_' + idx)}
                  className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        ev.actor_type === 'human'
                          ? 'bg-[#2563EB]'
                          : ev.actor_id === 'nova'
                          ? 'bg-[#6D28D9]'
                          : 'bg-[#0F766E]'
                      }`}
                    />
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-slate-900 mr-2">
                        {ev.actor_id.toUpperCase()}
                      </span>
                      <span className="text-slate-600">
                        {ev.event_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 font-mono">
                    <span>#{ev.sequence_no}</span>
                    <span>·</span>
                    <span>
                      {new Date(
                        ev.created_at || (ev.timestamp ? ev.timestamp * 1000 : Date.now())
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5/12): Specialist AI Collaborators */}
        <div className="lg:col-span-5 space-y-4">
          {/* NOVA Card */}
          <div
            onClick={() => onNavigateTab('agents')}
            className="coframe-card p-5 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#6D28D9] flex items-center justify-center border border-violet-200/70 shrink-0">
                  <Cpu className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-[#6D28D9] transition-colors">
                    NOVA
                  </h4>
                  <p className="text-xs text-slate-500">Product Strategist</p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-[#6D28D9] border border-violet-200/60">
                {stageInfo?.nova_status?.includes('Analyzing') ? 'Analyzing' : 'Ready'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-3.5 leading-relaxed">
              {novaRun?.task_description || 'Synthesizing product requirements, structured PRDs, and compliance checks.'}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-900/[0.06] flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Gemini 2.5</span>
              <span>ctx v{novaRun?.base_context_version || 1}</span>
            </div>
          </div>

          {/* PIXEL Card */}
          <div
            onClick={() => onNavigateTab('agents')}
            className="coframe-card p-5 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center border border-teal-200/70 shrink-0">
                  <Code2 className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-[#0F766E] transition-colors">
                    PIXEL
                  </h4>
                  <p className="text-xs text-slate-500">Software Engineer</p>
                </div>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-[#0F766E] border border-teal-200/60">
                {stageInfo?.pixel_status?.includes('Waiting') ? 'Awaiting PRD' : 'Standby'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-3.5 leading-relaxed">
              {pixelRun?.task_description || 'Formulating implementation plans and building verified LedgerFlow UI updates.'}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-900/[0.06] flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Gemini 2.5</span>
              <span>art v{pixelRun?.base_artifact_version || 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPromptModal && (
        <ProductPromptModal
          isOpen={showPromptModal}
          identity={identity}
          onClose={() => setShowPromptModal(false)}
          onAnalysisComplete={handleAnalysisComplete}
        />
      )}

      {showPRDModal && activePRD && (
        <PRDReviewModal
          isOpen={showPRDModal}
          prd={activePRD}
          identity={identity}
          onClose={() => setShowPRDModal(false)}
          onConfirmSuccess={() => {
            setShowPRDModal(false);
            loadWorkflowData();
            onRefresh();
          }}
          onRefresh={() => {
            loadWorkflowData();
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
