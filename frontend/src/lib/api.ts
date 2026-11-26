import {
  FullProjectState,
  Proposal,
  ObserverSummary,
  Delegation,
  ApprovalRequest,
  SharedResource,
  MCPToolManifest,
  GitHubConnectionStatus,
  GitHubRepository,
  GitHubBranch,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContribution,
  PublishProposalResult,
  PruneStatus,
  PruneDemoTrace,
  PruneMetadata,
  Conversation,
  ChatMessage,
  ProposalStats,
  ProposalConflictDetail,
  WorkflowStageInfo,
} from '../types';

const rawApiUrl = (import.meta as any).env?.VITE_API_URL;
const ENV_API_URL = rawApiUrl ? String(rawApiUrl).replace(/\/+$/, '') : '';
const API_BASE = ENV_API_URL ? `${ENV_API_URL}/api` : '/api';

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

export async function createHumanProposal(
  projectId: string,
  payload: {
    author: string;
    summary: string;
    reasoning: string;
    target_sections: string[];
    changes: Record<string, any>;
    affected_requirements?: string[];
    requires_decision?: boolean;
    assigned_decider_id?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/human`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit human proposal');
  }
  return res.json();
}

export async function approveProposal(
  projectId: string,
  proposalId: string,
  decidedBy: string,
  manualReview: boolean = false
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decided_by: decidedBy, manual_review: manualReview }),
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

export async function reverifyProposal(projectId: string, proposalId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/reverify`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to re-verify proposal with NOVA');
  }
  return res.json();
}

export async function fetchProposalStats(projectId: string = 'demo-ledgerflow'): Promise<ProposalStats> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/stats`);
  if (!res.ok) throw new Error('Failed to fetch proposal statistics');
  return res.json();
}

export async function fetchProposalConflictDetail(
  projectId: string = 'demo-ledgerflow',
  proposalId: string
): Promise<ProposalConflictDetail> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/conflict`);
  if (!res.ok) throw new Error('Failed to fetch proposal conflict details');
  return res.json();
}

export async function resolveProposalConflict(
  projectId: string = 'demo-ledgerflow',
  proposalId: string,
  resolutionMode: 'reconcile_pixel' | 'keep_human' | 'custom_merge',
  decidedBy: string = 'alex',
  note?: string,
  customChanges?: any
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/resolve-conflict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution_mode: resolutionMode,
      decided_by: decidedBy,
      note,
      custom_changes: customChanges,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to resolve conflict');
  }
  return res.json();
}

export async function restartAgent(projectId: string, agentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/restart`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restart agent');
  return res.json();
}

export async function getAgentContextPack(projectId: string, agentId: string, runId?: string): Promise<any> {
  const url = runId 
    ? `${API_BASE}/projects/${projectId}/agents/${agentId}/context-pack?run_id=${runId}`
    : `${API_BASE}/projects/${projectId}/agents/${agentId}/context-pack`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to get context pack');
  return res.json();
}

export async function getAgentRuns(projectId: string, agentId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/runs`);
  if (!res.ok) throw new Error('Failed to fetch agent runs');
  return res.json();
}

export async function getAgentRunContextPack(projectId: string, agentId: string, runId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/runs/${runId}/context-pack`);
  if (!res.ok) throw new Error('Failed to fetch specific run context pack');
  return res.json();
}

export async function rebuildAgentContext(projectId: string, agentId: string, baseRunId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/context-pack/rebuild`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_run_id: baseRunId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to rebuild context' }));
    throw new Error(err.detail || 'Failed to rebuild context');
  }
  return res.json();
}

export async function resumeAgentExecution(
  projectId: string,
  agentId: string,
  baseRunId?: string,
  idempotencyKey?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_run_id: baseRunId, idempotency_key: idempotencyKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to resume agent' }));
    throw new Error(err.detail || 'Failed to resume agent');
  }
  return res.json();
}

export async function getAgentRecoveryHistory(projectId: string, agentId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/recovery-history`);
  if (!res.ok) throw new Error('Failed to fetch recovery history');
  return res.json();
}

export async function getInterruptedTask(projectId: string, agentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/agents/${agentId}/interrupted-task`);
  if (!res.ok) throw new Error('Failed to check interrupted task');
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



// ==============================================================================
// PRUNE SEATBELT & WORKSHOP DEMO API CLIENTS (BIOS V2)
// ==============================================================================

export async function fetchPruneStatus(): Promise<PruneStatus> {
  const res = await fetch(`${API_BASE}/prune/status`);
  if (!res.ok) throw new Error('Failed to fetch Prune status');
  return res.json();
}

export async function runPruneWorkshopDemo(): Promise<PruneDemoTrace> {
  const res = await fetch(`${API_BASE}/prune/demo-receipt`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to execute Prune workshop demo');
  }
  return res.json();
}

export async function fetchPruneReceipts(limit: number = 25): Promise<PruneMetadata[]> {
  const res = await fetch(`${API_BASE}/prune/receipts?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch Prune receipts');
  return res.json();
}

export async function verifyPruneReceipt(
  receipt: any,
  signature: string,
  publicKey: string
): Promise<{ verified: boolean; algorithm: string; public_key: string }> {
  const res = await fetch(`${API_BASE}/prune/verify-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt, signature, public_key: publicKey }),
  });
  if (!res.ok) throw new Error('Failed to verify Prune receipt');
  return res.json();
}


// ==============================================================================
// OPENAGENTS CAPABILITIES: DELEGATIONS, APPROVALS, RESOURCES, MCP
// ==============================================================================

export async function fetchDelegations(projectId: string = 'demo-ledgerflow'): Promise<Delegation[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/delegations`);
  if (!res.ok) throw new Error('Failed to fetch delegations');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.delegations || []);
}

export async function createDelegation(
  projectId: string,
  payload: {
    source_agent: string;
    target_agent: string;
    task: string;
    scope?: string;
    acceptance_criteria?: string[];
    dependencies?: string[];
  }
): Promise<Delegation> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/delegations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create delegation');
  }
  const data = await res.json();
  return data.delegation || data;
}

export async function triggerDemoDelegation(projectId: string = 'demo-ledgerflow'): Promise<{
  delegation?: Delegation;
  pixel_proposal?: any;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/delegations/demo-nova-to-pixel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to trigger agent delegation');
  }
  return res.json();
}

export async function fetchApprovals(projectId: string = 'demo-ledgerflow', status?: string): Promise<ApprovalRequest[]> {
  const url = status
    ? `${API_BASE}/projects/${projectId}/approvals?status=${encodeURIComponent(status)}`
    : `${API_BASE}/projects/${projectId}/approvals`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.approvals || []);
}

export async function resolveApproval(
  projectId: string,
  approvalId: string,
  payload: {
    decision: 'approved' | 'rejected' | 'redirected';
    decided_by: string;
    note?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/approvals/${approvalId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: payload.decision,
      decision: payload.decision,
      decided_by: payload.decided_by,
      note: payload.note,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to resolve approval request');
  }
  return res.json();
}

export async function fetchResources(
  projectId: string = 'demo-ledgerflow',
  resourceType?: string
): Promise<SharedResource[]> {
  const url = resourceType
    ? `${API_BASE}/projects/${projectId}/resources?resource_type=${encodeURIComponent(resourceType)}`
    : `${API_BASE}/projects/${projectId}/resources`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch resources');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.resources || []);
}

export async function createResource(
  projectId: string,
  payload: {
    resource_type: string;
    title: string;
    description?: string;
    data: Record<string, any>;
    creator_id: string;
    creator_type?: 'human' | 'agent' | 'system';
  }
): Promise<SharedResource> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create resource');
  }
  const data = await res.json();
  return data.resource || data;
}

export async function fetchMCPTools(): Promise<MCPToolManifest[]> {
  const res = await fetch(`${API_BASE}/mcp/tools`);
  if (!res.ok) throw new Error('Failed to fetch MCP tools');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.tools || []);
}

export async function callMCPTool(
  toolName: string,
  toolArgs: Record<string, any>,
  callerIdentity: string = 'alex',
  callerType: 'human' | 'agent' | 'system' = 'human',
  projectId: string = 'demo-ledgerflow'
): Promise<any> {
  const res = await fetch(`${API_BASE}/mcp/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      agent_id: callerIdentity,
      tool_name: toolName,
      arguments: toolArgs,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to execute MCP tool ${toolName}`);
  }
  const data = await res.json();
  return data.result !== undefined ? data.result : data;
}


// ---------------------------------------------------------------------------
// LedgerFlow Functional Expense Workflow API
// ---------------------------------------------------------------------------

export async function fetchExpenses(
  projectId: string = 'demo-ledgerflow',
  status?: string,
  category?: string
): Promise<{ total: number; expenses: any[]; metrics: any }> {
  let url = `${API_BASE}/projects/${projectId}/expenses`;
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (category) params.append('category', category);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch expenses');
  return res.json();
}

export async function submitExpense(
  projectId: string = 'demo-ledgerflow',
  data: {
    amount: number;
    currency?: string;
    category: string;
    description: string;
    expense_date: string;
    reference?: string;
    submitted_by?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit expense');
  }
  return res.json();
}

export async function decideExpense(
  projectId: string = 'demo-ledgerflow',
  expenseId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  reason?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/expenses/${expenseId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, decided_by: decidedBy, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to ${decision} expense`);
  }
  return res.json();
}

export async function fetchExpenseMetrics(projectId: string = 'demo-ledgerflow'): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/expenses/metrics`);
  if (!res.ok) throw new Error('Failed to fetch expense metrics');
  return res.json();
}

export async function analyseProductPrompt(
  prompt: string,
  constraints?: string,
  submitterId: string = 'alex',
  projectId: string = 'demo-ledgerflow'
): Promise<{ status: string; message: string; prd: any }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, constraints, submitter_id: submitterId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to analyse product prompt with NOVA');
  }
  return res.json();
}

export async function fetchLatestPRD(projectId: string = 'demo-ledgerflow'): Promise<{ prd: any }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest PRD');
  return res.json();
}

export async function updatePRD(
  prdId: string,
  updates: any,
  projectId: string = 'demo-ledgerflow'
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/${prdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update PRD');
  }
  return res.json();
}

export async function confirmPRD(
  prdId: string,
  confirmedBy: string = 'alex',
  note?: string,
  projectId: string = 'demo-ledgerflow'
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/${prdId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_by: confirmedBy, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to confirm PRD');
  }
  return res.json();
}

export async function fetchLatestPlan(projectId: string = 'demo-ledgerflow'): Promise<{ plan: any }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/plan/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest implementation plan');
  return res.json();
}

export async function fetchWorkflowStage(projectId: string = 'demo-ledgerflow'): Promise<{ stage: any; stages: any[] }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/prd/workflow/stage`);
  if (!res.ok) throw new Error('Failed to fetch workflow stage');
  return res.json();
}

export async function loadDemoScenario(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/load-scenario`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to load demo scenario');
  return res.json();
}

export async function fetchConversations(projectId: string = 'demo-ledgerflow'): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function createConversation(
  projectId: string = 'demo-ledgerflow',
  payload: {
    title: string;
    conversation_type?: string;
    created_by: string;
    participants?: string[];
    associated_task_id?: string;
  }
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create conversation');
  }
  return res.json();
}

export async function fetchConversation(
  projectId: string = 'demo-ledgerflow',
  conversationId: string
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}`);
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
}

export async function fetchConversationMessages(
  projectId: string = 'demo-ledgerflow',
  conversationId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}/messages?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch conversation messages');
  return res.json();
}

export async function sendChatMessage(
  projectId: string = 'demo-ledgerflow',
  conversationId: string,
  payload: {
    sender_id: string;
    message_content: string;
    recipient: string;
    related_task_id?: string;
  }
): Promise<{ status: string; human_message: ChatMessage; agent_responses: ChatMessage[] }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send chat message');
  }
  return res.json();
}

export async function markConversationRead(
  projectId: string = 'demo-ledgerflow',
  conversationId: string,
  participantId: string
): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant_id: participantId }),
  });
  if (!res.ok) throw new Error('Failed to mark conversation read');
  return res.json();
}


export async function confirmProposalRequirements(
  projectId: string = 'demo-ledgerflow',
  proposalId: string,
  confirmedBy: string = 'alex',
  note?: string
): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/proposals/${proposalId}/confirm_requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_by: confirmedBy, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to confirm requirements');
  }
  return res.json();
}


export async function getRequirementHistory(
  projectId: string,
  requirementKey: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/requirements/${requirementKey}/history`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch requirement history');
  }
  return res.json();
}

export async function retrieveContextAdhoc(
  projectId: string,
  agentId: string,
  taskDescription: string,
  targetSections?: string[],
  affectedRequirements?: string[]
): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/context/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      task_description: taskDescription,
      target_sections: targetSections,
      affected_requirements: affectedRequirements,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to retrieve context');
  }
  return res.json();
}



export async function fetchChatWorkflowStage(projectId: string = 'demo-ledgerflow'): Promise<WorkflowStageInfo> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workflow-stage`);
  if (!res.ok) throw new Error('Failed to fetch chat workflow stage');
  return res.json();
}

export async function syncChatWorkflowStage(projectId: string = 'demo-ledgerflow'): Promise<WorkflowStageInfo> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workflow-stage/sync`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to sync chat workflow stage');
  return res.json();
}
