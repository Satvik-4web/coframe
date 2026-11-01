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
  Code2,
  Check,
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
  onNavigateTab: (tab: any, param?: string) => void;
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

  const pendingPRDs = state.proposals.filter(
    (p) => p.proposal_type === 'prd_requirement' && p.status === 'pending_review'
  );
  const pendingPlans = state.proposals.filter(
    (p) => p.proposal_type === 'implementation_plan' && p.status === 'pending_review'
  );
  const pendingReviews = state.proposals.filter(
    (p) => p.proposal_type === 'implementation_result' && p.status === 'pending_review'
  );

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
      // Graceful fallback to client state
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

  const humanName = identity === 'alex' ? 'Alex' : 'Maya';

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
      action: () => onNavigateTab('proposals', p.proposal_id),
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
      action: () => onNavigateTab('proposals', p.proposal_id),
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
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  const hasActiveTask =
    (activePRD && activePRD.status === 'awaiting_confirmation') ||
    pendingProposals.length > 0 ||
    conflictProposals.length > 0 ||
    staleProposals.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Welcome Section (Section 4.A) */}
      <div className="bg-white border border-[#E8EAF2] rounded-2xl p-6 lg:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-800 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
            <span>Shared Workspace Active · LedgerFlow</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-[#172033] tracking-tight">
            Good morning, {humanName}. Let's build something together.
          </h1>
          <p className="text-sm font-medium text-[#657189] mt-1.5 leading-relaxed">
            Your LedgerFlow workspace brings humans and AI agents together to develop one shared product through structured, human-controlled iteration.
          </p>

          {/* Primary & Secondary Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('chat')}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-violet-200" />
              <span>Open Workspace Chat</span>
            </button>

            <button
              onClick={() => onNavigateTab('preview')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F7F8FC] text-[#172033] border border-[#E8EAF2] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Eye className="w-4 h-4 text-[#0D9488]" />
              <span>View Product Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Prominent Quick Chat Panel (Section 4.B) */}
      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {/* 3. Project Pulse Metrics Strip (Section 4.C) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#657189]">
            Project Pulse
          </h3>
          <span className="text-[11px] text-[#94A3B8]">Real-time telemetry</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5">
          {/* Context Version */}
          <div className="bg-white border border-[#E8EAF2] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#657189]">Context Version</span>
              <Radio className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#172033] font-mono">
                v{state.project.context_version}
              </span>
            </div>
            <p className="text-[11px] text-[#657189] mt-1">Requirements provenance</p>
          </div>

          {/* Artifact Version */}
          <div className="bg-white border border-[#E8EAF2] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#657189]">Artifact Version</span>
              <Layers className="w-4 h-4 text-[#0D9488]" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#172033] font-mono">
                v{state.project.artifact_version}
              </span>
            </div>
            <p className="text-[11px] text-[#657189] mt-1">Compiled product release</p>
          </div>

          {/* Pending PRDs */}
          <div className="bg-white border border-[#E8EAF2] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#657189]">Pending PRDs</span>
              <FileText className="w-4 h-4 text-violet-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#172033]">
                {pendingPRDs.length}
              </span>
              <span className="text-xs text-[#657189]">awaiting review</span>
            </div>
            <p className="text-[11px] text-[#657189] mt-1">NOVA requirements specs</p>
          </div>

          {/* Active Collaborators */}
          <div className="bg-white border border-[#E8EAF2] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#657189]">Active Collaborators</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#172033]">
                {state.online_members.length > 0 ? state.online_members.length : 4}
              </span>
              <span className="text-xs text-emerald-600 font-semibold">Live Sync</span>
            </div>
            <p className="text-[11px] text-[#657189] mt-1">Alex, Maya, NOVA, PIXEL</p>
          </div>
        </div>
      </div>

      {/* 4. Attention Required (Section 4.D) */}
      <div className="bg-white border border-[#E8EAF2] rounded-2xl p-6 shadow-xs space-y-4">
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
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View all proposals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {attentionItems.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[#E8EAF2] bg-[#F7F8FC]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-[#172033]">All caught up!</p>
            <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
              No pending PRD approvals or section conflicts require immediate decision.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attentionItems.map((item, idx) => (
              <div
                key={item.id || ('attn_' + idx)}
                onClick={item.action}
                className="p-4 rounded-xl border border-[#E8EAF2] hover:border-violet-300 hover:shadow-xs bg-[#F7F8FC] cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <h4 className="font-bold text-xs text-[#172033] group-hover:text-violet-700 transition truncate">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs text-[#657189] line-clamp-1">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-violet-700 group-hover:translate-x-0.5 transition flex items-center gap-1">
                    {item.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Team Snapshot (Section 4.F) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NOVA Card */}
        <div className="bg-white border border-[#E8EAF2] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-base border border-violet-200">
                <Bot className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#172033]">NOVA</h4>
                <p className="text-[11px] text-[#657189]">AI Product Strategist · Gemini 2.5 Flash</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              {stageInfo?.nova_status?.includes('Analyzing') ? 'Analyzing' : 'Ready'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] text-xs">
            <span className="text-[10px] font-bold text-[#657189] uppercase tracking-wider block mb-1">
              Current Mission
            </span>
            <p className="text-[#334155] font-medium text-xs leading-relaxed">
              {novaRun?.task_description || 'Synthesizing requirements & structuring 11-section PRDs'}
            </p>
          </div>
        </div>

        {/* PIXEL Card */}
        <div className="bg-white border border-[#E8EAF2] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-base border border-teal-200">
                <Code2 className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#172033]">PIXEL</h4>
                <p className="text-[11px] text-[#657189]">AI Software Engineer · Gemini 2.5 Flash</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {stageInfo?.pixel_status?.includes('Waiting') ? 'Awaiting PRD' : 'Standby'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] text-xs">
            <span className="text-[10px] font-bold text-[#657189] uppercase tracking-wider block mb-1">
              Current Mission
            </span>
            <p className="text-[#334155] font-medium text-xs leading-relaxed">
              {pixelRun?.task_description || 'Implementation planning on confirmed PRDs with atomic CAS commits'}
            </p>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Timeline (Section 4.E) */}
      <div className="bg-white border border-[#E8EAF2] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              Recent Collaboration Events
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('activity')}
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Full event history</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {state.events.slice(0, 5).map((ev, idx) => (
            <div
              key={ev.id || ev.event_id || ('ev_' + idx)}
              className="p-3 rounded-xl bg-[#F7F8FC] border border-[#E8EAF2] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    ev.actor_type === 'human'
                      ? 'bg-blue-600'
                      : ev.actor_id === 'nova'
                      ? 'bg-violet-600'
                      : 'bg-teal-600'
                  }`}
                />
                <div className="min-w-0">
                  <span className="font-bold text-[#172033] mr-2">
                    {ev.actor_id.toUpperCase()}
                  </span>
                  <span className="text-[#475569] font-medium truncate">
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#94A3B8] font-mono">
                <span>Seq #{ev.sequence_no}</span>
                <span>•</span>
                <span>{new Date(ev.created_at || (ev.timestamp ? ev.timestamp * 1000 : Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
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
