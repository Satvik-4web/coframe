import React, { useState } from 'react';
import { ShieldCheck, GitFork, AlertCircle } from 'lucide-react';
import { ApprovalRequest, Delegation, HumanIdentity } from '../../types';
import { ApprovalInbox } from '../approvals/ApprovalInbox';
import { DelegationTimeline } from '../delegation/DelegationTimeline';

interface GovernanceDashboardProps {
  approvals: ApprovalRequest[];
  delegations: Delegation[];
  identity: HumanIdentity;
  onRefresh: () => void;
}

export const GovernanceDashboard: React.FC<GovernanceDashboardProps> = ({
  approvals,
  delegations,
  identity,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<'approvals' | 'delegations'>('approvals');

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-[#E5EAF0] rounded-xl w-fit shadow-xs">
        <button
          onClick={() => setSubTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            subTab === 'approvals'
              ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Decisions & Escalations</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('delegations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            subTab === 'delegations'
              ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <GitFork className="w-4 h-4 text-teal-600" />
          <span>Agent-to-Agent Delegation</span>
          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {delegations.length}
          </span>
        </button>
      </div>

      {/* Active Sub-tab View */}
      {subTab === 'approvals' && (
        <ApprovalInbox approvals={approvals} identity={identity} onRefresh={onRefresh} />
      )}

      {subTab === 'delegations' && (
        <DelegationTimeline delegations={delegations} identity={identity} onRefresh={onRefresh} />
      )}
    </div>
  );
};
