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
        <div><p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-teal-300">Product canvas</p><h1 className="text-3xl font-semibold tracking-[-.04em] text-[#EDF2FA] sm:text-4xl">LedgerFlow preview</h1><p className="mt-2 text-sm text-[#96A6BE]">Explore the product, its live expense workflow, and the strategy behind it.</p></div>
        <span className="rounded-full border border-[#303A4B] bg-[#1A202C] px-3 py-1.5 text-xs font-semibold text-[#ACBAD0]">Artifact v{artifactVersion}</span>
      </div>
      {/* Subheader Navigation Controls */}
      <div className="dashboard-card flex flex-col gap-4 rounded-[20px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('prototype')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'prototype'
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/25 shadow-2xs'
                : 'text-[#A3B0C4] hover:text-[#E7EDF7] hover:bg-[#141A24]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-teal-400" />
            <span>Prototype Preview (LedgerFlow)</span>
          </button>
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'brief'
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/25 shadow-2xs'
                : 'text-[#A3B0C4] hover:text-[#E7EDF7] hover:bg-[#141A24]'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-violet-400" />
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
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/10 text-violet-300 border border-violet-500/25 text-xs font-semibold transition cursor-pointer shadow-2xs"
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
        <div className="overflow-hidden rounded-[26px] border border-[#303A4B] bg-[#111822] p-3 shadow-[0_20px_55px_-36px_rgba(15,23,42,.35)] sm:p-6 space-y-6">
          {/* App Header simulation inside LedgerFlow */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#303A4B] bg-[#1A202C] px-5 py-4 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                LF
              </div>
              <div>
                <span className="font-bold text-[#E7EDF7] text-sm tracking-tight">LedgerFlow</span>
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 font-medium border border-teal-500/25">
                  Interactive demo
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-[#A3B0C4]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-[#E7EDF7]">Live LedgerFlow Sandbox</span>
            </div>
          </div>

          {/* Section 1: Hero */}
          <LedgerFlowHero data={heroSection.data as any} version={heroSection.version} />

          {expenseMetrics && (
            <section aria-label="Live expense totals" className="rounded-[22px] border border-teal-500/25 bg-[#142C2C] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-teal-300">Real data</p><h2 className="mt-1 text-lg font-semibold text-teal-300">Live expense workflow</h2></div><Receipt className="h-5 w-5 text-teal-300" /></div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-[#1A202C]/75 p-3"><span className="block text-xs text-teal-300">Submitted</span><strong className="mt-1 block text-2xl text-teal-300">{expenseMetrics.total_submitted}</strong></div>
                <div className="rounded-xl bg-[#1A202C]/75 p-3"><span className="block text-xs text-teal-300">Pending</span><strong className="mt-1 block text-2xl text-teal-300">{expenseMetrics.pending_count}</strong></div>
                <div className="rounded-xl bg-[#1A202C]/75 p-3"><span className="block text-xs text-teal-300">Approved</span><strong className="mt-1 block text-2xl text-teal-300">{expenseMetrics.approved_count}</strong></div>
                <div className="rounded-xl bg-[#1A202C]/75 p-3"><span className="block text-xs text-teal-300">Approved spend</span><strong className="mt-1 block text-xl text-teal-300">${expenseMetrics.total_approved_amount.toFixed(2)}</strong></div>
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
          <div className="bg-[#1A202C] border border-[#303A4B] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#303A4B]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
                  <Target className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-bold text-[#E7EDF7] text-sm">LedgerFlow Strategic Brief</h3>
                  <p className="text-xs text-[#A3B0C4]">Core value propositions and audience definitions</p>
                </div>
              </div>
              <span className="text-xs font-mono text-[#A3B0C4] bg-[#141A24] px-2.5 py-1 rounded-lg border border-[#303A4B]">
                Section v{briefSection.version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Audience */}
              <div className="bg-[#141A24] p-4 rounded-xl border border-[#303A4B]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                    Target Audience (REQ_AUDIENCE)
                  </span>
                  <button
                    onClick={() => setEditingAudience(!editingAudience)}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-blue-400 text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                  <p className="text-xs text-[#E7EDF7] font-semibold mt-1">
                    {briefSection.data?.target_audience || audienceReq?.value || 'Small businesses'}
                  </p>
                )}
              </div>

              {/* Value Proposition */}
              <div className="bg-[#141A24] p-4 rounded-xl border border-[#303A4B]">
                <span className="text-xs font-bold text-violet-300 uppercase tracking-wider block mb-2">
                  Value Proposition
                </span>
                <p className="text-xs text-[#E7EDF7] font-semibold mt-1">
                  {briefSection.data?.value_proposition || 'A simpler way for small teams to track spend and close books faster'}
                </p>
              </div>

              {/* Problem */}
              <div className="bg-[#141A24] p-4 rounded-xl border border-[#303A4B] md:col-span-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2">
                  Core Problem Statement
                </span>
                <p className="text-xs text-[#A3B0C4] mt-1 leading-relaxed">
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
