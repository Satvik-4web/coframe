import React, { useState } from 'react';
import { Target, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { updateRequirement } from '../../lib/api';
import { HumanIdentity } from '../../types';
import { useToast } from '../common/Toast';

interface EditRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementKey: string;
  requirementTitle: string;
  currentValue: any;
  identity: HumanIdentity;
  onUpdated: () => void;
}

export const EditRequirementModal: React.FC<EditRequirementModalProps> = ({
  isOpen,
  onClose,
  requirementKey,
  requirementTitle,
  currentValue,
  identity,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const formatInitialValue = (val: any): string => {
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  const [textValue, setTextValue] = useState(() => formatInitialValue(currentValue));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textValue.trim()) {
      setError('Requirement value cannot be empty');
      return;
    }

    if (identity !== 'alex') {
      showToast('Only Alex (Founder / Decision Owner) can update project requirements.', 'error');
      setError('Permission denied: Only Alex can update project requirements.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Attempt to parse as JSON if it looks like an object/array, otherwise pass string
    let parsed: any = textValue.trim();
    if (parsed.startsWith('{') || parsed.startsWith('[')) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    try {
      await updateRequirement('demo-ledgerflow', requirementKey, parsed, identity || 'alex');
      showToast(`Updated ${requirementKey}. Context version advanced.`, 'success');
      onUpdated();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to update requirement';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-[#E8EAF2] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#E8EAF2] flex items-center justify-between bg-gradient-to-r from-white via-white to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Target className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider font-mono">
                  {requirementKey}
                </span>
                <span className="text-xs text-slate-500">Authoritative Requirement</span>
              </div>
              <h2 className="text-base font-extrabold text-[#172033] mt-0.5">
                {requirementTitle || requirementKey}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1">
              Requirement Definition / Value
            </label>
            <p className="text-[11px] text-[#657189] mb-2 leading-relaxed">
              Updating this requirement will bump the workspace Context Version. AI agents and unapplied proposals depending on this requirement will selectively detect the change.
            </p>
            <textarea
              rows={4}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3 text-[#172033] focus:outline-none focus:border-blue-600 transition"
              placeholder="e.g. Enterprise finance teams and multi-entity controllers"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#657189] hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !textValue.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Requirement...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save &amp; Bump Context Version</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
