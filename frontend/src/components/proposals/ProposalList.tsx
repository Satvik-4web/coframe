import React, { useState } from 'react';
import { Proposal, HumanIdentity, ArtifactSection } from '../../types';
import { ProposalCard } from './ProposalCard';
import { RedirectModal } from './RedirectModal';
import { ConflictCompareModal } from './ConflictCompareModal';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  publishApprovedProposal,
} from '../../lib/api';
import { GitPullRequest, Filter, Sparkles, AlertCircle } from 'lucide-react';

interface ProposalListProps {
  proposals: Proposal[];
  sections: Record<string, ArtifactSection>;
  identity: HumanIdentity;
  onRefresh: () => void;
}

export const ProposalList: React.FC<ProposalListProps> = ({
  proposals,
  sections,
  identity,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'attention' | 'approved'>('all');
  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredProposals = proposals.filter((p) => {
    if (filter === 'pending') return p.status === 'pending_review';
    if (filter === 'attention') return p.status === 'stale' || p.status === 'conflict';
    if (filter === 'approved') return p.status === 'approved';
    return true;
  });

  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const attentionCount = proposals.filter((p) => p.status === 'stale' || p.status === 'conflict').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;

  const handleApprove = async (proposalId: string) => {
    setActionError(null);
    try {
      await approveProposal('demo-ledgerflow', proposalId, identity || 'alex');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve proposal');
    }
  };

  const handleReject = async (proposalId: string) => {
    setActionError(null);
    try {
      await rejectProposal('demo-ledgerflow', proposalId, identity || 'alex', 'Rejected via review UI');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject proposal');
    }
  };

  const handleReconcile = async (proposalId: string) => {
    setActionError(null);
    try {
      await reconcileProposal('demo-ledgerflow', proposalId, identity || 'maya');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reconcile proposal');
    }
  };

  const handleKeepHumanVersion = async (proposal: Proposal) => {
    await handleReject(proposal.proposal_id);
    setConflictedProposal(null);
  };

  const handlePublishToGitHub = async (proposalId: string) => {
    setActionError(null);
    try {
      await publishApprovedProposal(proposalId, identity || 'alex');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to publish to GitHub');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E5EAF0] p-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
            <GitPullRequest className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172033] tracking-tight">
              Agent Proposals ({proposals.length})
            </h2>
            <p className="text-xs text-[#657189]">
              Contributions created by NOVA and PIXEL awaiting human review
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-100 text-[#172033] font-semibold'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-50'
            }`}
          >
            All ({proposals.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              filter === 'pending'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-50'
            }`}
          >
            Needs Review ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              filter === 'attention'
                ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-50'
            }`}
          >
            Outdated & Conflicts ({attentionCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              filter === 'approved'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                : 'text-[#657189] hover:text-[#172033] hover:bg-slate-50'
            }`}
          >
            Approved ({approvedCount})
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-600 hover:text-red-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Proposal Cards List */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E5EAF0] rounded-2xl p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <GitPullRequest className="w-10 h-10 text-[#657189] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-[#172033]">No proposals in this view</h3>
          <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
            Click 'Start Collaboration (Run Agents)' from the workspace or use the guided demo assistant to dispatch NOVA and PIXEL.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((prop) => (
            <ProposalCard
              key={prop.proposal_id}
              proposal={prop}
              identity={identity}
              onApprove={handleApprove}
              onReject={handleReject}
              onRedirect={(p) => setRedirectingProposal(p)}
              onReconcile={handleReconcile}
              onCompareConflict={(p) => setConflictedProposal(p)}
              onPublishToGitHub={handlePublishToGitHub}
            />
          ))}
        </div>
      )}

      {/* Redirect Modal */}
      {redirectingProposal && (
        <RedirectModal
          proposalId={redirectingProposal.proposal_id}
          agentId={redirectingProposal.agent_id}
          summary={redirectingProposal.summary}
          decidedBy={identity || 'alex'}
          onClose={() => setRedirectingProposal(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Conflict Compare Side-by-Side Modal */}
      {conflictedProposal && (
        <ConflictCompareModal
          proposal={conflictedProposal}
          currentSection={sections[conflictedProposal.target_sections[0]]}
          onClose={() => setConflictedProposal(null)}
          onKeepHuman={() => handleKeepHumanVersion(conflictedProposal)}
          onRedirectAgent={() => {
            const targetProp = conflictedProposal;
            setConflictedProposal(null);
            setRedirectingProposal(targetProp);
          }}
        />
      )}
    </div>
  );
};
