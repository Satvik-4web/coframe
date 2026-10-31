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
      buttonLabel: 'Run Start Collaboration',
      action: async () => {
        setLoadingStep(2);
        try {
          await startCollaboration('demo-ledgerflow');
          onRefresh();
          onNavigateTab('proposals');
          onSetStep(3);
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
    <div className="bg-white border border-[#E5EAF0] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] mb-6 transition-all duration-200">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E5EAF0]">
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
                Phase {currentStep} of 7
              </span>
            </div>
            <p className="text-xs text-[#657189] mt-0.5">
              Follow the 7-step deterministic BIOS FORGE judging sequence
            </p>
          </div>
        </div>

        {/* Step Selector Chips (1 through 7) */}
        <div className="flex items-center space-x-1.5 self-start sm:self-center">
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-[#E5EAF0]">
            {steps.map((s) => {
              const isCompleted = currentStep > s.step;
              const isCurrent = currentStep === s.step;

              return (
                <button
                  key={s.step}
                  onClick={() => onSetStep(s.step)}
                  className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                    isCurrent
                      ? 'bg-teal-600 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-[#657189] hover:text-[#172033] hover:bg-slate-200'
                  }`}
                  title={s.title}
                >
                  {s.step}
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition cursor-pointer"
            title="Minimize Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-teal-600 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Prune Seatbelt Callout Banner */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-emerald-900">
          <span className="text-sm">🛡️</span>
          <span className="font-medium">
            <strong>Prune Seatbelt Active:</strong> All NOVA & PIXEL proposals are guarded against prompt injection, cached at $0 repeat cost, and stamped with Ed25519 receipts.
          </span>
        </div>
      </div>

      {/* Active Step Action Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50/70 border border-[#E5EAF0]">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#172033]">
              {currentStepData.title}
            </span>
          </div>
          <p className="text-xs text-[#657189] leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        <button
          onClick={currentStepData.action}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Executing...' : currentStepData.buttonLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
