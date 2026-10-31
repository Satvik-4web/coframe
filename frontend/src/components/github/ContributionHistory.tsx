import React, { useState } from 'react';
import {
  GitPullRequest,
  GitBranch,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Bot,
  User,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { GitHubContribution, Proposal } from '../../types';

interface ContributionHistoryProps {
  contributions: GitHubContribution[];
  approvedProposals: Proposal[];
  onPublishProposal: (proposalId: string) => Promise<void>;
  onRetryContribution: (contributionId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ContributionHistory: React.FC<ContributionHistoryProps> = ({
  contributions,
  approvedProposals,
  onPublishProposal,
  onRetryContribution,
  isLoading = false,
}) => {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const publishedProposalIds = new Set(contributions.map((c) => c.proposal_id));
  const pendingExportProposals = approvedProposals.filter(
    (p) => !publishedProposalIds.has(p.proposal_id)
  );

  const handlePublish = async (propId: string) => {
    setPublishingId(propId);
    try {
      await onPublishProposal(propId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleRetry = async (contribId: string) => {
    setRetryingId(contribId);
    try {
      await onRetryContribution(contribId);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[#F4F7FB]">Contribution Provenance Chain</h3>
        <p className="text-xs text-[#8E9EB5]">
          End-to-end traceability linking AI reasoning, human decisions, and real GitHub artifacts.
        </p>
      </div>

      {/* Pending Approved Proposals Section */}
      {pendingExportProposals.length > 0 && (
        <div className="p-4 rounded-xl bg-[#121826] border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-semibold text-[#F4F7FB]">
                Approved Proposals Awaiting GitHub Publishing ({pendingExportProposals.length})
              </h4>
            </div>
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
              Ready for Export
            </span>
          </div>

          <div className="space-y-2">
            {pendingExportProposals.map((prop) => (
              <div
                key={prop.proposal_id}
                className="p-3 rounded-lg bg-[#0C101A] border border-[#263244] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-teal-400 font-bold">#{prop.proposal_id}</span>
                    <span className="font-semibold text-[#F4F7FB]">{prop.summary}</span>
                    <span className="text-[10px] text-purple-400 uppercase bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold">
                      {prop.agent_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E9EB5]">
                    Sections: {prop.target_sections.join(', ')} • Base Artifact v{prop.base_artifact_version}
                  </p>
                </div>

                <button
                  onClick={() => handlePublish(prop.proposal_id)}
                  disabled={publishingId === prop.proposal_id}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition flex items-center space-x-1.5 shadow w-fit"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>
                    {publishingId === prop.proposal_id ? 'Exporting...' : 'Publish to GitHub'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contribution Chain List */}
      {isLoading ? (
        <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
          Loading contribution history...
        </div>
      ) : contributions.length === 0 ? (
        <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
          No GitHub contributions recorded yet. Approve a proposal and publish it to create a branch and pull request!
        </div>
      ) : (
        <div className="space-y-4">
          {contributions.map((c) => {
            const isFailed = c.sync_status === 'sync_failed';
            const isMerged = c.pr_status === 'merged';

            return (
              <div
                key={c.id}
                className="p-5 rounded-xl bg-[#121826] border border-[#263244] hover:border-[#384860] transition shadow space-y-4"
              >
                {/* Visual Traceability Breadcrumbs */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Step 1: Agent */}
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-[#F4F7FB]">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-semibold">{c.agent_id ? c.agent_id.toUpperCase() : 'AGENT'}</span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />

                  {/* Step 2: Proposal */}
                  <div className="px-2.5 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-[#F4F7FB] font-mono">
                    Proposal <span className="text-teal-400 font-bold">#{c.proposal_id}</span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />

                  {/* Step 3: Human Approver */}
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-[#F4F7FB]">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>Approved by <strong className="text-blue-300">{c.decided_by || 'Alex'}</strong></span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />

                  {/* Step 4: Branch */}
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-teal-300 font-mono">
                    <GitBranch className="w-3.5 h-3.5 text-teal-400" />
                    <span>{c.branch_name}</span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />

                  {/* Step 5: Commit */}
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-[#8E9EB5] font-mono">
                    <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                    <span>{c.commit_sha ? c.commit_sha.slice(0, 7) : 'pending'}</span>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />

                  {/* Step 6: PR */}
                  <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border font-mono font-bold ${
                    isMerged
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : isFailed
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                  }`}>
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span>PR #{c.pr_number || 'pending'}</span>
                  </div>
                </div>

                {/* Details Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#212C3D]">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-[#F4F7FB]">
                      {c.proposal_summary || c.pr_title || 'Exported Contribution'}
                    </p>
                    <p className="text-[11px] text-[#8E9EB5]">
                      Exported to <code className="text-teal-300 font-mono">{c.repository_full_name}</code> on {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {isFailed ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-red-400 flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{c.error_message || 'Sync failed'}</span>
                        </span>
                        <button
                          onClick={() => handleRetry(c.id)}
                          disabled={retryingId === c.id}
                          className="px-2.5 py-1 text-xs rounded bg-red-500 hover:bg-red-400 text-white font-semibold transition flex items-center space-x-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${retryingId === c.id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      c.pr_url && (
                        <a
                          href={c.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-semibold rounded bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-teal-300 hover:text-teal-200 transition flex items-center space-x-1"
                        >
                          <span>Open Pull Request #{c.pr_number}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
