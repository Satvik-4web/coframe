import React from 'react';
import { ObserverSummary } from '../../types';
import { Sparkles, Info, ChevronDown } from 'lucide-react';

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
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
              Latest Collaboration Update
            </h4>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-xs text-[#657189]">
              Plain-language summary of team activity
            </span>
          </div>

          <details className="text-[11px] text-[#657189] cursor-pointer group">
            <summary className="hover:text-[#172033] flex items-center gap-1 list-none font-medium">
              <span>Technical details</span>
              <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="absolute right-6 mt-1 bg-white border border-[#E5EAF0] rounded-xl p-3 shadow-lg z-30 text-xs w-64 space-y-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="font-bold text-[#172033] mb-1">Synthesis Metadata</div>
              <p>Source: <span className="font-mono">{summary.source}</span></p>
              <p>Context Version: <span className="font-mono">v{summary.context_version}</span></p>
              <p>Artifact Version: <span className="font-mono">v{summary.artifact_version}</span></p>
              <p>Audit Events: <span className="font-mono">{summary.source_event_ids?.length || 0} events</span></p>
            </div>
          </details>
        </div>

        {/* 3-Section Aligned Row: What Changed / Why / What Happens Next (Requirement 1.E) */}
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
