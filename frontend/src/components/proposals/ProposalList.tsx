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
import { GitPullRequest, Filter, Sparkles, AlertCircle, Bot, Code2, Layers } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'attention' | 'approved'>('all');
  const [agentFilter, setAgentFilter] = useState<'all' | 'pixel' | 'nova'>('all');
  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredProposals = proposals.filter((p) => {
    // 1. Agent filter (Requirement 1.C: Separate NOVA outputs from PIXEL outputs)
    if (agentFilter === 'pixel' && p.agent_id !== 'pixel') return false;
    if (agentFilter === 'nova' && p.agent_id !== 'nova') return false;

    // 2. Status filter
    if (statusFilter === 'pending') return p.status === 'pending_review';
    if (statusFilter === 'attention') return p.status === 'stale' || p.status === 'conflict';
    if (statusFilter === 'approved') return p.status === 'approved';
    return true;
  });

  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const attentionCount = proposals.filter((p) => p.status === 'stale' || p.status === 'conflict').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;

  const pixelCount = proposals.filter((p) => p.agent_id === 'pixel').length;
  const novaCount = proposals.filter((p) => p.agent_id === 'nova').length;

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
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#172033] tracking-tight">
                  Proposals & Contributions
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#172033] border border-[#E7ECF2]">
                  {proposals.length} Total
                </span>
              </div>
              <p className="text-xs text-[#657189] mt-0.5">
                Targeted contributions created by NOVA (Strategist) and PIXEL (Prototype Engineer)
              </p>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#F0F3F7] text-[#172033] font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              All ({proposals.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Needs Review ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('attention')}
              className={`px-3 py-1.5 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'attention'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Outdated & Conflicts ({attentionCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Approved ({approvedCount})
            </button>
          </div>
        </div>

        {/* Agent Separation Tabs (Requirement 1.C: Clarify NOVA vs PIXEL responsibilities) */}
        <div className="pt-3 border-t border-[#F0F3F7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-[#657189] uppercase tracking-wider">
              Output Category:
            </span>
            <div className="flex items-center space-x-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#E5EAF0]">
              <button
                onClick={() => setAgentFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  agentFilter === 'all'
                    ? 'bg-white text-[#172033] shadow-xs'
                    : 'text-[#657189] hover:text-[#172033]'
                }`}
              >
                All Contributors ({proposals.length})
              </button>
              <button
                onClick={() => setAgentFilter('pixel')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  agentFilter === 'pixel'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-teal-800 hover:bg-teal-50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>PIXEL · Prototype Changes ({pixelCount})</span>
              </button>
              <button
                onClick={() => setAgentFilter('nova')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  agentFilter === 'nova'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-violet-800 hover:bg-violet-50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>NOVA · Strategy & PRD ({novaCount})</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#657189]">
            {agentFilter === 'pixel' && 'PIXEL outputs: target UI sections, components & before/after code previews.'}
            {agentFilter === 'nova' && 'NOVA outputs: strategic positioning, PRDs, requirements & semantic reviews.'}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-600 hover:text-red-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Proposal Cards List */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E7ECF2] rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <GitPullRequest className="w-10 h-10 text-[#657189] mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-bold text-[#172033]">No proposals matching this filter</h3>
          <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
            Use the staged workflow from Overview or the Guided Demo assistant to generate new contributions.
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
