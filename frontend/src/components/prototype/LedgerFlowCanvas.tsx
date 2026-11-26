import React, { useEffect, useState } from 'react';
import { ArtifactSection, Requirement, HumanIdentity } from '../../types';
import { LedgerFlowHero } from './LedgerFlowHero';
import { LedgerFlowMetricGrid } from './LedgerFlowMetricGrid';
import { LedgerFlowApprovalQueue } from './LedgerFlowApprovalQueue';
import { ManualHeroEditModal } from './ManualHeroEditModal';
import { SubmitExpenseModal } from './SubmitExpenseModal';
import { Edit3, CheckCircle, Target, Sparkles, AlertCircle, ArrowUpRight, Layers, Palette, Plus, Receipt } from 'lucide-react';
import { fetchExpenses, updateRequirement } from '../../lib/api';

interface LedgerFlowCanvasProps {
  sections: Record<string, ArtifactSection>;
  requirements: Requirement[];
  artifactVersion: number;
  identity: HumanIdentity;
  onRefresh: () => void;
}

export const LedgerFlowCanvas: React.FC<LedgerFlowCanvasProps> = ({
  sections,
  requirements,
  artifactVersion,
  identity,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'prototype' | 'brief'>('prototype');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState(false);
  const [newAudienceVal, setNewAudienceVal] = useState('Enterprise finance teams');
  const [isUpdatingReq, setIsUpdatingReq] = useState(false);
  const [expenseRevision, setExpenseRevision] = useState(0);
  const [approvalThreshold, setApprovalThreshold] = useState<number | null>(null);
  const [expenseMetrics, setExpenseMetrics] = useState<{ total_submitted: number; pending_count: number; approved_count: number; total_approved_amount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExpenses('demo-ledgerflow').then(({ metrics, approval_threshold }) => {
      if (!cancelled) {
        setExpenseMetrics(metrics);
        setApprovalThreshold(approval_threshold);
      }
    }).catch(() => {
      if (!cancelled) setExpenseMetrics(null);
    });
    return () => { cancelled = true; };
  }, [expenseRevision]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === 'EXPENSE_SUBMITTED' || type === 'EXPENSE_DECIDED') setExpenseRevision((n) => n + 1);
    };
    window.addEventListener('coframe:ws_message', onUpdate);
    return () => window.removeEventListener('coframe:ws_message', onUpdate);
  }, []);

  const heroSection = sections['hero'] || { data: {}, version: 1 };
  const dashboardSection = sections['dashboard'] || { data: {}, version: 1 };
  const queueSection = sections['approval_queue'] || { data: {}, version: 1 };
  const briefSection = sections['product_brief'] || { data: {}, version: 1 };

  const audienceReq = requirements.find((r) => r.requirement_key === 'REQ_AUDIENCE');

  const handleAudienceSubmit = async () => {
    setIsUpdatingReq(true);
    try {
      await updateRequirement('demo-ledgerflow', 'REQ_AUDIENCE', newAudienceVal, identity || 'alex');
      setEditingAudience(false);
      onRefresh();
    } catch (err) {
      alert('Failed to update requirement');
    } finally {
      setIsUpdatingReq(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-teal-700">Product canvas</p><h1 className="text-3xl font-semibold tracking-[-.04em] text-[#14213A] sm:text-4xl">LedgerFlow preview</h1><p className="mt-2 text-sm text-slate-500">Explore the product, its live expense workflow, and the strategy behind it.</p></div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Artifact v{artifactVersion}</span>
      </div>
      {/* Subheader Navigation Controls */}
      <div className="dashboard-card flex flex-col gap-4 rounded-[20px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('prototype')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'prototype'
                ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-teal-600" />
            <span>Prototype Preview (LedgerFlow)</span>
          </button>
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'brief'
                ? 'bg-violet-50 text-violet-800 border border-violet-200 shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-violet-600" />
            <span>Product Brief & Strategy</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">

          {activeTab === 'prototype' && (
            <>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                disabled={approvalThreshold === null}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={approvalThreshold === null ? 'Loading expense policy' : 'Submit an expense into LedgerFlow'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Expense</span>
              </button>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Manually edit the Hero section as Maya to demonstrate human-vs-agent conflict"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual Edit Hero (Maya)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Live React Prototype Preview (LedgerFlow Canvas) */}
      {activeTab === 'prototype' && (
        <div className="overflow-hidden rounded-[26px] border border-[#E2E8F0] bg-[#F9FBFD] p-3 shadow-[0_20px_55px_-36px_rgba(15,23,42,.35)] sm:p-6 space-y-6">
          {/* App Header simulation inside LedgerFlow */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7ECF2] bg-white px-5 py-4 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                LF
              </div>
              <div>
                <span className="font-bold text-[#172033] text-sm tracking-tight">LedgerFlow</span>
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200">
                  Interactive demo
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-[#657189]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-[#172033]">Live LedgerFlow Sandbox</span>
            </div>
          </div>

          {/* Section 1: Hero */}
          <LedgerFlowHero data={heroSection.data as any} version={heroSection.version} />

          {expenseMetrics && (
            <section aria-label="Live expense totals" className="rounded-[22px] border border-teal-200 bg-[#F0FAF6] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-teal-700">Real data</p><h2 className="mt-1 text-lg font-semibold text-teal-950">Live expense workflow</h2></div><Receipt className="h-5 w-5 text-teal-700" /></div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-teal-800">Submitted</span><strong className="mt-1 block text-2xl text-teal-950">{expenseMetrics.total_submitted}</strong></div>
                <div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-teal-800">Pending</span><strong className="mt-1 block text-2xl text-teal-950">{expenseMetrics.pending_count}</strong></div>
                <div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-teal-800">Approved</span><strong className="mt-1 block text-2xl text-teal-950">{expenseMetrics.approved_count}</strong></div>
                <div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-teal-800">Approved spend</span><strong className="mt-1 block text-xl text-teal-950">${expenseMetrics.total_approved_amount.toFixed(2)}</strong></div>
              </div>
            </section>
          )}

          {/* Section 2: Metric Dashboard */}
          <LedgerFlowMetricGrid data={dashboardSection.data as any} version={dashboardSection.version} />

          {/* Section 3: Approval Queue */}
          <LedgerFlowApprovalQueue
            data={queueSection.data as any}
            version={queueSection.version}
            identity={identity}
            approvalThreshold={approvalThreshold}
            refreshKey={expenseRevision}
            onExpensesChanged={() => setExpenseRevision((n) => n + 1)}
          />
        </div>
      )}

      {/* Tab 2: Product Brief & Strategy */}
      {activeTab === 'brief' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E7ECF2] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E7ECF2]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center">
                  <Target className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-[#172033] text-sm">LedgerFlow Strategic Brief</h3>
                  <p className="text-xs text-[#657189]">Core value propositions and audience definitions</p>
                </div>
              </div>
              <span className="text-xs font-mono text-[#657189] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E7ECF2]">
                Section v{briefSection.version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Audience */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E7ECF2]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Target Audience (REQ_AUDIENCE)
                  </span>
                  <button
                    onClick={() => setEditingAudience(!editingAudience)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                  >
                    {editingAudience ? 'Cancel' : 'Edit as Alex'}
                  </button>
                </div>

                {editingAudience ? (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={newAudienceVal}
                      onChange={(e) => setNewAudienceVal(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-blue-400 text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g. Enterprise finance teams"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={handleAudienceSubmit}
                        disabled={isUpdatingReq}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        {isUpdatingReq ? 'Saving...' : 'Update & Advance Context'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#172033] font-semibold mt-1">
                    {briefSection.data?.target_audience || audienceReq?.value || 'Small businesses'}
                  </p>
                )}
              </div>

              {/* Value Proposition */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E7ECF2]">
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider block mb-2">
                  Value Proposition
                </span>
                <p className="text-xs text-[#172033] font-semibold mt-1">
                  {briefSection.data?.value_proposition || 'A simpler way for small teams to track spend and close books faster'}
                </p>
              </div>

              {/* Problem */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E7ECF2] md:col-span-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                  Core Problem Statement
                </span>
                <p className="text-xs text-[#657189] mt-1 leading-relaxed">
                  {briefSection.data?.problem || 'Manual, slow expense filing and receipt tracking creates reconciliation bottlenecks.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Hero Edit Modal */}
      {isEditModalOpen && (
        <ManualHeroEditModal
          currentVersion={heroSection.version}
          initialData={heroSection.data as any}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {/* Submit Expense Modal */}
      {isExpenseModalOpen && approvalThreshold !== null && (
        <SubmitExpenseModal
          identity={identity}
          approvalThreshold={approvalThreshold}
          onClose={() => setIsExpenseModalOpen(false)}
          onSuccess={() => { setExpenseRevision((n) => n + 1); onRefresh(); }}
        />
      )}
    </div>
  );
};
