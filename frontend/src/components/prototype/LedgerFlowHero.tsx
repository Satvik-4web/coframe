import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2, Zap } from 'lucide-react';

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
    <div
      className="relative overflow-hidden rounded-2xl p-8 border transition-all"
      style={{
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(129, 140, 248, 0.08) 50%, rgba(167, 139, 250, 0.05) 100%)',
        borderColor: 'rgba(34, 211, 238, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(34, 211, 238, 0.1)',
      }}
    >
      {/* Background glow orbs */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{ background: '#22D3EE' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{ background: '#818CF8' }}
      />

      {/* Version badge in top right */}
      <div
        className="absolute top-4 right-4 flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          color: '#94A3B8',
        }}
      >
        <span>hero</span>
        <span className="font-bold text-cyan-400">v{version}</span>
      </div>

      <div className="max-w-2xl relative z-10">
        {data.badge && (
          <div
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-semibold mb-4"
            style={{
              background: 'rgba(34, 211, 238, 0.15)',
              borderColor: 'rgba(34, 211, 238, 0.35)',
              color: '#22D3EE',
              boxShadow: '0 0 12px rgba(34, 211, 238, 0.25)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>{data.badge}</span>
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
          <span className="gradient-text">{data.headline}</span>
        </h1>

        <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-xl">
          {data.subheadline}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #06B6D4, #22D3EE)',
              color: '#042F2E',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)',
            }}
          >
            <span>{data.cta_text}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {data.secondary_cta && (
            <button
              className="px-5 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#F1F5F9',
              }}
            >
              {data.secondary_cta}
            </button>
          )}
        </div>

        <div
          className="mt-6 pt-4 border-t flex flex-wrap items-center gap-6 text-[11px] text-slate-400 font-medium"
          style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
        >
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Automated Receipt Scanning</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>1-Click ERP Synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
