import React from 'react';
import { GitBranch, Shield, Sparkles, ExternalLink, Check } from 'lucide-react';
import { GitHubBranch, GitHubRepository } from '../../types';

interface BranchListProps {
  branches: GitHubBranch[];
  repository: GitHubRepository | null;
  isLoading?: boolean;
}

export const BranchList: React.FC<BranchListProps> = ({
  branches,
  repository,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
        Loading repository branches...
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
        No branches found for this repository.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F4F7FB]">Repository Branches</h3>
          <p className="text-xs text-[#8E9EB5]">
            Isolated contribution branches created by COFRAME agents alongside repository branches.
          </p>
        </div>
        <span className="text-xs text-[#8E9EB5] font-mono bg-[#182234] px-2.5 py-1 rounded-lg border border-[#2B3B52]">
          {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
        </span>
      </div>

      <div className="bg-[#121826] border border-[#263244] rounded-xl overflow-hidden divide-y divide-[#212C3D]">
        {branches.map((b) => {
          const repoUrl = repository?.html_url || 'https://github.com';
          const branchUrl = `${repoUrl}/tree/${b.name}`;

          return (
            <div
              key={b.name}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#182234]/50 transition"
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    b.is_coframe_branch
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                      : b.is_default
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-[#182234] text-[#8E9EB5] border border-[#2B3B52]'
                  }`}
                >
                  <GitBranch className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono font-bold text-[#F4F7FB] hover:text-teal-300 hover:underline flex items-center space-x-1"
                    >
                      <span>{b.name}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    {b.is_default && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center space-x-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>Default</span>
                      </span>
                    )}

                    {b.is_coframe_branch && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>COFRAME Isolated</span>
                      </span>
                    )}
                  </div>

                  {b.is_coframe_branch && b.related_proposal_id && (
                    <p className="text-[11px] text-[#8E9EB5] mt-0.5">
                      Provenance: Linked to COFRAME Proposal <code className="text-teal-300 font-mono">#{b.related_proposal_id}</code>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono text-[#8E9EB5]">
                <span className="text-[10px] text-[#64748B]">HEAD:</span>
                <span className="px-2 py-1 rounded bg-[#0C101A] border border-[#212C3D] text-teal-400">
                  {b.commit_sha ? b.commit_sha.slice(0, 7) : 'main'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
