import React, { useState } from 'react';
import {
  GitFork,
  ArrowRight,
  Bot,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  CheckSquare,
  Square,
  FileCode,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Delegation, HumanIdentity } from '../../types';
import { triggerDemoDelegation, createDelegation } from '../../lib/api';

interface DelegationTimelineProps {
  delegations: Delegation[];
  identity: HumanIdentity;
  onRefresh: () => void;
}

export const DelegationTimeline: React.FC<DelegationTimelineProps> = ({
  delegations,
  identity,
  onRefresh,
}) => {
  const [triggering, setTriggering] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // New delegation form state
  const [sourceAgent, setSourceAgent] = useState<'nova' | 'pixel'>('nova');
  const [targetAgent, setTargetAgent] = useState<'nova' | 'pixel'>('pixel');
  const [task, setTask] = useState('');
  const [scope, setScope] = useState('');
  const [criteriaText, setCriteriaText] = useState('');
  const [creating, setCreating] = useState(false);

  const handleTriggerDemoDelegation = async () => {
    setTriggering(true);
    try {
      await triggerDemoDelegation('demo-ledgerflow');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger agent delegation');
    } finally {
      setTriggering(false);
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;
    setCreating(true);
    try {
      const criteria = criteriaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await createDelegation('demo-ledgerflow', {
        source_agent: sourceAgent,
        target_agent: targetAgent,
        task,
        scope: scope.trim() || undefined,
        acceptance_criteria: criteria.length > 0 ? criteria : ['Section update verified', 'Passes schema check'],
      });

      setShowModal(false);
      setTask('');
      setScope('');
      setCriteriaText('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch delegation');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5EAF0]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#172033]">Agent-to-Agent Delegation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
              OpenAgents Multi-Agent Protocol
            </span>
          </div>
          <p className="text-sm text-[#657189] mt-1">
            Autonomous handoffs where NOVA (Product Strategist) delegates implementation tasks with explicit criteria to PIXEL (Prototype Engineer).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E5EAF0] rounded-xl hover:bg-[#F8FAFC] transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Delegation
          </button>
          <button
            onClick={handleTriggerDemoDelegation}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs"
          >
            {triggering ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Trigger NOVA → PIXEL Run
          </button>
        </div>
      </div>

      {/* Delegation Cards Feed */}
      {delegations.length === 0 ? (
        <div className="bg-white border border-[#E5EAF0] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <GitFork className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#172033]">No agent delegations recorded yet</h3>
          <p className="text-xs text-[#657189] mt-1 max-w-md mx-auto">
            Click "Trigger NOVA → PIXEL Run" above to see NOVA synthesize market requirements and delegate prototype implementation to PIXEL.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {delegations.map((del) => (
            <div
              key={del.id}
              className="bg-white border border-[#E5EAF0] hover:border-teal-200 rounded-2xl p-5 transition-all shadow-xs space-y-4"
            >
              {/* Agent Handoff Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F3F7]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 text-xs font-bold">
                    <Bot className="w-3.5 h-3.5" />
                    <span>{del.source_agent.toUpperCase()}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400" />

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{del.target_agent.toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#657189]">{del.id}</span>
                  {getStatusBadge(del.status)}
                </div>
              </div>

              {/* Task & Scope */}
              <div>
                <h3 className="text-sm font-bold text-[#172033] mb-1">{del.task}</h3>
                {del.scope && (
                  <p className="text-xs text-[#657189] bg-[#F8FAFC] p-3 rounded-xl border border-[#E5EAF0]">
                    <span className="font-semibold text-[#172033]">Scope: </span>
                    {del.scope}
                  </p>
                )}
              </div>

              {/* Acceptance Criteria Checklist */}
              {del.acceptance_criteria && del.acceptance_criteria.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#657189] mb-2">
                    Acceptance Criteria Checklist
                  </h4>
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {del.acceptance_criteria.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-[#172033]">
                        {del.status === 'completed' ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={del.status === 'completed' ? 'text-slate-700 font-medium' : ''}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Result Proposal Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                {del.result_proposal_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#657189] text-[11px] font-medium">Resulting Artifact Proposal:</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 font-semibold">
                      <FileCode className="w-3 h-3" /> {del.result_proposal_id}
                    </span>
                  </div>
                ) : (
                  <span className="text-[#657189] text-[11px] italic">
                    Awaiting proposal emission from target agent...
                  </span>
                )}

                <span className="text-[#657189] text-[11px]">
                  Delegated on {new Date(del.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Delegation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E5EAF0] max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E5EAF0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#172033]">Dispatch Agent Delegation</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#657189] hover:text-[#172033] p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDelegation} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">Source Agent</label>
                  <select
                    value={sourceAgent}
                    onChange={(e) => setSourceAgent(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5EAF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-[#172033]"
                  >
                    <option value="nova">NOVA (Strategist)</option>
                    <option value="pixel">PIXEL (Engineer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">Target Agent</label>
                  <select
                    value={targetAgent}
                    onChange={(e) => setTargetAgent(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5EAF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-[#172033]"
                  >
                    <option value="pixel">PIXEL (Engineer)</option>
                    <option value="nova">NOVA (Strategist)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">Task Directive</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement multi-currency audit trail in metric grid"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5EAF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">Scope & Boundary</label>
                <input
                  type="text"
                  placeholder="e.g. Modify metric_grid section only; preserve existing hero header"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5EAF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-[#172033]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">
                  Acceptance Criteria (one per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="Display 4 distinct enterprise cards&#10;Total variance within 2%&#10;Ensure mobile responsiveness"
                  value={criteriaText}
                  onChange={(e) => setCriteriaText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5EAF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-[#172033]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E5EAF0] rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Dispatch Delegation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
