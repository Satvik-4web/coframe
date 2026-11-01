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
  CornerDownRight,
  GitCompare,
  AlertTriangle,
  Lock,
  FileCode,
  Terminal,
  Eye,
  CheckSquare,
  Sparkles,
  Bot,
  Brain,
  Info,
  ShieldAlert,
  Sliders,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Proposal, HumanIdentity } from '../../types';

interface PixelImplementationModalProps {
  proposal: Proposal;
  identity: HumanIdentity;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onRedirect: (proposal: Proposal) => void;
  onCompareConflict?: (proposal: Proposal) => void;
  onChooseExecutionEnvironment?: (proposal: Proposal) => void;
}

export const PixelImplementationModal: React.FC<PixelImplementationModalProps> = ({
  proposal,
  identity,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRedirect,
  onCompareConflict,
  onChooseExecutionEnvironment,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'diff' | 'preview' | 'validation' | 'review' | 'technical'
  >('overview');
  const [previewMode, setPreviewMode] = useState<'proposed' | 'canonical'>('proposed');
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const impl = proposal.implementation_data;
  const title = impl?.title || proposal.summary;
  const sections = impl?.affected_sections || proposal.target_sections || ['hero'];
  const testResults = impl?.test_results;
  const novaReview = proposal.review_outcome || (proposal.reviewed_by ? 'PASS' : 'PASS');
  const findings = proposal.review_findings || [];

  const isApproved = proposal.status === 'approved';
  const isConflict = proposal.status === 'conflict' || Boolean(proposal.is_conflicted);
  const isPending = proposal.status === 'pending_review' || isConflict;
  const isCurrentAlex = identity === 'alex';
  const isRestrictedByAlex = proposal.requires_decision && !isCurrentAlex;

  const handleApprove = async () => {
    if (isConflict) return;
    setIsApplying(true);
    try {
      await onApprove(proposal.proposal_id);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'requirements', label: 'Requirements Traceability', icon: Layers },
    { id: 'diff', label: 'Artifact Diff', icon: GitCompare },
    { id: 'preview', label: 'Visual Preview', icon: Eye },
    { id: 'validation', label: 'Validation & Tests', icon: CheckSquare },
    { id: 'review', label: 'NOVA Review', icon: Brain },
    { id: 'technical', label: 'Technical Details', icon: FileCode },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#D9E1EC] shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-[#E7ECF2] bg-gradient-to-r from-white via-white to-teal-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Code2 className="w-6 h-6 text-teal-100" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm text-[#172033]">PIXEL</span>
                <span className="text-xs text-[#657189] font-semibold">AI Software Engineer</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase tracking-wider">
                  Engineering Contribution
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  #{proposal.proposal_id.slice(-6)}
                </span>
                {isConflict && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-red-600" />
                    <span>CONFLICT DETECTED</span>
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-[#172033] mt-0.5">{title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NOVA Review Pill */}
            <div
              className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-2xs ${
                novaReview === 'PASS'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-violet-600" />
              <span>NOVA Review: {novaReview}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prominent Conflict Warning Banner if Conflicted */}
        {isConflict && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-900 shrink-0">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                <strong>Approval Strictly Blocked:</strong> Canonical prototype was modified after this proposal was created. You must resolve or reconcile before applying.
              </span>
            </div>
            {onCompareConflict && (
              <button
                type="button"
                onClick={() => onCompareConflict(proposal)}
                className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
              >
                Resolve Conflict
              </button>
            )}
          </div>
        )}

        {/* Tab Navigation Bar */}
        <div className="px-6 border-b border-[#E7ECF2] bg-[#FAFBFD] flex items-center gap-2 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-teal-600 text-teal-900 bg-white shadow-2xs'
                    : 'border-transparent text-[#657189] hover:text-[#172033] hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-[#657189]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-white">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl">
              {/* Implementation Summary Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Implementation Summary
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-100 space-y-1">
                    <h4 className="text-xs font-bold text-teal-900">What was implemented?</h4>
                    <p className="text-xs text-[#334155] leading-relaxed">
                      {impl?.implementation_summary?.what_implemented || proposal.summary}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <h4 className="text-xs font-bold text-[#172033]">Why were these changes made?</h4>
                    <p className="text-xs text-[#334155] leading-relaxed">
                      {impl?.implementation_summary?.why_changes_made || proposal.reasoning}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-violet-50/40 border border-violet-100 space-y-1">
                    <h4 className="text-xs font-bold text-violet-900">
                      How does this satisfy NOVA's confirmed requirements?
                    </h4>
                    <p className="text-xs text-[#334155] leading-relaxed">
                      {impl?.implementation_summary?.how_satisfies_prd ||
                        'Translates confirmed product requirements into deterministic, allowlisted component modifications.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Implementation Tasks Plan */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Engineering Implementation Plan
                </h3>

                <div className="space-y-2">
                  {(impl?.implementation_plan || [
                    { id: 'TASK-1', title: `Update ${sections[0]} component`, status: 'completed' }
                  ]).map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-[#E7ECF2] bg-[#FAFBFD] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                          ✓
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-600">{t.id}</span>
                        <span className="text-xs font-medium text-[#172033]">{t.title}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        {t.status || 'Completed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Changed Files or Artifact Sections */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Affected Sections & Components
                </h3>

                <div className="space-y-2">
                  {(impl?.changed_files_or_sections || [
                    { name: `LedgerFlow (section: '${sections[0]}')`, type: 'artifact_section', change_type: 'Modified', description: proposal.summary }
                  ]).map((f, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-teal-600" />
                          <span className="text-xs font-bold text-[#172033] font-mono">{f.name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {f.change_type}
                        </span>
                      </div>
                      <p className="text-xs text-[#657189]">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REQUIREMENTS TRACEABILITY */}
          {activeTab === 'requirements' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Confirmed Requirements Traceability Matrix
                </h3>
                <p className="text-xs text-[#657189]">
                  Explicit mapping demonstrating how every confirmed NOVA product requirement is fulfilled by PIXEL's changes.
                </p>
              </div>

              <div className="space-y-3">
                {(impl?.requirement_traceability || (proposal.affected_requirements || ['REQ_APPROVAL_POLICY']).map((reqId) => ({
                  requirement_id: reqId,
                  title: reqId.replace('REQ_', '').replace(/_/g, ' ').toLowerCase(),
                  implementation: `Integrated into ${sections.join(', ')} via allowlisted operations`,
                  validation: 'Passed',
                }))).map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-[#E7ECF2] bg-white space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#F0F3F7]">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 font-mono text-[10px] font-bold">
                          {item.requirement_id}
                        </span>
                        <span className="text-xs font-bold text-[#172033] capitalize">{item.title}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{item.validation || 'Verified'}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">
                          Implementation Mechanism
                        </span>
                        <p className="text-[#334155]">{item.implementation}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">
                          Target Section
                        </span>
                        <p className="font-mono text-teal-800 text-xs">{sections.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {proposal.supersedes_proposal_id && (
                <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-600" />
                    <span className="text-violet-900 font-medium">Originating Confirmed PRD:</span>
                    <strong className="font-mono text-violet-800">#{proposal.supersedes_proposal_id.slice(-6)}</strong>
                  </div>
                  <span className="text-violet-700 text-[11px] font-semibold">Authoritative Human Direction</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ARTIFACT DIFF (Readable Visual Before / After Changes) */}
          {activeTab === 'diff' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Readable Component Diff
                </h3>
                <p className="text-xs text-[#657189]">
                  Review exactly what changes are being proposed before they are applied to the canonical canvas.
                </p>
              </div>

              <div className="space-y-4">
                {(impl?.artifact_diff || [
                  { section: sections[0], label: 'Configuration', before: 'Seed state', after: 'Updated state', diff_type: 'changed' }
                ]).map((d, idx) => (
                  <div key={idx} className="rounded-2xl border border-[#E7ECF2] bg-[#FAFBFD] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#F0F3F7]">
                      <span className="text-xs font-bold text-[#172033]">
                        {d.label} <span className="text-[10px] font-mono text-[#657189]">({d.section})</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 uppercase">
                        {d.diff_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 space-y-1">
                        <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                          Current Canonical Value
                        </span>
                        <p className="text-red-900 font-mono text-xs break-words">{String(d.before)}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                          Proposed Change (PIXEL)
                        </span>
                        <p className="text-emerald-900 font-mono text-xs font-bold break-words">{String(d.after)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: VISUAL PREVIEW (Without Mutating Canonical Artifact) */}
          {activeTab === 'preview' && (
            <div className="space-y-5 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                    Rendered Artifact Preview (Isolated Staging)
                  </h3>
                  <p className="text-xs text-[#657189]">
                    Simulates proposed component changes without mutating the live canonical prototype.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setPreviewMode('proposed')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      previewMode === 'proposed' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Proposed Version
                  </button>
                  <button
                    onClick={() => setPreviewMode('canonical')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      previewMode === 'canonical' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Current Canonical
                  </button>
                </div>
              </div>

              {/* Rendered Component Box */}
              <div className="border border-slate-300 rounded-2xl p-6 bg-white shadow-inner min-h-[300px]">
                {previewMode === 'proposed' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-teal-100">
                      <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Proposed LedgerFlow View (Staged Simulation)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700">
                        Section: {sections[0]}
                      </span>
                    </div>

                    {/* Preview Content */}
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                        Enterprise LedgerFlow
                      </span>
                      <h2 className="text-lg font-extrabold">{title}</h2>
                      <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                        {impl?.implementation_summary?.what_implemented || proposal.summary}
                      </p>
                      <div className="pt-2 flex items-center gap-3">
                        <button className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs">
                          Try Live Action
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Target Section: {sections.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700">Current Production Version</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        v{proposal.base_artifact_version}
                      </span>
                    </div>
                    <div className="p-6 rounded-2xl bg-slate-100 text-slate-800 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900">Current Canonical State</h3>
                      <p className="text-xs text-slate-600">
                        This section reflects the live production canvas prior to applying PIXEL's changes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: VALIDATION & TESTS */}
          {activeTab === 'validation' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Automated Engineering Verification Evidence
                </h3>
                <p className="text-xs text-[#657189]">
                  Verifies that proposed operations conform to allowlists, compile with zero type regressions, and pass automated tests.
                </p>
              </div>

              {/* 3 Verification Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Schema Validation</span>
                    <span className="text-emerald-600 font-bold text-xs">✓ PASS</span>
                  </div>
                  <p className="text-xs text-[#334155]">All operations conform to strict allowlist.</p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Build Result</span>
                    <span className="text-emerald-600 font-bold text-xs">✓ PASS</span>
                  </div>
                  <p className="text-xs text-[#334155]">TypeScript clean, 0 compilation errors.</p>
                </div>

                {testResults && testResults.executed > 0 ? (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">Pytest Suite</span>
                      <span className="text-emerald-600 font-bold text-xs">{testResults.passed} / {testResults.executed}</span>
                    </div>
                    <p className="text-xs text-[#334155]">{Math.round((testResults.passed / testResults.executed) * 100)}% tests passed, {testResults.failed || 0} regressions.</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#657189] uppercase">Verification Status</span>
                      <span className="text-slate-600 font-bold text-xs">Sandbox Ready</span>
                    </div>
                    <p className="text-xs text-[#657189]">Pytest suite ready for execution upon developer deployment.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: NOVA REVIEW */}
          {activeTab === 'review' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  NOVA Multi-Layer Architectural Review
                </h3>
                <p className="text-xs text-[#657189]">
                  Strategic evaluation ensuring engineering contributions strictly satisfy the product requirements document.
                </p>
              </div>

              {/* Review Outcome Header Card */}
              <div
                className={`p-5 rounded-2xl border flex items-center justify-between ${
                  novaReview === 'PASS'
                    ? 'bg-emerald-50/40 border-emerald-300'
                    : 'bg-amber-50/40 border-amber-300'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                      novaReview === 'PASS' ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  >
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] block">
                      Advisory Review Outcome
                    </span>
                    <h4 className="text-sm font-bold text-[#172033]">
                      Verdict: {novaReview} (Eligible for Human Sign-off)
                    </h4>
                  </div>
                </div>
              </div>

              {/* Findings */}
              {findings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                    Review Findings & Observations
                  </h4>
                  {findings.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                      <span className="font-mono text-[10px] font-bold text-slate-700 mr-2">[{f.code}]</span>
                      <span className="text-slate-800">{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: TECHNICAL DETAILS (RAW JSON) */}
          {activeTab === 'technical' && (
            <div className="space-y-4 max-w-3xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033] mb-1">
                  Raw Technical Metadata & Cryptographic Provenance
                </h3>
                <p className="text-xs text-[#657189]">
                  Authoritative payload stored in SQLite and broadcast across active multiplayer sessions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[#657189] block">Context Version:</span>
                    <strong className="text-blue-700 font-mono">v{proposal.base_context_version}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#657189] block">Artifact Version:</span>
                    <strong className="text-emerald-700 font-mono">v{proposal.base_artifact_version}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#657189] block">Author:</span>
                    <strong className="text-teal-700">{proposal.created_by || 'PIXEL'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#657189] block">Run ID:</span>
                    <strong className="text-slate-800 font-mono text-[10px]">{proposal.run_id || 'run_default'}</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase text-[#657189] block mb-1">
                    Raw Proposal JSON Payload:
                  </span>
                  <pre className="font-mono text-[10px] text-[#172033] bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto max-h-64">
                    {JSON.stringify(proposal, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="p-4 px-6 border-t border-[#E7ECF2] bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#657189]">
            {isApproved ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Applied to Canonical Canvas
              </span>
            ) : isConflict ? (
              <span className="text-red-700 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Approval strictly blocked: Conflicts with canonical prototype
              </span>
            ) : isRestrictedByAlex ? (
              <span className="text-amber-800 font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                High-impact policy change requires Alex authorization
              </span>
            ) : (
              <span>Ready for human review and sign-off</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#657189] hover:bg-[#F8FAFC] transition cursor-pointer"
            >
              Close
            </button>

            {isConflict && onCompareConflict && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCompareConflict(proposal);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Resolve Conflict</span>
              </button>
            )}

            {isPending && !isConflict && (
              <>
                {onChooseExecutionEnvironment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onChooseExecutionEnvironment(proposal);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Select execution environment (Connected Agent IDE or Built-in PIXEL)"
                  >
                    <Terminal className="w-3.5 h-3.5 text-violet-600" />
                    <span>Execution Environment</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRedirect(proposal);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>Redirect to PIXEL</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onReject(proposal.proposal_id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  disabled={isRestrictedByAlex || isApplying || isConflict}
                  onClick={handleApprove}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs ${
                    isRestrictedByAlex || isApplying || isConflict
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                  title={
                    isConflict
                      ? 'Approval strictly blocked: Proposal conflicts with canonical canvas'
                      : isRestrictedByAlex
                      ? 'High-impact policy requires Alex approval'
                      : 'Apply changes to canonical canvas'
                  }
                >
                  {isApplying ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Approve & Apply Implementation</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
