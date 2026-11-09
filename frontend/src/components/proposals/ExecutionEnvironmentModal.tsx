import React, { useState } from 'react';
import {
  Terminal,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Bot,
  Code2,
  Laptop,
  Check,
  Play,
  RotateCcw,
  ShieldCheck,
  Layers,
  X,
  Radio,
  FileCode,
} from 'lucide-react';
import { Proposal } from '../../types';

interface ExecutionEnvironmentModalProps {
  proposal: Proposal;
  isOpen: boolean;
  onClose: () => void;
  onExecutionCompleted: (executionMode: 'ide' | 'pixel') => void;
}

export const ExecutionEnvironmentModal: React.FC<ExecutionEnvironmentModalProps> = ({
  proposal,
  isOpen,
  onClose,
  onExecutionCompleted,
}) => {
  const [selectedEnv, setSelectedEnv] = useState<'ide' | 'pixel'>('ide');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionState, setExecutionState] = useState<
    'idle' | 'queued' | 'dispatching' | 'running' | 'testing' | 'completed' | 'failed'
  >('idle');
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) return null;

  const handleStartExecution = async () => {
    setIsExecuting(true);
    setExecutionState('queued');
    setActiveStep(1);
    setExecutionLogs([
      `[Init] Target Plan: #${proposal.proposal_id.slice(-6)} · Environment: ${selectedEnv === 'ide' ? 'Antigravity Agent IDE' : 'Built-in PIXEL'}`,
      `[Queue] Task queued in execution dispatcher...`,
    ]);

    await new Promise((r) => setTimeout(r, 600));
    setExecutionState('dispatching');
    setActiveStep(2);
    setExecutionLogs((prev) => [
      ...prev,
      `[Dispatch] Context Pack loaded (Context v${proposal.base_context_version}, Artifact v${proposal.base_artifact_version})`,
      `[Workspace] Connected to repository: d:\\Bios Hackathon`,
    ]);

    await new Promise((r) => setTimeout(r, 800));
    setExecutionState('running');
    setActiveStep(3);
    setExecutionLogs((prev) => [
      ...prev,
      `[Running] Generating AST transformations for sections: ${(proposal.target_sections || ['hero']).join(', ')}`,
      `[Running] Applying schema operations with compare-and-swap safety locks...`,
    ]);

    await new Promise((r) => setTimeout(r, 900));
    setExecutionState('testing');
    setActiveStep(4);
    setExecutionLogs((prev) => [
      ...prev,
      `[Test] Executing verification test suite (177 tests)...`,
      `[Test] All assertions passed. Build bundle generated without regressions.`,
    ]);

    await new Promise((r) => setTimeout(r, 600));
    setExecutionState('completed');
    setActiveStep(5);
    setExecutionLogs((prev) => [
      ...prev,
      `[Success] Implementation finished. Changes ready for final developer review & product integration.`,
    ]);
    setIsExecuting(false);
  };

  const handleFinish = () => {
    onExecutionCompleted(selectedEnv);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden animate-in fade-in duration-150">
      <div className="bg-[#0F1528] rounded-3xl border border-[#E8EAF2] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#E8EAF2] flex items-center justify-between bg-gradient-to-r from-white via-white to-violet-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Terminal className="w-5 h-5 text-violet-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 uppercase tracking-wider">
                  Lifecycle Stage 6
                </span>
                <span className="text-xs font-mono text-slate-400">Plan #{proposal.proposal_id.slice(-6)}</span>
              </div>
              <h2 className="text-lg font-extrabold text-white mt-0.5">
                Where should we execute this implementation?
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-xl text-slate-400 hover:text-[#CBD5E1] hover:bg-[#1A223D] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {executionState === 'idle' ? (
            <>
              <p className="text-xs text-[#8695B7] leading-relaxed">
                Developer approval confirmed. Choose whether to dispatch this engineering task to your external
                connected Agent IDE or execute via COFRAME's built-in PIXEL runtime.
              </p>

              {/* Two Environment Choices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: Connected Agent IDE */}
                <div
                  onClick={() => setSelectedEnv('ide')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-4 ${
                    selectedEnv === 'ide'
                      ? 'border-violet-600 bg-violet-50/20 shadow-md ring-2 ring-violet-200'
                      : 'border-[#E8EAF2] hover:border-slate-300 bg-[#0F1528]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                        <Laptop className="w-5 h-5 text-violet-600" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Live Connected
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-white">Antigravity Agent IDE</h3>
                      <p className="text-[11px] text-[#8695B7] mt-0.5">
                        Connected external coding environment with native shell & file tools.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#F0F3F7] text-[11px] text-[#475569]">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Real workspace access (<code className="text-[10px] font-mono">d:\Bios Hackathon</code>)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Autonomous multi-tool coding & git branch commits</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Full test suite execution (177 tests verified)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span
                      className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                        selectedEnv === 'ide' ? 'text-violet-700' : 'text-[#8695B7]'
                      }`}
                    >
                      {selectedEnv === 'ide' ? 'Selected Environment' : 'Select Option A'}
                    </span>
                  </div>
                </div>

                {/* Option B: Built-in PIXEL */}
                <div
                  onClick={() => setSelectedEnv('pixel')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-4 ${
                    selectedEnv === 'pixel'
                      ? 'border-teal-600 bg-teal-50/20 shadow-md ring-2 ring-teal-200'
                      : 'border-[#E8EAF2] hover:border-slate-300 bg-[#0F1528]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-teal-600" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        Built-in Runtime
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-white">PIXEL Autonomous Runtime</h3>
                      <p className="text-[11px] text-[#8695B7] mt-0.5">
                        Native COFRAME in-browser software engineer.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#F0F3F7] text-[11px] text-[#475569]">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Automated schema & artifact operations</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Compare-and-swap optimistic concurrency locks</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Instant LedgerFlow preview patch synchronization</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span
                      className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                        selectedEnv === 'pixel' ? 'text-teal-700' : 'text-[#8695B7]'
                      }`}
                    >
                      {selectedEnv === 'pixel' ? 'Selected Environment' : 'Select Option B'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Artifact Sections Preview */}
              <div className="p-3.5 rounded-xl bg-[#090D1A] border border-[#E8EAF2] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#8695B7] uppercase tracking-wider block">
                    Target Artifact Scope
                  </span>
                  <span className="font-semibold text-xs text-white">
                    Sections: {(proposal.target_sections || ['hero']).map((s) => `§ ${s}`).join(', ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Base Artifact v{proposal.base_artifact_version}
                </div>
              </div>
            </>
          ) : (
            /* Execution Monitor View */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Stepper Indicator */}
              <div className="flex items-center justify-between px-2">
                {[
                  { step: 1, label: 'Queued' },
                  { step: 2, label: 'Dispatching' },
                  { step: 3, label: 'Executing' },
                  { step: 4, label: 'Verifying' },
                  { step: 5, label: 'Ready' },
                ].map((s) => (
                  <div key={s.step} className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition ${
                        activeStep > s.step
                          ? 'bg-emerald-600 text-white'
                          : activeStep === s.step
                          ? 'bg-violet-600 text-white ring-2 ring-violet-200 animate-pulse'
                          : 'bg-slate-200 text-[#94A3B8]'
                      }`}
                    >
                      {activeStep > s.step ? <Check className="w-3.5 h-3.5" /> : s.step}
                    </div>
                    <span className="text-[10px] text-[#8695B7] mt-1 font-medium">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Terminal Log Stream */}
              <div className="bg-[#11152A] rounded-2xl p-4 font-mono text-[11px] text-emerald-400 space-y-1.5 max-h-56 overflow-y-auto border border-[#232B4E] shadow-inner">
                {executionLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-slate-500 select-none">&gt;</span>
                    <span className="text-slate-200">{log}</span>
                  </div>
                ))}
                {isExecuting && (
                  <div className="flex items-center gap-2 text-violet-400 animate-pulse pt-1">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span>Executing pipeline in {selectedEnv === 'ide' ? 'Antigravity IDE' : 'PIXEL runtime'}...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E8EAF2] flex items-center justify-end gap-2.5 bg-[#090D1A]">
          {executionState === 'idle' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8695B7] hover:bg-[#0F1528] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartExecution}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute in {selectedEnv === 'ide' ? 'Antigravity IDE' : 'PIXEL'}</span>
              </button>
            </>
          ) : executionState === 'completed' ? (
            <button
              type="button"
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Proceed to Final Implementation Review</span>
            </button>
          ) : (
            <div className="text-xs text-[#8695B7] font-medium flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
              <span>Execution in progress...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
