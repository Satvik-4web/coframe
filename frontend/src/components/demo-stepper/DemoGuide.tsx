import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  X,
  Compass,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
} from 'lucide-react';
import {
  startCollaboration,
  updateRequirement,
  editArtifactSection,
  restartAgent,
  triggerPolicyProposal,
} from '../../lib/api';
import { HumanIdentity, Proposal } from '../../types';

interface DemoGuideProps {
  currentStep: number;
  onSetStep: (s: number) => void;
  identity: HumanIdentity;
  proposals: Proposal[];
  onRefresh: () => void;
  onNavigateTab: (tab: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const DemoGuide: React.FC<DemoGuideProps> = ({
  currentStep,
  onSetStep,
  identity,
  proposals,
  onRefresh,
  onNavigateTab,
  isOpen,
  onClose,
}) => {
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  const steps = [
    {
      step: 1,
      title: 'Step 1: Multi-User Collaboration & Presence',
      description: 'Open two browser windows (Alex and Maya) to see realtime presence and synchronization.',
      buttonLabel: 'Verify Step 1 Presence',
      action: async () => {
        onNavigateTab('workspace');
      },
    },
    {
      step: 2,
      title: 'Step 2: Start Parallel Agent Runs',
      description: 'Dispatch NOVA (Strategist) and PIXEL (Engineer) to generate initial proposals in parallel.',
      buttonLabel: 'Start Collaboration (Run Agents)',
      action: async () => {
        setLoadingStep(2);
        try {
          await startCollaboration('demo-ledgerflow');
          onRefresh();
          onNavigateTab('proposals');
          onSetStep(3);
          onClose();
        } finally {
          setLoadingStep(null);
        }
      },
    },
    {
      step: 3,
      title: 'Step 3: Mid-flight Requirement Change',
      description: "Alex updates REQ_AUDIENCE to 'Enterprise finance teams', advancing context_version.",
      buttonLabel: 'Update REQ_AUDIENCE (Alex)',
      action: async () => {
        setLoadingStep(3);
        try {
          await updateRequirement(
            'demo-ledgerflow',
            'REQ_AUDIENCE',
            'Enterprise finance teams',
            'alex'
          );
          onRefresh();
          onNavigateTab('proposals');
          onSetStep(4);
        } finally {
          setLoadingStep(null);
        }
      },
    },
    {
      step: 4,
      title: 'Step 4: Selective Staleness & Section Conflict',
      description: 'Proposal A stales selectively; Maya edits the Hero section, creating a visual conflict.',
      buttonLabel: 'Simulate Maya Hero Edit',
      action: async () => {
        setLoadingStep(4);
        try {
          await editArtifactSection(
            'demo-ledgerflow',
            'hero',
            1,
            {
              headline: 'Enterprise Spend Governance by Maya',
              subheadline: 'Direct human refinement with custom corporate policy',
              cta_text: 'Request Enterprise Access',
              secondary_cta: 'Contact Sales',
              badge: "Maya's Custom Edition",
            },
            'maya'
          );
          onRefresh();
          onNavigateTab('proposals');
          onSetStep(5);
        } finally {
          setLoadingStep(null);
        }
      },
    },
    {
      step: 5,
      title: 'Step 5: Agent Restart & Context Recovery',
      description: 'Restart NOVA; backend builds an authentic Context Pack from persisted database state.',
      buttonLabel: 'Restart NOVA & Recover',
      action: async () => {
        setLoadingStep(5);
        try {
          await restartAgent('demo-ledgerflow', 'nova');
          onRefresh();
          onNavigateTab('agents');
          onSetStep(6);
        } finally {
          setLoadingStep(null);
        }
      },
    },
    {
      step: 6,
      title: 'Step 6: High-Impact Decision & Redirect',
      description: 'PIXEL proposes approval policy requiring Alex approval. Demonstrate Redirect.',
      buttonLabel: 'Propose Enterprise Policy (PIXEL)',
      action: async () => {
        setLoadingStep(6);
        try {
          await triggerPolicyProposal('demo-ledgerflow');
          onRefresh();
          onNavigateTab('proposals');
          onSetStep(7);
          onClose();
        } finally {
          setLoadingStep(null);
        }
      },
    },
    {
      step: 7,
      title: 'Step 7: Shared Product Canvas Result',
      description: 'Inspect the resulting LedgerFlow Product Canvas with approved human & agent contributions.',
      buttonLabel: 'View Final LedgerFlow Canvas',
      action: async () => {
        onNavigateTab('canvas');
      },
    },
  ];

  if (!isOpen) return null;

  const currentStepData = steps[currentStep - 1] || steps[0];
  const progressPercent = Math.round((currentStep / 7) * 100);
  const isLoading = loadingStep === currentStepData.step;

  return (
    <div className="fixed top-16 right-0 bottom-0 w-full max-w-md bg-white shadow-xl z-30 border-l border-[#E5EAF0] flex flex-col animate-in slide-in-from-right duration-250">
      {/* Drawer Header */}
      <div className="p-5 border-b border-[#E5EAF0] flex items-center justify-between bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Compass className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#172033]">
                  Guided Demo Assistant
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  Step {currentStep} of 7
                </span>
              </div>
              <p className="text-xs text-[#657189] mt-0.5">
                Deterministic 7-step judging walkthrough
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Line */}
        <div className="w-full h-1 bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Selector Chips (1 through 7) */}
        <div className="p-4 bg-[#F8FAFC] border-b border-[#E5EAF0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
              Jump to Step
            </span>
            <span className="text-[11px] font-semibold text-teal-800">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 bg-white p-1.5 rounded-xl border border-[#E5EAF0]">
            {steps.map((s) => {
              const isCompleted = currentStep > s.step;
              const isCurrent = currentStep === s.step;

              return (
                <button
                  key={s.step}
                  onClick={() => onSetStep(s.step)}
                  className={`h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                    isCurrent
                      ? 'bg-teal-600 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-[#657189] hover:text-[#172033] hover:bg-slate-100'
                  }`}
                  title={s.title}
                >
                  {s.step}
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Body: Active Step Detail */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-600 text-white">
                Step {currentStepData.step}
              </span>
              <h4 className="text-xs font-bold text-[#172033]">
                {currentStepData.title}
              </h4>
            </div>
            <p className="text-xs text-[#657189] leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          {/* Steps Overview Checklist */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] block">
              Walkthrough Roadmap
            </span>
            {steps.map((s) => {
              const isDone = currentStep > s.step;
              const isCur = currentStep === s.step;
              return (
                <div
                  key={s.step}
                  onClick={() => onSetStep(s.step)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    isCur
                      ? 'bg-teal-50 border-teal-200 text-teal-900 font-semibold'
                      : isDone
                      ? 'bg-emerald-50/30 border-emerald-100 text-[#172033]'
                      : 'bg-white border-[#E5EAF0] text-[#657189] hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${isCur ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {s.step}
                      </span>
                    )}
                    <span className="truncate">{s.title.split(': ')[1] || s.title}</span>
                  </div>
                  {isCur && <span className="text-[10px] font-bold text-teal-700">Active</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-[#E5EAF0] bg-[#F8FAFC]">
          <button
            onClick={currentStepData.action}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Executing...' : currentStepData.buttonLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
  );
};
