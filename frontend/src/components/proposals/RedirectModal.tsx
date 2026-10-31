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
    <div className="fixed inset-0 bg-[#0B1020]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#151B29] border border-[#263244] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#263244]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
              <CornerDownRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#F4F7FB] text-sm">Redirect {agentId.toUpperCase()}</h3>
              <p className="text-[11px] text-[#98A5B7]">Provide corrective guidance as {decidedBy.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#98A5B7] hover:text-[#F4F7FB]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 p-3 rounded-lg bg-[#1B2433] border border-[#263244]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#98A5B7]">Original Proposal</span>
          <p className="text-xs text-[#F4F7FB] font-medium mt-1">{summary}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#98A5B7] mb-1">
              Human Direction / Feedback Note
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#1B2433] border border-[#263244] text-[#F4F7FB] text-xs focus:outline-none focus:border-teal-500 resize-none leading-relaxed"
              placeholder="Explain how the agent should adapt its proposal..."
            />
          </div>

          <div className="p-3 rounded-lg bg-[#1B2433] border border-[#263244] text-[11px] text-[#98A5B7]">
            ⚙️ <strong className="text-teal-400">Real Agent Execution:</strong> COFRAME captures this note, builds a fresh Context Pack, calls the originating agent to adapt its proposal, and preserves the original record with a link.
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#98A5B7] hover:bg-[#1B2433]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Redirect Instruction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
