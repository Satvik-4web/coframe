import React from 'react';
import {
  CheckCircle2,
  GitPullRequest,
  GitBranch,
  GitCommit,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { PublishProposalResult } from '../../types';

interface ContributionSuccessModalProps {
  result: PublishProposalResult | null;
  onClose: () => void;
}

export const ContributionSuccessModal: React.FC<ContributionSuccessModalProps> = ({
  result,
  onClose,
}) => {
  if (!result || result.status !== 'success') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121826] border border-teal-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#8E9EB5] hover:text-[#F4F7FB] hover:bg-[#182234] transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <CheckCircle2 className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-[#F4F7FB]">GitHub Contribution Created</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Live
              </span>
            </div>
            <p className="text-xs text-[#8E9EB5] mt-0.5">
              The approved COFRAME artifact has been exported and published to GitHub.
            </p>
          </div>
        </div>

        {/* Provenance Card */}
        <div className="p-4 rounded-xl bg-[#0C101A] border border-[#212C3D] space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#212C3D]">
            <span className="text-[#8E9EB5]">Target Repository</span>
            <span className="text-[#F4F7FB] font-mono font-semibold">LedgerFlow Product</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#8E9EB5]">
              <GitBranch className="w-3.5 h-3.5 text-teal-400" />
              <span>Isolated Branch</span>
            </div>
            <span className="text-teal-300 font-mono font-semibold">{result.branch_name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#8E9EB5]">
              <GitCommit className="w-3.5 h-3.5 text-amber-400" />
              <span>Commit SHA</span>
            </div>
            <span className="text-amber-300 font-mono font-semibold">
              {result.commit_sha ? result.commit_sha.slice(0, 7) : 'Generated'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#212C3D]">
            <div className="flex items-center space-x-2 text-[#8E9EB5]">
              <GitPullRequest className="w-3.5 h-3.5 text-teal-400" />
              <span>Pull Request</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/30">
                STATUS: OPEN
              </span>
              <span className="text-teal-400 font-mono font-bold">#{result.pr_number}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8E9EB5] hover:text-[#F4F7FB] transition"
          >
            Stay in COFRAME
          </button>

          {result.pr_url && (
            <a
              href={result.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition flex items-center space-x-1.5 shadow"
            >
              <span>Open Pull Request</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
