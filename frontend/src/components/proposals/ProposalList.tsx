import React, { useState, useEffect } from 'react';
import { Proposal, HumanIdentity, ArtifactSection, ProposalStats } from '../../types';
import { ProposalCard } from './ProposalCard';
import { NovaPrdCard } from './NovaPrdCard';
import { NovaPrdDocumentModal } from './NovaPrdDocumentModal';
import { PixelImplementationCard } from './PixelImplementationCard';
import { PixelImplementationModal } from './PixelImplementationModal';
import { RedirectModal } from './RedirectModal';
import { ConflictCompareModal } from './ConflictCompareModal';
import { CreateHumanProposalModal } from './CreateHumanProposalModal';
import { ExecutionEnvironmentModal } from './ExecutionEnvironmentModal';
import {
  approveProposal,
  rejectProposal,
  reconcileProposal,
  publishApprovedProposal,
  confirmProposalRequirements,
  fetchProposalStats,
  resolveProposalConflict,
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
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  FileText,
  CornerDownRight,
  RefreshCw,
  GitMerge,
  ExternalLink,
} from 'lucide-react';

interface ProposalListProps {
  proposals: Proposal[];
  sections: Record<string, ArtifactSection>;
  identity: HumanIdentity;
  onRefresh: () => void;
}

type FilterPill =
  | 'all'
  | 'nova_prds'
  | 'pixel_implementations'
  | 'needs_attention'
  | 'conflicts'
  | 'applied'
  | 'rejected';

export const ProposalList: React.FC<ProposalListProps> = ({
  proposals,
  sections,
  identity,
  onRefresh,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterPill>('all');
  const [redirectingProposal, setRedirectingProposal] = useState<Proposal | null>(null);
  const [conflictedProposal, setConflictedProposal] = useState<Proposal | null>(null);
  const [showCreateHumanModal, setShowCreateHumanModal] = useState(false);
  const [selectedNovaProposal, setSelectedNovaProposal] = useState<Proposal | null>(null);
  const [selectedPixelProposal, setSelectedPixelProposal] = useState<Proposal | null>(null);
  const [executingProposal, setExecutingProposal] = useState<Proposal | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProposalStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Load stats from server
  const loadStats = async () => {
    try {
      setIsStatsLoading(true);
      const data = await fetchProposalStats('demo-ledgerflow');
      setStats(data);
    } catch (e) {
      console.warn('Could not fetch proposal stats from backend:', e);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [proposals]);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  // Contributor classification helpers
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
    const ptype = p.proposal_type || '';
    return (
      authorClean === 'nova' ||
      ['prd_requirement', 'requirements', 'product_requirements'].includes(ptype) ||
      Boolean(p.prd_data && typeof p.prd_data === 'object')
    );
  };

  const isPixelProposal = (p: Proposal) => {
    const authorClean = (p.created_by || p.agent_id || '').toLowerCase();
    return (
      authorClean === 'pixel' ||
      p.proposal_type === 'prototype_modification' ||
      p.proposal_type === 'implementation' ||
      Boolean(p.implementation_data && typeof p.implementation_data === 'object')
    );
  };

  const isProposalConflicted = (p: Proposal) => {
    if (p.status === 'conflict' || Boolean(p.is_conflicted)) return true;
    if (p.status === 'pending_review' && p.base_section_versions) {
      for (const secKey of p.target_sections || []) {
        const liveSec = sections[secKey];
        const baseVer = p.base_section_versions[secKey] ?? 1;
        if (liveSec && liveSec.version > baseVer) {
          return true;
        }
      }
    }
    return false;
  };

  // Filter categorization
  const novaProposals = proposals.filter(isNovaProposal);
  const pixelProposals = proposals.filter((p) => isPixelProposal(p) && !isNovaProposal(p));
  const humanProposals = proposals.filter(isHumanProposal);
  const conflictedProposals = proposals.filter(isProposalConflicted);
  const appliedProposals = proposals.filter((p) => p.status === 'approved');
  const rejectedProposals = proposals.filter((p) => p.status === 'rejected');

  const needsAttentionProposals = proposals.filter((p) => {
    if (p.status !== 'pending_review' && !isProposalConflicted(p)) return false;
    if (p.requires_decision) {
      return (p.assigned_decider_id || 'alex').toLowerCase() === (identity || 'alex').toLowerCase();
    }
    return true;
  });

  // Calculate display counts (prefer live DB stats with fallback)
  const awaitingCount = stats ? stats.awaiting_confirmation : novaProposals.filter((p) => p.status === 'pending_review').length;
  const inProgressCount = stats ? stats.implementations_in_progress : 0;
  const readyForReviewCount = stats ? stats.ready_for_review : pixelProposals.filter((p) => p.status === 'pending_review' && !isProposalConflicted(p)).length;
  const conflictTotalCount = stats ? stats.conflicted : conflictedProposals.length;
  const appliedTotalCount = stats ? stats.recently_applied : appliedProposals.length;

  // Filtered proposal list based on activeFilter
  const getFilteredList = () => {
    switch (activeFilter) {
      case 'nova_prds':
        return novaProposals;
      case 'pixel_implementations':
        return pixelProposals;
      case 'needs_attention':
        return needsAttentionProposals;
      case 'conflicts':
        return conflictedProposals;
      case 'applied':
        return appliedProposals;
      case 'rejected':
        return rejectedProposals;
      case 'all':
      default:
        return proposals;
    }
  };

  const filteredProposals = getFilteredList();

  // Action handlers
  const handleApprove = async (proposalId: string) => {
    setActionError(null);
    try {
      await approveProposal('demo-ledgerflow', proposalId, identity || 'alex');
      onRefresh();
      loadStats();
    } catch (err: any) {
      onRefresh();
      setActionError(err.message || "Failed to approve proposal");
    }
  };

  const handleReject = async (proposalId: string) => {
    setActionError(null);
    try {
      await rejectProposal('demo-ledgerflow', proposalId, identity || 'alex', 'Rejected via review UI');
      onRefresh();
      loadStats();
    } catch (err: any) {
      onRefresh();
      setActionError(err.message || "Failed to reject proposal");
    }
  };

  const handleReconcile = async (proposalId: string) => {
    setActionError(null);
    try {
      await reconcileProposal('demo-ledgerflow', proposalId, identity || 'maya');
      onRefresh();
      loadStats();
    } catch (err: any) {
      onRefresh();
      setActionError(err.message || "Failed to reconcile proposal");
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
      onRefresh();
      loadStats();
    } catch (err: any) {
      onRefresh();
      setActionError(err.message || "Failed to confirm requirements");
    }
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
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* 1. Header & Live Stats */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
              <span>Workspace</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700 font-medium">Proposals</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-semibold text-slate-900 tracking-[-0.025em] leading-tight">
                Proposals & Specifications
              </h1>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-900/[0.06]">
                {proposals.length}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Review NOVA requirements, PIXEL implementation plans, and section updates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateHumanModal(true)}
            className="h-9 px-4 rounded-lg btn-obsidian text-xs font-medium flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add contribution</span>
          </button>
        </div>

        {/* 5 Clean Stripe Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div
            onClick={() => setActiveFilter('nova_prds')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              activeFilter === 'nova_prds'
                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                : 'coframe-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${activeFilter === 'nova_prds' ? 'text-slate-300' : 'text-slate-500'}`}>
                Awaiting PRD
              </span>
              <Brain className={`w-3.5 h-3.5 ${activeFilter === 'nova_prds' ? 'text-violet-300' : 'text-[#6D28D9]'}`} strokeWidth={1.75} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-medium font-mono tracking-tight">{awaitingCount}</span>
              <span className={`text-[11px] ${activeFilter === 'nova_prds' ? 'text-slate-400' : 'text-slate-400'}`}>specs</span>
            </div>
          </div>

          <div
            onClick={() => setActiveFilter('pixel_implementations')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              activeFilter === 'pixel_implementations'
                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                : 'coframe-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${activeFilter === 'pixel_implementations' ? 'text-slate-300' : 'text-slate-500'}`}>
                In progress
              </span>
              <RefreshCw className={`w-3.5 h-3.5 ${activeFilter === 'pixel_implementations' ? 'text-teal-300' : 'text-[#0F766E]'}`} strokeWidth={1.75} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-medium font-mono tracking-tight">{inProgressCount}</span>
              <span className="text-[11px] text-slate-400">tasks</span>
            </div>
          </div>

          <div
            onClick={() => setActiveFilter('needs_attention')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              activeFilter === 'needs_attention'
                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                : 'coframe-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${activeFilter === 'needs_attention' ? 'text-slate-300' : 'text-slate-500'}`}>
                Needs review
              </span>
              <Code2 className={`w-3.5 h-3.5 ${activeFilter === 'needs_attention' ? 'text-blue-300' : 'text-[#2563EB]'}`} strokeWidth={1.75} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-medium font-mono tracking-tight">{readyForReviewCount}</span>
              <span className="text-[11px] text-slate-400">pending</span>
            </div>
          </div>

          <div
            onClick={() => setActiveFilter('conflicts')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              activeFilter === 'conflicts'
                ? 'bg-rose-950 text-white border-rose-950 shadow-sm'
                : conflictTotalCount > 0
                ? 'bg-rose-50/70 border-rose-200'
                : 'coframe-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${activeFilter === 'conflicts' ? 'text-rose-200' : 'text-slate-500'}`}>
                Conflicts
              </span>
              <ShieldAlert className={`w-3.5 h-3.5 ${activeFilter === 'conflicts' ? 'text-rose-200' : 'text-rose-600'}`} strokeWidth={1.75} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-2xl font-medium font-mono tracking-tight ${conflictTotalCount > 0 && activeFilter !== 'conflicts' ? 'text-rose-600' : ''}`}>
                {conflictTotalCount}
              </span>
              <span className={`text-[11px] ${activeFilter === 'conflicts' ? 'text-rose-200/70' : 'text-slate-400'}`}>blocked</span>
            </div>
          </div>

          <div
            onClick={() => setActiveFilter('applied')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              activeFilter === 'applied'
                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                : 'coframe-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${activeFilter === 'applied' ? 'text-slate-300' : 'text-slate-500'}`}>
                Applied
              </span>
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeFilter === 'applied' ? 'text-emerald-300' : 'text-emerald-600'}`} strokeWidth={1.75} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-medium font-mono tracking-tight">{appliedTotalCount}</span>
              <span className="text-[11px] text-slate-400">merged</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Apple Segmented Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F4F8] border border-slate-900/[0.06] rounded-xl">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer shrink-0 ${
            activeFilter === 'all'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({proposals.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('nova_prds')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'nova_prds'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-[#6D28D9]" strokeWidth={1.75} />
          <span>NOVA PRDs ({novaProposals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('pixel_implementations')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'pixel_implementations'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-[#0F766E]" strokeWidth={1.75} />
          <span>PIXEL Code ({pixelProposals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('needs_attention')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'needs_attention'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={1.75} />
          <span>Needs Review ({needsAttentionProposals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('conflicts')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'conflicts'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" strokeWidth={1.75} />
          <span>Conflicts ({conflictedProposals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('applied')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'applied'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />
          <span>Applied ({appliedProposals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('rejected')}
          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === 'rejected'
              ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] font-medium'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Rejected ({rejectedProposals.length})</span>
        </button>
      </div>

      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-950 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-rose-100/60 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Structured Content Queues */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-16 coframe-card p-8">
          <GitPullRequest className="w-9 h-9 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-slate-900">No proposals matching this filter</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try switching filters above or create a new manual contribution.
          </p>
        </div>
      ) : activeFilter === 'all' ? (
        <div className="space-y-8">
          {/* QUEUE 1: Requirements Queue (NOVA PRDs) */}
          {novaProposals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#6D28D9]" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Requirements queue
                  </h2>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-900/[0.06]">
                    {novaProposals.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Confirmed PRDs delegate automatically to PIXEL
                </span>
              </div>

              <div className="space-y-4">
                {novaProposals.map((prop) => {
                  const linkedPixel = proposals.find(
                    (p) => p.supersedes_proposal_id === prop.proposal_id && isPixelProposal(p)
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
                })}
              </div>
            </div>
          )}

          {/* QUEUE 2: Engineering Queue (PIXEL Implementations) */}
          {pixelProposals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#0F766E]" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Engineering queue
                  </h2>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-900/[0.06]">
                    {pixelProposals.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Reviewed implementations awaiting final sign-off
                </span>
              </div>

              <div className="space-y-4">
                {pixelProposals.map((prop) => (
                  <PixelImplementationCard
                    key={prop.proposal_id}
                    proposal={prop}
                    identity={identity}
                    onOpenImplementation={(p) => setSelectedPixelProposal(p)}
                    onChooseExecutionEnvironment={(p) => setExecutingProposal(p)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onRedirect={(p) => setRedirectingProposal(p)}
                    onCompareConflict={(p) => setConflictedProposal(p)}
                    onOpenParentPrd={(parentPrdId) => {
                      const parentPrd = proposals.find((p) => p.proposal_id === parentPrdId);
                      if (parentPrd) setSelectedNovaProposal(parentPrd);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* QUEUE 3: Completed Contributions History Table */}
          {appliedProposals.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Completed history
                  </h2>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    {appliedProposals.length} applied
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Audited decision and integration ledger
                </span>
              </div>

              <div className="coframe-card overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-900/[0.06] text-[11px] font-medium text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Contribution</th>
                      <th className="py-3 px-4 font-medium">Author</th>
                      <th className="py-3 px-4 font-medium">Reviewer</th>
                      <th className="py-3 px-4 font-medium">Approver</th>
                      <th className="py-3 px-4 font-medium">Section</th>
                      <th className="py-3 px-4 font-medium">Applied</th>
                      <th className="py-3 px-4 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/[0.05]">
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
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-[11px] text-slate-400">
                                #{prop.proposal_id.slice(-6)}
                              </span>
                              <span className="max-w-xs truncate">{prop.summary}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                              {author}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <Brain className="w-3 h-3 text-[#6D28D9]" />
                              {reviewer}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                              {approver}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-[#0F766E]">
                            {targetSec} (v{prop.base_artifact_version + 1})
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px] font-mono">{dateStr}</td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (isNovaProposal(prop)) setSelectedNovaProposal(prop);
                                else setSelectedPixelProposal(prop);
                              }}
                              className="px-2.5 py-1 rounded-md btn-apple-secondary font-medium text-[11px] cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((prop) => {
            if (isNovaProposal(prop)) {
              const linkedPixel = proposals.find(
                (p) => p.supersedes_proposal_id === prop.proposal_id && isPixelProposal(p)
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
                  onChooseExecutionEnvironment={(p) => setExecutingProposal(p)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onRedirect={(p) => setRedirectingProposal(p)}
                  onCompareConflict={(p) => setConflictedProposal(p)}
                  onOpenParentPrd={(parentPrdId) => {
                    const parentPrd = proposals.find((p) => p.proposal_id === parentPrdId);
                    if (parentPrd) setSelectedNovaProposal(parentPrd);
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
          onSuccess={() => {
            onRefresh();
            loadStats();
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
            loadStats();
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
            loadStats();
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
            loadStats();
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
            loadStats();
          }}
        />
      )}
    </div>
  );
};
