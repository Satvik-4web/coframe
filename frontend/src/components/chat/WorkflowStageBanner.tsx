import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Code2,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { WorkflowStageInfo } from '../../types';

interface WorkflowStageBannerProps {
  stageInfo: WorkflowStageInfo | null;
  onNavigateTab: (tab: any, proposalId?: string) => void;
  onRefresh?: () => void;
}

export const WorkflowStageBanner: React.FC<WorkflowStageBannerProps> = ({
  stageInfo,
  onNavigateTab,
  onRefresh,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!stageInfo) return null;

  const stage = stageInfo.current_stage || 'product_discovery';

  // Theme configuration based on active workflow stage
  let badgeColor = 'bg-violet-50 text-violet-700 border-violet-200';
  let badgeIcon = <Sparkles className="w-3.5 h-3.5 text-violet-600" />;
  let borderHighlight = 'border-violet-200/80 bg-violet-50/20';

  if (stage === 'prd_awaiting_confirmation') {
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
    badgeIcon = <AlertCircle className="w-3.5 h-3.5 text-amber-600" />;
    borderHighlight = 'border-amber-200 bg-amber-50/25';
  } else if (stage === 'implementation_in_progress') {
    badgeColor = 'bg-teal-50 text-teal-700 border-teal-200';
    badgeIcon = <Code2 className="w-3.5 h-3.5 text-teal-600 animate-pulse" />;
    borderHighlight = 'border-teal-200 bg-teal-50/25';
  } else if (stage === 'implementation_awaiting_approval') {
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
    badgeIcon = <FileText className="w-3.5 h-3.5 text-blue-600" />;
    borderHighlight = 'border-blue-200 bg-blue-50/25';
  } else if (stage === 'implementation_applied') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    borderHighlight = 'border-emerald-200 bg-emerald-50/20';
  }

  return (
    <div
      className={`mx-6 mt-4 p-3.5 rounded-2xl border ${borderHighlight} shadow-2xs transition-all duration-200`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Stage Badge & Narrative */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight border ${badgeColor} shrink-0`}
          >
            {badgeIcon}
            <span>{stageInfo.display_label || stageInfo.stage_label || 'Sequential Workflow'}</span>
          </span>

          <p className="text-xs text-[#334155] font-medium truncate">
            {stageInfo.description ||
              (stage === 'prd_awaiting_confirmation'
                ? 'NOVA submitted PRD proposal · Waiting for Alex to confirm requirements'
                : stage === 'implementation_awaiting_approval'
                ? 'PIXEL completed implementation · Awaiting final human approval in Proposals'
                : stage === 'implementation_in_progress'
                ? 'PIXEL has started engineering implementation'
                : 'NOVA is exploring product strategy · PIXEL is waiting for confirmed requirements')}
          </p>
        </div>

        {/* Action Button & Collapse Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {stage === 'prd_awaiting_confirmation' && stageInfo.active_prd_id && (
            <button
              onClick={() => onNavigateTab('proposals', stageInfo.active_prd_id || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <span>Review PRD #{stageInfo.active_prd_id.slice(-6)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {stage === 'implementation_awaiting_approval' && stageInfo.active_pixel_proposal_id && (
            <button
              onClick={() => onNavigateTab('proposals', stageInfo.active_pixel_proposal_id || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <span>Review Implementation #{stageInfo.active_pixel_proposal_id.slice(-6)}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title={isCollapsed ? 'Expand agent details' : 'Collapse agent details'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Agent Readiness Sub-Bar */}
      {!isCollapsed && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          {/* NOVA Agent Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/70">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              N
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-slate-700">NOVA: </span>
              <span className="text-slate-500 truncate">
                {stageInfo.nova_status || 'Analyzing product ideas'}
              </span>
            </div>
          </div>

          {/* PIXEL Agent Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/70">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              P
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-slate-700">PIXEL: </span>
              <span
                className={`truncate ${
                  stageInfo.pixel_status?.includes('Waiting')
                    ? 'text-amber-700 font-medium'
                    : 'text-slate-500'
                }`}
              >
                {stageInfo.pixel_status || 'Waiting for confirmed requirements'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
