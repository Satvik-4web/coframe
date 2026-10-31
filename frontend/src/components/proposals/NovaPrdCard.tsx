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
      className={`rounded-2xl border transition-all p-5 shadow-xs ${
        isConfirmed
          ? 'bg-gradient-to-br from-white via-white to-violet-50/20 border-violet-200'
          : proposal.status === 'stale'
          ? 'bg-white border-amber-300 ring-2 ring-amber-100/60'
          : 'bg-white border-[#E2E8F0] hover:border-violet-300 hover:shadow-sm'
      }`}
    >
      {/* 1. Header: NOVA Identity, Role, PRD Tag, Confirmation Status */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            <Brain className="w-5 h-5 text-violet-100" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-xs text-[#172033] tracking-tight">NOVA</span>
              <span className="text-[11px] text-[#657189] font-medium">AI Product Strategist</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wider">
                Product Requirements
              </span>
            </div>
            <p className="text-[10px] text-[#657189] mt-0.5 font-mono">
              Task: {proposal.task_id || proposal.run_id || 'PRD-01'} · Submitted {timeStr}
            </p>
          </div>
        </div>

        {/* Confirmation Status Pill */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{hasLinkedImplementation ? 'CONFIRMED · DELEGATED TO PIXEL' : 'CONFIRMED REQUIREMENTS'}</span>
            </span>
          ) : proposal.status === 'stale' ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              ⚠️ STALE (REQUIREMENTS DRIFT)
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-300 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span>READY FOR REVIEW</span>
            </span>
          )}

          {proposal.prune_metadata && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1"
              title="Verified by Prune Ed25519"
            >
              <span>🛡️</span>
              <span>Prune Signed</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. PRD Title & Document Headline */}
      <div className="mb-2">
        <h3 className="font-bold text-sm text-[#172033] leading-snug flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-600 shrink-0" />
          <span>{title}</span>
        </h3>
      </div>

      {/* 3. Executive Summary (Human-readable document excerpt) */}
      <div className="mb-3.5 p-3 rounded-xl bg-[#FAFBFD] border border-[#E7ECF2]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800 mb-1">
          Executive Summary
        </p>
        <p className="text-xs text-[#334155] leading-relaxed line-clamp-3">
          {execSummary}
        </p>
      </div>

      {/* 4. Document Metrics Strip: Functional Requirements, Criteria, Target Audience */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-[#657189] pb-3 border-b border-[#F0F3F7]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
          <span className="font-bold text-violet-700">{frCount}</span>
          <span className="text-[11px]">Functional Requirements</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
          <span className="font-bold text-emerald-700">{acCount}</span>
          <span className="text-[11px]">Acceptance Criteria</span>
        </div>
        {prd?.target_users?.primary_users && (
          <div className="flex items-center gap-1.5 text-[11px] truncate max-w-xs text-[#475569]">
            <span className="text-[#94A3B8]">Audience:</span>
            <span className="font-medium truncate">{prd.target_users.primary_users}</span>
          </div>
        )}
      </div>

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
              <span>Sections: <strong>{proposal.target_sections.join(', ')}</strong></span>
            </div>
            <pre className="font-mono text-[10px] text-[#172033] bg-white p-2.5 rounded-lg border border-[#E7ECF2] overflow-x-auto max-h-48">
              {JSON.stringify(proposal.changes || proposal, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 6. Primary & Secondary Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F0F3F7]">
        <div className="text-[11px] text-[#657189]">
          {isConfirmed ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {hasLinkedImplementation
                ? 'Confirmed & Delegated to PIXEL · Implementation Active'
                : 'Authoritative Product Context'}
            </span>
          ) : (
            <span>Alex confirmation required to authorize implementation</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Primary Action: Read PRD Document */}
          <button
            type="button"
            onClick={() => onOpenPrd(proposal)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Read PRD</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* If confirmed and linked pixel proposal exists, show View PIXEL Task */}
          {isConfirmed && onOpenPixelProposal && (
            <button
              type="button"
              onClick={onOpenPixelProposal}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="View PIXEL implementation proposal and technical diff"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>View PIXEL Task</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Secondary Action: Confirm Requirements if not confirmed */}
          {!isConfirmed && proposal.status === 'pending_review' && (
            <button
              type="button"
              disabled={!isAlex}
              onClick={() => onConfirmRequirements(proposal.proposal_id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isAlex
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              title={isAlex ? 'Confirm requirements and automatically delegate implementation to PIXEL' : 'Only Alex (Founder / Decision Owner) can confirm requirements'}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Requirements</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
