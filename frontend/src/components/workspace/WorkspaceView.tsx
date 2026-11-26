import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Bot, Check, ChevronRight, CircleAlert,
  Clock3, Code2, FileText, GitPullRequest, Layers3, Plus, Radio, ShieldCheck,
  Sparkles, Users, WandSparkles,
} from 'lucide-react';
import { FullProjectState, HumanIdentity, ImplementationPlan, PRD, WorkflowStageInfo } from '../../types';
import { fetchLatestPRD, fetchLatestPlan, fetchWorkflowStage } from '../../lib/api';
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

const stageNames: Record<string, string> = {
  discovery: 'Discovery', requirements_review: 'Requirements review',
  implementation_planning: 'Implementation planning', prototype_development: 'Prototype development',
  agent_review: 'Agent review', human_approval: 'Human approval', completed: 'Completed',
};

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ state, identity, onRefresh, onNavigateTab }) => {
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showPRDModal, setShowPRDModal] = useState(false);
  const [activePRD, setActivePRD] = useState<PRD | null>(null);
  const [activePlan, setActivePlan] = useState<ImplementationPlan | null>(null);
  const [stageInfo, setStageInfo] = useState<WorkflowStageInfo | undefined>();
  const workflowRequestId = useRef(0);

  const loadWorkflowData = async () => {
    const requestId = ++workflowRequestId.current;
    const [prdRes, planRes, stageRes] = await Promise.all([
      fetchLatestPRD('demo-ledgerflow').catch(() => ({ prd: null })),
      fetchLatestPlan('demo-ledgerflow').catch(() => ({ plan: null })),
      fetchWorkflowStage('demo-ledgerflow').catch(() => ({ stage: null })),
    ]);
    if (requestId !== workflowRequestId.current) return;
    setActivePRD(prdRes.prd ?? null);
    setActivePlan(planRes.plan ?? null);
    setStageInfo(stageRes.stage ?? undefined);
  };

  useEffect(() => {
    loadWorkflowData();
    return () => { workflowRequestId.current += 1; };
  }, [state.project.context_version, state.project.artifact_version, state.proposals.length, state.events.length]);

  const pending = state.proposals.filter((p) => p.status === 'pending_review');
  const conflicts = state.proposals.filter((p) => p.status === 'conflict');
  const stale = state.proposals.filter((p) => p.status === 'stale');
  const attention = [
    ...(activePRD?.status === 'awaiting_confirmation' ? [{
      id: activePRD.id, label: 'Decision needed', title: activePRD.title,
      description: `Product brief v${activePRD.version} is ready for review.`,
      tone: 'violet', action: () => setShowPRDModal(true),
    }] : []),
    ...conflicts.map((p) => ({ id: p.proposal_id, label: 'Conflict', title: p.summary,
      description: p.conflict_reason || 'A section changed since this proposal was written.',
      tone: 'rose', action: () => onNavigateTab('proposals', p.proposal_id) })),
    ...stale.map((p) => ({ id: p.proposal_id, label: 'Needs refresh', title: p.summary,
      description: p.stale_reason || 'The requirements behind this proposal have changed.',
      tone: 'amber', action: () => onNavigateTab('proposals', p.proposal_id) })),
    ...pending.filter((p) => p.requires_decision).map((p) => ({
      id: p.proposal_id, label: 'Approval', title: p.summary,
      description: 'This proposal needs a decision from Alex.', tone: 'blue',
      action: () => onNavigateTab('proposals', p.proposal_id),
    })),
  ];
  const displayStage = stageNames[stageInfo?.current_stage || ''] || stageInfo?.stage_label || 'In progress';
  const recentEvents = state.events.slice(0, 4);
  const humanName = identity === 'alex' ? 'Alex' : 'Maya';

  return (
    <div className="coframe-dashboard mx-auto max-w-[1400px] space-y-7 pb-12">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-[28px] px-6 py-8 text-white shadow-[0_24px_60px_-32px_rgba(12,17,40,.75)] sm:px-9 sm:py-10 xl:px-12">
        <div className="dashboard-hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-16 -top-36 h-96 w-96 rounded-full bg-blue-400/15 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-52 right-1/4 h-80 w-80 rounded-full bg-sky-400/10 blur-[80px]" />
        <div className="relative grid gap-9 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold tracking-[.13em] text-slate-200 uppercase backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_#7DD3FC]" />
              LedgerFlow workspace <span className="text-white/30">/</span> {displayStage}
            </div>
            <p className="mb-2 text-sm font-medium text-slate-300">Welcome back, {humanName}</p>
            <h1 className="max-w-[650px] text-[clamp(2.2rem,4.2vw,4rem)] font-semibold leading-[1.08] tracking-[-.05em]">
              Make progress.<br /><span className="text-[#93C5FD]">Keep the context.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Ideas, agent work, and human decisions in one place. Pick up where the team left off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => setShowPromptModal(true)} disabled={identity !== 'alex'}
                title={identity !== 'alex' ? 'Alex starts product briefs in this demo' : 'Create a product brief'}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_26px_-10px_#3B82F6] transition hover:-translate-y-0.5 hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" /> New product brief
              </button>
              <button type="button" onClick={() => onNavigateTab('chat')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
                Open team chat <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="relative rounded-[22px] border border-white/15 bg-white/[.075] p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.18em] text-slate-300">
                <span>Collaboration flow</span><Sparkles className="h-4 w-4 text-sky-300" />
              </div>
              {[
                { n: '01', name: 'A clear idea', detail: 'Human direction', icon: WandSparkles, color: 'text-sky-300' },
                { n: '02', name: 'NOVA shapes it', detail: 'Requirements & context', icon: Bot, color: 'text-blue-300' },
                { n: '03', name: 'PIXEL proposes', detail: 'Reviewable artifact change', icon: Code2, color: 'text-slate-200' },
              ].map((step, index) => {
                const Icon = step.icon;
                return <div key={step.n} className={`flex items-center gap-3 rounded-xl p-3 ${index === 1 ? 'border border-white/10 bg-white/10' : ''}`}>
                  <span className="text-[11px] font-mono text-white/40">{step.n}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Icon className={`h-4 w-4 ${step.color}`} /></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{step.name}</p><p className="text-[11px] text-slate-300">{step.detail}</p></div>
                  {index < 2 && <ChevronRight className="h-4 w-4 text-white/30" />}
                </div>;
              })}
              <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-300">
                <ShieldCheck className="h-4 w-4 text-sky-300" /> Human review before changes apply
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Project snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Context version', value: `v${state.project.context_version}`, sub: 'Shared requirements', icon: Radio, color: 'text-blue-700', wash: 'bg-blue-50' },
          { label: 'Artifact version', value: `v${state.project.artifact_version}`, sub: 'Product canvas', icon: Layers3, color: 'text-sky-700', wash: 'bg-sky-50' },
          { label: 'In review', value: String(pending.length), sub: 'Open proposals', icon: GitPullRequest, color: 'text-slate-700', wash: 'bg-slate-100' },
          { label: 'Needs attention', value: String(attention.length), sub: 'Decisions & conflicts', icon: CircleAlert, color: 'text-amber-700', wash: 'bg-amber-50' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <div key={metric.label} className="dashboard-card flex min-h-[132px] flex-col justify-between rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-slate-500 sm:text-sm">{metric.label}</span><span className={`rounded-xl p-2 ${metric.wash}`}><Icon className={`h-4 w-4 ${metric.color}`} /></span></div>
            <div><p className="text-[30px] font-semibold leading-none tracking-[-.04em] text-[#14213A]">{metric.value}</p><p className="mt-1.5 text-xs text-slate-400">{metric.sub}</p></div>
          </div>;
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <section className="dashboard-card overflow-hidden rounded-[22px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
            <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-600">Your queue</p><h2 className="text-xl font-semibold tracking-tight text-[#14213A]">What needs a decision</h2></div>
            <button type="button" onClick={() => onNavigateTab('proposals')} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">All proposals <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            {attention.length ? attention.slice(0, 4).map((item) => (
              <button key={item.id} type="button" onClick={item.action} className="group flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-[#F8F9FC] p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-md">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.tone === 'rose' ? 'bg-rose-100 text-rose-700' : item.tone === 'amber' ? 'bg-amber-100 text-amber-700' : item.tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-indigo-600">{item.label}</span><span className="mt-0.5 block truncate text-sm font-semibold text-[#14213A]">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
              </button>
            )) : <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F9FAFC] px-6 text-center"><span className="mb-3 rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Check className="h-6 w-6" /></span><p className="font-semibold text-[#14213A]">You’re all caught up</p><p className="mt-1 max-w-xs text-sm text-slate-500">New proposals and decisions will show up here.</p></div>}
          </div>
        </section>

        <section className="dashboard-card flex flex-col rounded-[22px] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-sky-700">Team at work</p><h2 className="text-xl font-semibold tracking-tight text-[#14213A]">Your AI partners</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Users className="h-4 w-4" /></span></div>
          <div className="space-y-3">
            {[
              { name: 'NOVA', role: 'Product strategy', icon: Bot, tone: 'bg-blue-100 text-blue-700', description: 'Turns direction into a reviewable product brief.' },
              { name: 'PIXEL', role: 'Prototype engineering', icon: Code2, tone: 'bg-sky-100 text-sky-700', description: 'Suggests changes to the product artifact.' },
            ].map((agent) => {
              const Icon = agent.icon;
              return <button type="button" key={agent.name} onClick={() => onNavigateTab('agents')} className="group flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-[#F9FAFC] p-4 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${agent.tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between"><strong className="text-sm text-[#14213A]">{agent.name}</strong><ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-600" /></span><span className="text-[11px] font-medium text-slate-500">{agent.role}</span><span className="mt-2 block text-xs leading-5 text-slate-500">{agent.description}</span></span></button>;
            })}
          </div>
          <button type="button" onClick={() => onNavigateTab('preview')} className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5 text-sm font-semibold text-[#14213A] hover:text-indigo-600"><span>Explore the product canvas</span><ArrowUpRight className="h-4 w-4" /></button>
        </section>
      </div>

      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {activePlan && <ImplementationPlanCard plan={activePlan} onViewProposal={(id) => onNavigateTab('proposals', id)} />}

      <section className="dashboard-card overflow-hidden rounded-[22px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">The record</p><h2 className="text-xl font-semibold tracking-tight text-[#14213A]">Recent activity</h2></div><button type="button" onClick={() => onNavigateTab('activity')} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">Full history <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
        <div className="divide-y divide-slate-100 px-5 sm:px-7">
          {recentEvents.length ? recentEvents.map((event) => <div key={event.id} className="flex items-center gap-4 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Activity className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#14213A]">{event.event_type.replace(/[._]/g, ' ')}</p><p className="text-xs text-slate-500">{event.actor_id} · event #{event.sequence_no}</p></div><time className="hidden text-xs text-slate-400 sm:block">{new Date(event.created_at).toLocaleDateString()}</time></div>) : <div className="py-10 text-center text-sm text-slate-500"><Clock3 className="mx-auto mb-2 h-5 w-5" />Activity will appear here once the team starts working.</div>}
        </div>
      </section>

      {showPromptModal && <ProductPromptModal isOpen={showPromptModal} identity={identity} onClose={() => setShowPromptModal(false)} onAnalysisComplete={(prd: PRD) => { setActivePRD(prd); setShowPRDModal(true); loadWorkflowData(); onRefresh(); }} />}
      {showPRDModal && activePRD && <PRDReviewModal isOpen={showPRDModal} prd={activePRD} identity={identity} onClose={() => setShowPRDModal(false)} onConfirmSuccess={() => { setShowPRDModal(false); loadWorkflowData(); onRefresh(); }} onRefresh={() => { loadWorkflowData(); onRefresh(); }} />}
    </div>
  );
};
