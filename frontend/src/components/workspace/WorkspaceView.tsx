import React, { useState, useEffect } from 'react';
import {
  FullProjectState,
  HumanIdentity,
  AgentRun,
  Proposal,
  PRD,
  ImplementationPlan,
  WorkflowStageInfo,
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
  ShieldAlert,
  ShieldCheck,
  Layers,
  Activity,
  FileText,
  Radio,
  Eye,
  HelpCircle,
} from 'lucide-react';
import {
  restartAgent,
  fetchLatestPRD,
  fetchLatestPlan,
  fetchWorkflowStage,
} from '../../lib/api';
import { WorkflowStageIndicator } from './WorkflowStageIndicator';
import { ProductPromptModal } from './ProductPromptModal';
import { PRDReviewModal } from './PRDReviewModal';
import { ImplementationPlanCard } from './ImplementationPlanCard';
import { OverviewQuickChat } from '../chat/OverviewQuickChat';

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

  // Load latest PRD, Plan, and Workflow Stage from DB
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
      // Graceful fallback to client calculation
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

  const handleConfirmPRDSuccess = () => {
    loadWorkflowData();
    onRefresh();
  };

  const humanName = identity === 'alex' ? 'Alex' : 'Maya';
  const summary = state.observer_summary;

  // Derive Attention Required items
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

  // 1. PRD awaits confirmation
  if (activePRD && activePRD.status === 'awaiting_confirmation') {
    attentionItems.push({
      id: activePRD.id,
      type: 'prd',
      title: `PRD v${activePRD.version}: ${activePRD.title}`,
      description: 'NOVA completed product requirements. Alex confirmation required before PIXEL begins implementation.',
      actionLabel: 'Review & Confirm PRD',
      badge: 'PRD CONFIRMATION',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
      action: () => setShowPRDModal(true),
    });
  }

  // 2. Section Conflicts
  conflictProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'conflict',
      title: `Section Conflict on '${p.target_sections[0] || 'hero'}'`,
      description: p.conflict_reason || 'Maya manually edited this section concurrently. Reconcile side-by-side.',
      actionLabel: 'Resolve Conflict',
      badge: 'CONFLICT',
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      action: () => onNavigateTab('proposals'),
    });
  });

  // 3. Stale Proposals
  staleProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'stale',
      title: `Outdated Proposal: ${p.summary}`,
      description: p.stale_reason || 'Requirement dependency changed since proposal generation.',
      actionLabel: 'Inspect Staleness',
      badge: 'STALE',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      action: () => onNavigateTab('proposals'),
    });
  });

  // 4. High-Impact Approvals
  highImpactProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'high_impact',
      title: p.summary,
      description: 'High-impact policy proposal requiring exclusive Alex authorization or redirection.',
      actionLabel: 'Review Sign-off',
      badge: 'HIGH IMPACT',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      action: () => onNavigateTab('proposals'),
    });
  });

  // Determine whether an active task is running
  const hasActiveTask =
    (activePRD && activePRD.status === 'awaiting_confirmation') ||
    pendingProposals.length > 0 ||
    conflictProposals.length > 0 ||
    staleProposals.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Header (Requirement 2: Good afternoon, Alex. Here's what's happening with LedgerFlow.) */}
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

          {/* Main CTA (Requirement 2: Single Primary Action + Secondary View Product Preview) */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!hasActiveTask ? (
              <button
                onClick={() => setShowPromptModal(true)}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start a new product task</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (activePRD && activePRD.status === 'awaiting_confirmation') {
                    setShowPRDModal(true);
                  } else {
                    onNavigateTab('proposals');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Continue collaboration</span>
              </button>
            )}

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

      {/* Quick Chat: What would you like to build today? */}
      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {/* 2. Current Workflow Stage (Requirement 2 & Section 1.B: Staged Development Workflow) */}
      <WorkflowStageIndicator
        stageInfo={stageInfo}
        onOpenPRD={() => setShowPRDModal(true)}
      />

      {/* 3. Latest Collaboration Update (Requirement 2: What changed? Why? What happens next?) */}
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
                {summary?.what_changed || 'Collaboration workspace active.'}
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
                {summary?.why || 'Team is developing the LedgerFlow expense management artifact.'}
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
                {summary?.what_happens_next || 'Review pending proposals or advance requirements.'}
              </p>
            </div>
            <span className="text-[10px] text-[#657189] mt-3 font-mono">
              Next Action
            </span>
          </div>
        </div>
      </div>

      {/* 4. Attention Required (Requirement 2: PRD awaits confirmation, Agent clarification, Proposal review, Conflict, Approval) */}
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
              No tasks currently require sign-off or conflict resolution.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attentionItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={item.action}
                className="p-4 rounded-xl border border-[#E5EAF0] hover:border-teal-300 hover:shadow-xs bg-[#F8FAFC] cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <h4 className="font-bold text-xs text-[#172033] group-hover:text-teal-700 transition truncate">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs text-[#657189] line-clamp-1">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-teal-700 group-hover:translate-x-0.5 transition flex items-center gap-1">
                    {item.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. PIXEL Implementation Planning Preview (Requirement 5) */}
      {activePlan && (
        <ImplementationPlanCard
          plan={activePlan}
          onViewProposal={(propId) => onNavigateTab('proposals')}
        />
      )}

      {/* 6. Current Project Status Metrics Strip (Requirement 2) */}
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
            <span className="text-xs font-medium text-[#657189]">Pending Proposals</span>
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

      {/* 7. Lower Section: Activity & AI Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Recent Collaboration Activity
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

            <div className="space-y-2.5">
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
                        {evt.actor_id.toUpperCase()} · <span className="font-medium text-[#657189]">{evt.event_type.replace('.', ' ')}</span>
                      </p>
                      <p className="text-[11px] text-[#657189]">
                        {evt.payload?.summary || evt.payload?.title || evt.payload?.message || JSON.stringify(evt.payload).slice(0, 65)}
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
            <div className="p-3.5 rounded-xl border border-violet-100 bg-violet-50/20 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">
                  N
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033]">NOVA</h4>
                  <p className="text-[11px] text-violet-600 font-medium">Product Strategist & PRD Architect</p>
                </div>
              </div>
              <p className="text-xs text-[#657189] bg-white p-2.5 rounded-lg border border-violet-100">
                {activePRD ? `Active PRD: ${activePRD.title}` : 'Ready to analyze product prompts & formulate PRDs'}
              </p>
            </div>

            {/* PIXEL Preview */}
            <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/20 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
                  P
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172033]">PIXEL</h4>
                  <p className="text-[11px] text-teal-600 font-medium">Prototype Engineer</p>
                </div>
              </div>
              <p className="text-xs text-[#657189] bg-white p-2.5 rounded-lg border border-teal-100">
                {activePlan ? `Executing plan for: ${activePlan.target_sections.join(', ')}` : 'Evolves LedgerFlow React components & approval queues'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductPromptModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        identity={identity}
        onAnalysisComplete={handleAnalysisComplete}
      />

      <PRDReviewModal
        isOpen={showPRDModal}
        onClose={() => setShowPRDModal(false)}
        prd={activePRD}
        identity={identity}
        onConfirmSuccess={handleConfirmPRDSuccess}
        onRefresh={onRefresh}
      />
    </div>
  );
};
