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
      className={`coframe-card p-5 ${
        isConfirmed
          ? 'border-emerald-300/80'
          : proposal.status === 'stale'
          ? 'border-amber-300'
          : ''
      }`}
    >
      {/* 1. Header: NOVA Identity, PRD Tag, Confirmation Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center border border-violet-200/70 shrink-0">
            <Brain className="w-4 h-4" strokeWidth={1.75} />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-slate-900">NOVA</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">Product Strategist</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-violet-50 text-[#6D28D9] border border-violet-200/60">
                PRD
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Task #{proposal.task_id || proposal.run_id || 'PRD'} · {timeStr}
            </p>
          </div>
        </div>

        {/* Confirmation Status Pill */}
        <div className="flex items-center gap-1.5">
          {isConfirmed ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>{hasLinkedImplementation ? 'Confirmed · Delegated' : 'Confirmed'}</span>
            </span>
          ) : proposal.status === 'stale' ? (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70">
              Stale · Drift detected
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              <span>Ready for review</span>
            </span>
          )}

          {proposal.prune_metadata && (
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-900/[0.06] flex items-center gap-1"
              title="Cryptographically signed by Prune Ed25519"
            >
              <Shield className="w-3 h-3 text-emerald-600" />
              <span>Signed</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. PRD Title */}
      <div className="mb-2.5">
        <h3 className="font-semibold text-[15px] text-slate-900 leading-snug flex items-center gap-2 tracking-tight">
          <FileText className="w-4 h-4 text-[#6D28D9] shrink-0" strokeWidth={1.75} />
          <span>{title}</span>
        </h3>
      </div>

      {/* 3. Executive Summary */}
      <div className="mb-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-900/[0.06]">
        <p className="text-[11px] font-medium text-slate-500 mb-1">
          Executive summary
        </p>
        <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
          {execSummary}
        </p>
      </div>

      {/* 4. Document Metrics Strip */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-500 pb-3 border-b border-slate-900/[0.06]">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100/80 text-[11px]">
          <span className="font-semibold text-slate-900 font-mono">{frCount}</span>
          <span className="text-slate-600">requirements</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100/80 text-[11px]">
          <span className="font-semibold text-slate-900 font-mono">{acCount}</span>
          <span className="text-slate-600">criteria</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100/80 text-[11px]">
          <span className="text-slate-400">Audience:</span>
          <span className="font-medium text-slate-700 truncate max-w-[200px]">{prd?.target_users?.primary_users || (prd as any)?.target_audience || 'Enterprise'}</span>
        </div>
      </div>

      {/* 5. Raw Technical Details Toggle */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-[11px] font-medium text-slate-500 hover:text-slate-800 py-0.5 transition cursor-pointer"
        >
          <span>
            {showTechnicalDetails ? 'Hide raw JSON' : 'Inspect raw proposal JSON'}
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 space-y-1.5 bg-[#0F172A] text-slate-200 p-3 rounded-xl overflow-x-auto max-h-40 font-mono text-[10px]">
            <pre>{JSON.stringify(proposal.changes || proposal, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* 6. Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-xs text-slate-500">
          {isConfirmed ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {hasLinkedImplementation
                ? 'Confirmed & delegated to PIXEL'
                : 'Confirmed requirements baseline'}
            </span>
          ) : (
            <span>Alex confirmation authorizes implementation</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPrd(proposal)}
            className="h-8 px-3 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span>Read PRD</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>

          {isConfirmed && onOpenPixelProposal && (
            <button
              type="button"
              onClick={onOpenPixelProposal}
              className="h-8 px-3 rounded-lg bg-teal-50 hover:bg-teal-100/80 text-[#0F766E] border border-teal-200/70 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>View PIXEL task</span>
            </button>
          )}

          {!isConfirmed && proposal.status === 'pending_review' && (
            <button
              type="button"
              disabled={!isAlex}
              onClick={() => onConfirmRequirements(proposal.proposal_id || proposal.id || '')}
              className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                isAlex
                  ? 'btn-obsidian cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title={isAlex ? 'Confirm requirements and delegate to PIXEL' : 'Only Alex (Decision Owner) can confirm'}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm requirements</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
