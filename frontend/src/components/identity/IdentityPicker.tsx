import React from 'react';
import { HumanIdentity } from '../../types';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface IdentityPickerProps {
  onSelect: (id: HumanIdentity) => void;
}

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-6 selection:bg-[#2563EB] selection:text-white">
      <div className="max-w-2xl w-full">
        {/* Clean Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-slate-900/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-5">
            <div className="w-4 h-4 rounded bg-[#0F172A] flex items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="#FFFFFF" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="#93C5FD" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="#93C5FD" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="#FFFFFF" fillOpacity="0.45" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-900 tracking-tight">COFRAME</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium">LedgerFlow Workspace</span>
          </div>

          <h1 className="text-[28px] font-semibold text-slate-900 tracking-[-0.025em] leading-tight">
            Select your collaborator role
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Enter the shared workspace to review requirements, approve specifications, and guide NOVA and PIXEL.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Card 1: Alex */}
          <div
            onClick={() => onSelect('alex')}
            className="group coframe-card p-6 cursor-pointer flex flex-col justify-between hover:border-slate-900/20"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/70 text-[#2563EB] flex items-center justify-center font-semibold text-base">
                  A
                </div>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/60">
                  Decision Owner
                </span>
              </div>

              <h2 className="text-base font-semibold text-slate-900 tracking-tight">Alex</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Founder & Approver</p>
              <p className="text-[13px] text-slate-600 mt-3 leading-relaxed">
                Sets product direction, confirms NOVA specifications, and holds exclusive approval authority over high-impact changes.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-900/[0.06]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('alex');
                }}
                className="w-full h-10 px-4 rounded-xl btn-obsidian text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue as Alex</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Maya */}
          <div
            onClick={() => onSelect('maya')}
            className="group coframe-card p-6 cursor-pointer flex flex-col justify-between hover:border-slate-900/20"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-pink-50 border border-pink-200/70 text-[#BE185D] flex items-center justify-center font-semibold text-base">
                  M
                </div>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-pink-50 text-[#BE185D] border border-pink-200/60">
                  Collaborator
                </span>
              </div>

              <h2 className="text-base font-semibold text-slate-900 tracking-tight">Maya</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Product Designer</p>
              <p className="text-[13px] text-slate-600 mt-3 leading-relaxed">
                Refines interface sections directly on canvas, resolves concurrent conflicts, and redirects PIXEL engineering runs.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-900/[0.06]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect('maya');
                }}
                className="w-full h-10 px-4 rounded-xl btn-apple-secondary text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue as Maya</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Clean Environment Metadata */}
        <div className="px-4 py-3 rounded-xl bg-white/80 border border-slate-900/[0.07] text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.75} />
            <span>Multi-user workspace · Live WebSocket sync</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">LedgerFlow</span>
        </div>
      </div>
    </div>
  );
};
