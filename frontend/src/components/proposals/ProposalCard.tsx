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
            ? 'bg-white border-red-300 ring-2 ring-red-100/70 shadow-xs'
            : proposal.status === 'stale'
            ? 'bg-white border-amber-300 ring-2 ring-amber-100/70 shadow-xs'
            : proposal.status === 'approved'
            ? 'bg-emerald-50/20 border-emerald-200'
            : proposal.status === 'rejected'
            ? 'bg-[#F8FAFC] border-slate-200 opacity-75'
            : 'bg-white border-[#E7ECF2] hover:border-slate-300 hover:shadow-xs'
        }`}
      >
        {/* 1. Header: Author Identity, Role, Badges & Contribution Label */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center space-x-3">
            {/* Visual Avatar with established colors */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
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
              ) : isAlex || isMaya ? (
                <User className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
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

                {/* Contribution badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isNova
                      ? 'bg-violet-50 text-violet-700 border-violet-200'
                      : isPixel
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : isAlex
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : isMaya
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {authorLabel}
                </span>

                {proposal.supersedes_proposal_id && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    revised from #{proposal.supersedes_proposal_id.slice(-6)}
                  </span>
                )}
              </div>

              {/* Subtitle with Author and Originating Task ID */}
              <p className="text-[10px] text-[#657189] mt-0.5 font-mono">
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
                  ? 'bg-violet-50 text-violet-800 border-violet-300'
                  : contributionType === 'IMPLEMENTATION'
                  ? 'bg-teal-50 text-teal-800 border-teal-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}
            >
              {contributionType}
            </span>

            {proposal.status === 'pending_review' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Needs Review
              </span>
            )}
            {proposal.status === 'stale' && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                ⚠️ STALE
              </span>
            )}
            {proposal.status === 'conflict' && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-300">
                ⚡ CONFLICT
              </span>
            )}
            {proposal.status === 'approved' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3" /> Approved
              </span>
            )}
            {proposal.status === 'rejected' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Rejected
              </span>
            )}
            {proposal.status === 'superseded' && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Superseded
              </span>
            )}

            {/* High Impact Alex Decision Badge */}
            {proposal.requires_decision && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 flex items-center space-x-1">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Requires Alex Approval</span>
              </span>
            )}

            {/* Prune Seatbelt Signed Receipt Badge */}
            {proposal.prune_metadata ? (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1 cursor-pointer hover:bg-emerald-100 transition"
                title={`Ed25519 Signed Receipt: ${proposal.prune_metadata.receipt_id}\nTokens: ${proposal.prune_metadata.tokens_prompt + proposal.prune_metadata.tokens_completion}\nCost: $${proposal.prune_metadata.cost_usd.toFixed(6)}\nSignature: ${proposal.prune_metadata.ed25519_signature.slice(0, 24)}...`}
              >
                <span>🛡️</span>
                <span>{proposal.prune_metadata.cache_hit ? 'Prune Cached ($0)' : 'Prune Signed'}</span>
                <span className="text-[9px] text-emerald-600">✓ Ed25519</span>
              </span>
            ) : (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-50/50 text-emerald-700 border-emerald-200 flex items-center gap-1"
                title="Protected by Prune Gateway Seatbelt"
              >
                <span>🛡️</span>
                <span>Prune Guarded</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Proposal Summary */}
        <h3 className="font-bold text-sm text-[#172033] mb-1.5 leading-snug">
          {proposal.summary}
        </h3>

        {/* Plain Language Rationale */}
        <p className="text-xs text-[#657189] mb-3 leading-relaxed">
          {proposal.reasoning}
        </p>

        {/* Contribution Provenance Strip: Reviewer & Decision Owner */}
        <div className="mb-3.5 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {reviewer ? (
              <div className="flex items-center space-x-1.5 text-slate-700 font-medium text-[11px]">
                <span className="text-[#657189]">Reviewed by:</span>
                <span className="font-bold text-violet-700">{reviewer}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    reviewOutcome === 'PASS'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {reviewOutcome || 'PASS'}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#657189]">
                Review: <span className="text-slate-700 font-medium">Direct Submission</span>
              </div>
            )}

            <span className="text-[#657189] hidden sm:inline">•</span>

            <div className="flex items-center space-x-1 text-[11px] text-[#657189]">
              <span>Decision required from:</span>
              <strong className="text-blue-700 uppercase font-bold">{decisionOwner}</strong>
            </div>
          </div>

          <button
            onClick={() => setShowProvenanceModal(true)}
            className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center space-x-1 hover:underline cursor-pointer ml-auto"
          >
            <span>View Details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* High-Impact Governance Callout when required */}
        {proposal.requires_decision && (
          <div className="mb-3.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              This decision needs <strong>Alex's approval</strong> because it modifies an important product policy threshold.
            </p>
          </div>
        )}

        {/* 3. Plain Language Stale or Conflict Callout */}
        {proposal.status === 'stale' && (
          <div className="mb-3.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Outdated Requirement Dependency</span>
            </div>
            <p className="leading-relaxed text-amber-800 font-medium">{proposal.stale_reason}</p>
          </div>
        )}

        {proposal.status === 'conflict' && (
          <div className="mb-3.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Section Version Conflict with Human Edit</span>
            </div>
            <p className="leading-relaxed text-red-800 font-medium">{proposal.conflict_reason}</p>
          </div>
        )}

        {/* 4. Target Sections & Affected Dependencies Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <span className="text-[11px] font-medium text-[#657189]">Targets:</span>
          {proposal.target_sections.map((sec) => (
            <span
              key={sec}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200"
            >
              § {sec}
            </span>
          ))}
          {proposal.affected_requirements.length > 0 && (
            <>
              <span className="text-[11px] font-medium text-[#657189] ml-1.5">Dependencies:</span>
              {proposal.affected_requirements.map((req) => (
                <span
                  key={req}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#F8FAFC] text-[#172033] border border-[#E7ECF2]"
                >
                  {req}
                </span>
              ))}
            </>
          )}
        </div>

        {/* 5. Collapsible Provenance & Technical Details */}
        <div className="border-t border-[#F0F3F7] pt-2 mb-3">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center justify-between w-full text-xs font-medium text-[#657189] hover:text-[#172033] py-1 transition cursor-pointer"
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
            <div className="mt-3 space-y-2.5 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E7ECF2]">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#657189]">
                <span>
                  Base Context: <strong className="text-blue-700">v{proposal.base_context_version}</strong>
                </span>
                <span>•</span>
                <span>
                  Base Artifact: <strong className="text-emerald-700">v{proposal.base_artifact_version}</strong>
                </span>
                <span>•</span>
                <span>
                  Section Versions:{' '}
                  <strong className="text-[#172033]">
                    {sectionVersionsStr || targetSectionsStr}
                  </strong>
                </span>
              </div>

              <div className="font-mono text-[11px] text-[#172033] bg-white p-3 rounded-lg border border-[#E7ECF2] overflow-x-auto">
                <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1 font-sans">
                  Proposed Operations (JSON Allowlist)
                </span>
                <pre>{JSON.stringify(proposal.changes, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        {/* 6. Review Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#F0F3F7]">
          {/* Left Side: Conflict Comparison or Reconcile Button */}
          <div>
            {proposal.status === 'conflict' && (
              <button
                onClick={() => onCompareConflict(proposal)}
                className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5 text-red-600" />
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
          </div>

          {/* Right Side: Approval / Redirect / Reject or GitHub Publishing */}
          {proposal.status === 'approved' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
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
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold transition cursor-pointer"
              >
                Reject
              </button>

              <button
                onClick={() => onRedirect(proposal)}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#172033] border border-[#E7ECF2] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-[#657189]" />
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
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
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
