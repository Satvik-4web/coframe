import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isResetting: boolean;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isResetting,
}) => {
  const [typedValue, setTypedValue] = useState('');

  if (!isOpen) return null;

  const isConfirmed = typedValue.trim().toUpperCase() === 'RESET';

  const handleConfirm = () => {
    if (isConfirmed && !isResetting) {
      onConfirm();
      setTypedValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-red-200 shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">Reset LedgerFlow?</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            This will clear all proposals, revert the prototype to v1, and reset requirements. Type <strong className="font-mono text-red-600">RESET</strong> to confirm or click Cancel.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Type RESET below:
          </label>
          <input
            type="text"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder="RESET"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed || isResetting}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm ${
              isConfirmed && !isResetting
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <span>{isResetting ? 'Resetting...' : 'Confirm Reset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
