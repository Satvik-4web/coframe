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
    <div className="fixed inset-0 bg-[#0B1020]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#151B29] border border-[#263244] rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#263244]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F4F7FB]">Human vs. Agent Section Conflict</h2>
              <p className="text-xs text-[#98A5B7]">
                Compare Maya's current manual edit against PIXEL's older proposed revision.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#98A5B7] hover:text-[#F4F7FB]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Explanation Banner */}
        <div className="my-4 p-3.5 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-200 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Why did this conflict occur?</p>
            <p className="mt-0.5 leading-relaxed text-[#F4F7FB]">
              {proposal.conflict_reason ||
                "Maya updated this hero section in the current prototype after PIXEL formulated its proposal based on the previous baseline version. The atomic engine prevented an uncoordinated overwrite."}
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto my-2 pr-1">
          {/* Left Column: Human Version */}
          <div className="rounded-xl border border-purple-500/40 bg-[#182030] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#263244]">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center">
                    M
                  </span>
                  <span className="text-xs font-bold text-[#F4F7FB]">Maya's Current Version</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/50">
                  v{currentSection?.version ?? 2} (Active)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Headline</span>
                  <p className="font-semibold text-[#F4F7FB] mt-0.5">
                    {currentData.headline || 'Take control of company spending'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Subheadline</span>
                  <p className="text-[#98A5B7] mt-0.5 leading-relaxed">
                    {currentData.subheadline || 'Real-time expense management for high-velocity teams'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Primary CTA</span>
                  <p className="text-teal-400 font-medium mt-0.5">
                    {currentData.cta_text || 'Start Free Trial'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#263244] flex items-center text-[11px] text-purple-300">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Preserves human creative discretion</span>
            </div>
          </div>

          {/* Right Column: Agent Proposal */}
          <div className="rounded-xl border border-teal-500/40 bg-[#182030] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#263244]">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center justify-center">
                    P
                  </span>
                  <span className="text-xs font-bold text-[#F4F7FB]">PIXEL's Proposed Version</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950/40 text-teal-300 border border-teal-800/50">
                  Based on v{proposal.base_section_versions?.hero ?? 1} (Outdated)
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Headline</span>
                  <p className="font-semibold text-teal-300 mt-0.5">
                    {proposedFields.headline || 'Modern Expense Control, Zero Friction'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Subheadline</span>
                  <p className="text-[#98A5B7] mt-0.5 leading-relaxed">
                    {proposedFields.subheadline || 'Empower your team to submit receipts in seconds...'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Primary CTA</span>
                  <p className="text-teal-400 font-medium mt-0.5">
                    {proposedFields.cta_text || 'Start Free 14-Day Trial'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#263244] flex items-center text-[11px] text-teal-300">
              <span className="mr-1">🤖</span>
              <span>Based on original brand messaging requirement</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#263244] mt-2">
          <p className="text-[11px] text-[#98A5B7]">
            Choose whether to keep Maya's version as authoritative, or instruct PIXEL to integrate both.
          </p>

          <div className="flex items-center space-x-3">
            <button
              onClick={onKeepHuman}
              className="px-4 py-2 rounded-lg bg-[#1B2433] hover:bg-[#222E42] text-[#F4F7FB] border border-[#263244] text-xs font-medium transition cursor-pointer"
            >
              Keep Maya's Version (Dismiss Proposal)
            </button>
            <button
              onClick={onRedirectAgent}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium shadow-md shadow-teal-700/20 transition cursor-pointer"
            >
              Redirect PIXEL (Revise with Maya's Hero)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
