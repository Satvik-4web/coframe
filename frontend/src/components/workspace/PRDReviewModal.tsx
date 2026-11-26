import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  FileText,
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  Bot,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PRD, HumanIdentity, PRDFunctionalRequirement } from '../../types';
import { confirmPRD, updatePRD } from '../../lib/api';

interface PRDReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prd: PRD | null;
  identity: HumanIdentity;
  onConfirmSuccess: (result: any) => void;
  onRefresh: () => void;
}

export const PRDReviewModal: React.FC<PRDReviewModalProps> = ({
  isOpen,
  onClose,
  prd,
  identity,
  onConfirmSuccess,
  onRefresh,
}) => {
  if (!isOpen || !prd) return null;

  return <PRDReviewContent key={`${prd.id}:${prd.version}`} prd={prd} identity={identity} onClose={onClose} onConfirmSuccess={onConfirmSuccess} onRefresh={onRefresh} />;
};

const PRDReviewContent: React.FC<Omit<PRDReviewModalProps, 'isOpen' | 'prd'> & { prd: PRD }> = ({
  prd, identity, onClose, onConfirmSuccess, onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'criteria' | 'questions'>('overview');
  const [title, setTitle] = useState(prd.title);
  const [targetAudience, setTargetAudience] = useState(prd.target_audience);
  const [objective, setObjective] = useState(prd.objective);
  const [problemStatement, setProblemStatement] = useState(prd.problem_statement);
  const [functionalReqs, setFunctionalReqs] = useState<PRDFunctionalRequirement[]>(prd.functional_requirements || []);
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');
  const [showAddReq, setShowAddReq] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isAlex = identity === 'alex';

  const handleAddRequirement = () => {
    if (!newReqTitle.trim()) return;
    const newReq: PRDFunctionalRequirement = {
      id: `FR-${prd.version}.${functionalReqs.length + 1}`,
      title: newReqTitle.trim(),
      description: newReqDesc.trim() || 'Custom human requirement added by Alex.',
      priority: 'High',
    };
    setFunctionalReqs([...functionalReqs, newReq]);
    setNewReqTitle('');
    setNewReqDesc('');
    setShowAddReq(false);
  };

  const handleDeleteRequirement = (id: string) => {
    setFunctionalReqs(functionalReqs.filter((r) => r.id !== id));
  };

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      await updatePRD(prd.id, {
        title,
        target_audience: targetAudience,
        objective,
        problem_statement: problemStatement,
        functional_requirements: functionalReqs,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefresh();
    } catch {
      alert('Failed to save PRD edits');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPRD = async () => {
    if (!isAlex) {
      alert('Only Alex (Founder / Decision Owner) is authorized to confirm the PRD.');
      return;
    }
    setIsConfirming(true);
    try {
      // First persist any unsaved edits
      await updatePRD(prd.id, {
        title,
        target_audience: targetAudience,
        objective,
        problem_statement: problemStatement,
        functional_requirements: functionalReqs,
      });

      const res = await confirmPRD(
        prd.id,
        'alex',
        'Alex reviewed and confirmed PRD requirements. Dispatched to PIXEL for implementation planning.'
      );
      onConfirmSuccess(res);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm PRD');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#1A202C] rounded-2xl max-w-4xl w-full border border-[#E5EAF0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#E5EAF0] flex items-center justify-between bg-[#1A202C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-300 font-bold flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/25">
                  PRD draft v{prd.version}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  prd.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                }`}>
                  {prd.status === 'confirmed' ? 'Confirmed & Active' : 'Awaiting Alex Confirmation'}
                </span>
              </div>
              <h2 className="text-base font-bold text-[#E7EDF7] mt-1">
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A3B0C4] hover:bg-[#1D2633] hover:text-[#E7EDF7] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {prd.generation_mode === 'template_fallback' && (
          <div role="status" className="border-b border-amber-500/25 bg-amber-500/10 px-6 py-2.5 text-xs text-amber-300">
            Live AI was unavailable. This is a demo template; review and edit its requirements before confirming.
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-[#E5EAF0] bg-[#141A24] flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-violet-600 text-violet-300 font-bold'
                : 'border-transparent text-[#A3B0C4] hover:text-[#E7EDF7]'
            }`}
          >
            1. Product Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'requirements'
                ? 'border-violet-600 text-violet-300 font-bold'
                : 'border-transparent text-[#A3B0C4] hover:text-[#E7EDF7]'
            }`}
          >
            <span>2. Requirements ({functionalReqs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'criteria'
                ? 'border-violet-600 text-violet-300 font-bold'
                : 'border-transparent text-[#A3B0C4] hover:text-[#E7EDF7]'
            }`}
          >
            3. Acceptance Criteria
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'border-violet-600 text-violet-300 font-bold'
                : 'border-transparent text-[#A3B0C4] hover:text-[#E7EDF7]'
            }`}
          >
            <span>4. Questions for Alex</span>
            {prd.missing_information && prd.missing_information.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {prd.missing_information.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#E7EDF7] mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-xs font-semibold text-[#E7EDF7] bg-[#1A202C] focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#E7EDF7] mb-1">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-xs font-semibold text-[#E7EDF7] bg-[#1A202C] focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#E7EDF7] mb-1">
                  Product Objective
                </label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#E7EDF7] bg-[#1A202C] focus:outline-none focus:border-violet-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#E7EDF7] mb-1">
                  Problem Being Solved
                </label>
                <textarea
                  rows={2}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-xs text-[#E7EDF7] bg-[#1A202C] focus:outline-none focus:border-violet-500 leading-relaxed"
                />
              </div>

              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/25 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  Proposed Product Direction
                </span>
                <p className="text-xs text-[#E7EDF7] leading-relaxed">
                  {prd.product_direction}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#E7EDF7]">
                    Functional Requirements
                  </h3>
                  <p className="text-[11px] text-[#A3B0C4]">
                    Alex can edit, add, or remove requirements prior to confirming handoff to PIXEL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddReq(true)}
                  className="px-3 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/10 text-violet-300 border border-violet-500/25 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Requirement</span>
                </button>
              </div>

              {showAddReq && (
                <div className="p-4 rounded-xl border border-violet-300 bg-violet-500/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-300">New Functional Requirement</span>
                    <button onClick={() => setShowAddReq(false)} className="text-[#A3B0C4] hover:text-[#E7EDF7]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Requirement Title"
                    value={newReqTitle}
                    onChange={(e) => setNewReqTitle(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E5EAF0] text-xs bg-[#1A202C]"
                  />
                  <textarea
                    rows={2}
                    placeholder="Requirement Description and Expected Behavior"
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E5EAF0] text-xs bg-[#1A202C]"
                  />
                  <button
                    type="button"
                    onClick={handleAddRequirement}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold"
                  >
                    Add to PRD
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {functionalReqs.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="p-4 rounded-xl border border-[#E5EAF0] bg-[#141A24] space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#1A202C] border border-[#E5EAF0] text-violet-300">
                          {req.id}
                        </span>
                        <h4 className="text-xs font-bold text-[#E7EDF7]">
                          {req.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/25">
                          {req.priority || 'High'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequirement(req.id)}
                          className="p-1 rounded text-[#8495AD] hover:text-red-400 transition"
                          title="Remove requirement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#A3B0C4] leading-relaxed">
                      {req.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Non-Functional Requirements */}
              <div className="pt-4 border-t border-[#E5EAF0]">
                <h4 className="text-xs font-bold text-[#E7EDF7] mb-2">
                  Non-Functional Requirements & Constraints
                </h4>
                <div className="space-y-2">
                  {(prd.non_functional_requirements || []).map((nfr, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#1A202C] border border-[#E5EAF0] text-xs">
                      <span className="font-bold text-blue-300 mr-2">{nfr.id}</span>
                      <span className="font-semibold text-[#E7EDF7] mr-2">{nfr.title}:</span>
                      <span className="text-[#A3B0C4]">{nfr.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCEPTANCE CRITERIA */}
          {activeTab === 'criteria' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#E7EDF7]">
                  Acceptance Criteria
                </h3>
                <p className="text-[11px] text-[#A3B0C4]">
                  Explicit validation standards that PIXEL's component proposal must satisfy.
                </p>
              </div>

              <div className="space-y-3">
                {(prd.acceptance_criteria || []).map((ac, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-[#E5EAF0] bg-[#141A24] space-y-2">
                    <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/25">
                      Criteria for {ac.req_id}
                    </span>
                    <ul className="space-y-1.5 mt-2">
                      {(ac.criteria || []).map((c, cIdx) => (
                        <li key={cIdx} className="text-xs text-[#E7EDF7] flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: QUESTIONS FOR ALEX */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">
                    NOVA identified uncertainties & critical questions
                  </h4>
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    Clarify these assumptions so PIXEL builds the right prototype configuration.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {(prd.missing_information || []).map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-[#E5EAF0] bg-[#1A202C] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-bold flex items-center justify-center">
                        Q{idx + 1}
                      </span>
                      <p className="text-xs font-bold text-[#E7EDF7]">{q}</p>
                    </div>
                    <input
                      type="text"
                      placeholder="Alex's answer / clarification..."
                      value={answers[q] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E5EAF0] text-xs bg-[#141A24] focus:bg-[#1A202C] focus:outline-none focus:border-teal-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141A24] border-t border-[#E5EAF0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveEdits}
              disabled={isSaving || prd.status === 'confirmed'}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#E7EDF7] border border-[#E5EAF0] bg-[#1A202C] hover:bg-[#141A24] transition"
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Draft Edits'}
            </button>
            <span className="text-[11px] text-[#A3B0C4]">
              Alex (Founder) sign-off required
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A3B0C4] hover:bg-[#303D50] transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleConfirmPRD}
              disabled={isConfirming || prd.status === 'confirmed'}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isConfirming ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Handoff to PIXEL...</span>
                </>
              ) : prd.status === 'confirmed' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PRD Confirmed</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confirm Product Requirements (Handoff to PIXEL)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
