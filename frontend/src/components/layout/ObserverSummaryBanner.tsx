import React, { useState } from 'react';
import { ObserverSummary } from '../../types';
import { Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react';

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
    <div className="border-b border-blue-100 bg-[#EFF5FC] px-4 text-xs transition-all duration-150">
      <div className="mx-auto max-w-[1400px] py-2.5">
        {/* Compact Strip Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="hidden shrink-0 rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 sm:inline">
              Observer
            </span>
            <p className="truncate text-xs font-medium text-[#29425F] sm:text-sm">
              {summary.what_changed || 'Collaboration update available'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <span>{isExpanded ? 'Hide' : 'Context'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss update"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-blue-100 hover:text-slate-800"
              title="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expandable 3-Pillar Context Panel */}
        {isExpanded && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-blue-200/60 pb-2 pt-4 md:grid-cols-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                1. What Changed
              </span>
              <p className="text-xs text-slate-800 leading-relaxed">
                {summary.what_changed}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                2. Strategic Context
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {summary.why || 'Maintains strict requirement provenance and contract alignment.'}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                3. Authoritative Next Step
              </span>
              <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                {summary.what_happens_next || 'Review active proposals in the Proposals tab.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
