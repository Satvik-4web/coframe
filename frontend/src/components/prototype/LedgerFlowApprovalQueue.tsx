import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, Check, X, Lock } from 'lucide-react';
import { fetchExpenses, decideExpense } from '../../lib/api';
import { HumanIdentity } from '../../types';

interface QueueItem {
  id: string;
  submitter: string;
  department: string;
  amount: string;
  category: string;
  policy_flag?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
}

interface LedgerFlowApprovalQueueProps {
  data: {
    title?: string;
    policy_note?: string | null;
    threshold?: string | null;
    items?: QueueItem[];
  };
  version: number;
  identity?: HumanIdentity;
}

export const LedgerFlowApprovalQueue: React.FC<LedgerFlowApprovalQueueProps> = ({
  data,
  version,
  identity = 'alex',
}) => {
  const items = data.items || [];
  const [liveExpenses, setLiveExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadLiveExpenses = async () => {
    try {
      const res = await fetchExpenses('demo-ledgerflow');
      setLiveExpenses(res.expenses || []);
    } catch {
      // Ignore background load error
    }
  };

  useEffect(() => {
    loadLiveExpenses();
  }, []);

  const handleDecision = async (expenseId: string, decision: 'approved' | 'rejected') => {
    setActionError(null);
    try {
      await decideExpense('demo-ledgerflow', expenseId, decision, identity || 'alex');
      await loadLiveExpenses();
    } catch (err: any) {
      setActionError(err.message || `Failed to ${decision} expense`);
    }
  };

  return (
    <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F0F3F7]">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#172033]">{data.title || 'Expense Approval Queue'}</h2>
            {data.threshold && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                Threshold: {data.threshold}
              </span>
            )}
          </div>
          {data.policy_note && (
            <p className="text-xs text-[#657189] mt-1 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 inline mr-1" />
              <span>{data.policy_note}</span>
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-[10px] text-[#657189] font-mono self-start sm:self-center">
          <span>approval_queue</span>
          <span className="font-bold text-[#172033]">v{version}</span>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-red-800 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Live Persisted Expenses Section (If any submitted) */}
      {liveExpenses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#657189]">
              Active Financial Workflow ({liveExpenses.length} Persisted Records)
            </h3>
            <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-medium">
              SQLite Source of Truth
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E7ECF2]">
            <table className="w-full text-left text-xs text-[#657189]">
              <thead className="bg-[#F8FAFC] border-b border-[#E7ECF2] text-[11px] uppercase tracking-wider text-[#657189] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Expense ID</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Policy Audit</th>
                  <th className="py-2.5 px-3 text-right">Actions / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F3F7]">
                {liveExpenses.map((exp) => {
                  const isPending = exp.status === 'pending_approval';
                  const isRestrictedForMaya = exp.threshold_exceeded && identity !== 'alex';

                  return (
                    <tr key={exp.id} className="hover:bg-[#F8FAFC]/80 transition">
                      <td className="py-3 px-3 font-mono font-medium text-[#172033]">{exp.id.slice(-8)}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#172033] uppercase text-xs">{exp.submitted_by}</div>
                        <div className="text-[11px] text-[#657189]">{exp.description}</div>
                      </td>
                      <td className="py-3 px-3 font-medium">{exp.category}</td>
                      <td className="py-3 px-3 font-bold text-[#172033]">
                        ${exp.amount.toFixed(2)} {exp.currency}
                      </td>
                      <td className="py-3 px-3">
                        {exp.threshold_exceeded ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-300 font-semibold">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Requires Alex (&gt; $500)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-700 flex items-center space-x-1 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>Standard Policy</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleDecision(exp.id, 'rejected')}
                              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleDecision(exp.id, 'approved')}
                              disabled={isRestrictedForMaya}
                              title={
                                isRestrictedForMaya
                                  ? 'Expenses over $500 require Alex (Founder) approval.'
                                  : 'Approve expense'
                              }
                              className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition ${
                                isRestrictedForMaya
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-2xs'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{isRestrictedForMaya ? 'Alex Required' : 'Approve'}</span>
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              exp.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {exp.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Baseline LedgerFlow Prototype Queue Items (Targeted by Playwright) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#657189]">
          Configurable Corporate Queue Items
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[#E7ECF2]">
          <table className="w-full text-left text-xs text-[#657189]">
            <thead className="bg-[#F8FAFC] border-b border-[#E7ECF2] text-[11px] uppercase tracking-wider text-[#657189] font-semibold">
              <tr>
                <th className="py-2.5 px-3">Expense ID</th>
                <th className="py-2.5 px-3">Submitter</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Policy Audit</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F7]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC]/80 transition">
                  <td className="py-3 px-3 font-mono font-medium text-[#172033]">{item.id}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[#172033]">{item.submitter}</div>
                    <div className="text-[11px] text-[#657189]">{item.department}</div>
                  </td>
                  <td className="py-3 px-3">{item.category}</td>
                  <td className="py-3 px-3 font-bold text-[#172033]">{item.amount}</td>
                  <td className="py-3 px-3">
                    {item.policy_flag ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-medium">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{item.policy_flag}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700 flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Compliant</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : item.status === 'escalated'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
