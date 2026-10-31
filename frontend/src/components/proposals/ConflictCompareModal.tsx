import React from 'react';
import { X, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Proposal, ArtifactSection } from '../../types';

interface ConflictCompareModalProps {
  proposal: Proposal;
  currentSection?: ArtifactSection;
  onClose: () => void;
  onKeepHuman: () => void;
  onRedirectAgent: () => void;
}

export const ConflictCompareModal: React.FC<ConflictCompareModalProps> = ({
  proposal,
  currentSection,
  onClose,
  onKeepHuman,
  onRedirectAgent,
}) => {
  const currentData = currentSection?.data || {};
  const proposedOps = proposal.changes?.operations || [];
  const proposedFields = proposedOps[0]?.fields || {};

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5EAF0] rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col animate-in fade-in-50 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF0]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">Human vs. Agent Section Conflict</h2>
              <p className="text-xs text-[#657189]">
                Compare Maya's current manual edit against PIXEL's older proposed revision.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#657189] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conflict Explanation Banner */}
        <div className="my-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Why did this conflict occur?</p>
            <p className="mt-1 leading-relaxed text-red-800">
              {proposal.conflict_reason ||
                "Maya updated this hero section in the current prototype after PIXEL formulated its proposal based on the previous baseline version. The atomic engine prevented an uncoordinated overwrite."}
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto my-2 pr-1">
          {/* Left Column: Human Version */}
          <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-violet-100">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">
                    M
                  </span>
                  <span className="text-xs font-bold text-[#172033]">Maya's Current Version</span>
                </div>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-white text-violet-700 border border-violet-200">
                  v{currentSection?.version ?? 2} (Active)
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Headline</span>
                  <p className="font-semibold text-[#172033]">
                    {currentData.headline || 'Take control of company spending'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Subheadline</span>
                  <p className="text-[#657189] leading-relaxed">
                    {currentData.subheadline || 'Real-time expense management for high-velocity teams'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Primary CTA</span>
                  <p className="text-teal-700 font-semibold">
                    {currentData.cta_text || 'Start Free Trial'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-violet-100 flex items-center text-xs text-violet-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
              <span>Preserves human creative discretion</span>
            </div>
          </div>

          {/* Right Column: Agent Proposal */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-teal-100">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center">
                    P
                  </span>
                  <span className="text-xs font-bold text-[#172033]">PIXEL's Proposed Version</span>
                </div>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-white text-teal-700 border border-teal-200">
                  Based on v{proposal.base_section_versions?.hero ?? 1} (Outdated)
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Headline</span>
                  <p className="font-semibold text-teal-800">
                    {proposedFields.headline || 'Modern Expense Control, Zero Friction'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Subheadline</span>
                  <p className="text-[#657189] leading-relaxed">
                    {proposedFields.subheadline || 'Empower your team to submit receipts in seconds...'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Primary CTA</span>
                  <p className="text-teal-700 font-semibold">
                    {proposedFields.cta_text || 'Start Free 14-Day Trial'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-teal-100 flex items-center text-xs text-teal-700 font-medium">
              <span className="mr-1.5">🤖</span>
              <span>Based on original brand messaging requirement</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E5EAF0] mt-3">
          <p className="text-xs text-[#657189]">
            Choose whether to keep Maya's version as authoritative, or instruct PIXEL to integrate both.
          </p>

          <div className="flex items-center space-x-3">
            <button
              onClick={onKeepHuman}
              className="px-4 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#172033] border border-[#E5EAF0] text-xs font-semibold transition cursor-pointer"
            >
              Keep Maya's Version (Dismiss Proposal)
            </button>
            <button
              onClick={onRedirectAgent}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Redirect PIXEL (Revise with Maya's Hero)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
