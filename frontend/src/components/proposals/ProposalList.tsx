import React, { useState } from 'react';
import { Proposal, HumanIdentity, ArtifactSection } from '../../types';
import { ProposalCard } from './ProposalCard';
import { NovaPrdCard } from './NovaPrdCard';
import { NovaPrdDocumentModal } from './NovaPrdDocumentModal';
import { PixelImplementationCard } from './PixelImplementationCard';
import { PixelImplementationModal } from './PixelImplementationModal';
import { RedirectModal } from './RedirectModal';
import { ConflictCompareModal } from './ConflictCompareModal';
import { CreateHumanProposalModal } from './CreateHumanProposalModal';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  publishApprovedProposal,
  confirmProposalRequirements,
} from '../../lib/api';
import {
  GitPullRequest,
  Filter,
  Sparkles,
  AlertCircle,
  Bot,
  Code2,
  Layers,
  User,
  PlusCircle,
  Brain,
} from 'lucide-react';

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
  // Author filter: All Contributors | NOVA | PIXEL | Human Contributions
  const [authorFilter, setAuthorFilter] = useState<'all' | 'nova' | 'pixel' | 'human'>('all');

  // Status filter: All | Needs Review | Approved | Rejected | Stale | Conflicted
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'stale' | 'conflict'>('all');

  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [showCreateHumanModal, setShowCreateHumanModal] = useState(false);
  const [selectedNovaProposal, setSelectedNovaProposal] = useState<Proposal | null>(null);
  const [selectedPixelProposal, setSelectedPixelProposal] = useState<Proposal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Helper check for human proposals
  const isHumanProposal = (p: Proposal) => {
    const authorClean = (p.created_by || p.agent_id || p.author || '').toLowerCase();
    return (
      p.author_type === 'human' ||
      p.proposal_type === 'human_contribution' ||
      authorClean === 'alex' ||
      authorClean === 'maya' ||
      authorClean === 'human'
    );
  };

  const isNovaProposal = (p: Proposal) => {
    const authorClean = (p.created_by || p.agent_id || '').toLowerCase();
    return authorClean === 'nova' || p.proposal_type === 'prd_requirement' || p.proposal_type === 'requirements';
  };

  const isPixelProposal = (p: Proposal) => {
    const authorClean = (p.created_by || p.agent_id || '').toLowerCase();
    return authorClean === 'pixel' || p.proposal_type === 'prototype_modification' || p.proposal_type === 'implementation';
  };

  // Two-dimensional filter composition (Section 4)
  const filteredProposals = proposals.filter((p) => {
    // 1. Author / Contributor filter
    if (authorFilter === 'nova' && !isNovaProposal(p)) return false;
    if (authorFilter === 'pixel' && !isPixelProposal(p)) return false;
    if (authorFilter === 'human' && !isHumanProposal(p)) return false;

    // 2. Status filter
    if (statusFilter === 'pending' && p.status !== 'pending_review') return false;
    if (statusFilter === 'approved' && p.status !== 'approved') return false;
    if (statusFilter === 'rejected' && p.status !== 'rejected') return false;
    if (statusFilter === 'stale' && p.status !== 'stale') return false;
    if (statusFilter === 'conflict' && p.status !== 'conflict') return false;

    return true;
  });

  // Calculate live counts
  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;
  const rejectedCount = proposals.filter((p) => p.status === 'rejected').length;
  const staleCount = proposals.filter((p) => p.status === 'stale').length;
  const conflictCount = proposals.filter((p) => p.status === 'conflict').length;

  const novaCount = proposals.filter(isNovaProposal).length;
  const pixelCount = proposals.filter(isPixelProposal).length;
  const humanCount = proposals.filter(isHumanProposal).length;

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

  const handleConfirmRequirements = async (proposalId: string) => {
    setActionError(null);
    try {
      await confirmProposalRequirements('demo-ledgerflow', proposalId, identity || 'alex', `Requirements confirmed by ${identity || 'alex'}`);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm requirements');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Control Card */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        {/* Title Bar & Status Filters */}
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
                Traceable proposals authored by NOVA, PIXEL, and human decision owners
              </p>
            </div>
          </div>

          {/* New Human Contribution Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateHumanModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Add Human Contribution</span>
            </button>
          </div>
        </div>

        {/* Two-Dimensional Filter Controls */}
        <div className="pt-3 border-t border-[#F0F3F7] space-y-3">
          {/* 1. Author / Contributor Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-[#657189] uppercase tracking-wider">
                Contributor:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#E5EAF0]">
                <button
                  onClick={() => setAuthorFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    authorFilter === 'all'
                      ? 'bg-white text-[#172033] shadow-xs'
                      : 'text-[#657189] hover:text-[#172033]'
                  }`}
                >
                  All Contributors ({proposals.length})
                </button>
                <button
                  onClick={() => setAuthorFilter('nova')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    authorFilter === 'nova'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-violet-800 hover:bg-violet-50'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>NOVA ({novaCount})</span>
                </button>
                <button
                  onClick={() => setAuthorFilter('pixel')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    authorFilter === 'pixel'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-teal-800 hover:bg-teal-50'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>PIXEL ({pixelCount})</span>
                </button>
                <button
                  onClick={() => setAuthorFilter('human')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    authorFilter === 'human'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-800 hover:bg-blue-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Human Contributions ({humanCount})</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[#657189] hidden md:block">
              {authorFilter === 'pixel' && 'PIXEL: Implementation changes to LedgerFlow components & UI.'}
              {authorFilter === 'nova' && 'NOVA: Product requirements, positioning & strategic PRD updates.'}
              {authorFilter === 'human' && 'Human Contributions: Direct edits authored by Alex or Maya.'}
              {authorFilter === 'all' && 'All multi-agent and human contributions in workspace.'}
            </div>
          </div>

          {/* 2. Proposal Status Filter Tabs */}
          <div className="flex flex-wrap items-center space-x-1.5 text-xs pt-1">
            <span className="text-[11px] font-bold text-[#657189] uppercase tracking-wider mr-1">
              Status:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#F0F3F7] text-[#172033] font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              All ({proposals.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Needs Review ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'rejected'
                  ? 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              onClick={() => setStatusFilter('stale')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'stale'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Stale ({staleCount})
            </button>
            <button
              onClick={() => setStatusFilter('conflict')}
              className={`px-3 py-1 rounded-xl transition font-medium cursor-pointer ${
                statusFilter === 'conflict'
                  ? 'bg-red-50 text-red-800 border border-red-200 font-semibold shadow-2xs'
                  : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
              }`}
            >
              Conflicted ({conflictCount})
            </button>
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
            Try adjusting the contributor or status filters above, or add a new human contribution.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((prop) => {
            if (isNovaProposal(prop)) {
              const linkedPixel = proposals.find(
                (p) => p.supersedes_proposal_id === prop.proposal_id && (p.agent_id === 'pixel' || p.created_by === 'pixel')
              );
              return (
                <NovaPrdCard
                  key={prop.proposal_id}
                  proposal={prop}
                  identity={identity}
                  onOpenPrd={(p) => setSelectedNovaProposal(p)}
                  onConfirmRequirements={handleConfirmRequirements}
                  onReject={handleReject}
                  hasLinkedImplementation={Boolean(linkedPixel)}
                  onOpenPixelProposal={linkedPixel ? () => setSelectedPixelProposal(linkedPixel) : undefined}
                />
              );
            }
            if (isPixelProposal(prop)) {
              return (
                <PixelImplementationCard
                  key={prop.proposal_id}
                  proposal={prop}
                  identity={identity}
                  onOpenImplementation={(p) => setSelectedPixelProposal(p)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onRedirect={(p) => setRedirectingProposal(p)}
                  onCompareConflict={(p) => setConflictedProposal(p)}
                  onOpenParentPrd={(parentPrdId) => {
                    const parentPrd = proposals.find((p) => p.proposal_id === parentPrdId);
                    if (parentPrd) {
                      setSelectedNovaProposal(parentPrd);
                    }
                  }}
                />
              );
            }
            return (
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
            );
          })}
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

      {/* Create Human Proposal Modal */}
      {showCreateHumanModal && (
        <CreateHumanProposalModal
          identity={identity}
          onClose={() => setShowCreateHumanModal(false)}
          onSuccess={onRefresh}
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
        />
      )}

    </div>
  );
};
