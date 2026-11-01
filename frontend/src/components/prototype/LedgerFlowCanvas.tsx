import React, { useState } from 'react';
import { ArtifactSection, Requirement, HumanIdentity, Proposal } from '../../types';
import { LedgerFlowHero } from './LedgerFlowHero';
import { LedgerFlowMetricGrid } from './LedgerFlowMetricGrid';
import { LedgerFlowApprovalQueue } from './LedgerFlowApprovalQueue';
import { ManualHeroEditModal } from './ManualHeroEditModal';
import { SubmitExpenseModal } from './SubmitExpenseModal';
import {
  Edit3,
  Target,
  Palette,
  Plus,
  Lock,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { updateRequirement } from '../../lib/api';
import { useToast } from '../common/Toast';

interface LedgerFlowCanvasProps {
  sections: Record<string, ArtifactSection>;
  requirements: Requirement[];
  artifactVersion: number;
  identity: HumanIdentity;
  onRefresh: () => void;
  previewProposalId?: string | null;
  onExitPreview?: () => void;
  proposals?: Proposal[];
}

export const LedgerFlowCanvas: React.FC<LedgerFlowCanvasProps> = ({
  sections,
  requirements,
  artifactVersion,
  identity,
  onRefresh,
  previewProposalId,
  onExitPreview,
  proposals = [],
}) => {
  const [activeTab, setActiveTab] = useState<'prototype' | 'brief'>('prototype');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState(false);
  const [newAudienceVal, setNewAudienceVal] = useState('Enterprise finance teams');
  const [isUpdatingReq, setIsUpdatingReq] = useState(false);
  const { showToast } = useToast();

  // Find active preview proposal
  const previewProposal = previewProposalId
    ? proposals.find((p) => p.proposal_id === previewProposalId)
    : null;

  // Compute preview sections overlay if previewing
  const proposedSectionsSet = new Set<string>();
  const effectiveSections: Record<string, ArtifactSection> = { ...sections };

  if (previewProposal && previewProposal.changes?.operations) {
    for (const op of previewProposal.changes.operations) {
      const secKey =
        op.section ||
        (op.op === 'set_hero_content'
          ? 'hero'
          : op.op === 'set_dashboard_metrics'
          ? 'dashboard'
          : op.op === 'set_approval_queue_config'
          ? 'approval_queue'
          : op.op === 'update_product_brief'
          ? 'product_brief'
          : undefined);

      if (!secKey) continue;
      proposedSectionsSet.add(secKey);

      const baseSec = effectiveSections[secKey] || { data: {}, version: 1 };
      const currentData = baseSec.data || {};
      const anyOp = op as any;
      const fields = anyOp.fields || anyOp.config || anyOp.data || {};
      const updatedData = { ...currentData, ...fields };
      if (anyOp.metrics) updatedData.metrics = anyOp.metrics;
      if (anyOp.categories) updatedData.categories = anyOp.categories;
      if (anyOp.items) updatedData.items = anyOp.items;
      if (anyOp.title) updatedData.title = anyOp.title;

      effectiveSections[secKey] = {
        ...baseSec,
        data: updatedData,
      };
    }
  }

  const heroSection = effectiveSections['hero'] || { data: {}, version: 1 };
  const dashboardSection = effectiveSections['dashboard'] || { data: {}, version: 1 };
  const queueSection = effectiveSections['approval_queue'] || { data: {}, version: 1 };
  const briefSection = effectiveSections['product_brief'] || { data: {}, version: 1 };

  const audienceReq = requirements.find((r) => r.requirement_key === 'REQ_AUDIENCE');

  // Compute clean change badge for a section
  const getSectionBadge = (secKey: string, sec: ArtifactSection) => {
    if (proposedSectionsSet.has(secKey)) {
      return `PROPOSED BY PIXEL · proposal #${previewProposal?.proposal_id.slice(-6)}`;
    }
    const matchingProp = proposals.find(
      (p) => p.status === 'approved' && (p.target_sections || []).includes(secKey)
    );
    const author = sec.updated_by
      ? sec.updated_by.replace('agent:', '').toUpperCase()
      : matchingProp?.created_by?.toUpperCase() || 'SYSTEM';
    const propStamp = matchingProp ? ` · proposal #${matchingProp.proposal_id.slice(-6)}` : '';
    return `${secKey} · changed by ${author}${propStamp} · v${sec.version}`;
  };

  const handleAudienceSubmit = async () => {
    setIsUpdatingReq(true);
    try {
      await updateRequirement('demo-ledgerflow', 'REQ_AUDIENCE', newAudienceVal, identity || 'alex');
      showToast('Audience requirement updated! Context version advanced.', 'success');
      setEditingAudience(false);
      onRefresh();
    } catch (err) {
      showToast('Failed to update requirement', 'error');
    } finally {
      setIsUpdatingReq(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subheader Navigation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E7ECF2] p-4 sm:p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('prototype')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
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
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'brief'
                ? 'bg-violet-50 text-violet-800 border border-violet-200 shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-violet-600" />
            <span>Product Brief & Strategy</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#657189] font-medium bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E7ECF2]">
            Artifact Version: <strong className="text-emerald-700 font-mono">v{artifactVersion}</strong>
          </span>

          {activeTab === 'prototype' && (
            <>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Submit a real employee expense into LedgerFlow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Submit Expense</span>
              </button>

              <button
                onClick={() => {
                  if (identity !== 'maya') {
                    showToast('Only Maya (Product Designer) can manually edit the Hero section.', 'error');
                    return;
                  }
                  setIsEditModalOpen(true);
                }}
                disabled={identity !== 'maya'}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition shadow-2xs ${
                  identity === 'maya'
                    ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={
                  identity === 'maya'
                    ? 'Manually edit the Hero section as Maya'
                    : 'Only Maya (Product Designer) can manually edit the Hero section'
                }
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual Edit Hero (Maya)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sticky Proposal Preview Notification Bar */}
      {previewProposal && (
        <div className="bg-teal-900 text-white px-5 py-3 rounded-2xl shadow-lg border border-teal-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">
                  Live Preview Mode
                </span>
                <span className="text-[10px] font-mono bg-teal-800 px-2 py-0.5 rounded text-teal-100">
                  #{previewProposal.proposal_id.slice(-6)}
                </span>
              </div>
              <p className="text-xs text-white mt-0.5">
                Previewing proposed changes: <strong>{previewProposal.summary}</strong>. These changes have <em>not</em> been applied to the shared prototype.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="px-3.5 py-1.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer border border-teal-600"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit Preview</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Live React Prototype Preview inside Browser Window Frame */}
      {activeTab === 'prototype' && (
        <div className="rounded-3xl border border-[#D5DFEB] shadow-xl overflow-hidden bg-white">
          {/* Browser Window Frame Header */}
          <div className="bg-[#EDF2F7] px-4 py-3 border-b border-[#D5DFEB] flex flex-wrap items-center justify-between gap-3">
            {/* Window control dots */}
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block shadow-2xs" />

              <div className="hidden sm:flex items-center space-x-1 ml-4 text-slate-400">
                <button
                  type="button"
                  className="p-1 hover:text-slate-600 rounded transition cursor-default"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 hover:text-slate-600 rounded transition cursor-default"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-1 hover:text-slate-600 rounded transition cursor-pointer"
                  title="Reload prototype"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Fake URL Bar */}
            <div className="flex-1 max-w-md mx-2">
              <div className="bg-white border border-[#CBD5E1] rounded-xl px-3 py-1 flex items-center space-x-2 text-xs text-slate-600 shadow-2xs">
                <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="font-mono text-[11px] truncate">
                  app.ledgerflow.internal/expenses/overview
                </span>
              </div>
            </div>

            {/* Interactive Prototype Badge */}
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Interactive Prototype</span>
              </span>
            </div>
          </div>

          {/* Prototype Internal Canvas */}
          <div className="p-4 sm:p-6 bg-slate-50/70 space-y-6">
            {/* Section 1: Hero */}
            <LedgerFlowHero
              data={heroSection.data as any}
              version={heroSection.version}
              changeBadge={getSectionBadge('hero', heroSection)}
              isProposed={proposedSectionsSet.has('hero')}
            />

            {/* Section 2: Metric Dashboard */}
            <LedgerFlowMetricGrid
              data={dashboardSection.data as any}
              version={dashboardSection.version}
              changeBadge={getSectionBadge('dashboard', dashboardSection)}
              isProposed={proposedSectionsSet.has('dashboard')}
            />

            {/* Section 3: Approval Queue */}
            <LedgerFlowApprovalQueue
              data={queueSection.data as any}
              version={queueSection.version}
              identity={identity}
              changeBadge={getSectionBadge('approval_queue', queueSection)}
              isProposed={proposedSectionsSet.has('approval_queue')}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Product Brief & Strategy */}
      {activeTab === 'brief' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E7ECF2] rounded-3xl p-6 shadow-sm">
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
              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E7ECF2]">
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
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-400 text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g. Enterprise finance teams"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={handleAudienceSubmit}
                        disabled={isUpdatingReq}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
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
              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E7ECF2]">
                <span className="text-xs font-bold text-violet-700 uppercase tracking-wider block mb-2">
                  Value Proposition
                </span>
                <p className="text-xs text-[#172033] font-semibold mt-1">
                  {briefSection.data?.value_proposition ||
                    'A simpler way for small teams to track spend and close books faster'}
                </p>
              </div>

              {/* Problem */}
              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E7ECF2] md:col-span-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                  Core Problem Statement
                </span>
                <p className="text-xs text-[#657189] mt-1 leading-relaxed">
                  {briefSection.data?.problem ||
                    'Manual, slow expense filing and receipt tracking creates reconciliation bottlenecks.'}
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
