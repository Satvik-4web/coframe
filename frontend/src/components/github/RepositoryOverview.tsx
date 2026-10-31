import React from 'react';
import {
  GitFork,
  Star,
  AlertCircle,
  GitBranch,
  Lock,
  Globe,
  ExternalLink,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { GitHubRepository } from '../../types';

interface RepositoryOverviewProps {
  repository: GitHubRepository | null;
  onNavigateTab: (tab: 'branches' | 'commits' | 'pull-requests' | 'contributions') => void;
}

export const RepositoryOverview: React.FC<RepositoryOverviewProps> = ({
  repository,
  onNavigateTab,
}) => {
  if (!repository) {
    return (
      <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
        Connect a GitHub repository to view live repository metrics and activity.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-[#121826] border border-[#263244] shadow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-[#F4F7FB]">{repository.full_name}</span>
              {repository.is_private ? (
                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Private</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center space-x-1">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Public</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E9EB5]">
              {repository.description || 'Target engineering repository for LedgerFlow product contributions.'}
            </p>
          </div>

          <a
            href={repository.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-xs font-semibold text-teal-300 transition w-fit"
          >
            <span>Open on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#212C3D]">
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <div className="flex items-center justify-between text-[#8E9EB5]">
              <span className="text-[11px] uppercase font-semibold">Stars</span>
              <Star className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-lg font-bold text-[#F4F7FB] mt-1">{repository.stars_count}</p>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <div className="flex items-center justify-between text-[#8E9EB5]">
              <span className="text-[11px] uppercase font-semibold">Forks</span>
              <GitFork className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-lg font-bold text-[#F4F7FB] mt-1">{repository.forks_count}</p>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <div className="flex items-center justify-between text-[#8E9EB5]">
              <span className="text-[11px] uppercase font-semibold">Open Issues</span>
              <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-lg font-bold text-[#F4F7FB] mt-1">{repository.open_issues_count}</p>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <div className="flex items-center justify-between text-[#8E9EB5]">
              <span className="text-[11px] uppercase font-semibold">Base Branch</span>
              <GitBranch className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <p className="text-base font-mono font-bold text-teal-300 mt-1 truncate">
              {repository.default_branch}
            </p>
          </div>
        </div>
      </div>

      {/* Contribution Pipeline Guidance */}
      <div className="p-5 rounded-xl bg-[#121826] border border-[#263244] shadow space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#8E9EB5] flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-teal-400" />
          <span>COFRAME to GitHub Provenance Pipeline</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D] space-y-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase">1. Proposal Review</span>
            <p className="text-[#8E9EB5]">NOVA & PIXEL submit structured changes validated by COFRAME.</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D] space-y-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase">2. Human Approval</span>
            <p className="text-[#8E9EB5]">Alex or Maya reviews and approves the proposal atomically.</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D] space-y-1">
            <span className="text-[10px] font-bold text-teal-400 uppercase">3. Isolated Branch & Commit</span>
            <p className="text-[#8E9EB5]">COFRAME exports validated artifact files to a dedicated Git branch.</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D] space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase">4. Pull Request</span>
            <p className="text-[#8E9EB5]">PR opened with provenance for final human inspection and merge.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
