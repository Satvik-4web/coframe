import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface LedgerFlowHeroProps {
  data: {
    headline: string;
    subheadline: string;
    cta_text: string;
    secondary_cta?: string;
    badge?: string;
  };
  version: number;
}

export const LedgerFlowHero: React.FC<LedgerFlowHeroProps> = ({ data, version }) => {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#2C4851] bg-gradient-to-br from-[#152D32] via-[#19232E] to-[#1B2B40] p-6 shadow-[0_18px_38px_-28px_rgba(12,78,71,.4)] sm:p-10">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[38px] border-teal-400/10" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-indigo-300/20 blur-[60px]" />
      {/* Subtle version badge in top right */}
      <div className="absolute right-4 top-4 flex items-center space-x-1 rounded-full border border-teal-500/25 bg-[#1A202C]/80 px-2.5 py-1 font-mono text-[10px] text-teal-300">
        <span>hero section</span>
        <span className="font-bold text-[#C6D2E4]">v{version}</span>
      </div>

      <div className="relative max-w-2xl pt-6 sm:pt-3">
        {data.badge && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{data.badge}</span>
          </div>
        )}

        <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold text-[#E1EFF4] tracking-[-.05em] leading-[1.1]">
          {data.headline}
        </h1>

        <p className="mt-5 text-sm text-[#ACBAD0] leading-7 max-w-xl sm:text-base">
          {data.subheadline}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span aria-label="Preview of primary call to action" className="px-5 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-sm shadow-md shadow-teal-700/20 flex items-center space-x-1.5">
            <span>{data.cta_text}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>

          {data.secondary_cta && (
            <span aria-label="Preview of secondary call to action" className="px-5 py-3 rounded-xl bg-[#1A202C] text-[#C6D2E4] border border-[#303A4B] font-semibold text-sm">
              {data.secondary_cta}
            </span>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-teal-900/10 pt-5 text-xs text-[#ACBAD0]">
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Automated Receipt Scanning</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>1-Click ERP Synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
