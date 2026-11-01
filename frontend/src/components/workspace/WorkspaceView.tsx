import React, { useState } from 'react';
import { FullProjectState, HumanIdentity, Proposal, PRD, ImplementationPlan } from '../../types';
import { LedgerFlowCanvas } from '../prototype/LedgerFlowCanvas';
import { ProposalCard } from '../proposals/ProposalCard';
import { ProductPromptModal } from './ProductPromptModal';
import { PRDReviewModal } from './PRDReviewModal';
import { RedirectModal } from '../proposals/RedirectModal';
import { ConflictCompareModal } from '../proposals/ConflictCompareModal';
import { ExecutionEnvironmentModal } from '../proposals/ExecutionEnvironmentModal';
import { useProposalCounts } from '../../hooks/useProposalCounts';
import { useToast } from '../common/Toast';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  confirmProposalRequirements,
  restartAgent,
  rebuildAgentContext,
} from '../../lib/api';
import {
  Brain,
  Code2,
  Clock,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

interface WorkspaceViewProps {
  state: FullProjectState;
  identity: HumanIdentity;
  onRefresh: () => void;
  onNavigateTab: (tab: any, param?: string) => void;
  previewProposalId?: string | null;
  onTogglePreviewProposal?: (proposalId: string) => void;
  onExitPreview?: () => void;
  onOpenChatDrawer?: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  state,
  identity,
  onRefresh,
  onNavigateTab,
  previewProposalId,
  onTogglePreviewProposal,
  onExitPreview,
  onOpenChatDrawer,
}) => {
  const { showToast } = useToast();
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showPRDModal, setShowPRDModal] = useState(false);
  const [activePRD, setActivePRD] = useState<PRD | null>(null);
  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [executingProposal, setExecutingProposal] = useState<Proposal | null>(null);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);

  const counts = useProposalCounts(state.proposals);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const humanName = identity === 'alex' ? 'Alex' : 'Maya';

  // Extract proposals requiring decision
  const isConflict = (p: Proposal) => p.status === 'conflict' || Boolean((p as any).is_conflicted);
  const isStale = (p: Proposal) => p.status === 'stale';
  const isPending = (p: Proposal) => p.status === 'pending_review';

  const needsDecisionProposals = state.proposals.filter(
    (p) => isPending(p) || isConflict(p) || isStale(p)
  );

  const novaRun = state.agent_runs.find((r) => r.agent_id === 'nova');
  const pixelRun = state.agent_runs.find((r) => r.agent_id === 'pixel');

  // Agent status helper
  const getAgentStatus = (run?: any) => {
    if (!run) return 'offline';
    const st = (run.status || '').toLowerCase();
    const lc = (run.lifecycle_state || '').toLowerCase();
    if (st === 'error' || st === 'failed' || lc === 'failed') return 'failed';
    if (st === 'running' || st === 'working' || lc === 'running') return 'working';
    if (st === 'waiting_review' || st === 'pending_review' || lc === 'waiting_for_review')
      return 'waiting for review';
    return 'idle';
  };

  const novaStatus = getAgentStatus(novaRun);
  const pixelStatus = getAgentStatus(pixelRun);

  // Proposal action handlers
  const handleApprove = async (proposalId: string) => {
    try {
      await approveProposal('demo-ledgerflow', proposalId, identity || 'alex');
      showToast('Proposal approved and applied to prototype!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve proposal', 'error');
    }
  };

  const handleReject = async (proposalId: string) => {
    try {
      await rejectProposal('demo-ledgerflow', proposalId, identity || 'alex', 'Rejected via Workspace UI');
      showToast('Proposal rejected.', 'info');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject proposal', 'error');
    }
  };

  const handleReconcile = async (proposalId: string) => {
    try {
      await reconcileProposal('demo-ledgerflow', proposalId, identity || 'maya');
      showToast('Proposal reconciled with active context.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to reconcile proposal', 'error');
    }
  };

  const handleConfirmRequirements = async (proposalId: string) => {
    try {
      await confirmProposalRequirements(
        'demo-ledgerflow',
        proposalId,
        identity || 'alex',
        `Confirmed by ${identity || 'alex'}. Handing off to PIXEL for implementation.`
      );
      showToast('Requirements confirmed! Handed off to PIXEL for autonomous implementation.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm requirements', 'error');
    }
  };

  const handleRestartAndRecover = async (agentId: string) => {
    setRestartingAgent(agentId);
    try {
      await restartAgent('demo-ledgerflow', agentId);
      await rebuildAgentContext('demo-ledgerflow', agentId);
      showToast(`${agentId.toUpperCase()} restarted and recovered!`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(`Failed to restart ${agentId}`, 'error');
    } finally {
      setRestartingAgent(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#172033] tracking-tight">
              {getGreeting()}, {humanName}
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              LedgerFlow
            </span>
          </div>
          <p className="text-xs text-[#657189] mt-0.5">
            Primary collaborative workspace · {counts.needsDecision} decision{counts.needsDecision !== 1 ? 's' : ''} currently pending review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenChatDrawer && (
            <button
              type="button"
              onClick={onOpenChatDrawer}
              className="px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 text-violet-600" />
              <span>Agent Chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-violet-200" />
            <span>Initiate Feature with NOVA</span>
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout: Left Live Prototype + Right Decision & Activity Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Live LedgerFlow Prototype (Always visible & interactive) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <LedgerFlowCanvas
            sections={state.sections}
            requirements={state.requirements}
            artifactVersion={state.project.artifact_version}
            identity={identity}
            onRefresh={onRefresh}
            previewProposalId={previewProposalId}
            onExitPreview={onExitPreview}
            proposals={state.proposals}
          />
        </div>

        {/* Right Rail: Needs your decision + Agent status + Recent activity */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Rail Section 1: Needs Your Decision */}
          <div className="bg-white border border-[#E7ECF2] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Needs Your Decision ({counts.needsDecision})
                </h2>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Live Review Rail
              </span>
            </div>

            {needsDecisionProposals.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-800">All caught up!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No proposals require decision. Initiate a feature prompt above.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {needsDecisionProposals.map((prop) => (
                  <ProposalCard
                    key={prop.proposal_id}
                    proposal={prop}
                    identity={identity}
                    sections={state.sections}
                    isPreviewing={previewProposalId === prop.proposal_id}
                    onTogglePreview={onTogglePreviewProposal}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onRedirect={(p) => setRedirectingProposal(p)}
                    onReconcile={handleReconcile}
                    onCompareConflict={(p) => setConflictedProposal(p)}
                    onConfirmRequirements={handleConfirmRequirements}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rail Section 2: Agent Status */}
          <div className="bg-white border border-[#E7ECF2] rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F3F7]">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  AI Collaborator Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('agents_context')}
                className="text-[11px] text-violet-700 hover:underline font-semibold cursor-pointer"
              >
                Inspect All
              </button>
            </div>

            <div className="space-y-2.5">
              {/* NOVA Mini Card */}
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">
                    N
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#172033]">NOVA</div>
                    <div className="text-[10px] text-slate-500 capitalize">{novaStatus}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestartAndRecover('nova')}
                  disabled={restartingAgent === 'nova'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition cursor-pointer"
                  title="Restart NOVA"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'nova' ? 'animate-spin text-violet-600' : ''}`} />
                </button>
              </div>

              {/* PIXEL Mini Card */}
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
                    P
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#172033]">PIXEL</div>
                    <div className="text-[10px] text-slate-500 capitalize">{pixelStatus}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestartAndRecover('pixel')}
                  disabled={restartingAgent === 'pixel'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition cursor-pointer"
                  title="Restart PIXEL"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restartingAgent === 'pixel' ? 'animate-spin text-teal-600' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Rail Section 3: Recent Activity */}
          <div className="bg-white border border-[#E7ECF2] rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F3F7]">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Recent Activity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer"
              >
                View History
              </button>
            </div>

            <div className="space-y-2">
              {(state.events || []).slice(0, 5).map((ev: any) => {
                const isProposal = (ev.event_type || '').toLowerCase().includes('proposal');
                const isReq = (ev.event_type || '').toLowerCase().includes('req');
                return (
                  <div
                    key={ev.id || ev.timestamp}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F0F3F7] text-xs text-[#172033]"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#657189] mb-1">
                      <span className="font-semibold uppercase tracking-wider text-slate-600">
                        {ev.actor_id?.toUpperCase() || 'SYSTEM'}
                      </span>
                      <span>{ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-snug font-medium line-clamp-2">
                      {ev.payload?.message || ev.payload?.summary || ev.event_type}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Product Prompt Modal */}
      {showPromptModal && (
        <ProductPromptModal
          isOpen={showPromptModal}
          identity={identity}
          onClose={() => setShowPromptModal(false)}
          onAnalysisComplete={(prd) => {
            setShowPromptModal(false);
            setActivePRD(prd);
            setShowPRDModal(true);
            onRefresh();
          }}
        />
      )}

      {/* PRD Review Modal */}
      {showPRDModal && activePRD && (
        <PRDReviewModal
          prd={activePRD}
          identity={identity}
          isOpen={showPRDModal}
          onClose={() => setShowPRDModal(false)}
          onConfirmSuccess={() => {
            setShowPRDModal(false);
            onRefresh();
          }}
          onRefresh={onRefresh}
        />
      )}

      {/* Redirect Modal */}
      {redirectingProposal && (
        <RedirectModal
          proposalId={redirectingProposal.proposal_id}
          agentId={redirectingProposal.agent_id || 'pixel'}
          summary={redirectingProposal.summary}
          decidedBy={identity || 'alex'}
          onClose={() => setRedirectingProposal(null)}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* Conflict Compare Side-by-Side Modal */}
      {conflictedProposal && (
        <ConflictCompareModal
          proposal={conflictedProposal}
          currentSection={state.sections[conflictedProposal.target_sections[0] || 'hero']}
          identity={identity}
          onClose={() => setConflictedProposal(null)}
          onKeepHuman={() => {
            onRefresh();
          }}
          onReconcilePixel={async () => {
            await handleReconcile(conflictedProposal.proposal_id);
            setConflictedProposal(null);
          }}
          onRedirectAgent={() => {
            const targetProp = conflictedProposal;
            setConflictedProposal(null);
            setRedirectingProposal(targetProp);
          }}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* Execution Environment Selection Modal */}
      {executingProposal && (
        <ExecutionEnvironmentModal
          proposal={executingProposal}
          isOpen={Boolean(executingProposal)}
          onClose={() => setExecutingProposal(null)}
          onExecutionCompleted={(_mode) => {
            setExecutingProposal(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
