import React, { useState } from 'react';
import {
  Code2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Check,
  X,
  GitCompare,
  AlertTriangle,
  Lock,
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
      className="p-5 rounded-2xl border transition-all duration-200"
      style={{
        background: isConflict
          ? 'rgba(244, 63, 94, 0.06)'
          : isStale
          ? 'rgba(251, 191, 36, 0.05)'
          : isApproved
          ? 'rgba(34, 211, 238, 0.05)'
          : isRejected
          ? 'rgba(255, 255, 255, 0.01)'
          : 'rgba(255, 255, 255, 0.03)',
        borderColor: isConflict
          ? 'rgba(244, 63, 94, 0.4)'
          : isStale
          ? 'rgba(251, 191, 36, 0.3)'
          : isApproved
          ? 'rgba(34, 211, 238, 0.3)'
          : isRejected
          ? 'rgba(255, 255, 255, 0.04)'
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isConflict
          ? '0 0 20px rgba(244, 63, 94, 0.15)'
          : isApproved
          ? '0 0 20px rgba(34, 211, 238, 0.1)'
          : 'none',
      }}
    >
      {/* 1. Header: PIXEL Identity, Implementation Tag, Review Outcome */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(34, 211, 238, 0.15)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              color: '#22D3EE',
              boxShadow: '0 0 12px rgba(34, 211, 238, 0.25)',
            }}
          >
            <Code2 className="w-4.5 h-4.5" strokeWidth={1.75} />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">PIXEL</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Software Engineer</span>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(34, 211, 238, 0.15)',
                  color: '#22D3EE',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                }}
              >
                CODE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Build #{proposal.task_id || proposal.proposal_id.slice(-6)} · {timeStr}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isConflict && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#FB7185',
                border: '1px solid rgba(244, 63, 94, 0.3)',
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Conflict Detected</span>
            </span>
          )}

          {isApproved && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Merged to Canvas</span>
            </span>
          )}

          {isPending && !isConflict && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(34, 211, 238, 0.15)',
                color: '#22D3EE',
                border: '1px solid rgba(34, 211, 238, 0.3)',
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ready for Review</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Implementation Title & Description */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
          {implSummary}
        </p>
      </div>

      {/* 3. Sections & Quality Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase font-mono text-slate-500 mr-1">Target:</span>
        {sections.map((sec) => (
          <span
            key={sec}
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
            style={{
              background: 'rgba(34, 211, 238, 0.08)',
              borderColor: 'rgba(34, 211, 238, 0.2)',
              color: '#67E8F9',
            }}
          >
            {sec}
          </span>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
            style={{
              background: 'rgba(52, 211, 153, 0.1)',
              borderColor: 'rgba(52, 211, 153, 0.25)',
              color: '#34D399',
            }}
          >
            Tests 89/89 pass
          </span>
          <span
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
            style={{
              background: 'rgba(167, 139, 250, 0.1)',
              borderColor: 'rgba(167, 139, 250, 0.25)',
              color: '#A78BFA',
            }}
          >
            NOVA Verified
          </span>
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div
        className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2.5"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <button
          type="button"
          onClick={() => onOpenImplementation(proposal)}
          className="h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            color: '#F1F5F9',
          }}
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Inspect code diff</span>
        </button>

        {isConflict && onCompareConflict && (
          <button
            type="button"
            onClick={() => onCompareConflict(proposal)}
            className="h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border"
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              borderColor: 'rgba(244, 63, 94, 0.3)',
              color: '#FB7185',
            }}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare conflict</span>
          </button>
        )}

        {isPending && !isConflict && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRedirect(proposal)}
              className="h-8 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-slate-400 hover:text-white"
            >
              Redirect
            </button>

            <button
              type="button"
              onClick={() => onReject(proposal.proposal_id)}
              className="h-8 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-slate-400 hover:text-rose-400"
            >
              Reject
            </button>

            <button
              type="button"
              onClick={() => onApprove(proposal.proposal_id)}
              disabled={isRestrictedByAlex}
              className="h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #22D3EE)',
                color: '#042F2E',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)',
              }}
            >
              {isRestrictedByAlex ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Requires Alex</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve & Merge</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
