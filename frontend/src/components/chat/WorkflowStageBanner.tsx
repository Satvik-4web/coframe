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
  Layers,
  Check,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { WorkflowStageInfo } from '../../types';

interface WorkflowStageBannerProps {
  stageInfo: WorkflowStageInfo | null;
  onNavigateTab: (tab: any, proposalId?: string) => void;
  onRefresh?: () => void;
}

interface StepDefinition {
  id: string;
  number: number;
  label: string;
  shortLabel: string;
}

const WORKFLOW_STEPS: StepDefinition[] = [
  { id: 'idea', number: 1, label: 'Idea', shortLabel: 'Idea' },
  { id: 'prd', number: 2, label: 'PRD', shortLabel: 'PRD' },
  { id: 'prd_approval', number: 3, label: 'PRD Approval', shortLabel: 'Approve' },
  { id: 'plan', number: 4, label: 'Impl Plan', shortLabel: 'Plan' },
  { id: 'plan_approval', number: 5, label: 'Plan Approval', shortLabel: 'Approve' },
  { id: 'execution', number: 6, label: 'Execution', shortLabel: 'Exec' },
  { id: 'final_review', number: 7, label: 'Final Review', shortLabel: 'Review' },
  { id: 'integration', number: 8, label: 'Integration', shortLabel: 'Done' },
];

export const WorkflowStageBanner: React.FC<WorkflowStageBannerProps> = ({
  stageInfo,
  onNavigateTab,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!stageInfo) return null;

  const currentStage = stageInfo.current_stage || 'product_discovery';

  // Map backend current_stage to active step index (0-7)
  let activeStepIndex = 0;
  if (currentStage === 'product_discovery' || currentStage === 'product_clarification') {
    activeStepIndex = 0; // 1. Idea
  } else if (currentStage === 'prd_created') {
    activeStepIndex = 1; // 2. PRD
  } else if (currentStage === 'prd_awaiting_confirmation') {
    activeStepIndex = 2; // 3. PRD Approval
  } else if (currentStage === 'prd_confirmed' || currentStage === 'planning_in_progress') {
    activeStepIndex = 3; // 4. Impl Plan
  } else if (currentStage === 'plan_awaiting_approval') {
    activeStepIndex = 4; // 5. Plan Approval
  } else if (currentStage === 'execution_environment_selected' || currentStage === 'implementation_in_progress') {
    activeStepIndex = 5; // 6. Execution
  } else if (currentStage === 'implementation_awaiting_approval' || currentStage === 'implementation_completed') {
    activeStepIndex = 6; // 7. Final Review
  } else if (currentStage === 'implementation_applied') {
    activeStepIndex = 7; // 8. Integration
  }

  // Theme styling based on active stage
  let themeBadge = 'bg-violet-50 text-violet-700 border-violet-200';
  let borderCard = 'border-[#E8EAF2] bg-white';
  if (currentStage === 'prd_awaiting_confirmation') {
    themeBadge = 'bg-amber-50 text-amber-800 border-amber-300';
    borderCard = 'border-amber-200 bg-amber-50/15';
  } else if (currentStage === 'implementation_in_progress' || currentStage === 'execution_environment_selected') {
    themeBadge = 'bg-teal-50 text-teal-700 border-teal-200';
    borderCard = 'border-teal-200 bg-teal-50/15';
  } else if (currentStage === 'implementation_awaiting_approval') {
    themeBadge = 'bg-blue-50 text-blue-800 border-blue-300';
    borderCard = 'border-blue-200 bg-blue-50/15';
  } else if (currentStage === 'implementation_applied') {
    themeBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    borderCard = 'border-emerald-200 bg-emerald-50/15';
  }

  return (
    <div className={`mx-6 mt-4 p-3.5 rounded-2xl border ${borderCard} shadow-2xs transition-all duration-200`}>
      {/* 1. Top Bar: Stage Badge, Description & Quick Navigation Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight border ${themeBadge} shrink-0`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{stageInfo.display_label || stageInfo.stage_label || 'Sequential Lifecycle'}</span>
          </span>

          <p className="text-xs text-[#172033] font-medium truncate">
            {stageInfo.description ||
              (currentStage === 'prd_awaiting_confirmation'
                ? 'NOVA submitted PRD proposal · Waiting for Alex to confirm requirements'
                : currentStage === 'implementation_awaiting_approval'
                ? 'PIXEL completed implementation · Awaiting final human approval in Proposals'
                : currentStage === 'implementation_in_progress'
                ? 'PIXEL has started engineering implementation'
                : 'NOVA is analyzing product strategy · PIXEL is waiting for confirmed requirements')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentStage === 'prd_awaiting_confirmation' && stageInfo.active_prd_id && (
            <button
              onClick={() => onNavigateTab('proposals', stageInfo.active_prd_id || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <span>Review PRD #{stageInfo.active_prd_id.slice(-6)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {currentStage === 'implementation_awaiting_approval' && stageInfo.active_pixel_proposal_id && (
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
            className="p-1 rounded-lg text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition cursor-pointer"
            title={isCollapsed ? 'Expand workflow timeline' : 'Collapse workflow timeline'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Horizontal 8-Stage Sequential Workflow Stepper */}
      {!isCollapsed && (
        <div className="mt-3.5 pt-3 border-t border-[#E8EAF2]/80">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 items-center">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;
              const isWaiting = idx > activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition border ${
                    isCurrent
                      ? 'bg-violet-50/80 border-violet-300 shadow-2xs'
                      : isCompleted
                      ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                      : 'bg-[#F8FAFC] border-transparent text-[#94A3B8]'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full bg-violet-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-violet-300 animate-pulse">
                        {step.number}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 font-bold text-[10px] flex items-center justify-center">
                        {step.number}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-semibold truncate w-full ${
                      isCurrent
                        ? 'text-violet-900 font-bold'
                        : isCompleted
                        ? 'text-emerald-900 font-semibold'
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    {step.label}
                  </span>

                  <span className="text-[9px] uppercase tracking-wider font-mono mt-0.5">
                    {isCurrent ? (
                      <span className="text-violet-700 font-bold">Active</span>
                    ) : isCompleted ? (
                      <span className="text-emerald-700 font-medium">Done</span>
                    ) : (
                      <span className="text-slate-400">Wait</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Agent Readiness Footnote */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] text-[#657189] px-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600" />
                <span>NOVA: <strong className="text-[#172033]">{stageInfo.nova_status || 'Analyzing strategy'}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                <span>PIXEL: <strong className="text-[#172033]">{stageInfo.pixel_status || 'Waiting for confirmed requirements'}</strong></span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Sequential Execution Boundary Enforced</span>
          </div>
        </div>
      )}
    </div>
  );
};
