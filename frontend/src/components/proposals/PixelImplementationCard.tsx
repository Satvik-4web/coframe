import React, { useState } from 'react';
import {
  Code2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Layers,
  Check,
  X,
  CornerDownRight,
  GitCompare,
  AlertTriangle,
  Lock,
  Terminal,
} from 'lucide-react';
import { Proposal, HumanIdentity } from '../../types';

interface PixelImplementationCardProps {
  proposal: Proposal;
  identity: HumanIdentity;
  onOpenImplementation: (proposal: Proposal) => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onRedirect: (proposal: Proposal) => void;
  onCompareConflict?: (proposal: Proposal) => void;
  onOpenParentPrd?: (parentProposalId: string) => void;
  onChooseExecutionEnvironment?: (proposal: Proposal) => void;
}

export const PixelImplementationCard: React.FC<PixelImplementationCardProps> = ({
  proposal,
  identity,
  onOpenImplementation,
  onApprove,
  onReject,
  onRedirect,
  onCompareConflict,
  onOpenParentPrd,
  onChooseExecutionEnvironment,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const impl = proposal.implementation_data;
  const title = impl?.title || proposal.summary;
  const implSummary = impl?.implementation_summary?.what_implemented || proposal.summary;
  const sections = impl?.affected_sections || proposal.target_sections || ['hero'];
  const testResults = impl?.test_results;
  const novaReview = proposal.review_outcome || (proposal.reviewed_by ? 'PASS' : 'PASS');

  const isApproved = proposal.status === 'approved';
  const isRejected = proposal.status === 'rejected';
  const isStale = proposal.status === 'stale';
  const isConflict = proposal.status === 'conflict' || Boolean(proposal.is_conflicted);
  const isPending = proposal.status === 'pending_review' || isConflict;

  const isCurrentAlex = identity === 'alex';
  const isRestrictedByAlex = proposal.requires_decision && !isCurrentAlex;

  const timeStr = proposal.created_at
    ? new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`rounded-2xl border transition-all p-5 shadow-xs ${
        isConflict
          ? 'bg-white border-red-300 ring-2 ring-red-100/70'
          : isStale
          ? 'bg-white border-amber-300 ring-2 ring-amber-100/70'
          : isApproved
          ? 'bg-gradient-to-br from-white via-white to-teal-50/20 border-teal-200'
          : isRejected
          ? 'bg-slate-50 border-slate-200 opacity-75'
          : 'bg-white border-[#E2E8F0] hover:border-teal-300 hover:shadow-sm'
      }`}
    >
      {/* 1. Header: PIXEL Identity, Role, Implementation Tag, Review Outcome */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            <Code2 className="w-5 h-5 text-teal-100" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-xs text-[#172033] tracking-tight">PIXEL</span>
              <span className="text-[11px] text-[#657189] font-medium">AI Software Engineer</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider">
                Engineering Implementation
              </span>
              {proposal.supersedes_proposal_id && (
                onOpenParentPrd ? (
                  <button
                    type="button"
                    onClick={() => onOpenParentPrd(proposal.supersedes_proposal_id!)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition cursor-pointer"
                    title="Click to view originating NOVA PRD"
                  >
                    <span>Originating PRD:</span>
                    <span className="font-mono">#{proposal.supersedes_proposal_id.slice(-6)}</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    Originating PRD: #{proposal.supersedes_proposal_id.slice(-6)}
                  </span>
                )
              )}
            </div>
            <p className="text-[10px] text-[#657189] mt-0.5 font-mono">
              Task: {proposal.task_id || proposal.run_id || 'IMPL-01'} · Submitted {timeStr}
            </p>
          </div>
        </div>

        {/* Status & Review Outcome Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* NOVA Review Result */}
          <div
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-2xs ${
              novaReview === 'PASS'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : novaReview === 'WARNING'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
            title="NOVA Advisory Review against confirmed requirements"
          >
            <span>NOVA Review:</span>
            <span>{novaReview}</span>
          </div>

          {/* Proposal Status Badge */}
          {isApproved ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>APPLIED</span>
            </span>
          ) : isConflict ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-300">
              ⚡ CONFLICT
            </span>
          ) : isStale ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              ⚠️ STALE
            </span>
          ) : isRejected ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              REJECTED
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>READY FOR REVIEW</span>
            </span>
          )}

          {proposal.requires_decision && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Requires Alex</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Implementation Headline */}
      <h3 className="font-bold text-sm text-[#172033] mb-1.5 leading-snug">
        {title}
      </h3>

      {/* 3. Implementation Summary (Plain English) */}
      <p className="text-xs text-[#475569] mb-3 leading-relaxed">
        {implSummary}
      </p>

      {/* 4. Engineering Impact Strip: Changed Sections & Test Verification */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] mb-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
            Changed Sections:
          </span>
          {sections.map((sec) => (
            <span
              key={sec}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200"
            >
              § {sec}
            </span>
          ))}
        </div>

        {testResults && testResults.executed > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-[#657189]">Verification:</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{testResults.passed} Tests Passed ({Math.round((testResults.passed / testResults.executed) * 100)}%)</span>
            </span>
          </div>
        )}
      </div>

      {/* Stale / Conflict Callouts if active */}
      {isStale && (
        <div className="mb-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="leading-relaxed font-medium">{proposal.stale_reason || 'Underlying requirement dependencies changed since implementation was generated.'}</p>
        </div>
      )}

      {isConflict && (
        <div className="mb-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="leading-relaxed font-medium">{proposal.conflict_reason || 'Maya concurrently edited this section. Reconcile changes side-by-side.'}</p>
        </div>
      )}

      {/* 5. Collapsible Technical Details (Raw JSON hidden from primary view) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-xs font-medium text-[#657189] hover:text-[#172033] py-1 transition cursor-pointer"
        >
          <span className="text-[11px]">
            {showTechnicalDetails ? 'Hide Technical Details' : 'Technical Details → View Raw Proposal JSON'}
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 space-y-2 text-xs bg-[#F8FAFC] p-3 rounded-xl border border-[#E7ECF2]">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#657189]">
              <span>Context: <strong>v{proposal.base_context_version}</strong></span>
              <span>•</span>
              <span>Artifact: <strong>v{proposal.base_artifact_version}</strong></span>
              <span>•</span>
              <span>Target: <strong>{sections.join(', ')}</strong></span>
            </div>
            <pre className="font-mono text-[10px] text-[#172033] bg-white p-2.5 rounded-lg border border-[#E7ECF2] overflow-x-auto max-h-48">
              {JSON.stringify(proposal.changes || proposal, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 6. Review Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F0F3F7]">
        {/* Left Side: Conflict Comparison if conflicted */}
        <div>
          {isConflict && onCompareConflict && (
            <button
              type="button"
              onClick={() => onCompareConflict(proposal)}
              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-red-600" />
              <span>Compare Side-by-Side Conflict</span>
            </button>
          )}
        </div>

        {/* Right Side: Primary Review Button & Decisions */}
        <div className="flex flex-wrap items-center gap-2">
                    {/* Choose Execution Environment */}
          {onChooseExecutionEnvironment && (
            <button
              type="button"
              onClick={() => onChooseExecutionEnvironment(proposal)}
              className="px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Choose execution environment (Connected Agent IDE or Built-in PIXEL)"
            >
              <Terminal className="w-3.5 h-3.5 text-violet-600" />
              <span>Choose Execution Env</span>
            </button>
          )}

          {/* Primary Action: Review Implementation */}
          <button
            type="button"
            onClick={() => onOpenImplementation(proposal)}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Review Implementation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Secondary Actions: Reject / Redirect / Approve */}
          {isPending && (
            <>
              <button
                type="button"
                onClick={() => onRedirect(proposal)}
                className="px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 text-[#475569] border border-[#E7ECF2] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title="Send redirection instructions to PIXEL"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>Redirect</span>
              </button>

              <button
                type="button"
                onClick={() => onReject(proposal.proposal_id)}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>

              <button
                type="button"
                disabled={isRestrictedByAlex || isConflict}
                onClick={() => onApprove(proposal.proposal_id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  isRestrictedByAlex
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                }`}
                title={isConflict ? 'Approval strictly blocked: Proposal conflicts with canonical canvas' : isRestrictedByAlex ? 'High-impact policy change requires Alex authorization' : 'Approve implementation and apply to canvas'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve & Apply</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
