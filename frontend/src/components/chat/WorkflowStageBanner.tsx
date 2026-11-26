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

  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-900/[0.08]';
  if (currentStage === 'prd_awaiting_confirmation') {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200/70';
  } else if (currentStage === 'implementation_in_progress' || currentStage === 'execution_environment_selected') {
    badgeStyle = 'bg-teal-50 text-[#0F766E] border-teal-200/70';
  } else if (currentStage === 'implementation_awaiting_approval') {
    badgeStyle = 'bg-blue-50 text-[#2563EB] border-blue-200/70';
  } else if (currentStage === 'implementation_applied') {
    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
  }

  return (
    <div className="mx-6 mt-3 px-4 py-3 coframe-card transition-all duration-150 shrink-0">
      {/* 1. Top Bar: Stage Badge, Description & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeStyle} shrink-0`}>
            <Layers className="w-3 h-3" strokeWidth={1.75} />
            <span>{stageInfo.display_label || stageInfo.stage_label || 'Sequential lifecycle'}</span>
          </span>

          <p className="text-xs text-slate-700 font-medium truncate">
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
              type="button"
              onClick={() => onNavigateTab('proposals', stageInfo.active_prd_id || undefined)}
              className="h-7 inline-flex items-center gap-1.5 px-3 rounded-lg btn-obsidian text-[11px] font-medium cursor-pointer"
            >
              <span>Review PRD #{stageInfo.active_prd_id.slice(-6)}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {currentStage === 'implementation_awaiting_approval' && stageInfo.active_pixel_proposal_id && (
            <button
              type="button"
              onClick={() => onNavigateTab('proposals', stageInfo.active_pixel_proposal_id || undefined)}
              className="h-7 inline-flex items-center gap-1.5 px-3 rounded-lg btn-obsidian text-[11px] font-medium cursor-pointer"
            >
              <span>Review implementation #{stageInfo.active_pixel_proposal_id.slice(-6)}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title={isCollapsed ? 'Expand workflow timeline' : 'Collapse workflow timeline'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Horizontal 8-Stage Stepper */}
      {!isCollapsed && (
        <div className="mt-3.5 pt-3 border-t border-slate-900/[0.06]">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 items-center">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition border ${
                    isCurrent
                      ? 'bg-[#0F172A]/[0.04] border-slate-900/[0.14]'
                      : isCompleted
                      ? 'bg-emerald-50/60 border-emerald-200/70'
                      : 'bg-slate-50/70 border-transparent text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full bg-[#0F172A] text-white font-mono font-semibold text-[10px] flex items-center justify-center">
                        {step.number}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-500 font-mono font-medium text-[10px] flex items-center justify-center">
                        {step.number}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-medium truncate w-full ${
                      isCurrent
                        ? 'text-slate-900 font-semibold'
                        : isCompleted
                        ? 'text-emerald-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>

                  <span className="text-[10px] font-mono mt-0.5">
                    {isCurrent ? (
                      <span className="text-[#2563EB] font-medium">active</span>
                    ) : isCompleted ? (
                      <span className="text-emerald-600">done</span>
                    ) : (
                      <span className="text-slate-400">wait</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 px-0.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" />
                <span>NOVA: <strong className="font-medium text-slate-900">{stageInfo.nova_status || 'Analyzing strategy'}</strong></span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
                <span>PIXEL: <strong className="font-medium text-slate-900">{stageInfo.pixel_status || 'Waiting for confirmed requirements'}</strong></span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Sequential boundary active</span>
          </div>
        </div>
      )}
    </div>
  );
};
