import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

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
}

export const LedgerFlowApprovalQueue: React.FC<LedgerFlowApprovalQueueProps> = ({ data, version }) => {
  const items = data.items || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">{data.title || 'Expense Approval Queue'}</h2>
            {data.threshold && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Threshold: {data.threshold}
              </span>
            )}
          </div>
          {data.policy_note && (
            <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 inline mr-1" />
              <span>{data.policy_note}</span>
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500 font-mono self-start sm:self-center">
          <span>approval_queue</span>
          <span className="font-bold text-slate-700">v{version}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            <tr>
              <th className="py-2.5 px-3">Expense ID</th>
              <th className="py-2.5 px-3">Submitter</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Amount</th>
              <th className="py-2.5 px-3">Policy Audit</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/60 transition">
                <td className="py-3 px-3 font-mono font-medium text-slate-800">{item.id}</td>
                <td className="py-3 px-3">
                  <div className="font-semibold text-slate-900">{item.submitter}</div>
                  <div className="text-[11px] text-slate-400">{item.department}</div>
                </td>
                <td className="py-3 px-3">{item.category}</td>
                <td className="py-3 px-3 font-bold text-slate-900">{item.amount}</td>
                <td className="py-3 px-3">
                  {item.policy_flag ? (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
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
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'escalated'
                        ? 'bg-rose-100 text-rose-800'
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
  );
};
