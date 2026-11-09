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
  ArrowUpRight,
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
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      action: () => setShowPRDModal(true),
    });
  }

  // 2. Section Conflicts
  conflictProposals.forEach((p) => {
    attentionItems.push({
      id: p.proposal_id,
      type: 'conflict',
      title: `Section Conflict on '${p.target_sections[0] || 'hero'}'`,
      description: p.conflict_reason || 'Concurrent manual edits detected. Reconcile side-by-side.',
      actionLabel: 'Resolve Conflict',
      badge: 'CONFLICT',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
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
      description: 'High-impact policy proposal requiring Alex authorization.',
      actionLabel: 'Review Sign-off',
      badge: 'HIGH IMPACT',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* 1. Sleek Workspace Header */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              LedgerFlow · Human + AI Workspace
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back, {humanName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential product execution: Human Idea → NOVA PRD → Alex Approval → PIXEL Code → CAS Commit.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('chat')}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Open Chat</span>
          </button>

          <button
            onClick={() => onNavigateTab('preview')}
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-teal-600" />
            <span>Live Canvas</span>
          </button>
        </div>
      </div>

      {/* 2. Focused Quick Chat Bar */}
      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {/* 3. Project Pulse Metrics Strip */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Project Pulse
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">LIVE TELEMETRY</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Context Version */}
          <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Context Version</span>
              <Radio className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                v{state.project.context_version}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Requirements & PRDs</p>
          </div>

          {/* Artifact Version */}
          <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Artifact Version</span>
              <Layers className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 font-mono">
                v{state.project.artifact_version}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Canvas component code</p>
          </div>

          {/* Pending PRDs */}
          <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Pending PRDs</span>
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">
                {pendingPRDs.length}
              </span>
              <span className="text-[10px] text-slate-400">in queue</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">NOVA specifications</p>
          </div>

          {/* Active Collaborators */}
          <div className="bg-white border border-slate-200/80 rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Active Team</span>
              <Users className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">
                {state.online_members.length > 0 ? state.online_members.length : 4}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold font-mono">SYNCED</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Alex, Maya, NOVA, PIXEL</p>
          </div>
        </div>
      </div>

      {/* 4. Attention Required */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Attention Required ({attentionItems.length})
            </h2>
          </div>
          {attentionItems.length > 0 && (
            <button
              onClick={() => onNavigateTab('proposals')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {attentionItems.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
            <p className="text-xs font-semibold text-slate-900">Workspace in clean state</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              All proposals, requirements, and section changes are approved or applied.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attentionItems.map((item, idx) => (
              <div
                key={item.id || ('attn_' + idx)}
                onClick={item.action}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/20 bg-slate-50/50 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-2.5 group"
              >
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${item.badgeColor} border`}>
                      {item.badge}
                    </span>
                    <h4 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-700 transition truncate">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. AI Specialist Agents Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* NOVA Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">NOVA</h4>
                  <p className="text-[10px] text-slate-500">AI Product Strategist · Gemini 2.5</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {stageInfo?.nova_status?.includes('Analyzing') ? 'Analyzing' : 'Ready'}
              </span>
            </div>

            <div className="mt-3 text-xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                Role & Focus
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                {novaRun?.task_description || 'Synthesizing requirements, formulating 11-section PRDs & checking compliance'}
              </p>
            </div>
          </div>
        </div>

        {/* PIXEL Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200">
                  <Code2 className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">PIXEL</h4>
                  <p className="text-[10px] text-slate-500">AI Software Engineer · Gemini 2.5</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                {stageInfo?.pixel_status?.includes('Waiting') ? 'Awaiting PRD' : 'Standby'}
              </span>
            </div>

            <div className="mt-3 text-xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                Role & Focus
              </span>
              <p className="text-slate-600 text-xs leading-relaxed">
                {pixelRun?.task_description || 'Engineering plan formulation and CAS section implementation commits'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Log */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Recent Activity
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('activity')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Full audit log</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1.5">
          {state.events.slice(0, 5).map((ev, idx) => (
            <div
              key={ev.id || ev.event_id || ('ev_' + idx)}
              className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-200/60 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    ev.actor_type === 'human'
                      ? 'bg-blue-600'
                      : ev.actor_id === 'nova'
                      ? 'bg-purple-600'
                      : 'bg-teal-600'
                  }`}
                />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 mr-1.5 text-xs">
                    {ev.actor_id.toUpperCase()}
                  </span>
                  <span className="text-slate-600 truncate text-[11px]">
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400 font-mono">
                <span>#{ev.sequence_no}</span>
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
