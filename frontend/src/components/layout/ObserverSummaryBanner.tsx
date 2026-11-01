import React, { useState } from 'react';
import { ObserverSummary } from '../../types';
import { Sparkles, ChevronDown, ChevronUp, X, Info } from 'lucide-react';

interface ObserverSummaryBannerProps {
  summary?: ObserverSummary;
  onViewSource?: (eventId: string) => void;
}

export const ObserverSummaryBanner: React.FC<ObserverSummaryBannerProps> = ({
  summary,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary || isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-violet-50/70 via-indigo-50/50 to-teal-50/50 border-b border-[#E8EAF2] px-6 transition-all duration-200 text-xs">
      <div className="max-w-7xl mx-auto py-2">
        {/* Compact Strip Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800 bg-violet-100 px-2 py-0.5 rounded-full shrink-0">
              Live Synthesis
            </span>
            <p className="text-xs text-[#172033] font-medium truncate">
              {summary.what_changed || 'Collaboration update available'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#657189] hover:text-[#172033] hover:bg-white/80 transition cursor-pointer"
            >
              <span>{isExpanded ? 'Less details' : 'View context'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-[#657189] hover:text-[#172033] hover:bg-white/80 transition cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable 3-Pillar Context Panel (What Changed / Why / Next Steps) */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-violet-100 grid grid-cols-1 md:grid-cols-3 gap-4 pb-1 animate-in fade-in duration-150">
            {/* 1. What Changed */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">
                1. What Changed
              </span>
              <p className="text-xs text-[#172033] leading-relaxed">
                {summary.what_changed}
              </p>
            </div>

            {/* 2. Why */}
            <div className="space-y-1 md:border-l md:border-violet-100 md:pl-4">
              <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">
                2. Rationale & Context
              </span>
              <p className="text-xs text-[#475569] leading-relaxed">
                {summary.why}
              </p>
            </div>

            {/* 3. What Happens Next */}
            <div className="space-y-1 md:border-l md:border-violet-100 md:pl-4">
              <span className="text-[10px] font-bold text-[#0D9488] uppercase tracking-wider">
                3. What Happens Next
              </span>
              <p className="text-xs text-[#475569] leading-relaxed">
                {summary.what_happens_next}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
