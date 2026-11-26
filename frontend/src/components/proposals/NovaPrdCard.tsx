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
      className={`rounded-xl border transition-all p-4.5 shadow-2xs ${
        isConfirmed
          ? 'bg-[#1A202C] border-emerald-500/25 ring-1 ring-emerald-500/10'
          : proposal.status === 'stale'
          ? 'bg-[#1A202C] border-amber-300 ring-1 ring-amber-500/20'
          : 'bg-[#1A202C] border-[#303A4B]/80 hover:border-[#303A4B]'
      }`}
    >
      {/* 1. Header: NOVA Identity, PRD Tag, Confirmation Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-500/25 shrink-0">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-[#EDF2FA]">NOVA</span>
              <span className="text-[11px] text-[#8495AD]">•</span>
              <span className="text-[11px] text-[#96A6BE] font-medium">Product Strategist</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25 uppercase font-mono">
                PRD
              </span>
            </div>
            <p className="text-[10px] text-[#8495AD] font-mono">
              Task #{proposal.task_id || proposal.run_id || 'PRD'} · {timeStr}
            </p>
          </div>
        </div>

        {/* Confirmation Status Pill */}
        <div className="flex items-center gap-1.5">
          {isConfirmed ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>{hasLinkedImplementation ? 'CONFIRMED · DELEGATED TO PIXEL' : 'CONFIRMED'}</span>
            </span>
          ) : proposal.status === 'stale' ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
              ⚠️ STALE (DRIFT DETECTED)
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/25 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              <span>READY FOR REVIEW</span>
            </span>
          )}

          {proposal.prune_metadata && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1D2633] text-[#ACBAD0] border border-[#303A4B] flex items-center gap-1"
              title="Cryptographically signed by Prune Ed25519"
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Prune</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. PRD Title & Document Headline */}
      <div className="mb-2">
        <h3 className="font-semibold text-sm text-[#EDF2FA] leading-snug flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>{title}</span>
        </h3>
      </div>

      {/* 3. Executive Summary */}
      <div className="mb-3 p-2.5 rounded-lg bg-[#141A24]/70 border border-[#303A4B]/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-0.5">
          Executive Summary
        </p>
        <p className="text-xs text-[#ACBAD0] leading-relaxed line-clamp-3">
          {execSummary}
        </p>
      </div>

      {/* 4. Document Metrics Strip */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-[#96A6BE] pb-2.5 border-b border-[#303A4B]">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D2633]/70 text-[11px]">
          <span className="font-semibold text-purple-300 font-mono">{frCount}</span>
          <span className="text-[#ACBAD0]">Requirements</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D2633]/70 text-[11px]">
          <span className="font-semibold text-emerald-300 font-mono">{acCount}</span>
          <span className="text-[#ACBAD0]">Criteria</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D2633]/70 text-[11px]">
          <span className="text-[#8495AD]">Audience:</span>
          <span className="font-medium text-[#C6D2E4] truncate max-w-[200px]">{prd?.target_users?.primary_users || (prd as any)?.target_audience || 'Enterprise'}</span>
        </div>
      </div>

      {/* 5. Raw Technical Details Toggle */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-[11px] font-medium text-[#8495AD] hover:text-[#C6D2E4] py-0.5 transition cursor-pointer"
        >
          <span>
            {showTechnicalDetails ? 'Hide technical JSON' : 'Inspect raw proposal JSON'}
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 space-y-1.5 text-xs bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-h-40 font-mono text-[10px]">
            <pre>{JSON.stringify(proposal.changes || proposal, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* 6. Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-[#96A6BE]">
          {isConfirmed ? (
            <span className="text-emerald-300 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {hasLinkedImplementation
                ? 'Confirmed & Delegated to PIXEL'
                : 'Authoritative Requirements Baseline'}
            </span>
          ) : (
            <span>Alex confirmation authorizes implementation</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Read PRD */}
          <button
            type="button"
            onClick={() => onOpenPrd(proposal)}
            className="px-3 py-1.5 rounded-md bg-[#1A202C] hover:bg-[#141A24] text-[#DCE5F2] border border-[#303A4B] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3 h-3 text-purple-400" />
            <span>Read PRD</span>
            <ArrowRight className="w-3 h-3 text-[#8495AD]" />
          </button>

          {/* Linked PIXEL Task */}
          {isConfirmed && onOpenPixelProposal && (
            <button
              type="button"
              onClick={onOpenPixelProposal}
              className="px-3 py-1.5 rounded-md bg-teal-500/10 hover:bg-teal-500/10 text-teal-300 border border-teal-500/25 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Code2 className="w-3 h-3 text-teal-400" />
              <span>View PIXEL Task</span>
            </button>
          )}

          {/* Confirm Requirements */}
          {!isConfirmed && proposal.status === 'pending_review' && (
            <button
              type="button"
              disabled={!isAlex}
              onClick={() => onConfirmRequirements(proposal.proposal_id || proposal.id || '')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                isAlex
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                  : 'bg-[#1D2633] text-[#8495AD] cursor-not-allowed border border-[#303A4B]'
              }`}
              title={isAlex ? 'Confirm requirements and delegate to PIXEL' : 'Only Alex (Founder / Decision Owner) can confirm'}
            >
              <Check className="w-3 h-3" />
              <span>Confirm Requirements</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
