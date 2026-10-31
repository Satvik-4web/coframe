import {
  FullProjectState,
  Proposal,
  ObserverSummary,
  GitHubConnectionStatus,
  GitHubRepository,
  GitHubBranch,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContribution,
  PublishProposalResult,
} from '../types';

const API_BASE = '/api';

export async function fetchProjectState(projectId: string = 'demo-ledgerflow'): Promise<FullProjectState> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/state`);
  if (!res.ok) throw new Error('Failed to fetch project state');
  return res.json();
}

export async function resetDemo(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo');
  return res.json();
}

export async function joinProject(projectId: string, identityKey: 'alex' | 'maya'): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_key: identityKey }),
  });
  if (!res.ok) throw new Error('Failed to join project');
  return res.json();
}

export async function startCollaboration(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/start`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start collaboration');
  return res.json();
}

export async function updateRequirement(
  projectId: string,
  requirementKey: string,
  value: any,
  editorId: string = 'alex'
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/requirements/${requirementKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, editor_id: editorId }),
  });
  if (!res.ok) throw new Error('Failed to update requirement');
  return res.json();
}

export async function editArtifactSection(
  projectId: string,
  sectionKey: string,
  expectedVersion: number,
  data: Record<string, any>,
  editorId: string = 'maya'
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/artifact/sections/${sectionKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_version: expectedVersion, data, editor_id: editorId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to edit section');
  }
  return res.json();
}

export async function approveProposal(projectId: string, proposalId: string, decidedBy: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decided_by: decidedBy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to approve proposal');
  }
  return res.json();
}

export async function rejectProposal(
  projectId: string,
  proposalId: string,
  decidedBy: string,
  reason?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decided_by: decidedBy, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reject proposal');
  }
  return res.json();
}

export async function redirectProposal(
  projectId: string,
  proposalId: string,
  decidedBy: string,
  instruction: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/redirect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decided_by: decidedBy, instruction }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to redirect proposal');
  }
  return res.json();
}

export async function reconcileProposal(projectId: string, proposalId: string, requestedBy: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requested_by: requestedBy }),
  });
  if (!res.ok) throw new Error('Failed to reconcile proposal');
  return res.json();
}

export async function restartAgent(projectId: string, agentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/restart`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restart agent');
  return res.json();
}

export async function getAgentContextPack(projectId: string, agentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/context-pack`);
  if (!res.ok) throw new Error('Failed to get context pack');
  return res.json();
}

export async function triggerPolicyProposal(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/propose-policy`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger policy proposal');
  return res.json();
}

// ---------------------------------------------------------------------------
// GitHub Integration API Endpoints
// ---------------------------------------------------------------------------

export async function fetchGitHubStatus(projectId: string = 'demo-ledgerflow'): Promise<GitHubConnectionStatus> {
  const res = await fetch(`${API_BASE}/github/status?project_id=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch GitHub status');
  return res.json();
}

export async function connectGitHubRepository(
  owner: string,
  repositoryName: string,
  defaultBranch: string = 'main',
  projectId: string = 'demo-ledgerflow'
): Promise<GitHubConnectionStatus> {
  const res = await fetch(`${API_BASE}/github/connect?project_id=${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner,
      repository_name: repositoryName,
      default_branch: defaultBranch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to connect repository');
  }
  return res.json();
}

export async function disconnectGitHubRepository(projectId: string = 'demo-ledgerflow'): Promise<any> {
  const res = await fetch(`${API_BASE}/github/disconnect?project_id=${projectId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to disconnect repository');
  return res.json();
}

export async function fetchGitHubRepository(projectId: string = 'demo-ledgerflow'): Promise<GitHubRepository> {
  const res = await fetch(`${API_BASE}/github/repository?project_id=${projectId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch repository details');
  }
  return res.json();
}

export async function fetchGitHubBranches(projectId: string = 'demo-ledgerflow'): Promise<GitHubBranch[]> {
  const res = await fetch(`${API_BASE}/github/branches?project_id=${projectId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch branches');
  }
  return res.json();
}

export async function fetchGitHubCommits(
  branch?: string,
  projectId: string = 'demo-ledgerflow'
): Promise<GitHubCommit[]> {
  const url = branch
    ? `${API_BASE}/github/commits?project_id=${projectId}&branch=${encodeURIComponent(branch)}`
    : `${API_BASE}/github/commits?project_id=${projectId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch commits');
  }
  return res.json();
}

export async function fetchGitHubPullRequests(
  state: string = 'all',
  projectId: string = 'demo-ledgerflow'
): Promise<GitHubPullRequest[]> {
  const res = await fetch(`${API_BASE}/github/pull-requests?project_id=${projectId}&state=${state}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch pull requests');
  }
  return res.json();
}

export async function refreshPullRequest(
  prNumber: number,
  projectId: string = 'demo-ledgerflow'
): Promise<any> {
  const res = await fetch(`${API_BASE}/github/pull-requests/${prNumber}/refresh?project_id=${projectId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to refresh pull request status');
  }
  return res.json();
}

export async function publishApprovedProposal(
  proposalId: string,
  decidedBy: string = 'alex',
  projectId: string = 'demo-ledgerflow'
): Promise<PublishProposalResult> {
  const res = await fetch(
    `${API_BASE}/github/proposals/${proposalId}/publish?project_id=${projectId}&decided_by=${decidedBy}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to publish proposal to GitHub');
  }
  return res.json();
}

export async function fetchGitHubContributions(projectId: string = 'demo-ledgerflow'): Promise<GitHubContribution[]> {
  const res = await fetch(`${API_BASE}/github/contributions?project_id=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch contributions');
  return res.json();
}

export async function retryGitHubContribution(
  contributionId: string,
  projectId: string = 'demo-ledgerflow'
): Promise<PublishProposalResult> {
  const res = await fetch(`${API_BASE}/github/contributions/${contributionId}/retry?project_id=${projectId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to retry contribution publishing');
  }
  return res.json();
}

