import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  GitMerge,
  UserCheck,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import { Proposal, ArtifactSection, HumanIdentity, ProposalConflictDetail } from '../../types';
import { fetchProposalConflictDetail, resolveProposalConflict } from '../../lib/api';

interface ConflictCompareModalProps {
  proposal: Proposal;
  currentSection?: ArtifactSection;
  identity?: HumanIdentity;
  onClose: () => void;
  onKeepHuman: () => void;
  onReconcilePixel?: () => void;
  onRedirectAgent: () => void;
  onSuccess?: () => void;
}

export const ConflictCompareModal: React.FC<ConflictCompareModalProps> = ({
  proposal,
  currentSection,
  identity = 'alex',
  onClose,
  onKeepHuman,
  onReconcilePixel,
  onRedirectAgent,
  onSuccess,
}) => {
  const [conflictDetail, setConflictDetail] = useState<ProposalConflictDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadConflict() {
      try {
        setIsLoading(true);
        const data = await fetchProposalConflictDetail('demo-ledgerflow', proposal.proposal_id);
        if (isMounted) {
          setConflictDetail(data);
        }
      } catch (err: any) {
        // Fallback to local props if endpoint unavailable
        console.warn('Could not fetch server conflict details, using client fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadConflict();
    return () => {
      isMounted = false;
    };
  }, [proposal.proposal_id]);

  const secKey = conflictDetail?.section_key || proposal.target_sections?.[0] || 'hero';
  const humanAuthor = conflictDetail?.intervening_user || currentSection?.updated_by || 'maya';
  const humanAuthorName = humanAuthor.charAt(0).toUpperCase() + humanAuthor.slice(1);
  const humanVersion = conflictDetail?.canonical_version ?? currentSection?.version ?? 2;
  const pixelBaseVersion = conflictDetail?.base_version ?? proposal.base_section_versions?.[secKey] ?? 1;

  const currentData = conflictDetail?.canonical_content || currentSection?.data || {};
  const proposedOps = proposal.changes?.operations || [];
  const proposedFields = conflictDetail?.proposed_content || proposedOps[0]?.fields || {};

  const handleActionReconcile = async () => {
    if (onReconcilePixel) {
      onReconcilePixel();
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await resolveProposalConflict(
        'demo-ledgerflow',
        proposal.proposal_id,
        'reconcile_pixel',
        identity || 'alex'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reconcile with PIXEL');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionKeepHuman = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await resolveProposalConflict(
        'demo-ledgerflow',
        proposal.proposal_id,
        'keep_human',
        identity || 'alex',
        `Preserved ${humanAuthorName}'s changes in canonical canvas.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to preserve human version');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1528] border border-[#1A223D] rounded-3xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col animate-in fade-in-50 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A223D]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Conflict Resolution Center</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase tracking-wider">
                  Approval Blocked
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-[#CBD5E1]">
                  section: '{secKey}'
                </span>
              </div>
              <p className="text-xs text-[#8695B7] mt-0.5">
                Human canonical change (v{humanVersion}) conflicts with PIXEL's older baseline (v{pixelBaseVersion}).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8695B7] hover:text-white p-2 rounded-xl hover:bg-[#1A223D] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-700 font-bold hover:underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Conflict Explanation Banner */}
        <div className="my-4 p-4 rounded-2xl bg-red-50/70 border border-red-200 text-xs text-red-900 flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-red-900">Why was proposal approval strictly blocked?</p>
            <p className="leading-relaxed text-red-800">
              {conflictDetail?.conflict_reason ||
                proposal.conflict_reason ||
                `${humanAuthorName} updated the '${secKey}' section in the canonical prototype after PIXEL formulated this proposal based on version ${pixelBaseVersion}. COFRAME's atomic safety engine blocks automatic overwrite to preserve human decisions.`}
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto my-2 pr-1">
          {/* Left Column: Human Version */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50/20 p-5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-violet-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                    {humanAuthorName.charAt(0)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {humanAuthorName}'s Live Changes
                    </span>
                    <span className="text-[10px] text-violet-700 font-medium">Authoritative Canonical Prototype</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  v{humanVersion} · Active
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {Object.keys(currentData).length > 0 ? (
                  Object.entries(currentData).map(([key, val]) => (
                    <div key={key} className="p-2.5 rounded-xl bg-[#0F1528] border border-violet-100">
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5 font-mono">
                        {key}
                      </span>
                      <p className="font-medium text-white text-xs">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Headline</span>
                      <p className="font-semibold text-white">
                        {currentData.headline || 'Take control of company spending'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Subheadline</span>
                      <p className="text-[#8695B7] leading-relaxed">
                        {currentData.subheadline || 'Real-time expense management for high-velocity teams'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Primary CTA</span>
                      <p className="text-teal-700 font-semibold">
                        {currentData.cta_text || 'Start Free Trial'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-violet-100 flex items-center text-xs text-violet-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-violet-600" />
              <span>Preserves human creative discretion</span>
            </div>
          </div>

          {/* Right Column: Agent Proposal */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/20 p-5 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-teal-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                    P
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      PIXEL's Proposed Version
                    </span>
                    <span className="text-[10px] text-teal-700 font-medium">Engineering Contribution</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Based on v{pixelBaseVersion} · Outdated
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {Object.keys(proposedFields).length > 0 ? (
                  Object.entries(proposedFields).map(([key, val]) => (
                    <div key={key} className="p-2.5 rounded-xl bg-[#0F1528] border border-teal-100">
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5 font-mono">
                        {key}
                      </span>
                      <p className="font-semibold text-teal-900 text-xs">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Headline</span>
                      <p className="font-semibold text-teal-800">
                        {proposedFields.headline || 'Modern Expense Control, Zero Friction'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Subheadline</span>
                      <p className="text-[#8695B7] leading-relaxed">
                        {proposedFields.subheadline || 'Empower your team to submit receipts in seconds...'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8695B7] block mb-0.5">Primary CTA</span>
                      <p className="text-teal-700 font-semibold">
                        {proposedFields.cta_text || 'Start Free 14-Day Trial'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-teal-100 flex items-center text-xs text-teal-700 font-semibold">
              <span className="mr-1.5">🤖</span>
              <span>Based on original confirmed requirements</span>
            </div>
          </div>
        </div>

        {/* 3 Explicit Resolution Action Paths */}
        <div className="pt-4 border-t border-[#1A223D] mt-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white">Choose Resolution Path:</h4>
              <p className="text-[11px] text-[#8695B7]">
                Select how you wish to resolve this conflict before continuing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Option 1: Keep Human Version */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleActionKeepHuman}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title={`Keep ${humanAuthorName}'s version and dismiss PIXEL's proposal`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#CBD5E1]" />
                <span>Keep {humanAuthorName}'s Version</span>
              </button>

              {/* Option 3: Redirect with custom note */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  onClose();
                  onRedirectAgent();
                }}
                className="px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Direct PIXEL with custom instruction"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-violet-600" />
                <span>Manual / Custom Direct</span>
              </button>

              {/* Option 2: Reconcile with PIXEL */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleActionReconcile}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                title={`Ask PIXEL to synthesize a new revision adapted to ${humanAuthorName}'s v${humanVersion}`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciling...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                    <span>Reconcile with PIXEL (Auto-Adapt)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
