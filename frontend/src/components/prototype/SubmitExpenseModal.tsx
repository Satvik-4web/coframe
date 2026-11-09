import React, { useState } from 'react';
import { X, Receipt, DollarSign, Calendar, Tag, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { submitExpense } from '../../lib/api';
import { HumanIdentity } from '../../types';

interface SubmitExpenseModalProps {
  identity: HumanIdentity;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitExpenseModal: React.FC<SubmitExpenseModalProps> = ({
  identity,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('125.00');
  const [currency, setCurrency] = useState<string>('USD');
  const [category, setCategory] = useState<string>('Meals');
  const [description, setDescription] = useState<string>('Client dinner & product strategy session');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState<string>('INV-2026-042');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const isHighThreshold = numAmount > 500;

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
      <div className="bg-[#0F1528] border border-[#1A223D] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in-50 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A223D]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Submit Expense (LedgerFlow)</h2>
              <p className="text-xs text-[#8695B7]">
                Submit an expense into the live persisted financial workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8695B7] hover:text-white p-1.5 rounded-lg hover:bg-[#1A223D] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#8695B7] font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-[#0F1528]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Threshold alert */}
          {isHighThreshold ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                <strong>High Threshold Policy:</strong> Amount exceeds $500.00. This expense will require <strong>Alex's approval</strong> (Founder authority).
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Standard Tier: Under $500 threshold. Maya or Alex can approve.</span>
            </div>
          )}

          {/* Category & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                <option value="Meals">Meals & Entertainment</option>
                <option value="Travel">Travel & Lodging</option>
                <option value="Software">Software & Cloud</option>
                <option value="Equipment">Hardware & Equipment</option>
                <option value="Office">Office & Supplies</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
              Business Purpose / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-[#0F1528]"
              placeholder="e.g. Flight to client demo or cloud infrastructure bill"
              required
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
              Invoice Code / Reference (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#090D1A] border border-[#1A223D] text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
              placeholder="e.g. INV-2026-042"
            />
          </div>

          {/* Submitter Info */}
          <div className="p-2.5 rounded-xl bg-[#141A33] border border-[#1A223D] flex items-center justify-between text-[#8695B7]">
            <span>Submitting as:</span>
            <span className="font-bold text-white uppercase">{identity || 'alex'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#1A223D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8695B7] hover:text-white hover:bg-[#1A223D] transition cursor-pointer"
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
