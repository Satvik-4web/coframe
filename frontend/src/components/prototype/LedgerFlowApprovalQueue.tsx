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
  approvalThreshold: number | null;
  refreshKey?: number;
  onExpensesChanged?: () => void;
}

export const LedgerFlowApprovalQueue: React.FC<LedgerFlowApprovalQueueProps> = ({
  data,
  version,
  identity = 'alex',
  approvalThreshold,
  refreshKey = 0,
  onExpensesChanged,
}) => {
  const items = data.items || [];
  const [liveExpenses, setLiveExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadLiveExpenses = async () => {
    try {
      const res = await fetchExpenses('demo-ledgerflow');
      setLiveExpenses(res.expenses || []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    loadLiveExpenses();
  }, [refreshKey]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === 'EXPENSE_SUBMITTED' || type === 'EXPENSE_DECIDED') loadLiveExpenses();
    };
    window.addEventListener('coframe:ws_message', onUpdate);
    return () => window.removeEventListener('coframe:ws_message', onUpdate);
  }, []);

  const handleDecision = async (expenseId: string, decision: 'approved' | 'rejected') => {
    if (loading) return;
    setActionError(null);
    setLoading(true);
    try {
      await decideExpense('demo-ledgerflow', expenseId, decision, identity || 'alex');
      await loadLiveExpenses();
      onExpensesChanged?.();
    } catch (err: any) {
      setActionError(err.message || `Failed to ${decision} expense`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1A202C] border border-[#303A4B] rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#293445]">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#E7EDF7]">{data.title || 'Expense Approval Queue'}</h2>
            {data.threshold && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25">
                Design sample: {data.threshold}
              </span>
            )}
          </div>
          {data.policy_note && (
            <p className="text-xs text-[#A3B0C4] mt-1 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400 inline mr-1" />
              <span>Artifact copy: {data.policy_note}</span>
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#141A24] border border-[#303A4B] text-[10px] text-[#A3B0C4] font-mono self-start sm:self-center">
          <span>approval_queue</span>
          <span className="font-bold text-[#E7EDF7]">v{version}</span>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-red-300 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {loadError && <div role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">Could not load saved expenses. <button type="button" onClick={loadLiveExpenses} className="font-semibold underline">Retry</button></div>}

      {/* Live Persisted Expenses Section (If any submitted) */}
      <p className="text-xs text-[#ACBAD0]">Live approval limit: <strong>{approvalThreshold === null ? 'Loading…' : `$${approvalThreshold.toFixed(2)} USD`}</strong>. Higher amounts require Alex.</p>
      {liveExpenses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A3B0C4]">
              Active Financial Workflow ({liveExpenses.length} Persisted Records)
            </h3>
            <span className="text-[10px] text-teal-300 bg-teal-500/10 border border-teal-500/25 px-2 py-0.5 rounded-full font-medium">
              Saved expenses
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#303A4B]">
            <table className="w-full text-left text-xs text-[#A3B0C4]">
              <thead className="bg-[#141A24] border-b border-[#303A4B] text-[11px] uppercase tracking-wider text-[#A3B0C4] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Expense ID</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Policy Audit</th>
                  <th className="py-2.5 px-3 text-right">Actions / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#293445]">
                {liveExpenses.map((exp) => {
                  const isPending = exp.status === 'pending_approval';
                  const isRestrictedForMaya = exp.threshold_exceeded && identity !== 'alex';

                  return (
                    <tr key={exp.id} className="hover:bg-[#141A24]/80 transition">
                      <td className="py-3 px-3 font-mono font-medium text-[#E7EDF7]">{exp.id.slice(-8)}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#E7EDF7] uppercase text-xs">{exp.submitted_by}</div>
                        <div className="text-[11px] text-[#A3B0C4]">{exp.description}</div>
                      </td>
                      <td className="py-3 px-3 font-medium">{exp.category}</td>
                      <td className="py-3 px-3 font-bold text-[#E7EDF7]">
                        ${exp.amount.toFixed(2)} {exp.currency}
                      </td>
                      <td className="py-3 px-3">
                        {exp.threshold_exceeded ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-300 font-semibold">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <span>Requires Alex</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-300 flex items-center space-x-1 font-medium">
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
                              disabled={isRestrictedForMaya || loading}
                              title={isRestrictedForMaya ? 'Only Alex can decide this expense' : 'Reject expense'}
                              className="px-2.5 py-1 rounded-lg bg-[#1A202C] border border-rose-500/25 text-rose-400 hover:bg-rose-500/10 text-[11px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleDecision(exp.id, 'approved')}
                              disabled={isRestrictedForMaya || loading}
                              title={
                                isRestrictedForMaya
                                  ? 'This expense requires Alex (Founder) approval.'
                                  : 'Approve expense'
                              }
                              className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition ${
                                isRestrictedForMaya
                                  ? 'bg-[#1D2633] text-[#8495AD] border border-[#303A4B] cursor-not-allowed'
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
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#A3B0C4]">
          Example queue from the artifact design
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[#303A4B]">
          <table className="w-full text-left text-xs text-[#A3B0C4]">
            <thead className="bg-[#141A24] border-b border-[#303A4B] text-[11px] uppercase tracking-wider text-[#A3B0C4] font-semibold">
              <tr>
                <th className="py-2.5 px-3">Expense ID</th>
                <th className="py-2.5 px-3">Submitter</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Policy Audit</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#293445]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#141A24]/80 transition">
                  <td className="py-3 px-3 font-mono font-medium text-[#E7EDF7]">{item.id}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[#E7EDF7]">{item.submitter}</div>
                    <div className="text-[11px] text-[#A3B0C4]">{item.department}</div>
                  </td>
                  <td className="py-3 px-3">{item.category}</td>
                  <td className="py-3 px-3 font-bold text-[#E7EDF7]">{item.amount}</td>
                  <td className="py-3 px-3">
                    {item.policy_flag ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/25 font-medium">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{item.policy_flag}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-300 flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Compliant</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
                          : item.status === 'escalated'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
                          : 'bg-[#1D2633] text-[#C6D2E4]'
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
