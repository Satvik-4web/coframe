import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Bot,
  ArrowRight,
  Shield,
  Layers,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { HumanIdentity } from '../../types';
import { analyseProductPrompt } from '../../lib/api';

interface ProductPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  identity: HumanIdentity;
  onAnalysisComplete: (prd: any) => void;
}

const PRESET_IDEAS = [
  {
    title: 'Enterprise Multi-Tier Approvals',
    prompt: 'Implement enterprise tiered approvals with a strict $500 threshold requiring Alex/VP sign-off and custom audit reasons.',
    constraints: 'Role validation must restrict Maya from approving above $500.',
  },
  {
    title: 'Departmental Spend & Cards',
    prompt: 'Add real-time category spending breakdowns for Software, Travel, and Cloud Ops with active virtual cards tracking.',
    constraints: 'Integrate directly with LedgerFlow Dashboard metrics.',
  },
  {
    title: 'Global Multi-Currency Treasury',
    prompt: 'Enable submitting and reimbursing corporate expenses in EUR, GBP, and USD with automated receipt reconciliation.',
    constraints: 'Must retain atomic SQLite commit guarantees.',
  },
];

export const ProductPromptModal: React.FC<ProductPromptModalProps> = ({
  isOpen,
  onClose,
  identity,
  onAnalysisComplete,
}) => {
  const [prompt, setPrompt] = useState('');
  const [constraints, setConstraints] = useState('');
  const [referenceNote, setReferenceNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setError('Please enter a product idea or objective.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await analyseProductPrompt(
        prompt.trim(),
        constraints.trim() || undefined,
        identity || 'alex'
      );
      if (res.prd) {
        onAnalysisComplete(res.prd);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit idea to NOVA');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (p: typeof PRESET_IDEAS[0]) => {
    setPrompt(p.prompt);
    setConstraints(p.constraints);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0F1528] rounded-2xl max-w-2xl w-full border border-[#1A223D] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#1A223D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                What would you like to create?
              </h2>
              <p className="text-xs text-[#8695B7] mt-0.5">
                Describe your idea. NOVA will turn it into a structured product plan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8695B7] hover:bg-[#1A223D] hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8695B7] mb-2">
              Fast Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRESET_IDEAS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3 text-left rounded-xl border border-[#1A223D] bg-[#090D1A] hover:border-violet-300 hover:bg-violet-50/30 transition text-xs group"
                >
                  <p className="font-bold text-white group-hover:text-violet-700">
                    {preset.title}
                  </p>
                  <p className="text-[10px] text-[#8695B7] mt-1 line-clamp-2">
                    {preset.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Prompt Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-white">
              Product Objective & Functional Scope *
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder="e.g. We need to implement tiered manager expense approvals where any spend exceeding $500 requires Alex's explicit decision..."
              className="w-full p-3.5 rounded-xl border border-[#1A223D] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-[#0F1528]"
            />
            <p className="text-[11px] text-[#8695B7]">
              NOVA will analyze target audience, functional constraints, and acceptance criteria.
            </p>
          </div>

          {/* Advanced Constraints Accordion */}
          <div className="pt-2 border-t border-[#F0F3F7]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
            >
              <span>{showAdvanced ? 'Hide Optional Constraints' : 'Add Constraints & Reference Materials'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pl-3 border-l-2 border-teal-200">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    System Constraints
                  </label>
                  <input
                    type="text"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="e.g. Strict role validation; compare-and-swap atomic update"
                    className="w-full p-2.5 rounded-xl border border-[#1A223D] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Reference Context Notes
                  </label>
                  <input
                    type="text"
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="e.g. Aligns with LedgerFlow approval_queue component v1"
                    className="w-full p-2.5 rounded-xl border border-[#1A223D] text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#090D1A] border-t border-[#1A223D] flex items-center justify-between">
          <div className="text-xs text-[#8695B7] flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-violet-600" />
            <span>NOVA acts as your AI Product Strategist</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8695B7] hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !prompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>NOVA is understanding your idea...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask NOVA to analyse</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
