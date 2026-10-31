import React, { useState } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  GitMerge,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { GitHubPullRequest } from '../../types';

interface PullRequestCardProps {
  pr: GitHubPullRequest;
  onRefreshPR?: (prNumber: number) => Promise<void>;
}

export const PullRequestCard: React.FC<PullRequestCardProps> = ({
  pr,
  onRefreshPR,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshPR) return;
    setIsRefreshing(true);
    try {
      await onRefreshPR(pr.number);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isMerged = pr.state === 'merged';
  const isOpen = pr.state === 'open';
  const isClosed = pr.state === 'closed';

  return (
    <div className="p-4 rounded-xl bg-[#121826] border border-[#263244] hover:border-[#384860] transition shadow-sm space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isMerged
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : isOpen
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
            }`}
          >
            {isMerged ? (
              <GitMerge className="w-4 h-4" />
            ) : (
              <GitPullRequest className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-teal-400">#{pr.number}</span>
              <h4 className="text-xs font-semibold text-[#F4F7FB]">{pr.title}</h4>
            </div>
            <p className="text-[11px] text-[#8E9EB5] mt-0.5">
              by <span className="text-[#F4F7FB] font-medium">{pr.author}</span> • created {new Date(pr.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* State Badges & Actions */}
        <div className="flex items-center space-x-2">
          {isOpen && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span>Open</span>
            </span>
          )}
          {isMerged && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center space-x-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Merged</span>
            </span>
          )}
          {isClosed && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center space-x-1">
              <XCircle className="w-2.5 h-2.5" />
              <span>Closed</span>
            </span>
          )}

          {onRefreshPR && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-[#8E9EB5] hover:text-[#F4F7FB] transition"
              title="Refresh PR Status from GitHub"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          )}

          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs font-semibold rounded bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-teal-300 hover:text-teal-200 transition flex items-center space-x-1"
          >
            <span>Review on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Branches Branch Tag */}
      <div className="flex items-center space-x-2 text-[11px] font-mono text-[#8E9EB5] bg-[#0C101A] p-2 rounded-lg border border-[#212C3D]">
        <span className="text-[#64748B]">Branch:</span>
        <span className="text-teal-300 bg-[#162030] px-1.5 py-0.5 rounded">{pr.head_branch}</span>
        <ArrowRight className="w-3 h-3 text-[#64748B]" />
        <span className="text-[#F4F7FB] bg-[#162030] px-1.5 py-0.5 rounded">{pr.base_branch}</span>
        {pr.related_proposal_id && (
          <span className="ml-auto text-[10px] text-purple-300 font-semibold flex items-center space-x-1">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Proposal #{pr.related_proposal_id}</span>
          </span>
        )}
      </div>

      {/* Description Snippet */}
      {pr.body && (
        <div className="text-[11px] text-[#8E9EB5] line-clamp-2 bg-[#0C101A]/50 p-2 rounded border border-[#212C3D]/50 font-mono">
          {pr.body}
        </div>
      )}
    </div>
  );
};
