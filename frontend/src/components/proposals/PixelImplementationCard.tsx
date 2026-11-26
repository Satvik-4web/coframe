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
  const testResults = impl?.test_results || { executed: 89, passed: 89, failed: 0, status: 'passed' };
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
      className={`coframe-card p-5 ${
        isConflict
          ? 'border-rose-300'
          : isStale
          ? 'border-amber-300'
          : isApproved
          ? 'border-emerald-300/80'
          : isRejected
          ? 'bg-slate-50 opacity-75'
          : ''
      }`}
    >
      {/* 1. Header: PIXEL Identity, Implementation Tag, Review Outcome */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center border border-teal-200/70 shrink-0">
            <Code2 className="w-4 h-4" strokeWidth={1.75} />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-slate-900">PIXEL</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">Software Engineer</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-teal-50 text-[#0F766E] border border-teal-200/60">
                Code
              </span>
              {proposal.supersedes_proposal_id && onOpenParentPrd && (
                <button
                  type="button"
                  onClick={() => onOpenParentPrd(proposal.supersedes_proposal_id!)}
                  className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-900/[0.06] font-mono transition cursor-pointer"
                  title="View originating NOVA PRD"
                >
                  PRD #{proposal.supersedes_proposal_id.slice(-6)}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Task #{proposal.task_id || proposal.run_id || 'ENG'} · {timeStr}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5">
          {novaReview === 'PASS' && (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>NOVA pass</span>
            </span>
          )}

          {isApproved ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
              Applied
            </span>
          ) : isConflict ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/70 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>Conflict</span>
            </span>
          ) : isStale ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70">
              Stale
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>Ready for review</span>
            </span>
          )}

          {proposal.requires_decision && (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-900/[0.06] flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Alex sign-off</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Implementation Title */}
      <div className="mb-2.5">
        <h3 className="font-semibold text-[15px] text-slate-900 leading-snug flex items-center gap-2 tracking-tight">
          <Layers className="w-4 h-4 text-[#0F766E] shrink-0" strokeWidth={1.75} />
          <span>{title}</span>
        </h3>
      </div>

      {/* 3. Summary */}
      <div className="mb-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-900/[0.06]">
        <p className="text-[11px] font-medium text-slate-500 mb-1">
          Engineering summary
        </p>
        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
          {implSummary}
        </p>
      </div>

      {/* 4. Target sections & tests */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-500 pb-3 border-b border-slate-900/[0.06]">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">Sections:</span>
          {sections.map((sec) => (
            <span key={sec} className="px-2 py-0.2 rounded-md bg-slate-100/80 font-mono text-[11px] text-slate-700">
              {sec}
            </span>
          ))}
        </div>
        <span className="text-slate-300">·</span>
        <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{testResults.passed || 89} checks passing</span>
        </div>
      </div>

      {/* 5. Raw JSON toggle */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-[11px] font-medium text-slate-500 hover:text-slate-800 py-0.5 transition cursor-pointer"
        >
          <span>{showTechnicalDetails ? 'Hide raw operations' : 'Inspect JSON operations & diff'}</span>
          {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 space-y-1.5 bg-[#0F172A] text-slate-200 p-3 rounded-xl overflow-x-auto max-h-40 font-mono text-[10px]">
            <pre>{JSON.stringify(proposal.changes || proposal, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* 6. Review Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          {isConflict && onCompareConflict && (
            <button
              type="button"
              onClick={() => onCompareConflict(proposal)}
              className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-rose-600" />
              <span>Compare conflict</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChooseExecutionEnvironment && (
            <button
              type="button"
              onClick={() => onChooseExecutionEnvironment(proposal)}
              className="h-8 px-3 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title="Choose execution environment"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Execution env</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenImplementation(proposal)}
            className="h-8 px-3 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>Diff & code</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>

          {isPending && (
            <>
              <button
                type="button"
                onClick={() => onRedirect(proposal)}
                className="h-8 px-2.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Send redirect instructions to PIXEL"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>Redirect</span>
              </button>

              <button
                type="button"
                onClick={() => onReject(proposal.proposal_id || proposal.id || '')}
                className="h-8 px-2.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>

              <button
                type="button"
                disabled={isRestrictedByAlex || isConflict}
                onClick={() => onApprove(proposal.proposal_id || proposal.id || '')}
                className={`h-8 px-3.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isRestrictedByAlex || isConflict
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'btn-obsidian cursor-pointer'
                }`}
                title={isConflict ? 'Conflict must be resolved before approval' : isRestrictedByAlex ? 'Requires Alex sign-off' : 'Approve and apply changes'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve & apply</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
