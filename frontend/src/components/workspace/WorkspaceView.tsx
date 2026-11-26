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
    ...pending.map((p) => ({
      id: p.proposal_id, label: 'Approval', title: p.summary,
      description: p.requires_decision ? 'This proposal needs a decision from Alex.' : 'Review this proposal and decide whether to apply it.', tone: 'blue',
      action: () => onNavigateTab('proposals', p.proposal_id),
    })),
  ];
  const displayStage = stageNames[stageInfo?.current_stage || ''] || stageInfo?.stage_label || 'In progress';
  const recentEvents = state.events.slice(0, 4);
  const humanName = identity === 'alex' ? 'Alex' : 'Maya';

  return (
    <div className="coframe-dashboard mx-auto max-w-[1400px] space-y-7 pb-12">
      <section className="workbench-intro">
        <div><p className="workbench-eyebrow">COFRAME / SHARED WORKSPACE</p><h1>What will we build today?</h1><p className="workbench-description">Welcome back, {humanName}. Turn a team discussion into a brief, review the changes, and move your product forward.</p></div>
        <span className="workbench-stage"><span />{displayStage}</span>
      </section>
      <section className="workbench-launch">
        <div className="workbench-launch-copy"><Sparkles size={28} /><h2>Great work starts with<br />a shared direction.</h2><p>Bring your idea. Give your team and agents the context to move it forward.</p><button onClick={() => setShowPromptModal(true)} disabled={identity !== 'alex'} title={identity !== 'alex' ? 'Switch to Alex to create a product brief' : 'Create product brief'}><Plus size={18} />Create a product brief<ArrowUpRight size={18} /></button></div>
        <div className="workbench-actions">{[
          {title:'Talk with your team',detail:'Discuss ideas and ask your agents for help.',icon:Users,tab:'chat'},
          {title:'Add project knowledge',detail:'Keep shared files and references together.',icon:FileText,tab:'resources'},
          {title:'Review proposed changes',detail:`${pending.length} proposals ready for your review.`,icon:GitPullRequest,tab:'proposals'},
          {title:'Open your repository',detail:'Manage branches, contributions and pull requests.',icon:Code2,tab:'github'},
        ].map(action => <button key={action.tab} onClick={() => onNavigateTab(action.tab)}><span className="workbench-action-icon"><action.icon size={20} /></span><span><strong>{action.title}</strong><small>{action.detail}</small></span><ArrowUpRight size={17} /></button>)}</div>
      </section>
      <section aria-label="Project snapshot" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Context version', value: `v${state.project.context_version}`, sub: 'Shared requirements', icon: Radio, color: 'text-blue-300', wash: 'bg-blue-500/10' },
          { label: 'Artifact version', value: `v${state.project.artifact_version}`, sub: 'Product canvas', icon: Layers3, color: 'text-sky-300', wash: 'bg-sky-500/10' },
          { label: 'In review', value: String(pending.length), sub: 'Open proposals', icon: GitPullRequest, color: 'text-[#C6D2E4]', wash: 'bg-[#1D2633]' },
          { label: 'Needs attention', value: String(attention.length), sub: 'Decisions & conflicts', icon: CircleAlert, color: 'text-amber-300', wash: 'bg-amber-500/10' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <div key={metric.label} className="dashboard-card flex min-h-[132px] flex-col justify-between rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-[#96A6BE] sm:text-sm">{metric.label}</span><span className={`rounded-xl p-2 ${metric.wash}`}><Icon className={`h-4 w-4 ${metric.color}`} /></span></div>
            <div><p className="text-[30px] font-semibold leading-none tracking-[-.04em] text-[#EDF2FA]">{metric.value}</p><p className="mt-1.5 text-xs text-[#8495AD]">{metric.sub}</p></div>
          </div>;
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <section className="dashboard-card overflow-hidden rounded-[22px]">
          <div className="flex items-center justify-between border-b border-[#303A4B] px-5 py-5 sm:px-7">
            <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-indigo-400">Your queue</p><h2 className="text-xl font-semibold tracking-tight text-[#EDF2FA]">What needs a decision</h2></div>
            <button type="button" onClick={() => onNavigateTab('proposals')} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300">All proposals <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            {attention.length ? attention.slice(0, 4).map((item) => (
              <button key={item.id} type="button" onClick={item.action} className="group flex w-full items-center gap-4 rounded-2xl border border-[#303A4B] bg-[#171E29] p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:shadow-md">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.tone === 'rose' ? 'bg-rose-500/10 text-rose-300' : item.tone === 'amber' ? 'bg-amber-500/10 text-amber-300' : item.tone === 'blue' ? 'bg-blue-500/10 text-blue-300' : 'bg-violet-500/10 text-violet-300'}`}><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-indigo-400">{item.label}</span><span className="mt-0.5 block truncate text-sm font-semibold text-[#EDF2FA]">{item.title}</span><span className="mt-0.5 block truncate text-xs text-[#96A6BE]">{item.description}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#8495AD] transition group-hover:translate-x-1 group-hover:text-indigo-400" />
              </button>
            )) : <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#303A4B] bg-[#171E29] px-6 text-center"><span className="mb-3 rounded-2xl bg-emerald-500/10 p-3 text-emerald-400"><Check className="h-6 w-6" /></span><p className="font-semibold text-[#EDF2FA]">You’re all caught up</p><p className="mt-1 max-w-xs text-sm text-[#96A6BE]">New proposals and decisions will show up here.</p></div>}
          </div>
        </section>

        <section className="dashboard-card flex flex-col rounded-[22px] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300">Team at work</p><h2 className="text-xl font-semibold tracking-tight text-[#EDF2FA]">Your AI partners</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D2633] text-[#96A6BE]"><Users className="h-4 w-4" /></span></div>
          <div className="space-y-3">
            {[
              { name: 'NOVA', role: 'Product strategy', icon: Bot, tone: 'bg-blue-500/10 text-blue-300', description: 'Turns direction into a reviewable product brief.' },
              { name: 'PIXEL', role: 'Prototype engineering', icon: Code2, tone: 'bg-sky-500/10 text-sky-300', description: 'Suggests changes to the product artifact.' },
            ].map((agent) => {
              const Icon = agent.icon;
              return <button type="button" key={agent.name} onClick={() => onNavigateTab('agents')} className="group flex w-full items-start gap-3 rounded-2xl border border-[#303A4B] bg-[#171E29] p-4 text-left transition hover:border-[#303A4B] hover:bg-[#1A202C] hover:shadow-sm"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${agent.tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between"><strong className="text-sm text-[#EDF2FA]">{agent.name}</strong><ArrowUpRight className="h-4 w-4 text-[#8495AD] transition group-hover:text-indigo-400" /></span><span className="text-[11px] font-medium text-[#96A6BE]">{agent.role}</span><span className="mt-2 block text-xs leading-5 text-[#96A6BE]">{agent.description}</span></span></button>;
            })}
          </div>
          <button type="button" onClick={() => onNavigateTab('preview')} className="mt-auto flex items-center justify-between border-t border-[#303A4B] pt-5 text-sm font-semibold text-[#EDF2FA] hover:text-indigo-400"><span>Explore the product canvas</span><ArrowUpRight className="h-4 w-4" /></button>
        </section>
      </div>

      <OverviewQuickChat identity={identity} onNavigateTab={onNavigateTab} />

      {activePlan && <ImplementationPlanCard plan={activePlan} onViewProposal={(id) => onNavigateTab('proposals', id)} />}

      <section className="dashboard-card overflow-hidden rounded-[22px]">
        <div className="flex items-center justify-between border-b border-[#303A4B] px-5 py-5 sm:px-7"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-[#96A6BE]">The record</p><h2 className="text-xl font-semibold tracking-tight text-[#EDF2FA]">Recent activity</h2></div><button type="button" onClick={() => onNavigateTab('activity')} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300">Full history <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
        <div className="divide-y divide-slate-100 px-5 sm:px-7">
          {recentEvents.length ? recentEvents.map((event) => <div key={event.id} className="flex items-center gap-4 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1D2633] text-[#96A6BE]"><Activity className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#EDF2FA]">{event.event_type.replace(/[._]/g, ' ')}</p><p className="text-xs text-[#96A6BE]">{event.actor_id} · event #{event.sequence_no}</p></div><time className="hidden text-xs text-[#8495AD] sm:block">{new Date(event.created_at).toLocaleDateString()}</time></div>) : <div className="py-10 text-center text-sm text-[#96A6BE]"><Clock3 className="mx-auto mb-2 h-5 w-5" />Activity will appear here once the team starts working.</div>}
        </div>
      </section>

      {showPromptModal && <ProductPromptModal isOpen={showPromptModal} identity={identity} onClose={() => setShowPromptModal(false)} onAnalysisComplete={(prd: PRD) => { setActivePRD(prd); setShowPRDModal(true); loadWorkflowData(); onRefresh(); }} />}
      {showPRDModal && activePRD && <PRDReviewModal isOpen={showPRDModal} prd={activePRD} identity={identity} onClose={() => setShowPRDModal(false)} onConfirmSuccess={() => { setShowPRDModal(false); loadWorkflowData(); onRefresh(); }} onRefresh={() => { loadWorkflowData(); onRefresh(); }} />}
    </div>
  );
};
