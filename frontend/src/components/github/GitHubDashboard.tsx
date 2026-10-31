import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  History,
  Layers,
  Settings,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';
import {
  GitHubConnectionStatus,
  GitHubRepository,
  GitHubBranch,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContribution,
  PublishProposalResult,
  Proposal,
} from '../../types';
import {
  fetchGitHubStatus,
  connectGitHubRepository,
  disconnectGitHubRepository,
  fetchGitHubRepository,
  fetchGitHubBranches,
  fetchGitHubCommits,
  fetchGitHubPullRequests,
  refreshPullRequest,
  publishApprovedProposal,
  fetchGitHubContributions,
  retryGitHubContribution,
} from '../../lib/api';

import { GitHubConnectionCard } from './GitHubConnectionCard';
import { RepositoryOverview } from './RepositoryOverview';
import { BranchList } from './BranchList';
import { CommitTimeline } from './CommitTimeline';
import { PullRequestList } from './PullRequestList';
import { ContributionHistory } from './ContributionHistory';
import { ContributionSuccessModal } from './ContributionSuccessModal';
import { RepositorySettings } from './RepositorySettings';

interface GitHubDashboardProps {
  proposals: Proposal[];
  onRefreshProject?: () => void;
}

type SubTab = 'overview' | 'branches' | 'commits' | 'pull-requests' | 'contributions' | 'settings';

export const GitHubDashboard: React.FC<GitHubDashboardProps> = ({
  proposals,
  onRefreshProject,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [contributions, setContributions] = useState<GitHubContribution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPublishedResult, setLastPublishedResult] = useState<PublishProposalResult | null>(null);

  const loadGitHubData = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusData = await fetchGitHubStatus();
      setStatus(statusData);

      if (statusData.connection_status === 'connected') {
        const [repoData, branchData, commitData, prData, contribData] = await Promise.all([
          fetchGitHubRepository().catch(() => null),
          fetchGitHubBranches().catch(() => []),
          fetchGitHubCommits().catch(() => []),
          fetchGitHubPullRequests('all').catch(() => []),
          fetchGitHubContributions().catch(() => []),
        ]);
        setRepository(repoData);
        setBranches(branchData);
        setCommits(commitData);
        setPullRequests(prData);
        setContributions(contribData);
      } else {
        setRepository(null);
        setBranches([]);
        setCommits([]);
        setPullRequests([]);
        const contribData = await fetchGitHubContributions().catch(() => []);
        setContributions(contribData);
      }
    } catch (err) {
      console.error('Failed to load GitHub data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGitHubData();
  }, [loadGitHubData]);

  const handleConnect = async (owner: string, repo: string, branch: string) => {
    await connectGitHubRepository(owner, repo, branch);
    await loadGitHubData();
  };

  const handleDisconnect = async () => {
    await disconnectGitHubRepository();
    await loadGitHubData();
  };

  const handleRefreshPR = async (prNumber: number) => {
    await refreshPullRequest(prNumber);
    await loadGitHubData();
  };

  const handlePublishProposal = async (proposalId: string) => {
    const res = await publishApprovedProposal(proposalId);
    setLastPublishedResult(res);
    await loadGitHubData();
    if (onRefreshProject) onRefreshProject();
  };

  const handleRetryContribution = async (contribId: string) => {
    const res = await retryGitHubContribution(contribId);
    setLastPublishedResult(res);
    await loadGitHubData();
  };

  const approvedProposals = proposals.filter((p) => p.status === 'approved');

  const tabs: { id: SubTab; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'branches', label: 'Branches', icon: GitBranch, count: branches.length },
    { id: 'commits', label: 'Commits', icon: GitCommit, count: commits.length },
    { id: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest, count: pullRequests.filter((p) => p.state === 'open').length },
    { id: 'contributions', label: 'Contribution Chain', icon: History, count: contributions.length },
    { id: 'settings', label: 'Governance', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Top GitHub Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <GitHubIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#F4F7FB]">
              COFRAME × GitHub
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20">
              Live Integration
            </span>
          </div>
          <p className="text-xs text-[#8E9EB5]">
            Bridging collaborative Human + AI product development into verified GitHub branches, commits, and pull requests.
          </p>
        </div>

        <button
          onClick={loadGitHubData}
          disabled={isLoading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-xs font-semibold text-[#8E9EB5] hover:text-[#F4F7FB] transition w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* 1. Connection Card */}
      <GitHubConnectionCard
        status={status}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRefresh={loadGitHubData}
        isLoading={isLoading}
      />

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex border-b border-[#263244] gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-teal-400 text-teal-300 bg-[#162030]/50'
                  : 'border-transparent text-[#8E9EB5] hover:text-[#F4F7FB] hover:border-[#384860]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-[#182234] text-[#8E9EB5]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content Panes */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <RepositoryOverview
            repository={repository}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'branches' && (
          <BranchList
            branches={branches}
            repository={repository}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'commits' && (
          <CommitTimeline
            commits={commits}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'pull-requests' && (
          <PullRequestList
            pullRequests={pullRequests}
            onRefreshPR={handleRefreshPR}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'contributions' && (
          <ContributionHistory
            contributions={contributions}
            approvedProposals={approvedProposals}
            onPublishProposal={handlePublishProposal}
            onRetryContribution={handleRetryContribution}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'settings' && (
          <RepositorySettings status={status} />
        )}
      </div>

      {/* 4. Publishing Success Modal */}
      <ContributionSuccessModal
        result={lastPublishedResult}
        onClose={() => setLastPublishedResult(null)}
      />
    </div>
  );
};
