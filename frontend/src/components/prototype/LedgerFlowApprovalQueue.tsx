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
    <div
      className="rounded-2xl p-6 border space-y-6 transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-white">{data.title || 'Expense Approval Queue'}</h2>
            {data.threshold && (
              <span
                className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border"
                style={{
                  background: 'rgba(251, 191, 36, 0.12)',
                  borderColor: 'rgba(251, 191, 36, 0.25)',
                  color: '#FBBF24',
                }}
              >
                Threshold: {data.threshold}
              </span>
            )}
          </div>
          {data.policy_note && (
            <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline mr-1" />
              <span>{data.policy_note}</span>
            </p>
          )}
        </div>

        <div
          className="flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold self-start sm:self-center"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#94A3B8',
          }}
        >
          <span>queue</span>
          <span className="font-bold text-cyan-400">v{version}</span>
        </div>
      </div>

      {actionError && (
        <div
          className="p-3 rounded-xl border text-xs text-rose-300 flex items-center justify-between"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            borderColor: 'rgba(244, 63, 94, 0.3)',
          }}
        >
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Queue items table/cards */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{item.submitter}</span>
                <span className="text-[10px] text-slate-400 font-mono">({item.department})</span>
                {item.policy_flag && (
                  <span
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      borderColor: 'rgba(244, 63, 94, 0.3)',
                      color: '#FB7185',
                    }}
                  >
                    {item.policy_flag}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Category: <strong className="text-slate-200">{item.category}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-lg font-bold font-mono text-cyan-300">{item.amount}</span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDecision(item.id, 'rejected')}
                  className="p-1.5 rounded-lg border text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}
                  title="Reject expense"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision(item.id, 'approved')}
                  className="p-1.5 rounded-lg border text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                  style={{ borderColor: 'rgba(52, 211, 153, 0.3)' }}
                  title="Approve expense"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
