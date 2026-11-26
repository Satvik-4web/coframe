import React, { useState } from 'react';
import {
  Brain,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  Layers,
  HelpCircle,
  Check,
  Code2,
} from 'lucide-react';
import { Proposal, HumanIdentity } from '../../types';

interface NovaPrdCardProps {
  proposal: Proposal;
  identity: HumanIdentity;
  onOpenPrd: (proposal: Proposal) => void;
  onConfirmRequirements: (proposalId: string) => void;
  onReject?: (proposalId: string) => void;
  hasLinkedImplementation?: boolean;
  onOpenPixelProposal?: () => void;
}

export const NovaPrdCard: React.FC<NovaPrdCardProps> = ({
  proposal,
  identity,
  onOpenPrd,
  onConfirmRequirements,
  onReject,
  hasLinkedImplementation,
  onOpenPixelProposal,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const prd = proposal.prd_data;
  const title = prd?.title || proposal.summary;
  const execSummary = prd?.executive_summary?.what_proposed || proposal.reasoning;
  const frCount = prd?.functional_requirements?.length || proposal.affected_requirements?.length || 2;
  const acCount = prd?.acceptance_criteria?.length || 3;
  const isConfirmed = proposal.status === 'approved' || prd?.status === 'confirmed';
  const isAlex = identity === 'alex';

  const timeStr = proposal.created_at
    ? new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className="p-5 rounded-2xl border transition-all duration-200"
      style={{
        background: isConfirmed
          ? 'rgba(167, 139, 250, 0.05)'
          : proposal.status === 'stale'
          ? 'rgba(251, 191, 36, 0.05)'
          : 'rgba(255, 255, 255, 0.03)',
        borderColor: isConfirmed
          ? 'rgba(167, 139, 250, 0.3)'
          : proposal.status === 'stale'
          ? 'rgba(251, 191, 36, 0.3)'
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isConfirmed
          ? '0 0 20px rgba(167, 139, 250, 0.1)'
          : 'none',
      }}
    >
      {/* 1. Header: NOVA Identity, PRD Tag, Confirmation Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(167, 139, 250, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              color: '#A78BFA',
              boxShadow: '0 0 12px rgba(167, 139, 250, 0.25)',
            }}
          >
            <Brain className="w-4.5 h-4.5" strokeWidth={1.75} />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">NOVA</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Product Strategist</span>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(167, 139, 250, 0.15)',
                  color: '#A78BFA',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                }}
              >
                PRD
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Task #{proposal.task_id || proposal.run_id || 'PRD'} · {timeStr}
            </p>
          </div>
        </div>

        {/* Confirmation Status Badge */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmed</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(251, 191, 36, 0.15)',
                color: '#FBBF24',
                border: '1px solid rgba(251, 191, 36, 0.3)',
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting Confirmation</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. PRD Title & Executive Summary */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
          {execSummary}
        </p>
      </div>

      {/* 3. Metrics Strip */}
      <div
        className="mt-3.5 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div
          className="p-2.5 rounded-xl border"
          style={{ background: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[10px] text-slate-500 block uppercase">Reqs</span>
          <span className="font-bold text-indigo-300 mt-0.5 block">{frCount} items</span>
        </div>
        <div
          className="p-2.5 rounded-xl border"
          style={{ background: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[10px] text-slate-500 block uppercase">Criteria</span>
          <span className="font-bold text-white mt-0.5 block">{acCount} pass rules</span>
        </div>
        <div
          className="p-2.5 rounded-xl border"
          style={{ background: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[10px] text-slate-500 block uppercase">Confidence</span>
          <span className="font-bold text-emerald-400 mt-0.5 block">96%</span>
        </div>
        <div
          className="p-2.5 rounded-xl border"
          style={{ background: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[10px] text-slate-500 block uppercase">Next Agent</span>
          <span className="font-bold text-cyan-400 mt-0.5 block">PIXEL</span>
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div
        className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2.5"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPrd(proposal)}
            className="h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              color: '#F1F5F9',
            }}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Read full PRD</span>
          </button>

          {hasLinkedImplementation && onOpenPixelProposal && (
            <button
              type="button"
              onClick={onOpenPixelProposal}
              className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border"
              style={{
                background: 'rgba(34, 211, 238, 0.1)',
                borderColor: 'rgba(34, 211, 238, 0.25)',
                color: '#22D3EE',
              }}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>View PIXEL code</span>
            </button>
          )}
        </div>

        {!isConfirmed && (
          <div className="flex items-center gap-2">
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(proposal.proposal_id)}
                className="h-8 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
              >
                Reject
              </button>
            )}

            <button
              type="button"
              onClick={() => onConfirmRequirements(proposal.proposal_id)}
              className="h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
                color: '#FFFFFF',
                boxShadow: '0 0 15px rgba(129, 140, 248, 0.4)',
              }}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Dispatch PIXEL</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
