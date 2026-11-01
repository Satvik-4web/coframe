import React, { useState } from 'react';
import { Proposal, HumanIdentity, ArtifactSection } from '../../types';
import { ProposalProvenanceModal } from './ProposalProvenanceModal';
import {
  Check,
  X,
  CornerDownRight,
  RefreshCw,
  GitCompare,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Eye,
  GitPullRequest,
  Layers,
  ArrowRight,
  FileCode,
  CheckCircle2,
  Brain,
  Code2,
  User,
  HelpCircle,
  FileText,
  Loader2,
  Diff,
} from 'lucide-react';
import { useToast } from '../common/Toast';

interface ProposalCardProps {
  proposal: Proposal;
  identity: HumanIdentity;
  sections?: Record<string, ArtifactSection>;
  isPreviewing?: boolean;
  onTogglePreview?: (proposalId: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRedirect: (proposal: Proposal) => void;
  onReconcile: (id: string) => void;
  onCompareConflict: (proposal: Proposal) => void;
  onConfirmRequirements?: (id: string) => void;
  onOpenPrd?: (proposal: Proposal) => void;
  onPublishToGitHub?: (proposalId: string) => void;
  onReverify?: (id: string) => void;
  isReverifying?: boolean;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  identity,
  sections: _sections,
  isPreviewing = false,
  onTogglePreview,
  onApprove,
  onReject,
  onRedirect,
  onReconcile,
  onCompareConflict,
  onConfirmRequirements,
  onOpenPrd,
  onPublishToGitHub,
  onReverify,
  isReverifying = false,
}) => {
  const { showToast } = useToast();
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);

  // Author identity resolution
  const authorClean = (proposal.created_by || proposal.agent_id || proposal.author || '').toLowerCase();
  const isNova = authorClean === 'nova';
  const isPixel = authorClean === 'pixel';
  const isAlex = authorClean === 'alex';
  const isMaya = authorClean === 'maya';

  const authorName = isNova ? 'NOVA' : isPixel ? 'PIXEL' : isAlex ? 'Alex' : isMaya ? 'Maya' : (proposal.author || 'Contributor');
  const authorRole = isNova
    ? 'AI Product Strategist'
    : isPixel
    ? 'AI Software Engineer'
    : isAlex
    ? 'Founder / Decision Owner'
    : isMaya
    ? 'Product Designer'
    : 'Team Contributor';

  const isPrd =
    proposal.proposal_type === 'prd_requirement' ||
    Boolean(proposal.prd_data && typeof proposal.prd_data === 'object');
  const isImplementation =
    proposal.proposal_type === 'implementation' ||
    proposal.proposal_type === 'prototype_modification' ||
    Boolean(proposal.implementation_data && typeof proposal.implementation_data === 'object') ||
    isPixel;

  const isConflict = proposal.status === 'conflict' || Boolean((proposal as any).is_conflicted);
  const isStale = proposal.status === 'stale';
  const isPending = proposal.status === 'pending_review';
  const isApproved = proposal.status === 'approved';
  const isRejected = proposal.status === 'rejected';
  const isRedirected = (proposal.status as string) === 'redirected' || (isRejected && Boolean((proposal as any).superseded_by));

  const isCurrentAlex = identity === 'alex';
  const isRestrictedByAlex = proposal.requires_decision && !isCurrentAlex;

  // Formatting timestamps
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const targetSections = proposal.target_sections || [];
  const baseSectionEntries = Object.entries(proposal.base_section_versions || {});
  const sectionVersionsStr =
    baseSectionEntries.length > 0
      ? baseSectionEntries.map(([k, v]) => `${k} v${v}`).join(', ')
      : targetSections.map((s) => `${s} v1`).join(', ');

  // Operations summary
  const ops = proposal.changes?.operations || [];

  return (
    <>
      <div
        className={`rounded-2xl border transition-all p-5 shadow-xs ${
          isConflict
            ? 'bg-white border-rose-300 ring-2 ring-rose-100/70 shadow-sm'
            : isStale
            ? 'bg-white border-amber-300 ring-2 ring-amber-100/70 shadow-sm'
            : isApproved
            ? 'bg-emerald-50/20 border-emerald-200'
            : isRejected || isRedirected
            ? 'bg-[#F8FAFC] border-slate-200 opacity-85'
            : 'bg-white border-[#E7ECF2] hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        {/* 1. Header: Agent Identity, Avatar, Role, Time, Freshness Badge */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                isNova
                  ? 'bg-violet-100 text-violet-700 border border-violet-200'
                  : isPixel
                  ? 'bg-teal-100 text-teal-700 border border-teal-200'
                  : isAlex
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : isMaya
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isNova ? (
                <Brain className="w-5 h-5 text-violet-700" />
              ) : isPixel ? (
                <Code2 className="w-5 h-5 text-teal-700" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-[#172033] tracking-tight">
                  {authorName}
                </span>
                <span className="text-[11px] text-[#657189] font-medium">
                  {authorRole}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    isPrd
                      ? 'bg-violet-50 text-violet-800 border-violet-200'
                      : isImplementation
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {isPrd ? 'PRD SPECIFICATION' : isImplementation ? 'IMPLEMENTATION PLAN' : 'HUMAN CONTRIBUTION'}
                </span>

                {proposal.supersedes_proposal_id && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                    revised #{proposal.supersedes_proposal_id.slice(-6)}
                  </span>
                )}
              </div>

              {/* Time Stamp with tooltip */}
              <p
                className="text-[10px] text-[#657189] mt-0.5 font-mono cursor-default"
                title={proposal.created_at ? new Date(proposal.created_at).toISOString() : ''}
              >
                Submitted {formatRelativeTime(proposal.created_at)} · Task {proposal.task_id || proposal.run_id || 'T-001'}
              </p>
            </div>
          </div>

          {/* Freshness Badge with Plain-Language Reason */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isConflict ? (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                <span>⚡</span>
                <span>Conflict</span>
              </span>
            ) : isStale ? (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                <span>⚠️</span>
                <span>Stale</span>
              </span>
            ) : isPending ? (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Fresh</span>
              </span>
            ) : isApproved ? (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Applied</span>
              </span>
            ) : isRedirected ? (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Redirected
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Rejected
              </span>
            )}

            {proposal.requires_decision && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-600" />
                <span>Alex Decision</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Version Stamp Line */}
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-wrap items-center gap-2 text-2xs font-mono text-[#657189]">
          <span className="font-semibold text-[#172033]">Provenance Stamp:</span>
          <span>Based on requirements <strong className="text-blue-700">v{proposal.base_context_version || 1}</strong></span>
          <span>·</span>
          <span>prototype <strong className="text-emerald-700">v{proposal.base_artifact_version || 1}</strong></span>
          {sectionVersionsStr && (
            <>
              <span>·</span>
              <span>{sectionVersionsStr}</span>
            </>
          )}
        </div>

        {/* 3. Title & Summary */}
        <h3 className="font-bold text-sm text-[#172033] mb-1 leading-snug">
          {proposal.summary}
        </h3>

        {/* 4. Why Line (From Reasoning) */}
        <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-[#334155] leading-relaxed">
          <span className="font-bold text-slate-700 block mb-0.5">Why this change:</span>
          <p>{proposal.reasoning || proposal.summary}</p>
        </div>

        {/* 5. Freshness Reason Banner (One-Sentence Plain Language) */}
        {isConflict && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Concurrent Conflict Detected:</span>
              <p className="mt-0.5">
                {proposal.conflict_reason ||
                  "Maya modified this section in the prototype concurrently. Reconcile side-by-side before applying."}
              </p>
            </div>
          </div>
        )}

        {isStale && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Stale Dependency:</span>
              <p className="mt-0.5">
                {proposal.stale_reason ||
                  "Underlying requirement dependencies changed since this proposal was drafted. Ask agent to revise or reconcile."}
              </p>
            </div>
          </div>
        )}

        {/* 6. Target Sections and Affected Requirements Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-[#657189]">Targets:</span>
          {targetSections.map((sec) => (
            <span
              key={sec}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200"
            >
              § {sec}
            </span>
          ))}

          {proposal.affected_requirements && proposal.affected_requirements.length > 0 && (
            <>
              <span className="text-2xs font-bold uppercase tracking-wider text-[#657189] ml-2">Dependencies:</span>
              {proposal.affected_requirements.map((req) => (
                <span
                  key={req}
                  className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-lg bg-[#F8FAFC] text-blue-800 border border-blue-200"
                >
                  {req}
                </span>
              ))}
            </>
          )}
        </div>

        {/* 7. Mini Before/After Preview (Expandable Diff) */}
        <div className="mb-4 rounded-xl border border-[#E7ECF2] bg-[#F8FAFC] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFullDiff(!showFullDiff)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-[#172033] hover:bg-slate-100 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Diff className="w-3.5 h-3.5 text-teal-600" />
              <span>Proposed Changes Preview ({ops.length} operation{ops.length !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#657189]">
              <span>{showFullDiff ? 'Collapse diff' : 'Expand full diff'}</span>
              {showFullDiff ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* Mini Summary Strip */}
          <div className="px-3.5 py-2 border-t border-[#E7ECF2] text-xs text-[#657189] bg-white flex flex-wrap gap-3">
            {ops.map((op: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span>
                  <strong>{op.section || 'prototype'}</strong>: {op.op || 'update'}
                </span>
              </span>
            ))}
          </div>

          {/* Expanded Full Diff & JSON View */}
          {showFullDiff && (
            <div className="p-3.5 border-t border-[#E7ECF2] bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-60 rounded-b-xl">
              <pre>{JSON.stringify(proposal.changes, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* 8. Review Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 border-t border-[#F0F3F7]">
          {/* Left Actions: Compare Conflict / Reconcile / Prototype Preview Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {isConflict && (
              <button
                type="button"
                onClick={() => onCompareConflict(proposal)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <GitCompare className="w-3.5 h-3.5 text-rose-600" />
                <span>Compare Side-by-Side</span>
              </button>
            )}

            {isStale && (
              <button
                type="button"
                onClick={() => onReconcile(proposal.proposal_id)}
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconcile with Context</span>
              </button>
            )}

            {/* Preview on prototype toggle (for PIXEL / implementation proposals) */}
            {isImplementation && onTogglePreview && (
              <button
                type="button"
                onClick={() => onTogglePreview(proposal.proposal_id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer shadow-2xs ${
                  isPreviewing
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-teal-50 text-teal-700 border-teal-200'
                }`}
                title="Preview this proposal overlaid on the live prototype canvas without applying"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isPreviewing ? 'Stop Previewing' : 'Preview on prototype'}</span>
              </button>
            )}

            {/* Read PRD Button */}
            {isPrd && onOpenPrd && (
              <button
                type="button"
                onClick={() => onOpenPrd(proposal)}
                className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Read Full PRD</span>
              </button>
            )}
          </div>

          {/* Right Actions: Confirm / Approve / Redirect / Reject */}
          <div className="flex flex-wrap items-center gap-2">
            {isPending && !isConflict && !isStale && (
              <>
                {/* Reject Button */}
                <button
                  type="button"
                  onClick={() => onReject(proposal.proposal_id)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold transition cursor-pointer"
                >
                  Reject
                </button>

                {/* Redirect Button */}
                <button
                  type="button"
                  onClick={() => onRedirect(proposal)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#172033] border border-[#E7ECF2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Redirect agent with human feedback note"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-[#657189]" />
                  <span>Redirect</span>
                </button>

                {/* Confirm Requirements (for PRD) or Approve & Apply (for implementation) */}
                {isPrd && onConfirmRequirements ? (
                  <button
                    type="button"
                    disabled={!isCurrentAlex}
                    onClick={() => {
                      if (!isCurrentAlex) {
                        showToast('Only Alex (Founder / Decision Owner) can confirm product requirements.', 'error');
                        return;
                      }
                      onConfirmRequirements(proposal.proposal_id);
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
                      isCurrentAlex
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      isCurrentAlex
                        ? 'Confirm requirements and advance to implementation'
                        : 'Only Alex (Founder / Decision Owner) can confirm requirements'
                    }
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Requirements</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isRestrictedByAlex}
                    onClick={() => {
                      if (isRestrictedByAlex) {
                        showToast('Only Alex (Decision Owner) can approve high-impact proposals.', 'error');
                        return;
                      }
                      onApprove(proposal.proposal_id);
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition ${
                      isRestrictedByAlex
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                    }`}
                    title={
                      isRestrictedByAlex
                        ? 'Only Alex (Founder / Decision Owner) can approve high-impact proposals'
                        : 'Approve and apply atomically to the LedgerFlow prototype'
                    }
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isRestrictedByAlex ? 'Alex Approval Required' : 'Approve & Apply'}</span>
                  </button>
                )}
              </>
            )}

            {/* If Stale or Conflict: Approve is disabled */}
            {(isConflict || isStale) && (
              <>
                <button
                  type="button"
                  onClick={() => onReject(proposal.proposal_id)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold transition cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => onRedirect(proposal)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#172033] border border-[#E7ECF2] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Ask agent to revise proposal"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-[#657189]" />
                  <span>Ask Agent to Revise</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold cursor-not-allowed opacity-60"
                  title="Cannot approve stale or conflicted proposal. Please reconcile or ask agent to revise."
                >
                  Approve Disabled
                </button>
              </>
            )}

            {isApproved && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <Check className="w-3.5 h-3.5" />
                <span>Applied to Prototype</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {showProvenanceModal && (
        <ProposalProvenanceModal
          proposal={proposal}
          identity={identity}
          onClose={() => setShowProvenanceModal(false)}
        />
      )}
    </>
  );
};
