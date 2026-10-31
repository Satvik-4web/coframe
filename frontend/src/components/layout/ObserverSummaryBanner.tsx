import React from 'react';
import { ObserverSummary } from '../../types';
import { Sparkles, ArrowRight, Zap, Info } from 'lucide-react';

interface ObserverSummaryBannerProps {
  summary?: ObserverSummary;
  onViewSource?: (eventId: string) => void;
}

export const ObserverSummaryBanner: React.FC<ObserverSummaryBannerProps> = ({
  summary,
}) => {
  if (!summary) return null;

  return (
    <div className="bg-white border-b border-[#E5EAF0] px-6 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto space-y-2.5">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              Latest Collaboration Update
            </h4>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-xs text-[#657189]">
              Plain-language synthesis of team activity
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                summary.source === 'live_llm'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {summary.source === 'live_llm' ? 'Live AI Synthesis' : 'Rule-Based Synthesis'}
            </span>
            {summary.is_simulated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold uppercase">
                Simulated Fallback
              </span>
            )}
          </div>
        </div>

        {/* 3-Section Aligned Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Section 1: What Changed */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-teal-700 uppercase tracking-wide">
              <span>What Changed</span>
            </div>
            <p className="text-xs text-[#172033] leading-relaxed font-medium">
              {summary.what_changed}
            </p>
          </div>

          {/* Section 2: Why */}
          <div className="space-y-1 md:border-l md:border-[#E5EAF0] md:pl-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-blue-700 uppercase tracking-wide">
              <span>Why</span>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              {summary.why}
            </p>
          </div>

          {/* Section 3: What Happens Next */}
          <div className="space-y-1 md:border-l md:border-[#E5EAF0] md:pl-4">
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-violet-700 uppercase tracking-wide">
              <span>What Happens Next</span>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              {summary.what_happens_next}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
