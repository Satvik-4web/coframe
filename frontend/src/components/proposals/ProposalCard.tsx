import React, { useState } from 'react';
import { Proposal, HumanIdentity } from '../../types';
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
  Cpu,
  GitPullRequest,
  Layers,
  ArrowRight,
  FileCode,
  CheckCircle2,
  Brain,
  Code2,
  User,
  HelpCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface ProposalCardProps {
  proposal: Proposal;
  identity: HumanIdentity;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRedirect: (proposal: Proposal) => void;
  onReconcile: (id: string) => void;
  onCompareConflict: (proposal: Proposal) => void;
  onPublishToGitHub?: (proposalId: string) => void;
  onReverify?: (id: string) => void;
  isReverifying?: boolean;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  identity,
  onApprove,
  onReject,
  onRedirect,
  onReconcile,
  onCompareConflict,
  onPublishToGitHub,
  onReverify,
  isReverifying = false,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);

  // Author identity resolution
  const authorName = proposal.author || (proposal.agent_id ? proposal.agent_id.toUpperCase() : 'Legacy / Unknown author');
  const authorLower = (proposal.created_by || proposal.agent_id || '').toLowerCase();
  const isNova = authorLower === 'nova';
  const isPixel = authorLower === 'pixel';
  const isAlex = authorLower === 'alex';
  const isMaya = authorLower === 'maya';
  const isLegacy = authorName.includes('Legacy') || authorName.includes('Unknown');

  // Role resolution
  let authorRole = proposal.author_role;
  if (!authorRole) {
    if (isNova) authorRole = 'AI Product Strategist';
    else if (isPixel) authorRole = 'AI Software Engineer';
    else if (isAlex) authorRole = 'Founder / Decision Owner';
    else if (isMaya) authorRole = 'Product Designer';
    else if (isLegacy) authorRole = 'Unspecified Origin';
    else authorRole = 'Contributor';
  }

  // Contribution type & labels
  const contributionType = proposal.contribution_type || (
    isNova ? 'PRODUCT REQUIREMENTS' : isPixel ? 'IMPLEMENTATION' : 'HUMAN CONTRIBUTION'
  );
  const authorLabel = proposal.author_label || (
    isNova ? 'NOVA · PRD' : isPixel ? 'PIXEL · Implementation' : 'Human Contribution'
  );

  // Reviewer and Decision Owner resolution
  const reviewer = proposal.reviewed_by || (isPixel ? 'NOVA' : null);
  const reviewOutcome = proposal.review_outcome || (reviewer ? 'PASS' : null);
  const decisionOwner = proposal.assigned_decider_id ? proposal.assigned_decider_id.toUpperCase() : 'ALEX';

  const isCurrentAlex = identity === 'alex';
  const isRestrictedByAlex = proposal.requires_decision && !isCurrentAlex;

  const targetSectionsStr = proposal.target_sections.join(', ');
  const baseSectionEntries = Object.entries(proposal.base_section_versions || {});
  const sectionVersionsStr = baseSectionEntries.map(([k, v]) => `${k}: v${v}`).join(', ');

  return (
    <>
      <div
        className={`rounded-xl border transition-all p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${
          proposal.status === 'conflict'
            ? 'bg-[#1A202C] border-red-300 ring-2 ring-red-100/70 shadow-xs'
            : proposal.status === 'stale'
            ? 'bg-[#1A202C] border-amber-300 ring-2 ring-amber-100/70 shadow-xs'
            : proposal.status === 'approved'
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : proposal.status === 'rejected'
            ? 'bg-[#141A24] border-[#303A4B] opacity-75'
            : 'bg-[#1A202C] border-[#303A4B] hover:border-[#303A4B] hover:shadow-xs'
        }`}
      >
        {/* 1. Header: Author Identity, Role, Badges & Contribution Label */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center space-x-3">
            {/* Visual Avatar with established colors */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                isNova
                  ? 'bg-violet-500/10 text-violet-300 border border-violet-500/25'
                  : isPixel
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/25'
                  : isAlex
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/25'
                  : isMaya
                  ? 'bg-purple-500/10 text-purple-300 border border-purple-500/25'
                  : 'bg-[#1D2633] text-[#ACBAD0] border border-[#303A4B]'
              }`}
            >
              {isNova ? (
                <Brain className="w-5 h-5 text-violet-300" />
              ) : isPixel ? (
                <Code2 className="w-5 h-5 text-teal-300" />
              ) : isAlex || isMaya ? (
                <User className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-[#E7EDF7] tracking-tight">
                  {authorName}
                </span>
                <span className="text-[11px] text-[#A3B0C4] font-medium">
                  {authorRole}
                </span>

                {/* Contribution badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isNova
                      ? 'bg-violet-500/10 text-violet-300 border-violet-500/25'
                      : isPixel
                      ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
                      : isAlex
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                      : isMaya
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                      : 'bg-[#1D2633] text-[#ACBAD0] border-[#303A4B]'
                  }`}
                >
                  {authorLabel}
                </span>

                {proposal.supersedes_proposal_id && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/25">
                    revised from #{proposal.supersedes_proposal_id.slice(-6)}
                  </span>
                )}
              </div>

              {/* Subtitle with Author and Originating Task ID */}
              <p className="text-[10px] text-[#A3B0C4] mt-0.5 font-mono">
                Submitted by {authorName} · Task {proposal.task_id || proposal.run_id || 'T-001'} ·{' '}
                {new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Status & Contribution Type Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Contribution Type Pill */}
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                contributionType === 'PRODUCT REQUIREMENTS'
                  ? 'bg-violet-500/10 text-violet-300 border-violet-300'
                  : contributionType === 'IMPLEMENTATION'
                  ? 'bg-teal-500/10 text-teal-300 border-teal-300'
                  : 'bg-blue-500/10 text-blue-300 border-blue-300'
              }`}
            >
              {contributionType}
            </span>

            {proposal.status === 'pending_review' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Needs Review
              </span>
            )}
            {proposal.status === 'stale' && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-300">
                ⚠️ STALE
              </span>
            )}
            {proposal.status === 'conflict' && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-300">
                ⚡ CONFLICT
              </span>
            )}
            {proposal.status === 'approved' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3" /> Approved
              </span>
            )}
            {proposal.status === 'rejected' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1D2633] text-[#ACBAD0] border border-[#303A4B]">
                Rejected
              </span>
            )}
            {proposal.status === 'superseded' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1D2633] text-[#ACBAD0] border border-[#303A4B]">
                Superseded
              </span>
            )}

            {/* High Impact Alex Decision Badge */}
            {proposal.requires_decision && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-300 flex items-center space-x-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Requires Alex Approval</span>
              </span>
            )}

            {/* Prune Seatbelt Signed Receipt Badge */}
            {proposal.prune_metadata ? (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-300 flex items-center gap-1 cursor-pointer hover:bg-emerald-500/10 transition"
                title={`Ed25519 Signed Receipt: ${proposal.prune_metadata.receipt_id}\nTokens: ${proposal.prune_metadata.tokens_prompt + proposal.prune_metadata.tokens_completion}\nCost: $${proposal.prune_metadata.cost_usd.toFixed(6)}\nSignature: ${proposal.prune_metadata.ed25519_signature.slice(0, 24)}...`}
              >
                <span>🛡️</span>
                <span>{proposal.prune_metadata.cache_hit ? 'Prune Cached ($0)' : 'Prune Signed'}</span>
                <span className="text-[9px] text-emerald-400">✓ Ed25519</span>
              </span>
            ) : (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/25 flex items-center gap-1"
                title="Protected by Prune Gateway Seatbelt"
              >
                <span>🛡️</span>
                <span>Prune Guarded</span>
              </span>
            )}

            {/* NOVA Re-Verification Status Badge */}
            {proposal.nova_review && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  proposal.nova_review.review_status === 'AFFECTED'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-300'
                    : proposal.nova_review.review_status === 'NOT_AFFECTED'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-300'
                    : proposal.nova_review.review_status === 'REVIEW_FAILED'
                    ? 'bg-red-500/10 text-red-300 border-red-300'
                    : 'bg-[#1D2633] text-[#C6D2E4] border-[#303A4B]'
                }`}
                title={`NOVA Review: ${proposal.nova_review.impact_explanation}`}
              >
                <Brain className="w-3 h-3" />
                <span>NOVA: {proposal.nova_review.review_status.replace('_', ' ')}</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Proposal Summary */}
        <h3 className="font-bold text-sm text-[#E7EDF7] mb-1.5 leading-snug">
          {proposal.summary}
        </h3>

        {/* Plain Language Rationale */}
        <p className="text-xs text-[#A3B0C4] mb-3 leading-relaxed">
          {proposal.reasoning}
        </p>

        {/* Contribution Provenance Strip: Reviewer & Decision Owner */}
        <div className="mb-3.5 p-2.5 rounded-xl bg-[#141A24] border border-[#303A4B] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {reviewer ? (
              <div className="flex items-center space-x-1.5 text-[#C6D2E4] font-medium text-[11px]">
                <span className="text-[#A3B0C4]">Reviewed by:</span>
                <span className="font-bold text-violet-300">{reviewer}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    reviewOutcome === 'PASS'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                  }`}
                >
                  {reviewOutcome || 'PASS'}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#A3B0C4]">
                Review: <span className="text-[#C6D2E4] font-medium">Direct Submission</span>
              </div>
            )}

            <span className="text-[#A3B0C4] hidden sm:inline">•</span>

            <div className="flex items-center space-x-1 text-[11px] text-[#A3B0C4]">
              <span>Decision required from:</span>
              <strong className="text-blue-300 uppercase font-bold">{decisionOwner}</strong>
            </div>
          </div>

          <button
            onClick={() => setShowProvenanceModal(true)}
            className="text-[11px] font-semibold text-teal-300 hover:text-teal-300 flex items-center space-x-1 hover:underline cursor-pointer ml-auto"
          >
            <span>View Details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* High-Impact Governance Callout when required */}
        {proposal.requires_decision && (
          <div className="mb-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              This decision needs <strong>Alex's approval</strong> because it modifies an important product policy threshold.
            </p>
          </div>
        )}

        {/* 3. Plain Language Stale or Conflict Callout */}
        {proposal.status === 'stale' && (
          <div className="mb-3.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Outdated Requirement Dependency</span>
            </div>
            <p className="leading-relaxed text-amber-300 font-medium">{proposal.stale_reason}</p>
          </div>
        )}

        {proposal.status === 'conflict' && (
          <div className="mb-3.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Section Version Conflict with Human Edit</span>
            </div>
            <p className="leading-relaxed text-red-300 font-medium">{proposal.conflict_reason}</p>
          </div>
        )}

        {/* NOVA Independent Re-Verification Callout */}
        {proposal.nova_review && (
          <div
            className={`mb-3.5 p-3.5 rounded-xl border text-xs space-y-2 ${
              proposal.nova_review.review_status === 'AFFECTED'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                : proposal.nova_review.review_status === 'NOT_AFFECTED'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : proposal.nova_review.review_status === 'REVIEW_FAILED'
                ? 'bg-red-500/10 border-red-500/25 text-red-300'
                : 'bg-[#141A24] border-[#303A4B] text-[#DCE5F2]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold">
                <Brain className="w-4 h-4" />
                <span>NOVA Independent Re-Verification</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  proposal.nova_review.review_status === 'AFFECTED'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-300'
                    : proposal.nova_review.review_status === 'NOT_AFFECTED'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-300'
                    : proposal.nova_review.review_status === 'REVIEW_FAILED'
                    ? 'bg-red-500/10 text-red-300 border-red-300'
                    : 'bg-[#303D50] text-[#C6D2E4] border-[#303A4B]'
                }`}
              >
                {proposal.nova_review.review_status.replace('_', ' ')}
              </span>
            </div>

            <p className="leading-relaxed font-medium">{proposal.nova_review.impact_explanation}</p>

            {proposal.nova_review.missing_dependencies.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-[11px]">Missing deps detected:</span>
                {proposal.nova_review.missing_dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-300"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-current/10">
              <span className="text-[10px] font-semibold">
                Recommended: <strong>{proposal.nova_review.recommended_action.replace('_', ' ')}</strong>
              </span>
              <span className="text-[10px] font-medium">
                Confidence: {(proposal.nova_review.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* 4. Target Sections & Affected Dependencies Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <span className="text-[11px] font-medium text-[#A3B0C4]">Targets:</span>
          {proposal.target_sections.map((sec) => (
            <span
              key={sec}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/25"
            >
              § {sec}
            </span>
          ))}
          {proposal.affected_requirements.length > 0 && (
            <>
              <span className="text-[11px] font-medium text-[#A3B0C4] ml-1.5">Dependencies:</span>
              {proposal.affected_requirements.map((req) => (
                <span
                  key={req}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#141A24] text-[#E7EDF7] border border-[#303A4B]"
                >
                  {req}
                </span>
              ))}
            </>
          )}
        </div>

        {/* 5. Collapsible Provenance & Technical Details */}
        <div className="border-t border-[#293445] pt-2 mb-3">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center justify-between w-full text-xs font-medium text-[#A3B0C4] hover:text-[#E7EDF7] py-1 transition cursor-pointer"
          >
            <span>
              {showTechnicalDetails
                ? 'Hide context and version details'
                : 'Show context and version details (technical provenance)'}
            </span>
            {showTechnicalDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showTechnicalDetails && (
            <div className="mt-3 space-y-2.5 text-xs bg-[#141A24] p-3.5 rounded-xl border border-[#303A4B]">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#A3B0C4]">
                <span>
                  Base Context: <strong className="text-blue-300">v{proposal.base_context_version}</strong>
                </span>
                <span>•</span>
                <span>
                  Base Artifact: <strong className="text-emerald-300">v{proposal.base_artifact_version}</strong>
                </span>
                <span>•</span>
                <span>
                  Section Versions:{' '}
                  <strong className="text-[#E7EDF7]">
                    {sectionVersionsStr || targetSectionsStr}
                  </strong>
                </span>
              </div>

              <div className="font-mono text-[11px] text-[#E7EDF7] bg-[#1A202C] p-3 rounded-lg border border-[#303A4B] overflow-x-auto">
                <span className="text-[10px] uppercase font-bold text-[#A3B0C4] block mb-1 font-sans">
                  Proposed Operations (JSON Allowlist)
                </span>
                <pre>{JSON.stringify(proposal.changes, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        {/* 6. Review Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#293445]">
          {/* Left Side: Conflict Comparison or Reconcile Button */}
          <div className="flex items-center gap-2">
            {proposal.status === 'conflict' && (
              <button
                onClick={() => onCompareConflict(proposal)}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/10 text-red-300 border border-red-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5 text-red-400" />
                <span>Compare Side-by-Side Conflict</span>
              </button>
            )}

            {proposal.status === 'stale' && (
              <button
                onClick={() => onReconcile(proposal.proposal_id)}
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconcile with Enterprise Context</span>
              </button>
            )}
            {/* NOVA Re-verify button: visible on stale or pending_review proposals */}
            {(proposal.status === 'stale' || proposal.status === 'pending_review') && onReverify && (
              <button
                onClick={() => onReverify(proposal.proposal_id)}
                disabled={isReverifying}
                title="Ask NOVA to independently re-verify this proposal's dependencies against current requirements"
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
                  isReverifying
                    ? 'bg-[#1D2633] text-[#8495AD] border-[#303A4B] cursor-not-allowed'
                    : 'bg-violet-500/10 hover:bg-violet-500/10 text-violet-300 border-violet-300 cursor-pointer'
                }`}
              >
                {isReverifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>NOVA Reviewing…</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5" />
                    <span>NOVA Re-verify</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right Side: Approval / Redirect / Reject or GitHub Publishing */}
          {proposal.status === 'approved' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-emerald-300 font-semibold flex items-center space-x-1 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/25">
                <Check className="w-3.5 h-3.5" />
                <span>Applied to Artifact</span>
              </span>
              {onPublishToGitHub && (
                <button
                  onClick={() => onPublishToGitHub(proposal.proposal_id)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Publish to GitHub</span>
                </button>
              )}
            </div>
          )}

          {proposal.status === 'pending_review' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onReject(proposal.proposal_id)}
                className="px-3.5 py-1.5 rounded-xl bg-[#1A202C] hover:bg-rose-500/10 text-rose-400 border border-rose-500/25 text-xs font-semibold transition cursor-pointer"
              >
                Reject
              </button>

              <button
                onClick={() => onRedirect(proposal)}
                className="px-3.5 py-1.5 rounded-xl bg-[#1A202C] hover:bg-[#141A24] text-[#E7EDF7] border border-[#303A4B] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-[#A3B0C4]" />
                <span>Redirect</span>
              </button>

              <button
                onClick={() => onApprove(proposal.proposal_id)}
                disabled={isRestrictedByAlex}
                title={
                  isRestrictedByAlex
                    ? 'High-impact decision: Only Alex (Founder) can approve this proposal.'
                    : 'Approve and apply atomically to the LedgerFlow artifact'
                }
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition ${
                  isRestrictedByAlex
                    ? 'bg-[#1D2633] text-[#8495AD] border border-[#303A4B] cursor-not-allowed'
                    : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isRestrictedByAlex ? 'Alex Approval Required' : 'Approve & Apply'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Provenance Detail Modal */}
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
