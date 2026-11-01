import React, { useState } from 'react';
import { Proposal, HumanIdentity, ArtifactSection } from '../../types';
import { ProposalCard } from './ProposalCard';
import { NovaPrdDocumentModal } from './NovaPrdDocumentModal';
import { PixelImplementationModal } from './PixelImplementationModal';
import { RedirectModal } from './RedirectModal';
import { ConflictCompareModal } from './ConflictCompareModal';
import { CreateHumanProposalModal } from './CreateHumanProposalModal';
import { ExecutionEnvironmentModal } from './ExecutionEnvironmentModal';
import { computeProposalCounts } from '../../hooks/useProposalCounts';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  publishApprovedProposal,
  confirmProposalRequirements,
} from '../../lib/api';
import {
  GitPullRequest,
  PlusCircle,
  Brain,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  History,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '../common/Toast';

interface ProposalListProps {
  proposals: Proposal[];
  sections: Record<string, ArtifactSection>;
  identity: HumanIdentity;
  onRefresh: () => void;
  previewProposalId?: string | null;
  onTogglePreviewProposal?: (proposalId: string) => void;
}

export type MainProposalTab = 'needs_decision' | 'applied' | 'history';
export type HistorySubFilter = 'all' | 'rejected' | 'redirected' | 'superseded';

export const ProposalList: React.FC<ProposalListProps> = ({
  proposals,
  sections,
  identity,
  onRefresh,
  previewProposalId,
  onTogglePreviewProposal,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<MainProposalTab>('needs_decision');
  const [historySubFilter, setHistorySubFilter] = useState<HistorySubFilter>('all');
  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [showCreateHumanModal, setShowCreateHumanModal] = useState(false);
  const [selectedNovaProposal, setSelectedNovaProposal] = useState<Proposal | null>(null);
  const [selectedPixelProposal, setSelectedPixelProposal] = useState<Proposal | null>(null);
  const [executingProposal, setExecutingProposal] = useState<Proposal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Single authoritative source of proposal counts across entire workspace
  const counts = computeProposalCounts(proposals);

  // Categorize proposals
  const isConflict = (p: Proposal) =>
    p.status === 'conflict' || Boolean((p as any).is_conflicted);
  const isStale = (p: Proposal) => p.status === 'stale';
  const isPending = (p: Proposal) => p.status === 'pending_review';
  const isApplied = (p: Proposal) => p.status === 'approved';
  const isRedirected = (p: Proposal) =>
    (p.status as string) === 'redirected' ||
    (p.status === 'rejected' && Boolean((p as any).superseded_by)) ||
    Boolean((p as any).is_redirected);
  const isRejected = (p: Proposal) =>
    p.status === 'rejected' && !(p as any).superseded_by && !(p as any).is_redirected;
  const isSuperseded = (p: Proposal) => p.status === 'superseded';

  // Three primary queues
  const needsDecisionProposals = proposals.filter(
    (p) => isPending(p) || isConflict(p) || isStale(p)
  );

  const appliedProposals = proposals.filter(isApplied);

  const historyProposals = proposals.filter(
    (p) => isRejected(p) || isRedirected(p) || isSuperseded(p)
  );

  const filteredHistoryProposals = historyProposals.filter((p) => {
    if (historySubFilter === 'rejected') return isRejected(p);
    if (historySubFilter === 'redirected') return isRedirected(p);
    if (historySubFilter === 'superseded') return isSuperseded(p);
    return true;
  });

  const displayedProposals =
    activeTab === 'needs_decision'
      ? needsDecisionProposals
      : activeTab === 'applied'
      ? appliedProposals
      : filteredHistoryProposals;

  // Action handlers
  const handleApprove = async (proposalId: string) => {
    setActionError(null);
    try {
      await approveProposal('demo-ledgerflow', proposalId, identity || 'alex');
      showToast('Proposal approved and applied to prototype!', 'success');
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to approve proposal';
      setActionError(msg);
      showToast(msg, 'error');
    }
  };

  const handleReject = async (proposalId: string) => {
    setActionError(null);
    try {
      await rejectProposal('demo-ledgerflow', proposalId, identity || 'alex', 'Rejected via review UI');
      showToast('Proposal rejected.', 'info');
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to reject proposal';
      setActionError(msg);
      showToast(msg, 'error');
    }
  };

  const handleReconcile = async (proposalId: string) => {
    setActionError(null);
    try {
      await reconcileProposal('demo-ledgerflow', proposalId, identity || 'maya');
      showToast('Proposal reconciled with active context.', 'success');
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to reconcile proposal';
      setActionError(msg);
      showToast(msg, 'error');
    }
  };

  const handleConfirmRequirements = async (proposalId: string) => {
    setActionError(null);
    try {
      await confirmProposalRequirements(
        'demo-ledgerflow',
        proposalId,
        identity || 'alex',
        `Confirmed by ${identity || 'alex'}. Handing off to PIXEL for autonomous implementation.`
      );
      showToast('Requirements confirmed! Handed off to PIXEL for autonomous implementation.', 'success');
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to confirm requirements';
      setActionError(msg);
      showToast(msg, 'error');
    }
  };

  const handlePublishToGitHub = async (proposalId: string) => {
    setActionError(null);
    try {
      await publishApprovedProposal(proposalId, identity || 'alex');
      showToast('Proposal published to GitHub.', 'success');
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to publish to GitHub';
      setActionError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Unified Selector Stats Cards */}
      <div className="space-y-4">
        {/* Main Title & Action Bar */}
        <div className="bg-white border border-[#E7ECF2] p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shadow-md">
              <GitPullRequest className="w-6 h-6 text-teal-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#172033] tracking-tight">
                  Proposals & Decisions
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#172033] border border-[#E7ECF2]">
                  {counts.total} Total
                </span>
              </div>
              <p className="text-xs text-[#657189] mt-0.5">
                Transparent multi-agent product development workflow linking strategy, code, and decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateHumanModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>Add Human Contribution</span>
            </button>
          </div>
        </div>

        {/* 5 Authoritative Selector Summary Tiles (Derived strictly from useProposalCounts) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Tile 1: Needs Decision */}
          <div
            onClick={() => setActiveTab('needs_decision')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              activeTab === 'needs_decision'
                ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-200 shadow-xs'
                : 'bg-white border-[#E7ECF2] hover:border-blue-200 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                Needs Decision
              </span>
              <Clock className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-900">{counts.needsDecision}</span>
              <span className="text-[10px] text-[#657189] font-medium">Pending Review</span>
            </div>
          </div>

          {/* Tile 2: Fresh Pending */}
          <div
            onClick={() => setActiveTab('needs_decision')}
            className="p-4 rounded-2xl border bg-white border-[#E7ECF2] hover:border-teal-200 hover:shadow-2xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-teal-700 tracking-wider">
                Fresh Pending
              </span>
              <Brain className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-teal-900">{counts.pending}</span>
              <span className="text-[10px] text-[#657189] font-medium">Ready for Review</span>
            </div>
          </div>

          {/* Tile 3: Conflicts */}
          <div
            onClick={() => setActiveTab('needs_decision')}
            className="p-4 rounded-2xl border bg-white border-[#E7ECF2] hover:border-rose-200 hover:shadow-2xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">
                Conflicts
              </span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-700">{counts.conflict}</span>
              <span className="text-[10px] text-rose-600 font-medium">Needs Reconcile</span>
            </div>
          </div>

          {/* Tile 4: Stale Proposals */}
          <div
            onClick={() => setActiveTab('needs_decision')}
            className="p-4 rounded-2xl border bg-white border-[#E7ECF2] hover:border-amber-200 hover:shadow-2xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                Stale
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-700">{counts.stale}</span>
              <span className="text-[10px] text-amber-600 font-medium">Superseded</span>
            </div>
          </div>

          {/* Tile 5: Applied to Prototype */}
          <div
            onClick={() => setActiveTab('applied')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              activeTab === 'applied'
                ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-200 shadow-xs'
                : 'bg-white border-[#E7ECF2] hover:border-emerald-200 hover:shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                Applied
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">{counts.applied}</span>
              <span className="text-[10px] text-emerald-600 font-medium">In LedgerFlow</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simplified Three-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFBFD] border border-[#E7ECF2] p-1.5 rounded-2xl">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {/* Tab 1: Needs Decision */}
          <button
            onClick={() => setActiveTab('needs_decision')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'needs_decision'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Needs decision ({counts.needsDecision})</span>
          </button>

          {/* Tab 2: Applied */}
          <button
            onClick={() => setActiveTab('applied')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'applied'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Applied ({counts.applied})</span>
          </button>

          {/* Tab 3: History */}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({counts.rejected + counts.redirected})</span>
          </button>
        </div>

        {/* Sub-filter for History tab */}
        {activeTab === 'history' && (
          <div className="flex items-center space-x-1 px-2">
            <span className="text-2xs font-semibold text-[#657189] mr-1 uppercase">Filter:</span>
            {(['all', 'rejected', 'redirected'] as HistorySubFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setHistorySubFilter(filter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer capitalize ${
                  historySubFilter === filter
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-600 hover:text-red-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Proposals Display via Unified ProposalCard */}
      {displayedProposals.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E7ECF2] rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <GitPullRequest className="w-10 h-10 text-[#657189] mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-bold text-[#172033]">
            {activeTab === 'needs_decision'
              ? 'No proposals need decision'
              : activeTab === 'applied'
              ? 'No applied proposals yet'
              : 'No proposals in history'}
          </h3>
          <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
            {activeTab === 'needs_decision'
              ? 'All caught up! Start a new feature or request in Workspace Chat.'
              : 'Proposals will appear here once approved or archived.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedProposals.map((prop) => (
            <ProposalCard
              key={prop.proposal_id}
              proposal={prop}
              identity={identity}
              sections={sections}
              isPreviewing={previewProposalId === prop.proposal_id}
              onTogglePreview={onTogglePreviewProposal}
              onApprove={handleApprove}
              onReject={handleReject}
              onRedirect={(p) => setRedirectingProposal(p)}
              onReconcile={handleReconcile}
              onCompareConflict={(p) => setConflictedProposal(p)}
              onConfirmRequirements={handleConfirmRequirements}
              onOpenPrd={(p) => setSelectedNovaProposal(p)}
              onPublishToGitHub={handlePublishToGitHub}
            />
          ))}
        </div>
      )}

      {/* Completed Contributions Table for Applied Tab */}
      {activeTab === 'applied' && appliedProposals.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                Completed Contributions Audit Log
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {appliedProposals.length} Applied
              </span>
            </div>
            <span className="text-[11px] text-[#657189]">
              Cryptographically traceable decision and deployment audit log
            </span>
          </div>

          <div className="bg-white border border-[#E7ECF2] rounded-3xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAFBFD] border-b border-[#E7ECF2] text-[10px] font-bold uppercase tracking-wider text-[#657189]">
                <tr>
                  <th className="py-3 px-4">Contribution</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4">Approver</th>
                  <th className="py-3 px-4">Target Section</th>
                  <th className="py-3 px-4">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F3F7]">
                {appliedProposals.map((prop) => {
                  const author = prop.author || prop.created_by || 'PIXEL';
                  const reviewer = prop.reviewed_by || 'NOVA';
                  const approver = prop.assigned_decider_id || 'Alex';
                  const targetSec = (prop.target_sections || ['hero'])[0];
                  const dateStr = prop.updated_at
                    ? new Date(prop.updated_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recently';

                  return (
                    <tr key={prop.proposal_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-semibold text-[#172033]">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            #{prop.proposal_id.slice(-6)}
                          </span>
                          <span className="max-w-xs truncate">{prop.summary}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {author}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Brain className="w-3 h-3 text-violet-500" />
                          {reviewer}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {approver.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-teal-700">
                        {targetSec} (v{prop.base_artifact_version + 1})
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
          currentSection={sections[conflictedProposal.target_sections[0] || 'hero']}
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

      {/* Create Human Proposal Modal */}
      {showCreateHumanModal && (
        <CreateHumanProposalModal
          identity={identity}
          onClose={() => setShowCreateHumanModal(false)}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* NOVA PRD Document Reader Modal */}
      {selectedNovaProposal && (
        <NovaPrdDocumentModal
          proposal={selectedNovaProposal}
          identity={identity}
          isOpen={true}
          onClose={() => setSelectedNovaProposal(null)}
          onConfirmRequirements={(id) => {
            handleConfirmRequirements(id);
            setSelectedNovaProposal(null);
          }}
        />
      )}

      {/* PIXEL Implementation Engineering Modal */}
      {selectedPixelProposal && (
        <PixelImplementationModal
          proposal={selectedPixelProposal}
          identity={identity}
          isOpen={true}
          onClose={() => setSelectedPixelProposal(null)}
          onChooseExecutionEnvironment={(p) => setExecutingProposal(p)}
          onApprove={(id) => {
            handleApprove(id);
            setSelectedPixelProposal(null);
          }}
          onReject={(id) => {
            handleReject(id);
            setSelectedPixelProposal(null);
          }}
          onRedirect={(p) => {
            setSelectedPixelProposal(null);
            setRedirectingProposal(p);
          }}
          onCompareConflict={(p) => {
            setSelectedPixelProposal(null);
            setConflictedProposal(p);
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
