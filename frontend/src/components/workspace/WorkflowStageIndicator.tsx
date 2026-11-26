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
    <div className="bg-white border border-[#E5EAF0] rounded-2xl p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#F0F3F7]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
            Active Collaboration Workflow
          </h3>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
            {stageInfo?.stage_label || 'Product Discovery'}
          </span>
        </div>

        <p className="text-xs text-[#657189]">
          Acting: <strong className="text-[#172033] font-semibold">{stageInfo?.actor || 'Alex (Founder)'}</strong>
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
                  ? 'bg-teal-50/70 border-teal-300 shadow-2xs ring-1 ring-teal-200'
                  : isPast
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                  : 'bg-[#F8FAFC] border-[#E5EAF0] text-[#657189] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? 'bg-teal-600 text-white'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono font-bold text-[#657189]">
                  {idx + 1}/7
                </span>
              </div>

              <div>
                <p className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-teal-900' : isPast ? 'text-emerald-900' : 'text-[#657189]'}`}>
                  {s.label.split('. ')[1]}
                </p>
                <p className="text-[10px] text-[#657189] mt-0.5 truncate">
                  {s.short}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {stageInfo?.description && (
        <div className="mt-3 pt-2.5 border-t border-[#F0F3F7] flex items-center justify-between text-xs text-[#657189]">
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-[#172033]">Current Step:</span>
            <span>{stageInfo.description}</span>
          </p>
          {currentStage === 'requirements_review' && onOpenPRD && (
            <button
              onClick={onOpenPRD}
              className="text-xs font-semibold text-teal-700 hover:underline shrink-0 ml-2"
            >
              Review PRD →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
