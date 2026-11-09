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
    <div className="bg-slate-50/90 border-b border-slate-200/70 px-4 transition-all duration-150 text-xs">
      <div className="max-w-7xl mx-auto py-1.5">
        {/* Compact Strip Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded font-mono shrink-0">
              Observer
            </span>
            <p className="text-xs text-slate-700 font-medium truncate">
              {summary.what_changed || 'Collaboration update available'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition cursor-pointer"
            >
              <span>{isExpanded ? 'Hide' : 'Context'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expandable 3-Pillar Context Panel */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-slate-200/60 grid grid-cols-1 md:grid-cols-3 gap-3 pb-1 animate-in fade-in duration-150">
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
