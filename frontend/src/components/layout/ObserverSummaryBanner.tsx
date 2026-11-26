import React, { useState } from 'react';
import { ObserverSummary } from '../../types';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

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
    <div className="bg-slate-50/70 border-b border-slate-900/[0.06] px-5 text-xs select-none">
      <div className="max-w-7xl mx-auto py-1.5">
        {/* Compact Strip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 shrink-0">
              Latest
            </span>
            <span className="text-slate-300 shrink-0">·</span>
            <p className="text-xs text-slate-700 font-medium truncate">
              {summary.what_changed || 'Collaboration update available'}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-900/[0.05] transition cursor-pointer"
            >
              <span>{isExpanded ? 'Hide details' : 'Details'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-900/[0.05] transition cursor-pointer"
              title="Dismiss update"
              aria-label="Dismiss update"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expandable 3-Column Context Panel */}
        {isExpanded && (
          <div className="mt-2 pt-2.5 border-t border-slate-900/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 pb-1">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">
                What changed
              </span>
              <p className="text-xs text-slate-800 leading-relaxed">
                {summary.what_changed}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">
                Why it matters
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {summary.why || 'Maintains requirement provenance and contract alignment.'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">
                Next step
              </span>
              <p className="text-xs text-[#2563EB] font-medium leading-relaxed">
                {summary.what_happens_next || 'Review active specifications in Proposals.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
