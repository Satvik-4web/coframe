import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  Users,
  Bot,
  Edit3,
  AlertTriangle,
  RotateCcw,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import {
  startCollaboration,
  updateRequirement,
  editArtifactSection,
  restartAgent,
  triggerPolicyProposal,
  reconcileProposal,
  redirectProposal,
  approveProposal,
} from '../../lib/api';
import { HumanIdentity, Proposal } from '../../types';

interface DemoGuideProps {
  currentStep: number;
  onSetStep: (s: number) => void;
  identity: HumanIdentity;
  proposals: Proposal[];
  onRefresh: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DemoGuide: React.FC<DemoGuideProps> = ({
  currentStep,
  onSetStep,
  identity,
  proposals,
  onRefresh,
  onNavigateTab,
}) => {
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  const steps = [
    {
      step: 1,
      title: 'Step 1: Two Humans + Two AI Agents',
      description: 'Open a second browser session to see Alex & Maya presence in real-time.',
      buttonLabel: 'Verify Step 1 Presence',
      action: async () => {
        onNavigateTab('workspace');
      },
    },
    {
      step: 2,
      title: 'Step 2: Start Parallel Agent Runs',
      description: 'Dispatch NOVA (Strategist) & PIXEL (Engineer) to create initial proposals A, B, C.',
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
      buttonLabel: "Update REQ_AUDIENCE (Alex)",
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
      title: 'Step 4: Outdated & Conflicted Handling',
      description: 'Proposal A stales selectively. Maya edits Hero to demonstrate human-vs-agent conflict.',
      buttonLabel: 'Simulate Maya Hero Edit',
      action: async () => {
        setLoadingStep(4);
        try {
          await editArtifactSection(
            'demo-ledgerflow',
            'hero',
            1,
            {
              headline: "Enterprise Spend Governance by Maya",
              subheadline: "Direct human refinement with custom corporate policy",
              cta_text: "Request Enterprise Access",
              secondary_cta: "Contact Sales",
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
      description: 'Restart NOVA; backend builds an authentic Context Pack from database state.',
      buttonLabel: 'Restart NOVA & Recover',
      action: async () => {
        setLoadingStep(5);
        try {
          await restartAgent('demo-ledgerflow', 'nova');
          onRefresh();
          onNavigateTab('context');
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

  return (
    <div className="bg-[#151B29] border border-[#263244] rounded-xl p-4 shadow-lg mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#263244]">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
            ★
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#F4F7FB] uppercase tracking-wider">
              BIOS FORGE Demo Walkthrough Stepper
            </h3>
            <p className="text-[11px] text-[#98A5B7]">
              Execute the 7 required demo steps deterministically in sequence.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {steps.map((s) => (
            <button
              key={s.step}
              onClick={() => onSetStep(s.step)}
              className={`w-6 h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center transition ${
                currentStep === s.step
                  ? 'bg-teal-500 text-black shadow-md shadow-teal-500/30'
                  : currentStep > s.step
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                  : 'bg-[#1B2433] text-[#98A5B7] hover:text-[#F4F7FB]'
              }`}
            >
              {s.step}
            </button>
          ))}
        </div>
      </div>

      {/* Current Step Highlighted Box */}
      {(() => {
        const s = steps[currentStep - 1] || steps[0];
        const isLoading = loadingStep === s.step;
        return (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1B2433] p-3 rounded-lg border border-teal-500/30">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-teal-400">{s.title}</span>
                <span className="text-[10px] text-[#98A5B7]">Step {s.step} of 7</span>
              </div>
              <p className="text-xs text-[#F4F7FB] mt-0.5">{s.description}</p>
            </div>

            <button
              onClick={s.action}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-teal-600/20 transition cursor-pointer self-start sm:self-center disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Executing...' : s.buttonLabel}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}
    </div>
  );
};
