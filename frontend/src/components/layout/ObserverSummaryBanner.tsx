import React from 'react';
import { ObserverSummary } from '../../types';
import { Eye, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ObserverSummaryBannerProps {
  summary?: ObserverSummary;
  onViewSource?: (eventId: string) => void;
}

export const ObserverSummaryBanner: React.FC<ObserverSummaryBannerProps> = ({ summary, onViewSource }) => {
  if (!summary) return null;

  return (
    <div className="bg-[#121824] border-b border-[#263244] px-6 py-3 shadow-inner">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-violet-500/20 text-violet-400">
              <Eye className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold tracking-wider uppercase text-[#F4F7FB]">
              COFRAME Observer Summary
            </span>
            <span className="text-[10px] text-[#98A5B7]">
              Plain-language synthesis for non-technical judges & founders
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                summary.source === 'live_llm'
                  ? 'bg-violet-950/40 text-violet-300 border-violet-700/40'
                  : 'bg-[#1B2433] text-teal-400 border-teal-500/30'
              }`}
            >
              {summary.source === 'live_llm' ? '● Live LLM Synthesized' : '● Rule-Based Engine'}
            </span>
            {summary.is_simulated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-700/40 font-mono">
                SIMULATED FALLBACK
              </span>
            )}
          </div>
        </div>

        {/* 3-Column Grid: WHAT CHANGED | WHY | WHAT HAPPENS NEXT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: WHAT CHANGED */}
          <div className="bg-[#182132] border border-[#263244] rounded-lg p-2.5 flex flex-col justify-between hover:border-violet-500/40 transition">
            <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-bold text-violet-400 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span>What Changed</span>
            </div>
            <p className="text-xs text-[#F4F7FB] leading-snug line-clamp-2">{summary.what_changed}</p>
          </div>

          {/* Card 2: WHY */}
          <div className="bg-[#182132] border border-[#263244] rounded-lg p-2.5 flex flex-col justify-between hover:border-blue-500/40 transition">
            <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-bold text-blue-400 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Why</span>
            </div>
            <p className="text-xs text-[#98A5B7] leading-snug line-clamp-2">{summary.why}</p>
          </div>

          {/* Card 3: WHAT HAPPENS NEXT */}
          <div className="bg-[#182132] border border-[#263244] rounded-lg p-2.5 flex flex-col justify-between hover:border-teal-500/40 transition">
            <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-bold text-teal-400 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>What Happens Next</span>
            </div>
            <p className="text-xs text-teal-100/90 leading-snug line-clamp-2">{summary.what_happens_next}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
