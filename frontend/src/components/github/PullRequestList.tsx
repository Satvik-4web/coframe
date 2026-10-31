import React, { useState } from 'react';
import { GitPullRequest, ShieldCheck, Filter } from 'lucide-react';
import { GitHubPullRequest } from '../../types';
import { PullRequestCard } from './PullRequestCard';

interface PullRequestListProps {
  pullRequests: GitHubPullRequest[];
  onRefreshPR?: (prNumber: number) => Promise<void>;
  isLoading?: boolean;
}

export const PullRequestList: React.FC<PullRequestListProps> = ({
  pullRequests,
  onRefreshPR,
  isLoading = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'merged'>('all');

  const filtered = pullRequests.filter((pr) => {
    if (filter === 'all') return true;
    if (filter === 'open') return pr.state === 'open';
    if (filter === 'merged') return pr.state === 'merged';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#F4F7FB]">Pull Requests</h3>
          <p className="text-xs text-[#8E9EB5]">
            Contributions awaiting human review, inspection, and merge directly on GitHub.
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-[#121826] p-1 rounded-lg border border-[#263244] w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-teal-500 text-black font-bold'
                : 'text-[#8E9EB5] hover:text-[#F4F7FB]'
            }`}
          >
            All ({pullRequests.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              filter === 'open'
                ? 'bg-teal-500 text-black font-bold'
                : 'text-[#8E9EB5] hover:text-[#F4F7FB]'
            }`}
          >
            Open ({pullRequests.filter((p) => p.state === 'open').length})
          </button>
          <button
            onClick={() => setFilter('merged')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              filter === 'merged'
                ? 'bg-purple-500 text-white font-bold'
                : 'text-[#8E9EB5] hover:text-[#F4F7FB]'
            }`}
          >
            Merged ({pullRequests.filter((p) => p.state === 'merged').length})
          </button>
        </div>
      </div>

      {/* Human Merge Safety Notice */}
      <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20 text-xs text-[#8E9EB5] flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <span>
          <strong className="text-teal-300">Human Governance Guarantee:</strong> COFRAME agents cannot automatically merge pull requests or push directly to default branches. Humans inspect diffs and execute merges on GitHub.
        </span>
      </div>

      {/* PR Cards */}
      {isLoading ? (
        <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
          Loading pull requests from GitHub...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
          No pull requests matching filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pr) => (
            <PullRequestCard
              key={pr.number}
              pr={pr}
              onRefreshPR={onRefreshPR}
            />
          ))}
        </div>
      )}
    </div>
  );
};
