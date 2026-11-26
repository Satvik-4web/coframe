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

const LIFECYCLE_STEPS = ['Idea', 'NOVA PRD', 'Human Confirm', 'PIXEL Plan', 'Execution', 'Final Review'];

const STEP_COLORS = [
  { active: '#818CF8', glow: 'rgba(129,140,248,0.4)' },
  { active: '#A78BFA', glow: 'rgba(167,139,250,0.4)' },
  { active: '#60A5FA', glow: 'rgba(96,165,250,0.4)' },
  { active: '#22D3EE', glow: 'rgba(34,211,238,0.4)' },
  { active: '#34D399', glow: 'rgba(52,211,153,0.4)' },
  { active: '#FBBF24', glow: 'rgba(251,191,36,0.4)' },
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
    badgeStyle: React.CSSProperties;
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
      badgeStyle: { background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)' },
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
      badgeStyle: { background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' },
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
      badgeStyle: { background: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.25)' },
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
      badgeStyle: { background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' },
      action: () => onNavigateTab('proposals', p.proposal_id),
    });
  });

  const activeStageIdx = Math.min(stageInfo?.active_index ?? 0, LIFECYCLE_STEPS.length - 1);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-1.5">
            <span>Workspace</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500 font-medium">LedgerFlow</span>
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-[-0.025em] leading-tight">
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
            className="h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.09)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Brief</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('preview')}
            className="h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
            style={{ background: 'rgba(34,211,238,0.10)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.22)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,211,238,0.18)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(34,211,238,0.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,211,238,0.10)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('chat')}
            className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
              color: '#fff',
              boxShadow: '0 0 20px rgba(129,140,248,0.4)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(129,140,248,0.6)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(129,140,248,0.4)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Chat</span>
          </button>
        </div>
      </div>

      {/* Lifecycle Pipeline Rail */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: STEP_COLORS[activeStageIdx]?.active ?? '#818CF8',
              boxShadow: `0 0 8px ${STEP_COLORS[activeStageIdx]?.glow ?? 'rgba(129,140,248,0.4)'}`,
            }}
          />
          <span className="text-xs font-semibold text-white">
            {stageInfo?.stage_label || 'Product Discovery'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {LIFECYCLE_STEPS.map((label, idx) => {
            const isDone = idx < activeStageIdx;
            const isCurrent = idx === activeStageIdx;
            const color = STEP_COLORS[idx];
            return (
              <React.Fragment key={label}>
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all"
                  style={
                    isCurrent
                      ? {
                          background: `${color.active}22`,
                          color: color.active,
                          border: `1px solid ${color.active}44`,
                          boxShadow: `0 0 10px ${color.glow}`,
                        }
                      : isDone
                      ? { background: 'rgba(52,211,153,0.10)', color: '#34D399', border: '1px solid rgba(52,211,153,0.20)' }
                      : { color: '#475569' }
                  }
                >
                  {idx + 1}. {label}
                </span>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <span className="text-slate-700 text-[10px]">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Quick Chat */}
      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          {
            label: 'Context version',
            value: `v${state.project.context_version}`,
            sub: 'Approved PRDs & rules',
            icon: Radio,
            color: '#818CF8',
            glow: 'rgba(129,140,248,0.3)',
            bg: 'rgba(129,140,248,0.08)',
            border: 'rgba(129,140,248,0.18)',
          },
          {
            label: 'Artifact version',
            value: `v${state.project.artifact_version}`,
            sub: 'Merged canvas build',
            icon: Layers,
            color: '#22D3EE',
            glow: 'rgba(34,211,238,0.3)',
            bg: 'rgba(34,211,238,0.08)',
            border: 'rgba(34,211,238,0.18)',
          },
          {
            label: 'Pending PRDs',
            value: pendingPRDs.length,
            sub: 'NOVA specifications',
            icon: FileText,
            color: '#A78BFA',
            glow: 'rgba(167,139,250,0.3)',
            bg: 'rgba(167,139,250,0.08)',
            border: 'rgba(167,139,250,0.18)',
          },
          {
            label: 'Team active',
            value: state.online_members.length > 0 ? state.online_members.length : 4,
            sub: 'Alex · Maya · NOVA · PIXEL',
            icon: Users,
            color: '#34D399',
            glow: 'rgba(52,211,153,0.3)',
            bg: 'rgba(52,211,153,0.08)',
            border: 'rgba(52,211,153,0.18)',
          },
        ].map(({ label, value, sub, icon: Icon, color, glow, bg, border }) => (
          <div
            key={label}
            className="rounded-xl p-4 transition-all"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18`, boxShadow: `0 0 10px ${glow}` }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color }} />
              </div>
            </div>
            <div
              className="mt-3 text-[28px] font-bold font-mono leading-none tracking-tight"
              style={{ color }}
            >
              {value}
            </div>
            <p className="text-[11px] text-slate-600 mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Attention Queue */}
          <div
            className="rounded-xl p-5 space-y-3.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" strokeWidth={1.75} style={{ color: '#FBBF24' }} />
                <h2 className="text-sm font-bold text-white">
                  Needs attention ({attentionItems.length})
                </h2>
              </div>
              {attentionItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('proposals')}
                  className="text-xs font-semibold flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: '#818CF8' }}
                >
                  <span>View all</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div
                className="text-center py-8 px-4 rounded-xl"
                style={{ background: 'rgba(52,211,153,0.04)', border: '1px dashed rgba(52,211,153,0.15)' }}
              >
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2" strokeWidth={1.75} style={{ color: '#34D399' }} />
                <p className="text-xs font-bold text-white">Everything is up to date</p>
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
                    className="p-3.5 rounded-xl cursor-pointer transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(129,140,248,0.06)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(129,140,248,0.20)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    }}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={item.badgeStyle}>
                          {item.badge}
                        </span>
                        <h4 className="font-semibold text-xs text-white truncate">{item.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0 text-xs font-semibold group-hover:translate-x-0.5 transition-transform"
                      style={{ color: '#818CF8' }}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Plan */}
          {activePlan && (
            <ImplementationPlanCard
              plan={activePlan}
              onViewProposal={(pid) => onNavigateTab('proposals', pid)}
            />
          )}

          {/* Recent Activity */}
          <div
            className="rounded-xl p-5 space-y-3.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                <h3 className="text-sm font-bold text-white">Recent activity</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('activity')}
                className="text-xs font-semibold flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
                style={{ color: '#818CF8' }}
              >
                <span>Audit log</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {state.events.slice(0, 5).map((ev, idx) => {
                const actorColor =
                  ev.actor_type === 'human' ? '#60A5FA'
                  : ev.actor_id === 'nova' ? '#A78BFA'
                  : '#22D3EE';
                return (
                  <div
                    key={ev.id || ev.event_id || ('ev_' + idx)}
                    className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: actorColor, boxShadow: `0 0 6px ${actorColor}99` }}
                      />
                      <div className="min-w-0 truncate">
                        <span className="font-bold mr-2" style={{ color: actorColor }}>
                          {ev.actor_id.toUpperCase()}
                        </span>
                        <span className="text-slate-500">
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-600 font-mono">
                      <span>#{ev.sequence_no}</span>
                      <span>·</span>
                      <span>
                        {new Date(
                          ev.created_at || (ev.timestamp ? ev.timestamp * 1000 : Date.now())
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: AI Agents */}
        <div className="lg:col-span-5 space-y-4">
          {/* NOVA Card */}
          <div
            onClick={() => onNavigateTab('agents')}
            className="rounded-xl p-5 cursor-pointer group transition-all"
            style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(167,139,250,0.10)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(167,139,250,0.28)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px rgba(167,139,250,0.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(167,139,250,0.06)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(167,139,250,0.15)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.30)', boxShadow: '0 0 16px rgba(167,139,250,0.3)' }}
                >
                  <Cpu className="w-4.5 h-4.5" strokeWidth={1.75} style={{ color: '#A78BFA' }} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">NOVA</h4>
                  <p className="text-xs" style={{ color: '#A78BFA' }}>Product Strategist</p>
                </div>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}
              >
                {stageInfo?.nova_status?.includes('Analyzing') ? 'Analyzing' : 'Ready'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              {novaRun?.task_description || 'Synthesizing product requirements, structured PRDs, and compliance checks.'}
            </p>

            <div className="mt-4 pt-3 flex items-center justify-between text-[11px] font-mono" style={{ borderTop: '1px solid rgba(167,139,250,0.10)' }}>
              <span className="text-slate-600">Gemini 2.5</span>
              <span style={{ color: '#A78BFA' }}>ctx v{novaRun?.base_context_version || 1}</span>
            </div>
          </div>

          {/* PIXEL Card */}
          <div
            onClick={() => onNavigateTab('agents')}
            className="rounded-xl p-5 cursor-pointer group transition-all"
            style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.14)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(34,211,238,0.09)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(34,211,238,0.26)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px rgba(34,211,238,0.10)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(34,211,238,0.05)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(34,211,238,0.14)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,211,238,0.14)', border: '1px solid rgba(34,211,238,0.28)', boxShadow: '0 0 16px rgba(34,211,238,0.25)' }}
                >
                  <Code2 className="w-4.5 h-4.5" strokeWidth={1.75} style={{ color: '#22D3EE' }} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">PIXEL</h4>
                  <p className="text-xs" style={{ color: '#22D3EE' }}>Software Engineer</p>
                </div>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,211,238,0.10)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.22)' }}
              >
                {stageInfo?.pixel_status?.includes('Waiting') ? 'Awaiting PRD' : 'Standby'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              {pixelRun?.task_description || 'Formulating implementation plans and building verified LedgerFlow UI updates.'}
            </p>

            <div className="mt-4 pt-3 flex items-center justify-between text-[11px] font-mono" style={{ borderTop: '1px solid rgba(34,211,238,0.08)' }}>
              <span className="text-slate-600">Gemini 2.5</span>
              <span style={{ color: '#22D3EE' }}>art v{pixelRun?.base_artifact_version || 1}</span>
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
