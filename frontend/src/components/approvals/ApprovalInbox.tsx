import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CornerUpRight,
  AlertTriangle,
  Clock,
  User,
  Bot,
  Sparkles,
  Lock,
  MessageSquare,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ApprovalRequest, HumanIdentity } from '../../types';
import { resolveApproval } from '../../lib/api';

interface ApprovalInboxProps {
  approvals: ApprovalRequest[];
  identity: HumanIdentity;
  onRefresh: () => void;
}

export const ApprovalInbox: React.FC<ApprovalInboxProps> = ({
  approvals,
  identity,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | 'redirected' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [loading, setLoading] = useState(false);

  const isAlex = identity === 'alex';

  const filteredApprovals = approvals.filter((appr) => {
    if (filter === 'pending') return appr.status === 'pending';
    if (filter === 'resolved') return appr.status !== 'pending';
    return true;
  });

  const handleResolve = async (approvalId: string, decision: 'approved' | 'rejected' | 'redirected') => {
    if (!isAlex) {
      alert('Permission Denied: Only Alex (Founder & Decision Owner) can sign off on escalations.');
      return;
    }
    setLoading(true);
    try {
      await resolveApproval('demo-ledgerflow', approvalId, {
        decision,
        decided_by: 'alex',
        note: resolutionNote.trim() || undefined,
      });
      setResolvingId(null);
      setActionType(null);
      setResolutionNote('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve approval request');
    } finally {
      setLoading(false);
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            Critical Impact
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            High Impact
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            Medium Impact
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Low Impact
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'redirected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <CornerUpRight className="w-3 h-3" /> Redirected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3 h-3" /> Pending Sign-off
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1A223D]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Decisions & Governance Inbox</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
              OpenAgents Escalation Protocol
            </span>
          </div>
          <p className="text-sm text-[#8695B7] mt-1">
            Authoritative human review and sign-off queue for high-impact agent contributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-teal-50 text-teal-900 border border-teal-200 font-semibold'
                : 'text-[#8695B7] hover:bg-[#141A33] hover:text-white'
            }`}
          >
            All ({approvals.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'pending'
                ? 'bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
                : 'text-[#8695B7] hover:bg-[#141A33] hover:text-white'
            }`}
          >
            Pending ({approvals.filter((a) => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'resolved'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold'
                : 'text-[#8695B7] hover:bg-[#141A33] hover:text-white'
            }`}
          >
            Resolved ({approvals.filter((a) => a.status !== 'pending').length})
          </button>
        </div>
      </div>

      {/* Identity Role Advisory Banner */}
      {!isAlex && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
              Read-Only Governance Access (Signed in as {identity === 'maya' ? 'Maya — Product Designer' : 'Observer'})
            </h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              High-impact architectural and product changes require authoritative sign-off by Alex (Founder & Decision Owner).
              Switch to Alex using the identity picker in the top bar to approve or reject pending requests.
            </p>
          </div>
        </div>
      )}

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="bg-[#0F1528] border border-[#1A223D] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#141A33] border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No approval requests in this view</h3>
          <p className="text-xs text-[#8695B7] mt-1">
            All agent contributions are currently reconciled and compliant with decision policies.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((appr) => {
            const isPending = appr.status === 'pending';
            const isResolving = resolvingId === appr.id;

            return (
              <div
                key={appr.id}
                className={`bg-[#0F1528] border rounded-2xl p-5 transition-all shadow-xs ${
                  isPending
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-[#1A223D] hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F0F3F7]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-teal-50 border border-teal-100">
                      <ShieldAlert className="w-4 h-4 text-teal-700" />
                    </span>
                    <h3 className="text-sm font-bold text-white">{appr.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {getImpactBadge(appr.expected_impact)}
                    {getStatusBadge(appr.status)}
                  </div>
                </div>

                {/* Body Details */}
                <div className="py-3 space-y-3">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#8695B7]">
                      Explanation & Context
                    </h4>
                    <p className="text-xs text-white mt-1 leading-relaxed bg-[#090D1A] p-3 rounded-xl border border-[#1A223D]">
                      {appr.explanation}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                      Escalation Trigger
                    </h4>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                      {appr.escalation_reason}
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-[#8695B7] text-[11px] font-medium">Requested By:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100 text-xs font-semibold">
                      <Bot className="w-3 h-3" /> {appr.requested_by.toUpperCase()}
                    </span>

                    <span className="text-slate-300">•</span>

                    <span className="text-[#8695B7] text-[11px] font-medium">Assigned Decider:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold">
                      <User className="w-3 h-3" /> {appr.assigned_decider_id.toUpperCase()} (Founder)
                    </span>

                    {appr.proposal_id && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-[#8695B7] text-[11px] font-medium">Linked Proposal:</span>
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {appr.proposal_id}
                        </span>
                      </>
                    )}

                    {appr.resolved_by && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-[#8695B7] text-[11px] font-medium">Signed By:</span>
                        <span className="font-semibold text-emerald-700">
                          {appr.resolved_by.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions Row */}
                {isPending && (
                  <div className="pt-3 border-t border-[#F0F3F7]">
                    {isResolving ? (
                      <div className="bg-[#090D1A] p-4 rounded-xl border border-[#1A223D] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Confirm Decision: <span className="uppercase text-teal-700">{actionType}</span>
                          </span>
                          <button
                            onClick={() => {
                              setResolvingId(null);
                              setActionType(null);
                            }}
                            className="text-xs text-[#8695B7] hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Optional decision note / guidance..."
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#0F1528] border border-[#1A223D] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleResolve(appr.id, actionType!)}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition"
                          >
                            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            Confirm & Apply Decision
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResolvingId(appr.id);
                            setActionType('redirected');
                          }}
                          disabled={!isAlex}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!isAlex ? 'Requires Alex identity' : undefined}
                        >
                          <CornerUpRight className="w-3.5 h-3.5" />
                          Redirect Agent
                        </button>
                        <button
                          onClick={() => {
                            setResolvingId(appr.id);
                            setActionType('rejected');
                          }}
                          disabled={!isAlex}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!isAlex ? 'Requires Alex identity' : undefined}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            setResolvingId(appr.id);
                            setActionType('approved');
                          }}
                          disabled={!isAlex}
                          className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!isAlex ? 'Requires Alex identity' : undefined}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Sign-off
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
