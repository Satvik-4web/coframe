import React, { useState } from 'react';
import { Bot, Sparkles, Play, X, RefreshCw, CheckCircle2, Shield } from 'lucide-react';
import { HumanIdentity } from '../../types';

interface StartCollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (objective: string) => Promise<void>;
  starting: boolean;
  identity: HumanIdentity;
}

export const StartCollaborationModal: React.FC<StartCollaborationModalProps> = ({
  isOpen,
  onClose,
  onStart,
  starting,
  identity,
}) => {
  const [objective, setObjective] = useState(
    'Improve LedgerFlow for enterprise finance teams and add a manager approval workflow.'
  );
  const [selectNova, setSelectNova] = useState(true);
  const [selectPixel, setSelectPixel] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;
    await onStart(objective);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#E7ECF2] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7ECF2] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172033]">What should we work on?</h2>
            <p className="text-xs text-[#657189] mt-0.5">
              Give your AI collaborators a shared objective. They'll use the latest project context to begin.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#657189] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#657189] mb-1.5">
              Shared Objective
            </label>
            <textarea
              rows={4}
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Optimize the expense submission process and add automated receipt verification..."
              className="w-full px-3.5 py-2.5 text-xs text-[#172033] bg-white border border-[#E7ECF2] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition leading-relaxed resize-none"
            />
          </div>

          {/* Collaborating Agents Selection */}
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-[#657189] mb-2">
              Collaborating Agents
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* NOVA Option */}
              <label
                onClick={() => setSelectNova(!selectNova)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  selectNova
                    ? 'bg-violet-50/50 border-violet-200'
                    : 'bg-white border-[#E7ECF2] opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectNova}
                  onChange={() => {}}
                  className="rounded text-violet-600 focus:ring-violet-500 mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-violet-700" />
                    <span className="text-xs font-bold text-[#172033]">NOVA</span>
                  </div>
                  <p className="text-[11px] text-[#657189] mt-0.5">Strategy & Requirements</p>
                </div>
              </label>

              {/* PIXEL Option */}
              <label
                onClick={() => setSelectPixel(!selectPixel)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  selectPixel
                    ? 'bg-teal-50/50 border-teal-200'
                    : 'bg-white border-[#E7ECF2] opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectPixel}
                  onChange={() => {}}
                  className="rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                    <span className="text-xs font-bold text-[#172033]">PIXEL</span>
                  </div>
                  <p className="text-[11px] text-[#657189] mt-0.5">Prototype Engineer</p>
                </div>
              </label>
            </div>
          </div>

          {/* Context Notice */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs text-[#657189] flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              Both agents will receive immutable Context Pack v1 stamped by the backend.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0F3F7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E7ECF2] rounded-xl hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={starting}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {starting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Start Collaboration (Run Agents)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
