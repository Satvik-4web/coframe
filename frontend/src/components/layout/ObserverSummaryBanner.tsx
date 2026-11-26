import React, { useState } from 'react';
import { ObserverSummary } from '../../types';
import { ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';

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
    <div
      className="px-5 text-xs select-none transition-colors border-b"
      style={{
        background: '#F1F5FC',
        borderColor: '#E1E7F0',
      }}
    >
      <div className="max-w-7xl mx-auto py-2">
        {/* Compact Strip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: '#5279CC',
                boxShadow: 'none',
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
                Live State
              </span>
            </div>
            <span className="text-slate-400 shrink-0">·</span>
            <p className="text-xs text-slate-700 font-medium truncate">
              {summary.what_changed || 'Collaboration update available'}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
              style={{ background: 'rgba(255, 255, 255, 0.04)' }}
            >
              <span>{isExpanded ? 'Hide details' : 'Context'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition cursor-pointer"
              title="Dismiss update"
              aria-label="Dismiss update"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable 3-Column Context Panel */}
        {isExpanded && (
          <div
            className="mt-2.5 pt-3 border-t grid grid-cols-1 md:grid-cols-3 gap-4 pb-1"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <div
              className="p-3 rounded-xl"
              style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}
            >
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                What changed
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {summary.what_changed}
              </p>
            </div>

            <div
              className="p-3 rounded-xl"
              style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}
            >
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Why it matters
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {summary.why || 'Maintains requirement provenance and contract alignment.'}
              </p>
            </div>

            <div
              className="p-3 rounded-xl"
              style={{
                background: 'rgba(129, 140, 248, 0.06)',
                border: '1px solid rgba(129, 140, 248, 0.15)',
              }}
            >
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-700 block mb-1">
                Next step
              </span>
              <p className="text-xs text-indigo-200 font-medium leading-relaxed">
                {summary.what_happens_next || 'Review active specifications in Proposals.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


