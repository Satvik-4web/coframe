import React, { useState } from 'react';
import { HumanIdentity } from '../../types';
import { createHumanProposal } from '../../lib/api';
import { X, User, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CreateHumanProposalModalProps {
  identity: HumanIdentity;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateHumanProposalModal: React.FC<CreateHumanProposalModalProps> = ({
  identity,
  onClose,
  onSuccess,
}) => {
  const currentAuthor = identity || 'alex';
  const [summary, setSummary] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [targetSection, setTargetSection] = useState('product_brief');
  const [requiresDecision, setRequiresDecision] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Please provide a proposal summary.');
      return;
    }
    if (!reasoning.trim()) {
      setError('Please provide rationale for this contribution.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createHumanProposal('demo-ledgerflow', {
        author: currentAuthor,
        summary: summary.trim(),
        reasoning: reasoning.trim(),
        target_sections: [targetSection],
        changes: {
          operations: [
            {
              op: targetSection === 'hero' ? 'set_hero_content' : targetSection === 'approval_queue' ? 'set_approval_queue_config' : 'update_product_brief',
              section: targetSection,
              fields: { note: summary.trim(), contributor: currentAuthor },
            },
          ],
        },
        requires_decision: requiresDecision,
        assigned_decider_id: 'alex',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit human proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#1A202C] rounded-2xl shadow-2xl border border-[#303A4B] w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#293445] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E7EDF7]">New Human Contribution</h2>
              <p className="text-xs text-[#A3B0C4]">
                Submit a proposal authored by {currentAuthor.toUpperCase()} ({currentAuthor === 'alex' ? 'Founder / Decision Owner' : 'Product Designer'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A3B0C4] hover:text-[#E7EDF7] hover:bg-[#293445] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#A3B0C4] mb-1">
              Proposal Summary / Title
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Introduce simplified expense categories for consultants"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E5EAF0] text-[#E7EDF7] text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#A3B0C4] mb-1">
              Plain Language Rationale
            </label>
            <textarea
              rows={3}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Explain why this human contribution is being introduced and what product impact it brings..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E5EAF0] text-[#E7EDF7] text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#A3B0C4] mb-1">
                Target Artifact Section
              </label>
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E5EAF0] text-[#E7EDF7] text-xs bg-[#1A202C] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="product_brief">product_brief</option>
                <option value="hero">hero</option>
                <option value="dashboard">dashboard</option>
                <option value="approval_queue">approval_queue</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#A3B0C4] mb-1">
                Author Attribution
              </label>
              <div className="px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] font-semibold flex items-center justify-between">
                <span>{currentAuthor.toUpperCase()}</span>
                <span className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded font-bold">
                  Human Author
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresDecision}
                onChange={(e) => setRequiresDecision(e.target.checked)}
                className="w-4 h-4 rounded text-blue-400 focus:ring-blue-500 border-[#303A4B]"
              />
              <span className="text-xs text-[#E7EDF7] font-medium">
                Requires Alex founder sign-off before applying
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#293445] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#293445] hover:bg-[#E5EAF0] text-[#E7EDF7] font-semibold transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-xs cursor-pointer text-xs flex items-center space-x-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Human Proposal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
