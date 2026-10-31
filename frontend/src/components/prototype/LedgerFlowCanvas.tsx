import React, { useState } from 'react';
import { ArtifactSection, Requirement, HumanIdentity } from '../../types';
import { LedgerFlowHero } from './LedgerFlowHero';
import { LedgerFlowMetricGrid } from './LedgerFlowMetricGrid';
import { LedgerFlowApprovalQueue } from './LedgerFlowApprovalQueue';
import { ManualHeroEditModal } from './ManualHeroEditModal';
import { Edit3, CheckCircle, Target, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Subheader Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151B29] border border-[#263244] p-3 rounded-xl">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('prototype')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'prototype'
                ? 'bg-[#1B2433] text-teal-400 border border-teal-500/40 shadow-sm'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            🎨 Prototype Preview (LedgerFlow)
          </button>
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'brief'
                ? 'bg-[#1B2433] text-violet-400 border border-violet-500/40 shadow-sm'
                : 'text-[#98A5B7] hover:text-[#F4F7FB]'
            }`}
          >
            📋 Product Brief & Strategy
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[11px] text-[#98A5B7]">
            Overall Artifact: <strong className="text-emerald-400 font-mono">v{artifactVersion}</strong>
          </span>

          {activeTab === 'prototype' && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-800/40 text-xs font-medium transition cursor-pointer"
              title="Manually edit the Hero section as Maya to demonstrate human-vs-agent conflict"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Manual Edit Hero (Maya)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Live React Prototype Preview (Warm White Canvas) */}
      {activeTab === 'prototype' && (
        <div className="rounded-2xl border-4 border-[#1E293B] shadow-2xl overflow-hidden bg-slate-100 p-4 sm:p-6 space-y-6">
          {/* App Header simulation inside LedgerFlow */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
                LF
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs tracking-wide">LedgerFlow App</span>
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium border border-teal-200">
                  Production Sandbox
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium text-slate-600">Enterprise Sync Active</span>
            </div>
          </div>

          {/* Section 1: Hero */}
          <LedgerFlowHero data={heroSection.data as any} version={heroSection.version} />

          {/* Section 2: Metric Dashboard */}
          <LedgerFlowMetricGrid data={dashboardSection.data as any} version={dashboardSection.version} />

          {/* Section 3: Approval Queue */}
          <LedgerFlowApprovalQueue data={queueSection.data as any} version={queueSection.version} />
        </div>
      )}

      {/* Tab 2: Product Brief & Strategy */}
      {activeTab === 'brief' && (
        <div className="space-y-4">
          <div className="bg-[#151B29] border border-[#263244] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-[#F4F7FB] text-base">LedgerFlow Product Brief</h3>
              </div>
              <span className="text-xs font-mono text-[#98A5B7]">
                Section v{briefSection.version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Audience */}
              <div className="bg-[#1B2433] p-4 rounded-lg border border-[#263244]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    Target Audience (REQ_AUDIENCE)
                  </span>
                  <button
                    onClick={() => setEditingAudience(!editingAudience)}
                    className="text-[11px] text-blue-400 hover:underline"
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
                      className="w-full px-2.5 py-1.5 rounded bg-[#121824] border border-blue-500/50 text-[#F4F7FB] text-xs"
                      placeholder="e.g. Enterprise finance teams"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={handleAudienceSubmit}
                        disabled={isUpdatingReq}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                      >
                        {isUpdatingReq ? 'Saving...' : 'Update & Advance Context'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#F4F7FB] font-medium mt-1">
                    {briefSection.data?.target_audience || audienceReq?.value || 'Small businesses'}
                  </p>
                )}
              </div>

              {/* Value Proposition */}
              <div className="bg-[#1B2433] p-4 rounded-lg border border-[#263244]">
                <span className="text-xs font-bold text-violet-400 uppercase tracking-wider block mb-1.5">
                  Value Proposition
                </span>
                <p className="text-xs text-[#F4F7FB] font-medium mt-1">
                  {briefSection.data?.value_proposition || 'A simpler way for small teams to track spend and close books faster'}
                </p>
              </div>

              {/* Problem */}
              <div className="bg-[#1B2433] p-4 rounded-lg border border-[#263244] md:col-span-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1.5">
                  Core Problem Statement
                </span>
                <p className="text-xs text-[#98A5B7] mt-1">
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
    </div>
  );
};
