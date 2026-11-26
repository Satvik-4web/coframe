import React, { useState } from 'react';
import { X, Receipt, DollarSign, Calendar, Tag, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { submitExpense } from '../../lib/api';
import { HumanIdentity } from '../../types';

interface SubmitExpenseModalProps {
  identity: HumanIdentity;
  approvalThreshold: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitExpenseModal: React.FC<SubmitExpenseModalProps> = ({
  identity,
  approvalThreshold,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('');
  const currency = 'USD';
  const [category, setCategory] = useState<string>('Meals');
  const [description, setDescription] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [reference, setReference] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const isHighThreshold = numAmount > approvalThreshold;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitExpense('demo-ledgerflow', {
        amount: numAmount,
        currency,
        category,
        description: description.trim(),
        expense_date: expenseDate,
        reference: reference.trim() || undefined,
        submitted_by: identity || 'alex',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A202C] border border-[#303A4B] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in-50 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#303A4B]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/25">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E7EDF7]">Submit Expense (LedgerFlow)</h2>
              <p className="text-xs text-[#A3B0C4]">
                Submit an expense into the live persisted financial workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A3B0C4] hover:text-[#E7EDF7] p-1.5 rounded-lg hover:bg-[#1D2633] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#A3B0C4] font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-[#1A202C]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
                Currency
              </label>
              <div className="w-full px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] font-semibold text-xs">USD ($)</div>
            </div>
          </div>

          {/* Threshold alert */}
          {isHighThreshold ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                <strong>High Threshold Policy:</strong> Amount exceeds ${approvalThreshold.toFixed(2)}. This expense will require <strong>Alex's approval</strong> (Founder authority).
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Standard tier: at or under ${approvalThreshold.toFixed(2)}, Maya or Alex can approve.</span>
            </div>
          )}

          {/* Category & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] font-medium text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="Meals">Meals & Entertainment</option>
                <option value="Travel">Travel & Lodging</option>
                <option value="Software">Software & Cloud</option>
                <option value="Equipment">Hardware & Equipment</option>
                <option value="Office">Office & Supplies</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] font-medium text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
              Business Purpose / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-[#1A202C]"
              placeholder="e.g. Flight to client demo or cloud infrastructure bill"
              required
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-[11px] font-bold text-[#E7EDF7] uppercase tracking-wider mb-1">
              Invoice Code / Reference (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A24] border border-[#303A4B] text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
              placeholder="e.g. INV-2026-042"
            />
          </div>

          {/* Submitter Info */}
          <div className="p-2.5 rounded-xl bg-[#141A24] border border-[#303A4B] flex items-center justify-between text-[#A3B0C4]">
            <span>Submitting as:</span>
            <span className="font-bold text-[#E7EDF7] uppercase">{identity || 'alex'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#303A4B]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A3B0C4] hover:text-[#E7EDF7] hover:bg-[#1D2633] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
