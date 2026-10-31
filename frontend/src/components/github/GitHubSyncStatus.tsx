import React from 'react';
import { GitPullRequest, GitBranch, GitCommit, CheckCircle2, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { GitHubContribution } from '../../types';

interface GitHubSyncStatusProps {
  contribution?: GitHubContribution | null;
  isApproved: boolean;
  onPublish?: () => void;
  isPublishing?: boolean;
}

export const GitHubSyncStatus: React.FC<GitHubSyncStatusProps> = ({
  contribution,
  isApproved,
  onPublish,
  isPublishing = false,
}) => {
  if (!isApproved) {
    return (
      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1A2234] text-[#8E9EB5] border border-[#2D3A50]">
        <Clock className="w-3 h-3 text-[#64748B]" />
        <span>Pending Approval</span>
      </span>
    );
  }

  if (isPublishing || contribution?.sync_status === 'publishing') {
    return (
      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
        <GitBranch className="w-3 h-3 animate-spin" />
        <span>Publishing to GitHub...</span>
      </span>
    );
  }

  if (!contribution) {
    return (
      <div className="inline-flex items-center space-x-2">
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
          <CheckCircle2 className="w-3 h-3 text-teal-400" />
          <span>Approved — Ready to Publish</span>
        </span>
        {onPublish && (
          <button
            onClick={onPublish}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-teal-500 hover:bg-teal-400 text-black transition flex items-center space-x-1 shadow-sm"
          >
            <GitPullRequest className="w-3 h-3" />
            <span>Publish to GitHub</span>
          </button>
        )}
      </div>
    );
  }

  if (contribution.sync_status === 'sync_failed') {
    return (
      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span>Sync Failed</span>
      </span>
    );
  }

  if (contribution.pr_status === 'merged') {
    return (
      <a
        href={contribution.pr_url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition"
      >
        <GitPullRequest className="w-3 h-3 text-purple-400" />
        <span>Merged (PR #{contribution.pr_number})</span>
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    );
  }

  return (
    <a
      href={contribution.pr_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition"
    >
      <GitPullRequest className="w-3 h-3 text-teal-400" />
      <span>PR #{contribution.pr_number} Open</span>
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
};
