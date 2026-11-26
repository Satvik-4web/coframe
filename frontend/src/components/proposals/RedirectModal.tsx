import React, { useState } from 'react';
import { X, CornerDownRight, AlertCircle } from 'lucide-react';
import { redirectProposal } from '../../lib/api';

interface RedirectModalProps {
  proposalId: string;
  agentId: string;
  summary: string;
  decidedBy: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RedirectModal: React.FC<RedirectModalProps> = ({
  proposalId,
  agentId,
  summary,
  decidedBy,
  onClose,
  onSuccess,
}) => {
  const [instruction, setInstruction] = useState(
    'Make approval thresholds configurable per organisation'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await redirectProposal('demo-ledgerflow', proposalId, decidedBy, instruction);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to redirect agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5EAF0] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in-50 duration-200">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E5EAF0]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
              <CornerDownRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#172033] text-sm">Redirect {agentId.toUpperCase()}</h3>
              <p className="text-xs text-[#657189]">Provide corrective guidance as {decidedBy.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#657189] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 p-3.5 rounded-xl bg-slate-50 border border-[#E5EAF0]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">Original Proposal</span>
          <p className="text-xs text-[#172033] font-semibold mt-1">{summary}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1.5">
              Human Direction / Feedback Note
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5EAF0] text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500 resize-none leading-relaxed"
              placeholder="Explain how the agent should adapt its proposal..."
            />
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-100 text-xs text-teal-900 leading-relaxed">
            ⚙️ <strong className="text-teal-800">Real Agent Execution:</strong> COFRAME captures this note, builds a fresh Context Pack, calls the originating agent to adapt its proposal, and preserves the original record with a link.
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E5EAF0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#657189] hover:text-[#172033] hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Redirect Instruction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
