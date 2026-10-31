import React from 'react';
import { HumanIdentity } from '../../types';
import { Shield, Sparkles, User, CheckCircle2 } from 'lucide-react';

interface IdentityPickerProps {
  onSelect: (id: HumanIdentity) => void;
}

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 bg-[#0B1020]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#151B29] border border-[#263244] rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-xl bg-[#1B2433] border border-[#263244] text-teal-400 mb-3 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#F4F7FB]">Choose Your Demo Identity</h2>
          <p className="text-xs text-[#98A5B7] mt-1 max-w-sm mx-auto">
            COFRAME multiplayer session: Alex and Maya collaborate with AI agents NOVA and PIXEL on LedgerFlow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Option 1: Alex */}
          <button
            onClick={() => onSelect('alex')}
            className="group p-5 rounded-xl bg-[#1B2433] hover:bg-[#202B3D] border border-[#263244] hover:border-blue-500/60 text-left transition relative flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-lg mb-3">
                A
              </div>
              <h3 className="font-bold text-[#F4F7FB] text-base group-hover:text-blue-400 transition">
                Alex
              </h3>
              <p className="text-xs font-semibold text-blue-400/90 mt-0.5">Founder & Decision Owner</p>
              <p className="text-[11px] text-[#98A5B7] mt-2 leading-relaxed">
                Edits product strategy requirements, reviews enterprise policies, and holds exclusive authority over high-impact approvals.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#263244] flex items-center text-xs text-blue-400 font-medium">
              <span>Join as Alex</span>
              <span className="ml-1 group-hover:translate-x-1 transition">→</span>
            </div>
          </button>

          {/* Option 2: Maya */}
          <button
            onClick={() => onSelect('maya')}
            className="group p-5 rounded-xl bg-[#1B2433] hover:bg-[#202B3D] border border-[#263244] hover:border-purple-500/60 text-left transition relative flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-lg mb-3">
                M
              </div>
              <h3 className="font-bold text-[#F4F7FB] text-base group-hover:text-purple-400 transition">
                Maya
              </h3>
              <p className="text-xs font-semibold text-purple-400/90 mt-0.5">Product Designer</p>
              <p className="text-[11px] text-[#98A5B7] mt-2 leading-relaxed">
                Directly crafts prototype sections, reviews agent visual proposals, resolves conflicts, and redirects agent engineering runs.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#263244] flex items-center text-xs text-purple-400 font-medium">
              <span>Join as Maya</span>
              <span className="ml-1 group-hover:translate-x-1 transition">→</span>
            </div>
          </button>
        </div>

        <div className="text-center text-[11px] text-[#98A5B7]">
          💡 <span className="font-semibold text-[#F4F7FB]">Multiplayer Tip:</span> Open a second browser window (e.g. Incognito) and select the other identity to see live Realtime presence and synchronized state!
        </div>
      </div>
    </div>
  );
};
