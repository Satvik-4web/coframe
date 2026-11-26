import React, { useState } from 'react';
import { ArtifactSection, Requirement, HumanIdentity } from '../../types';
import { LedgerFlowHero } from './LedgerFlowHero';
import { LedgerFlowMetricGrid } from './LedgerFlowMetricGrid';
import { LedgerFlowApprovalQueue } from './LedgerFlowApprovalQueue';
import { ManualHeroEditModal } from './ManualHeroEditModal';
import { SubmitExpenseModal } from './SubmitExpenseModal';
import { Edit3, CheckCircle, Target, Sparkles, AlertCircle, ArrowUpRight, Layers, Palette, Plus, Receipt } from 'lucide-react';
import { updateRequirement } from '../../lib/api';

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
    <div className="space-y-5 max-w-6xl mx-auto pb-8">
      {/* Subheader Navigation Controls */}
      <div
        className="p-3 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="flex items-center gap-1 p-1 rounded-xl self-start lg:self-auto shrink-0 border"
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('prototype')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            style={
              activeTab === 'prototype'
                ? {
                    background: 'rgba(34, 211, 238, 0.2)',
                    color: '#22D3EE',
                    boxShadow: '0 0 10px rgba(34, 211, 238, 0.25)',
                  }
                : { color: '#64748B' }
            }
          >
            <Palette className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Prototype preview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brief')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            style={
              activeTab === 'brief'
                ? {
                    background: 'rgba(167, 139, 250, 0.2)',
                    color: '#A78BFA',
                    boxShadow: '0 0 10px rgba(167, 139, 250, 0.25)',
                  }
                : { color: '#64748B' }
            }
          >
            <Target className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Product brief</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg border whitespace-nowrap font-bold"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              color: '#34D399',
            }}
          >
            Artifact v{artifactVersion}
          </span>

          {activeTab === 'prototype' && (
            <>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="h-8 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#F1F5F9',
                }}
                title="Edit hero section manually to simulate concurrent changes"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                <span>Manual edit hero</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: 'linear-gradient(135deg, #06B6D4, #22D3EE)',
                  color: '#042F2E',
                  boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)',
                }}
                title="Submit a live employee expense into LedgerFlow"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Submit expense</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Live React Prototype Preview */}
      {activeTab === 'prototype' && (
        <div
          className="rounded-2xl border overflow-hidden p-4 sm:p-6 space-y-6"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* App Chrome Header */}
          <div
            className="rounded-xl px-5 py-3 flex items-center justify-between border"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <div className="flex items-center space-x-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{
                  background: 'linear-gradient(135deg, #06B6D4, #22D3EE)',
                  boxShadow: '0 0 10px rgba(34, 211, 238, 0.4)',
                  color: '#042F2E',
                }}
              >
                LF
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs tracking-tight">LedgerFlow</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border"
                  style={{
                    background: 'rgba(34, 211, 238, 0.12)',
                    borderColor: 'rgba(34, 211, 238, 0.25)',
                    color: '#22D3EE',
                  }}
                >
                  Live sandbox
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#34D399',
                  boxShadow: '0 0 6px rgba(52, 211, 153, 0.8)',
                }}
              />
              <span className="text-[11px] font-semibold text-emerald-400">Interactive preview</span>
            </div>
          </div>

          {/* Section 1: Hero */}
          <LedgerFlowHero data={heroSection.data as any} version={heroSection.version} />

          {/* Section 2: Metric Dashboard */}
          <LedgerFlowMetricGrid data={dashboardSection.data as any} version={dashboardSection.version} />

          {/* Section 3: Approval Queue */}
          <LedgerFlowApprovalQueue
            data={queueSection.data as any}
            version={queueSection.version}
            identity={identity}
          />
        </div>
      )}

      {/* Tab 2: Product Brief & Strategy */}
      {activeTab === 'brief' && (
        <div className="space-y-4">
          <div className="coframe-card p-6">
            <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-900/[0.06]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200/70 flex items-center justify-center">
                  <Target className="w-4 h-4 text-[#6D28D9]" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">LedgerFlow Strategic Brief</h3>
                  <p className="text-xs text-slate-500">Core value propositions and audience definitions</p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-900/[0.06]">
                v{briefSection.version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-900/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#2563EB]">
                    Target audience (REQ_AUDIENCE)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingAudience(!editingAudience)}
                    className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#2563EB]/40 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                      placeholder="e.g. Enterprise finance teams"
                    />
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleAudienceSubmit}
                        disabled={isUpdatingReq}
                        className="h-8 px-3.5 rounded-lg btn-obsidian text-xs font-medium cursor-pointer"
                      >
                        {isUpdatingReq ? 'Saving...' : 'Update & advance context'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-900 font-medium mt-1">
                    {briefSection.data?.target_audience || audienceReq?.value || 'Small businesses'}
                  </p>
                )}
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-900/[0.06]">
                <span className="text-xs font-medium text-[#6D28D9] block mb-2">
                  Value proposition
                </span>
                <p className="text-xs text-slate-900 font-medium mt-1 leading-relaxed">
                  {briefSection.data?.value_proposition || 'A simpler way for small teams to track spend and close books faster'}
                </p>
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-900/[0.06] md:col-span-2">
                <span className="text-xs font-medium text-slate-700 block mb-2">
                  Core problem statement
                </span>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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
      {isExpenseModalOpen && (
        <SubmitExpenseModal
          identity={identity}
          onClose={() => setIsExpenseModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};
