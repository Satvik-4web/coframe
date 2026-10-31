import React, { useState } from 'react';
import { Proposal, HumanIdentity, ArtifactSection } from '../../types';
import { ProposalCard } from './ProposalCard';
import { RedirectModal } from './RedirectModal';
import { ConflictCompareModal } from './ConflictCompareModal';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  editArtifactSection,
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
    // Rejects conflicted proposal, keeping Maya's version intact
    await handleReject(proposal.proposal_id);
    setConflictedProposal(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151B29] border border-[#263244] p-3 rounded-xl">
        <div className="flex items-center space-x-2">
          <GitPullRequest className="w-4 h-4 text-teal-400" />
          <h2 className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wider">
            Agent Proposals ({proposals.length})
          </h2>
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === 'all'
                ? 'bg-[#1B2433] text-[#F4F7FB] border border-[#263244] font-semibold'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            All ({proposals.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === 'pending'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40 font-semibold'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            Pending ({proposals.filter((p) => p.status === 'pending_review').length})
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === 'attention'
                ? 'bg-red-950/40 text-red-300 border border-red-800/40 font-semibold'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            Stale & Conflict ({proposals.filter((p) => p.status === 'stale' || p.status === 'conflict').length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-2.5 py-1 rounded-md transition ${
              filter === 'approved'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-semibold'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            Approved ({proposals.filter((p) => p.status === 'approved').length})
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-200 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Proposal Cards List */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-12 bg-[#151B29] border border-[#263244] rounded-xl p-8">
          <GitPullRequest className="w-8 h-8 text-[#98A5B7] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-[#F4F7FB]">No proposals in this filter</h3>
          <p className="text-xs text-[#98A5B7] mt-1 max-w-sm mx-auto">
            Click 'Start Collaboration' in the workspace or stepper to dispatch NOVA and PIXEL agent runs.
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
