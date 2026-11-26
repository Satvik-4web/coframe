import React from 'react';
import { WorkflowStageInfo } from '../../types';
import {
  Compass,
  FileText,
  Layers,
  Code2,
  CheckCircle2,
  UserCheck,
  Sparkles,
} from 'lucide-react';

interface WorkflowStageIndicatorProps {
  stageInfo?: WorkflowStageInfo;
  onOpenDiscovery?: () => void;
  onOpenPRD?: () => void;
}

const STAGES = [
  { id: 'discovery', label: '1. Discovery', icon: Sparkles, short: 'Idea' },
  { id: 'requirements_review', label: '2. PRD Review', icon: FileText, short: 'NOVA PRD' },
  { id: 'implementation_planning', label: '3. Planning', icon: Layers, short: 'PIXEL Plan' },
  { id: 'prototype_development', label: '4. Prototype', icon: Code2, short: 'PIXEL Code' },
  { id: 'agent_review', label: '5. Agent Review', icon: CheckCircle2, short: 'Review' },
  { id: 'human_approval', label: '6. Human Sign-off', icon: UserCheck, short: 'Alex Gate' },
  { id: 'completed', label: '7. Merged', icon: Compass, short: 'Artifact' },
];

export const WorkflowStageIndicator: React.FC<WorkflowStageIndicatorProps> = ({
  stageInfo,
  onOpenDiscovery,
  onOpenPRD,
}) => {
  const currentStage = stageInfo?.current_stage || 'discovery';
  const activeIdx = stageInfo?.active_index ?? 0;

  return (
    <div className="bg-[#1A202C] border border-[#E5EAF0] rounded-2xl p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#293445]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E7EDF7]">
            Active Collaboration Workflow
          </h3>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-semibold text-teal-300 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/25">
            {stageInfo?.stage_label || 'Product Discovery'}
          </span>
        </div>

        <p className="text-xs text-[#A3B0C4]">
          Acting: <strong className="text-[#E7EDF7] font-semibold">{stageInfo?.actor || 'Alex (Founder)'}</strong>
        </p>
      </div>

      {/* Horizontal Steps Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAGES.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = idx === activeIdx;
          const isPast = idx < activeIdx;

          return (
            <div
              key={s.id}
              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'bg-teal-500/10 border-teal-300 shadow-2xs ring-1 ring-teal-200'
                  : isPast
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-[#141A24] border-[#E5EAF0] text-[#A3B0C4] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? 'bg-teal-600 text-white'
                      : isPast
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-[#303D50] text-[#96A6BE]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono font-bold text-[#A3B0C4]">
                  {idx + 1}/7
                </span>
              </div>

              <div>
                <p className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-teal-300' : isPast ? 'text-emerald-300' : 'text-[#A3B0C4]'}`}>
                  {s.label.split('. ')[1]}
                </p>
                <p className="text-[10px] text-[#A3B0C4] mt-0.5 truncate">
                  {s.short}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {stageInfo?.description && (
        <div className="mt-3 pt-2.5 border-t border-[#293445] flex items-center justify-between text-xs text-[#A3B0C4]">
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-[#E7EDF7]">Current Step:</span>
            <span>{stageInfo.description}</span>
          </p>
          {currentStage === 'requirements_review' && onOpenPRD && (
            <button
              onClick={onOpenPRD}
              className="text-xs font-semibold text-teal-300 hover:underline shrink-0 ml-2"
            >
              Review PRD →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
