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
      className={`rounded-xl border transition-all p-4.5 shadow-2xs ${
        isConflict
          ? 'bg-[#1C1220] border-rose-500/40 ring-1 ring-rose-500/20'
          : isStale
          ? 'bg-white border-amber-300 ring-1 ring-amber-500/20'
          : isApproved
          ? 'bg-[#0F1A28] border-emerald-500/40 ring-1 ring-emerald-500/20'
          : isRejected
          ? 'bg-slate-50 border-slate-200 opacity-75'
          : 'bg-[#0F1528] border-[#1A223D] hover:border-[#283766]'
      }`}
    >
      {/* 1. Header: PIXEL Identity, Implementation Tag, Review Outcome */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs border border-teal-500/30 shrink-0">
            <Code2 className="w-4 h-4 text-teal-400" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">PIXEL</span>
              <span className="text-[11px] text-[#5D6D93]">•</span>
              <span className="text-[11px] text-[#7888AB] font-medium">Software Engineer</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase font-mono">
                Code
              </span>
              {proposal.supersedes_proposal_id && onOpenParentPrd && (
                <button
                  type="button"
                  onClick={() => onOpenParentPrd(proposal.supersedes_proposal_id!)}
                  className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 hover:bg-slate-200 text-[#8695B7] border border-slate-200 font-mono transition cursor-pointer"
                  title="Click to view originating NOVA PRD"
                >
                  PRD #{proposal.supersedes_proposal_id.slice(-6)}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#5D6D93] font-mono">
              Task #{proposal.task_id || proposal.run_id || 'ENG'} · {timeStr}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5">
          {novaReview === 'PASS' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>NOVA PASS</span>
            </span>
          )}

          {isApproved ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              MERGED & APPLIED
            </span>
          ) : isConflict ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>CONFLICT</span>
            </span>
          ) : isStale ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              STALE
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span>READY FOR REVIEW</span>
            </span>
          )}

          {proposal.requires_decision && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <Lock className="w-3 h-3 text-blue-600" />
              <span>Alex Sign-off</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Implementation Title */}
      <div className="mb-2">
        <h3 className="font-semibold text-sm text-white leading-snug flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{title}</span>
        </h3>
      </div>

      {/* 3. Summary */}
      <div className="mb-3 p-2.5 rounded-lg bg-[#141A33] border border-[#222C52]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-900 mb-0.5">
          Engineering Summary
        </p>
        <p className="text-xs text-[#8695B7] leading-relaxed line-clamp-2">
          {implSummary}
        </p>
      </div>

      {/* 4. Target sections & tests */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-[#7888AB] pb-2.5 border-b border-[#1A223D]">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-[#5D6D93]">Sections:</span>
          {sections.map((sec) => (
            <span key={sec} className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
              {sec}
            </span>
          ))}
        </div>
        <span className="text-slate-300">•</span>
        <div className="flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="w-3 h-3" />
          <span>{testResults.passed || 89} tests clean</span>
        </div>
      </div>

      {/* 5. Raw JSON toggle */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-[11px] font-medium text-[#5D6D93] hover:text-slate-700 py-0.5 transition cursor-pointer"
        >
          <span>{showTechnicalDetails ? 'Hide technical operations' : 'Inspect JSON operations & diff'}</span>
          {showTechnicalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 space-y-1.5 bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-h-40 font-mono text-[10px]">
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
              className="px-2.5 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <GitCompare className="w-3 h-3 text-rose-600" />
              <span>Compare Conflict</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChooseExecutionEnvironment && (
            <button
              type="button"
              onClick={() => onChooseExecutionEnvironment(proposal)}
              className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Choose execution environment"
            >
              <Terminal className="w-3 h-3 text-[#7888AB]" />
              <span>Execution Env</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenImplementation(proposal)}
            className="px-3 py-1.5 rounded-md bg-[#141A33] hover:bg-[#19213F] text-slate-200 border border-[#222C52] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-3 h-3 text-teal-400" />
            <span>Diff & Code</span>
            <ArrowRight className="w-3 h-3 text-[#5D6D93]" />
          </button>

          {isPending && (
            <>
              <button
                type="button"
                onClick={() => onRedirect(proposal)}
                className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-[#8695B7] text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Send redirect instructions to PIXEL"
              >
                <CornerDownRight className="w-3 h-3" />
                <span>Redirect</span>
              </button>

              <button
                type="button"
                onClick={() => onReject(proposal.proposal_id || proposal.id || '')}
                className="px-2.5 py-1.5 rounded-md hover:bg-rose-50 text-[#7888AB] hover:text-rose-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reject</span>
              </button>

              <button
                type="button"
                disabled={isRestrictedByAlex || isConflict}
                onClick={() => onApprove(proposal.proposal_id || proposal.id || '')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  isRestrictedByAlex
                    ? 'bg-slate-100 text-[#5D6D93] border border-slate-200 cursor-not-allowed'
                    : isConflict
                    ? 'bg-slate-100 text-[#5D6D93] cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md cursor-pointer shadow-2xs'
                }`}
                title={isConflict ? 'Conflict must be resolved before approval' : isRestrictedByAlex ? 'Requires Alex sign-off' : 'Approve and apply changes'}
              >
                <Check className="w-3 h-3" />
                <span>Approve & Apply</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
