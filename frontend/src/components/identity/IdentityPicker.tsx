import React from 'react';
import { HumanIdentity } from '../../types';
import { ArrowRight, ShieldCheck, Sparkles, User, Palette } from 'lucide-react';

interface IdentityPickerProps {
  onSelect: (id: HumanIdentity) => void;
}

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-6 selection:bg-teal-500 selection:text-white">
      <div className="max-w-2xl w-full">
        {/* Brand & Welcoming Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E7ECF2] shadow-2xs mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-semibold text-[#172033] tracking-wide">COFRAME</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-[#657189]">Human + AI, One Shared Creation</span>
          </div>

          <h1 className="text-3xl font-bold text-[#172033] tracking-tight">
            Welcome to your workspace.
          </h1>
          <p className="text-sm text-[#657189] mt-2 max-w-md mx-auto leading-relaxed">
            Choose Your Demo Identity to enter the LedgerFlow collaboration with NOVA & PIXEL.
          </p>
        </div>

        {/* Identity Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Card 1: Alex (Founder) */}
          <div
            onClick={() => onSelect('alex')}
            className="group bg-white rounded-2xl border border-[#E7ECF2] hover:border-blue-400 p-6 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shadow-2xs group-hover:scale-105 transition-transform">
                  A
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Founder
                </span>
              </div>

              <h2 className="text-lg font-bold text-[#172033] group-hover:text-blue-700 transition">
                Alex
              </h2>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">Final Decision Owner</p>
              <p className="text-xs text-[#657189] mt-3 leading-relaxed">
                Directs product vision, updates strategic requirements, and retains exclusive authority to approve high-impact proposals.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#F0F3F7]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('alex');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs group-hover:shadow"
              >
                <span>Join as Alex</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>

          {/* Card 2: Maya (Product Designer) */}
          <div
            onClick={() => onSelect('maya')}
            className="group bg-white rounded-2xl border border-[#E7ECF2] hover:border-purple-400 p-6 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg shadow-2xs group-hover:scale-105 transition-transform">
                  M
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                  Collaborator
                </span>
              </div>

              <h2 className="text-lg font-bold text-[#172033] group-hover:text-purple-700 transition">
                Maya
              </h2>
              <p className="text-xs font-semibold text-purple-600 mt-0.5">Product Designer</p>
              <p className="text-xs text-[#657189] mt-3 leading-relaxed">
                Refines user interface sections, reviews agent proposals, resolves design conflicts, and redirects PIXEL implementation runs.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#F0F3F7]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('maya');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs group-hover:shadow"
              >
                <span>Join as Maya</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>
        </div>

        {/* Discreet Environment Footnote */}
        <div className="p-4 rounded-xl bg-white border border-[#E7ECF2] text-xs text-[#657189] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Multi-User Demo Workspace · Real-time WebSocket Synchronisation</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">LedgerFlow Demo</span>
        </div>
      </div>
    </div>
  );
};
