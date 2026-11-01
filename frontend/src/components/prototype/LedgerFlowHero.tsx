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
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-xl p-8 shadow-sm">
      {/* Subtle version badge in top right */}
      <div className="absolute top-4 right-4 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500 font-mono">
        <span>hero section</span>
        <span className="font-bold text-slate-700">v{version}</span>
      </div>

      <div className="max-w-2xl">
        {data.badge && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>{data.badge}</span>
          </div>
        )}

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {data.headline}
        </h1>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-xl">
          {data.subheadline}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-md shadow-teal-700/20 transition flex items-center space-x-1.5 cursor-pointer">
            <span>{data.cta_text}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {data.secondary_cta && (
            <button className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs transition cursor-pointer">
              {data.secondary_cta}
            </button>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center space-x-6 text-[11px] text-slate-500">
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Automated Receipt Scanning</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>1-Click ERP Synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
