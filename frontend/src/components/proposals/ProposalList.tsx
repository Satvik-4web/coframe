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
    <div className="space-y-6">
      {/* 1. Header & Live Stats */}
      <div className="space-y-3">
        {/* Main Title & Action Bar */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Proposals & Specifications
                </h1>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {proposals.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                NOVA product requirements, PIXEL implementation plans, and human decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateHumanModal(true)}
              className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Contribution</span>
            </button>
          </div>
        </div>

        {/* 5 Clean Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Card 1: Awaiting Confirmation */}
          <div
            onClick={() => setActiveFilter("nova_prds")}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              activeFilter === "nova_prds"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${activeFilter === "nova_prds" ? "text-indigo-300" : "text-slate-400"}`}>
                Awaiting PRD
              </span>
              <Brain className={`w-3.5 h-3.5 ${activeFilter === "nova_prds" ? "text-indigo-300" : "text-purple-600"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{awaitingCount}</span>
              <span className={`text-[10px] ${activeFilter === "nova_prds" ? "text-white/60" : "text-slate-400"}`}>specs</span>
            </div>
          </div>

          {/* Card 2: Implementations In Progress */}
          <div
            onClick={() => setActiveFilter("pixel_implementations")}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              activeFilter === "pixel_implementations"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${activeFilter === "pixel_implementations" ? "text-teal-300" : "text-slate-400"}`}>
                In Progress
              </span>
              <RefreshCw className={`w-3.5 h-3.5 ${activeFilter === "pixel_implementations" ? "text-teal-300" : "text-teal-600"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{inProgressCount}</span>
              <span className={`text-[10px] ${activeFilter === "pixel_implementations" ? "text-white/60" : "text-slate-400"}`}>tasks</span>
            </div>
          </div>

          {/* Card 3: Ready for Human Review */}
          <div
            onClick={() => setActiveFilter("needs_attention")}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              activeFilter === "needs_attention"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${activeFilter === "needs_attention" ? "text-blue-300" : "text-slate-400"}`}>
                For Review
              </span>
              <Code2 className={`w-3.5 h-3.5 ${activeFilter === "needs_attention" ? "text-blue-300" : "text-blue-600"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{readyForReviewCount}</span>
              <span className={`text-[10px] ${activeFilter === "needs_attention" ? "text-white/60" : "text-slate-400"}`}>pending</span>
            </div>
          </div>

          {/* Card 4: Conflicted */}
          <div
            onClick={() => setActiveFilter("conflicts")}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              activeFilter === "conflicts"
                ? "bg-rose-900 text-white border-rose-900 shadow-xs"
                : conflictTotalCount > 0
                ? "bg-rose-50/50 border-rose-200"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${activeFilter === "conflicts" ? "text-rose-200" : "text-slate-400"}`}>
                Conflicts
              </span>
              <ShieldAlert className={`w-3.5 h-3.5 ${activeFilter === "conflicts" ? "text-rose-200" : "text-rose-600"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-xl font-bold font-mono ${conflictTotalCount > 0 && activeFilter !== "conflicts" ? "text-rose-600" : ""}`}>
                {conflictTotalCount}
              </span>
              <span className={`text-[10px] ${activeFilter === "conflicts" ? "text-white/60" : "text-slate-400"}`}>blocked</span>
            </div>
          </div>

          {/* Card 5: Recently Applied */}
          <div
            onClick={() => setActiveFilter("applied")}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              activeFilter === "applied"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-white border-slate-200/80 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${activeFilter === "applied" ? "text-emerald-300" : "text-slate-400"}`}>
                Applied
              </span>
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeFilter === "applied" ? "text-emerald-300" : "text-emerald-600"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{appliedTotalCount}</span>
              <span className={`text-[10px] ${activeFilter === "applied" ? "text-white/60" : "text-slate-400"}`}>merged</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Refined Monochromatic Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100/70 border border-slate-200/60 rounded-lg shrink-0">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer shrink-0 ${
            activeFilter === "all"
              ? "bg-white text-slate-900 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All ({proposals.length})
        </button>

        <button
          onClick={() => setActiveFilter("nova_prds")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "nova_prds"
              ? "bg-white text-purple-700 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Brain className="w-3 h-3 text-purple-600" />
          <span>NOVA PRDs ({novaProposals.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter("pixel_implementations")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "pixel_implementations"
              ? "bg-white text-teal-700 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Code2 className="w-3 h-3 text-teal-600" />
          <span>PIXEL Code ({pixelProposals.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter("needs_attention")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "needs_attention"
              ? "bg-white text-blue-700 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3 h-3 text-blue-600" />
          <span>Needs Attention ({needsAttentionProposals.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter("conflicts")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "conflicts"
              ? "bg-white text-rose-700 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-rose-600" />
          <span>Conflicts ({conflictedProposals.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter("applied")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "applied"
              ? "bg-white text-emerald-700 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Applied ({appliedProposals.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter("rejected")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeFilter === "rejected"
              ? "bg-white text-slate-800 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Rejected ({rejectedProposals.length})</span>
        </button>
      </div>

      {actionError && (
        <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs transition-all animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-950 text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-100/60 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Structured Content Queues */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E7ECF2] rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <GitPullRequest className="w-10 h-10 text-[#657189] mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-bold text-[#172033]">No proposals matching this filter</h3>
          <p className="text-xs text-[#657189] mt-1 max-w-sm mx-auto">
            Try adjusting your filter selection above or create a new contribution.
          </p>
        </div>
      ) : activeFilter === 'all' ? (
        <div className="space-y-8">
          {/* QUEUE 1: Requirements Queue (NOVA PRDs) */}
          {novaProposals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <Brain className="w-4 h-4 text-violet-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                    Requirements Queue (NOVA PRDs)
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    {novaProposals.length}
                  </span>
                </div>
                <span className="text-[11px] text-[#657189]">
                  Confirmed PRDs automatically delegate to PIXEL
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
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-teal-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                    Engineering Queue (PIXEL Implementations)
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    {pixelProposals.length}
                  </span>
                </div>
                <span className="text-[11px] text-[#657189]">
                  Code contributions reviewed by NOVA awaiting human approval
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
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                    Completed Contributions History
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {appliedProposals.length} Applied
                  </span>
                </div>
                <span className="text-[11px] text-[#657189]">
                  Cryptographically traceable decision and deployment audit log
                </span>
              </div>

              <div className="bg-white border border-[#E7ECF2] rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAFBFD] border-b border-[#E7ECF2] text-[10px] font-bold uppercase tracking-wider text-[#657189]">
                    <tr>
                      <th className="py-3 px-4">Contribution</th>
                      <th className="py-3 px-4">Author</th>
                      <th className="py-3 px-4">Reviewer</th>
                      <th className="py-3 px-4">Approver</th>
                      <th className="py-3 px-4">Target Section</th>
                      <th className="py-3 px-4">Applied</th>
                      <th className="py-3 px-4 text-right">Action</th>
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
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (isNovaProposal(prop)) setSelectedNovaProposal(prop);
                                else setSelectedPixelProposal(prop);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#172033] font-bold text-[10px] transition cursor-pointer"
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
