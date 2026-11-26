import React, { useState } from 'react';
import {
  Brain,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  HelpCircle,
  AlertTriangle,
  Users,
  Target,
  Workflow,
  Sparkles,
  Check,
  X,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { Proposal, HumanIdentity } from '../../types';

interface NovaPrdDocumentModalProps {
  proposal: Proposal;
  identity: HumanIdentity;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRequirements: (proposalId: string) => void;
  onAskNova?: (question: string) => void;
}

export const NovaPrdDocumentModal: React.FC<NovaPrdDocumentModalProps> = ({
  proposal,
  identity,
  isOpen,
  onClose,
  onConfirmRequirements,
  onAskNova,
}) => {
  const [activeSection, setActiveSection] = useState<string>('executive');
  const [clarificationQuestion, setClarificationQuestion] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  if (!isOpen) return null;

  const prd = proposal.prd_data;
  const title = prd?.title || proposal.summary;
  const isConfirmed = proposal.status === 'approved' || prd?.status === 'confirmed';
  const isAlex = identity === 'alex';

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirmRequirements(proposal.proposal_id);
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  const navItems = [
    { id: 'executive', label: '1. Executive Summary' },
    { id: 'problem', label: '2. Problem Statement' },
    { id: 'users', label: '3. Target Users' },
    { id: 'solution', label: '4. Proposed Solution' },
    { id: 'functional', label: '5. Functional Requirements' },
    { id: 'nonfunctional', label: '6. Non-Functional Requirements' },
    { id: 'stories', label: '7. User Stories' },
    { id: 'acceptance', label: '8. Acceptance Criteria' },
    { id: 'constraints', label: '9. Constraints & Assumptions' },
    { id: 'risks', label: '10. Dependencies & Risks' },
    { id: 'questions', label: '11. Open Questions' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-[#1A202C] rounded-3xl border border-[#D9E1EC] shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-[#303A4B] bg-gradient-to-r from-[#1A202C] via-[#19232E] to-violet-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Brain className="w-6 h-6 text-violet-100" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm text-[#E7EDF7]">NOVA</span>
                <span className="text-xs text-[#A3B0C4] font-semibold">AI Product Strategist</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 uppercase tracking-wider">
                  Product Requirements Document
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1D2633] text-[#C6D2E4]">
                  v{prd?.version || 1}.0
                </span>
              </div>
              <h2 className="text-base font-bold text-[#E7EDF7] mt-0.5">{title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConfirmed ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>CONFIRMED</span>
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-300 flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <span>READY FOR REVIEW</span>
              </span>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8495AD] hover:text-[#C6D2E4] hover:bg-[#1D2633] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: Sidebar Nav + Scrollable Document Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Section Index Sidebar */}
          <div className="w-64 border-r border-[#303A4B] bg-[#FAFBFD] p-4 overflow-y-auto shrink-0 hidden md:block space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3B0C4] px-2 mb-2">
              Document Sections
            </p>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  const el = document.getElementById(`prd-sec-${item.id}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                  activeSection === item.id
                    ? 'bg-violet-500/10 text-violet-300 font-bold border border-violet-500/25'
                    : 'text-[#475569] hover:bg-[#1D2633]'
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Document View Stream */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-[#1A202C] max-w-3xl mx-auto">
            {/* 1. Executive Summary */}
            <section id="prd-sec-executive" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  1. Executive Summary
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/25 space-y-1">
                  <h4 className="text-xs font-bold text-violet-300">What is being proposed?</h4>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {prd?.executive_summary?.what_proposed || proposal.summary}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#141A24] border border-[#303A4B] space-y-1">
                  <h4 className="text-xs font-bold text-[#E7EDF7]">What problem does it solve?</h4>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {prd?.executive_summary?.problem_solved || proposal.reasoning}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                  <h4 className="text-xs font-bold text-emerald-300">Expected Outcome</h4>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {prd?.executive_summary?.expected_outcome ||
                      'Authoritative alignment between strategic roadmap and engineering execution.'}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Problem Statement */}
            <section id="prd-sec-problem" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  2. Problem Statement
                </h3>
              </div>
              <p className="text-xs text-[#334155] leading-relaxed">
                {prd?.problem_statement?.current_problem || proposal.reasoning}
              </p>
              {prd?.problem_statement?.pain_points && (
                <div className="space-y-1.5 pl-2">
                  <p className="text-xs font-bold text-[#E7EDF7]">User Pain Points:</p>
                  {prd.problem_statement.pain_points.map((p, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#475569]">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Target Users */}
            <section id="prd-sec-users" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  3. Target Users & Needs
                </h3>
              </div>
              <p className="text-xs text-[#334155]">
                <strong>Primary Users:</strong> {prd?.target_users?.primary_users || 'Finance leaders and employees'}
              </p>
              {prd?.target_users?.goals_and_needs && (
                <div className="space-y-1 pl-2">
                  <p className="text-xs font-bold text-[#E7EDF7]">Goals and Needs:</p>
                  {prd.target_users.goals_and_needs.map((g, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#475569]">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Proposed Solution */}
            <section id="prd-sec-solution" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Workflow className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  4. Proposed Solution & Interaction Flow
                </h3>
              </div>
              <p className="text-xs text-[#334155] leading-relaxed">
                {prd?.proposed_solution?.summary || prd?.executive_summary?.what_proposed}
              </p>
              {prd?.proposed_solution?.user_interaction_flow && (
                <div className="space-y-2 p-3 rounded-xl bg-[#141A24] border border-[#303A4B]">
                  <p className="text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider">
                    Interaction Lifecycle:
                  </p>
                  {prd.proposed_solution.user_interaction_flow.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[#334155]">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 5. Functional Requirements */}
            <section id="prd-sec-functional" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  5. Functional Requirements (Numbered & Explicit)
                </h3>
              </div>
              <div className="space-y-3">
                {(prd?.functional_requirements || []).map((fr) => (
                  <div key={fr.id} className="p-3.5 rounded-xl border border-[#303A4B] bg-[#FAFBFD] space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono text-[10px] font-bold">
                          {fr.id}
                        </span>
                        <h4 className="text-xs font-bold text-[#E7EDF7]">{fr.title}</h4>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          fr.priority === 'High'
                            ? 'bg-red-500/10 text-red-300 border border-red-500/25'
                            : 'bg-[#1D2633] text-[#C6D2E4]'
                        }`}
                      >
                        {fr.priority || 'High'}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed pt-1">{fr.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Non-Functional Requirements */}
            <section id="prd-sec-nonfunctional" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Shield className="w-4 h-4 text-[#ACBAD0]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  6. Non-Functional Requirements
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(prd?.non_functional_requirements || []).map((nfr) => (
                  <div key={nfr.id} className="p-3 rounded-xl border border-[#303A4B] bg-[#1A202C] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-[#C6D2E4]">{nfr.id}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1D2633] text-[#ACBAD0] font-semibold">
                        {nfr.category}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-[#E7EDF7]">{nfr.title}</h5>
                    <p className="text-[11px] text-[#A3B0C4] leading-relaxed">{nfr.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 7. User Stories */}
            <section id="prd-sec-stories" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  7. User Stories
                </h3>
              </div>
              <div className="space-y-2">
                {(prd?.user_stories || []).map((us, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#141A24] border border-[#303A4B] text-xs text-[#334155] italic">
                    {us.text || `As a ${us.role}, I want ${us.action}, so that ${us.benefit}.`}
                  </div>
                ))}
              </div>
            </section>

            {/* 8. Acceptance Criteria */}
            <section id="prd-sec-acceptance" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  8. Acceptance Criteria (Measurable)
                </h3>
              </div>
              <div className="space-y-2">
                {(prd?.acceptance_criteria || []).map((ac) => (
                  <div key={ac.id} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-xs text-[#1e293b]">
                    <span className="font-mono text-[10px] font-bold text-emerald-300 shrink-0 pt-0.5">
                      {ac.id}
                    </span>
                    <span>{ac.criterion}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 9. Constraints and Assumptions */}
            <section id="prd-sec-constraints" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  9. Constraints & Assumptions
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#141A24] border border-[#303A4B] space-y-1">
                  <p className="font-bold text-[#E7EDF7]">Constraints:</p>
                  {(prd?.constraints || []).map((c, i) => (
                    <p key={i} className="text-[#475569]">• {c}</p>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-[#141A24] border border-[#303A4B] space-y-1">
                  <p className="font-bold text-[#E7EDF7]">Assumptions:</p>
                  {(prd?.assumptions || []).map((a, i) => (
                    <p key={i} className="text-[#475569]">• {a}</p>
                  ))}
                </div>
              </div>
            </section>

            {/* 10. Dependencies and Risks */}
            <section id="prd-sec-risks" className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  10. Dependencies & Risks
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-bold text-[#E7EDF7]">Related Dependencies: </span>
                  <span className="text-[#475569]">{(prd?.dependencies || []).join(', ')}</span>
                </div>
                {(prd?.risks || []).map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300">
                    <strong>Risk:</strong> {r}
                  </div>
                ))}
              </div>
            </section>

            {/* 11. Open Questions */}
            <section id="prd-sec-questions" className="space-y-3 pb-8">
              <div className="flex items-center gap-2 border-b border-[#293445] pb-2">
                <HelpCircle className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#E7EDF7]">
                  11. Open Questions (Requiring Human Clarification)
                </h3>
              </div>
              {(prd?.open_questions || []).map((q, i) => (
                <div key={i} className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/25 text-xs text-violet-300 space-y-1">
                  <p className="font-semibold">{q}</p>
                </div>
              ))}
            </section>
          </div>
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="p-4 px-6 border-t border-[#303A4B] bg-[#1A202C] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#A3B0C4]">
            {isConfirmed ? (
              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Confirmed by {prd?.confirmed_by?.toUpperCase() || 'ALEX'}
              </span>
            ) : (
              <span>Alex confirmation makes these requirements authoritative for PIXEL implementation</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A3B0C4] hover:bg-[#141A24] transition cursor-pointer"
            >
              Close
            </button>

            {!isConfirmed && (
              <button
                disabled={!isAlex || isConfirming}
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs ${
                  isAlex && !isConfirming
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-[#1D2633] text-[#8495AD] cursor-not-allowed border border-[#303A4B]'
                }`}
                title={isAlex ? 'Confirm requirements as authoritative' : 'Only Alex (Founder / Decision Owner) can confirm requirements'}
              >
                {isConfirming ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Requirements</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
