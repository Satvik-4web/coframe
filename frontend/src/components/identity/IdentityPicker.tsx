import React from 'react';
import { HumanIdentity } from '../../types';
import { Sparkles, ArrowRight, Users, Shield, Layers } from 'lucide-react';

interface IdentityPickerProps {
  onSelect: (id: HumanIdentity) => void;
}

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 bg-[#F6F8FB] z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-white border border-[#E5EAF0] rounded-2xl max-w-2xl w-full p-8 md:p-10 shadow-xl relative overflow-hidden">
        {/* Subtle accent bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-blue-500 to-violet-500" />

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Human + AI Collaborative Workspace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172033] tracking-tight">
            Welcome to COFRAME
          </h1>
          <p className="text-sm text-[#657189] mt-2 max-w-md mx-auto">
            Choose Your Demo Identity to enter the shared LedgerFlow workspace alongside AI agents NOVA and PIXEL.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Card 1: Alex */}
          <div className="p-6 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg mb-4 shadow-sm">
                A
              </div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-[#172033] text-lg">Alex</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Founder
                </span>
              </div>
              <p className="text-xs font-medium text-[#657189] mt-1">Decision Owner</p>
              <p className="text-sm text-[#475569] mt-3 leading-relaxed">
                Owns high-level product strategy, refines enterprise requirements, and holds exclusive signoff authority on high-impact proposals.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => onSelect('alex')}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition flex items-center justify-center space-x-2 shadow-sm group-hover:shadow"
              >
                <span>Join as Alex</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>

          {/* Card 2: Maya */}
          <div className="p-6 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-violet-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-lg mb-4 shadow-sm">
                M
              </div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-[#172033] text-lg">Maya</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                  Designer
                </span>
              </div>
              <p className="text-xs font-medium text-[#657189] mt-1">Product Designer</p>
              <p className="text-sm text-[#475569] mt-3 leading-relaxed">
                Directly crafts prototype sections, reviews agent proposals, resolves human-agent design conflicts, and redirects PIXEL runs.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => onSelect('maya')}
                className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition flex items-center justify-center space-x-2 shadow-sm group-hover:shadow"
              >
                <span>Join as Maya</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-[#657189] bg-[#F1F5F9] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
          <p className="font-medium text-[#334155]">
            <span className="font-bold text-teal-700">Multiplayer Demo Environment:</span> These identities simulate two real collaborators.
          </p>
          <p className="text-[11px] text-[#64748B]">
            Open a second browser session (e.g., Chrome Incognito) to experience live synchronized collaboration and realtime presence.
          </p>
        </div>
      </div>
    </div>
  );
};
