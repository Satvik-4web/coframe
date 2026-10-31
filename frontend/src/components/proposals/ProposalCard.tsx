import React, { useState } from 'react';
import { Proposal, HumanIdentity } from '../../types';
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
  const [expanded, setExpanded] = useState(false);

  const isNova = proposal.agent_id === 'nova';
  const isAlex = identity === 'alex';
  const isRestrictedByAlex = proposal.requires_decision && !isAlex;

  const targetSectionsStr = proposal.target_sections.join(', ');
  const baseSectionEntries = Object.entries(proposal.base_section_versions || {});
  const sectionVersionsStr = baseSectionEntries.map(([k, v]) => `${k}: v${v}`).join(', ');

  return (
    <div
      className={`rounded-xl border transition p-5 ${
        proposal.status === 'conflict'
          ? 'bg-[#181622] border-red-500/50 shadow-md shadow-red-950/20'
          : proposal.status === 'stale'
          ? 'bg-[#181824] border-red-800/40'
          : proposal.status === 'approved'
          ? 'bg-[#131E24] border-emerald-500/40 opacity-90'
          : proposal.status === 'rejected'
          ? 'bg-[#151922] border-[#263244] opacity-60'
          : 'bg-[#151B29] border-[#263244] hover:border-slate-600'
      }`}
    >
      {/* Top Header: Agent, Status Badges & High-Impact Alert */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              isNova
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                : 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
            }`}
          >
            {isNova ? 'N' : 'P'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-[#F4F7FB]">{proposal.agent_id.toUpperCase()}</span>
              <span className="text-[10px] text-[#98A5B7]">
                {isNova ? 'Product Strategist' : 'Prototype Engineer'}
              </span>
              {proposal.supersedes_proposal_id && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1B2433] text-teal-400 border border-teal-500/30">
                  revised from #{proposal.supersedes_proposal_id.slice(-6)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {proposal.status === 'pending_review' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-600/40">
              ● Pending Review
            </span>
          )}
          {proposal.status === 'stale' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-600/50 animate-pulse">
              ⚠️ STALE
            </span>
          )}
          {proposal.status === 'conflict' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-600/50 animate-pulse">
              ⚡ CONFLICT
            </span>
          )}
          {proposal.status === 'approved' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-600/40">
              ✓ Approved
            </span>
          )}
          {proposal.status === 'rejected' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Rejected
            </span>
          )}
          {proposal.status === 'superseded' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Superseded
            </span>
          )}

          {/* High Impact Alex Decision Badge */}
          {proposal.requires_decision && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Requires Alex Approval</span>
            </span>
          )}

          {/* Source badge */}
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              proposal.source === 'live_llm'
                ? 'bg-violet-950/30 text-violet-300 border-violet-700/40'
                : 'bg-amber-950/40 text-amber-300 border-amber-700/40'
            }`}
          >
            {proposal.source === 'live_llm' ? 'Live LLM' : 'SIMULATED FALLBACK'}
          </span>
        </div>
      </div>

      {/* Summary Title */}
      <h3 className="font-bold text-sm text-[#F4F7FB] mb-2 leading-snug">{proposal.summary}</h3>

      {/* Provenance Line - MUST BE VISIBLE ON CARD PER SPEC */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#98A5B7] mb-3 bg-[#1B2433]/70 px-2.5 py-1.5 rounded-md border border-[#263244]">
        <span>
          Based on: <strong className="text-blue-400">Context v{proposal.base_context_version}</strong>
        </span>
        <span>•</span>
        <span>
          <strong className="text-emerald-400">Artifact v{proposal.base_artifact_version}</strong>
        </span>
        <span>•</span>
        <span>
          Target Sections:{' '}
          <strong className="text-teal-300">
            {sectionVersionsStr || targetSectionsStr}
          </strong>
        </span>
      </div>

      {/* Stale / Conflict plain language explanation box */}
      {proposal.status === 'stale' && (
        <div className="mb-3 p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-200">
          <div className="flex items-center space-x-1.5 font-semibold text-red-300 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Outdated Requirement Dependency</span>
          </div>
          <p className="leading-relaxed">{proposal.stale_reason}</p>
        </div>
      )}

      {proposal.status === 'conflict' && (
        <div className="mb-3 p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-200">
          <div className="flex items-center space-x-1.5 font-semibold text-red-300 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Section Version Conflict with Human Edit</span>
          </div>
          <p className="leading-relaxed">{proposal.conflict_reason}</p>
        </div>
      )}

      {/* Affected requirements tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[10px] text-[#98A5B7] uppercase font-semibold">Dependencies:</span>
        {proposal.affected_requirements.map((req) => (
          <span
            key={req}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2433] text-blue-300 border border-[#263244]"
          >
            {req}
          </span>
        ))}
        {proposal.target_sections.map((sec) => (
          <span
            key={sec}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2433] text-teal-300 border border-[#263244]"
          >
            § {sec}
          </span>
        ))}
      </div>

      {/* Expandable Reasoning & Changes */}
      <div className="border-t border-[#263244] pt-2 mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-xs text-[#98A5B7] hover:text-[#F4F7FB] py-1"
        >
          <span>{expanded ? 'Hide Rationale & Structured Changes' : 'View Rationale & Structured Changes'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2 text-xs">
            <div className="p-2.5 rounded bg-[#1B2433] border border-[#263244]">
              <span className="text-[10px] uppercase font-bold text-[#98A5B7] block mb-1">Agent Reasoning</span>
              <p className="text-[#F4F7FB] leading-relaxed">{proposal.reasoning}</p>
            </div>

            <div className="p-2.5 rounded bg-[#1B2433] border border-[#263244] font-mono text-[11px] text-teal-300 overflow-x-auto">
              <span className="text-[10px] uppercase font-bold text-[#98A5B7] block mb-1 font-sans">
                Proposed Operations (JSON Allowlist)
              </span>
              <pre>{JSON.stringify(proposal.changes, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#263244]">
        {/* Left Side: Conflict Comparison Button if conflicted */}
        <div>
          {proposal.status === 'conflict' && (
            <button
              onClick={() => onCompareConflict(proposal)}
              className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-200 border border-red-700/50 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-red-400" />
              <span>Compare Side-by-Side Conflict</span>
            </button>
          )}

          {proposal.status === 'stale' && (
            <button
              onClick={() => onReconcile(proposal.proposal_id)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconcile with Enterprise Context</span>
            </button>
          )}
        </div>

        {/* Right Side: Review Actions (Approve / Reject / Redirect) or GitHub Publishing */}
        {proposal.status === 'approved' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Applied to Artifact</span>
            </span>
            {onPublishToGitHub && (
              <button
                onClick={() => onPublishToGitHub(proposal.proposal_id)}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-black text-xs font-semibold flex items-center space-x-1 shadow-sm transition cursor-pointer"
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
              className="px-3 py-1.5 rounded-lg bg-[#1B2433] hover:bg-[#232F42] text-rose-300 border border-rose-900/30 text-xs font-medium transition cursor-pointer"
            >
              Reject
            </button>

            <button
              onClick={() => onRedirect(proposal)}
              className="px-3 py-1.5 rounded-lg bg-[#1B2433] hover:bg-[#232F42] text-teal-300 border border-teal-900/30 text-xs font-medium flex items-center space-x-1 transition cursor-pointer"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition ${
                isRestrictedByAlex
                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isRestrictedByAlex ? 'Alex Approval Required' : 'Approve & Apply'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
