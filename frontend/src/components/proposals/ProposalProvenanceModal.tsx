import React from 'react';
import { Proposal, HumanIdentity } from '../../types';
import {
  X,
  Bot,
  User,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  GitPullRequest,
  Clock,
  Layers,
  Code2,
  Brain,
  ArrowRight,
  FileCode,
} from 'lucide-react';

interface ProposalProvenanceModalProps {
  proposal: Proposal;
  identity: HumanIdentity;
  onClose: () => void;
}

export const ProposalProvenanceModal: React.FC<ProposalProvenanceModalProps> = ({
  proposal,
  identity,
  onClose,
}) => {
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

  // Author Type
  const authorTypeLabel =
    proposal.author_type === 'human' || isAlex || isMaya
      ? 'Human Contributor'
      : isLegacy
      ? 'Legacy Origin'
      : 'AI Agent';

  // Reviewer resolution
  const reviewerName = proposal.reviewed_by || (isPixel ? 'NOVA' : null);
  const reviewOutcome = proposal.review_outcome || (reviewerName ? 'PASS' : null);

  // Decision Owner resolution
  const decisionOwner = proposal.assigned_decider_id ? proposal.assigned_decider_id.toUpperCase() : 'ALEX';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E7ECF2] w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#F0F3F7] flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
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
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isNova ? <Brain className="w-5 h-5 text-violet-700" /> : isPixel ? <Code2 className="w-5 h-5 text-teal-700" /> : isAlex || isMaya ? <User className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#172033]">Contribution Provenance</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F0F3F7] text-[#657189] border border-[#E5EAF0]">
                  #{proposal.proposal_id.slice(-8)}
                </span>
              </div>
              <p className="text-xs text-[#657189]">
                Verified attribution separating Author, Reviewer, and Decision Owner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#657189] hover:text-[#172033] hover:bg-[#F0F3F7] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs">
          {/* Proposal Summary & Category */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  proposal.contribution_type === 'PRODUCT REQUIREMENTS' || isNova
                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                    : proposal.contribution_type === 'IMPLEMENTATION' || isPixel
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {proposal.contribution_type || (isNova ? 'PRODUCT REQUIREMENTS' : isPixel ? 'IMPLEMENTATION' : 'HUMAN CONTRIBUTION')}
              </span>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  proposal.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : proposal.status === 'stale'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : proposal.status === 'conflict'
                    ? 'bg-red-50 text-red-800 border-red-300'
                    : proposal.status === 'rejected'
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                Status: {proposal.status.toUpperCase().replace('_', ' ')}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#172033] mb-1">{proposal.summary}</h3>
            <p className="text-xs text-[#657189] leading-relaxed">{proposal.reasoning}</p>
          </div>

          {/* Three Distinct Pillars: AUTHOR ≠ REVIEWER ≠ DECISION OWNER */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#657189] uppercase tracking-wider">
                Identity & Responsibility Pillars
              </span>
              <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                AUTHOR ≠ REVIEWER ≠ DECISION OWNER
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. ORIGINAL AUTHOR */}
              <div className="p-3.5 rounded-xl border border-[#E7ECF2] bg-white shadow-2xs space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#657189] flex items-center justify-between">
                  <span>1. Author</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                    Originator
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isNova
                        ? 'bg-violet-100 text-violet-700'
                        : isPixel
                        ? 'bg-teal-100 text-teal-700'
                        : isAlex
                        ? 'bg-blue-100 text-blue-700'
                        : isMaya
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isNova ? 'N' : isPixel ? 'P' : isAlex ? 'A' : isMaya ? 'M' : '?'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#172033]">{authorName}</h4>
                    <p className="text-[10px] text-[#657189]">{authorRole}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#F0F3F7] text-[10px] text-[#657189]">
                  Type: <strong className="text-[#172033]">{authorTypeLabel}</strong>
                </div>
              </div>

              {/* 2. REVIEWER */}
              <div className="p-3.5 rounded-xl border border-[#E7ECF2] bg-white shadow-2xs space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#657189] flex items-center justify-between">
                  <span>2. Reviewer</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      reviewOutcome === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : reviewOutcome === 'WARNING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {reviewOutcome || 'Direct'}
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                    {reviewerName === 'NOVA' ? 'N' : '—'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#172033]">
                      {reviewerName || 'None Required'}
                    </h4>
                    <p className="text-[10px] text-[#657189]">
                      {reviewerName === 'NOVA'
                        ? 'AI Product Strategist'
                        : 'Direct Submission'}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#F0F3F7] text-[10px] text-[#657189]">
                  {reviewerName === 'NOVA' ? (
                    <span>
                      Outcome: <strong className="text-emerald-700 font-bold">PASS (Schema & Deps)</strong>
                    </span>
                  ) : (
                    <span>Self-attested proposal</span>
                  )}
                </div>
              </div>

              {/* 3. DECISION OWNER */}
              <div className="p-3.5 rounded-xl border border-[#E7ECF2] bg-white shadow-2xs space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#657189] flex items-center justify-between">
                  <span>3. Decision Owner</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                    Human Sign-off
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    {decisionOwner[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#172033]">{decisionOwner}</h4>
                    <p className="text-[10px] text-[#657189]">Founder / Decision Owner</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#F0F3F7] text-[10px] text-[#657189]">
                  Authority:{' '}
                  <strong className="text-[#172033]">
                    {proposal.requires_decision ? 'Sign-off Required' : 'Standard Governance'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Provenance & Version Anchors */}
          <div>
            <h4 className="text-[11px] font-bold text-[#657189] uppercase tracking-wider mb-2">
              Traceability & Context Anchors
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E7ECF2]">
              <div>
                <span className="text-[10px] text-[#657189] block">Originating Task</span>
                <strong className="font-mono text-xs text-[#172033] truncate block" title={proposal.task_id || proposal.run_id}>
                  {proposal.task_id || proposal.run_id || 'task_init'}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-[#657189] block">Base Context</span>
                <strong className="text-xs text-blue-700">v{proposal.base_context_version}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#657189] block">Base Artifact</span>
                <strong className="text-xs text-emerald-700">v{proposal.base_artifact_version}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#657189] block">Submission Time</span>
                <strong className="text-xs text-[#172033]">
                  {new Date(proposal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </strong>
              </div>
            </div>
          </div>

          {/* Revision Provenance Link if revised */}
          {proposal.supersedes_proposal_id && (
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitPullRequest className="w-4 h-4 text-teal-700" />
                <span>
                  Revised from previous proposal <strong>#{proposal.supersedes_proposal_id.slice(-8)}</strong>
                </span>
              </div>
              <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-teal-200 text-teal-800">
                Revision Chain
              </span>
            </div>
          )}

          {/* Target Section Versions */}
          <div>
            <h4 className="text-[11px] font-bold text-[#657189] uppercase tracking-wider mb-2">
              Target Artifact Sections & Base Versions
            </h4>
            <div className="flex flex-wrap gap-2">
              {proposal.target_sections.map((sec) => (
                <div
                  key={sec}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#E7ECF2] shadow-2xs flex items-center space-x-2"
                >
                  <span className="font-semibold text-teal-800">§ {sec}</span>
                  <span className="text-[#657189]">•</span>
                  <span className="text-[10px] font-mono text-[#657189]">
                    Base: v{proposal.base_section_versions[sec] || 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Proposed Operations Payload */}
          <div>
            <h4 className="text-[11px] font-bold text-[#657189] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Proposed Changes (JSON Allowlist Payload)</span>
              <span className="text-[10px] font-normal text-[#657189]">
                {proposal.changes.operations?.length || 0} Operations
              </span>
            </h4>
            <div className="bg-[#1E293B] text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-700">
              <pre>{JSON.stringify(proposal.changes, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#F0F3F7] flex items-center justify-end bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F0F3F7] hover:bg-[#E5EAF0] text-[#172033] font-semibold transition cursor-pointer text-xs"
          >
            Close Provenance
          </button>
        </div>
      </div>
    </div>
  );
};
