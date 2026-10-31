export type HumanIdentity = 'alex' | 'maya' | null;

export interface ProjectInfo {
  id: string;
  name: string;
  context_version: number;
  artifact_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  identity_key: 'alex' | 'maya';
  display_name: string;
  role: string;
}

export interface Requirement {
  id: string;
  requirement_key: string;
  title: string;
  value: any;
  version: number;
  updated_by: string;
  updated_at: string;
}

export interface ArtifactSection {
  section_key: string;
  data: Record<string, any>;
  version: number;
  updated_by: string;
  updated_at: string;
}

export interface Proposal {
  proposal_id: string;
  project_id: string;
  agent_id: 'nova' | 'pixel';
  run_id: string;
  supersedes_proposal_id?: string | null;
  summary: string;
  reasoning: string;
  affected_requirements: string[];
  target_sections: string[];
  changes: {
    operations: Array<{
      op: string;
      section?: string;
      fields?: Record<string, any>;
      config?: Record<string, any>;
      metrics?: any[];
      categories?: any[];
      items?: any[];
    }>;
  };
  base_context_version: number;
  base_artifact_version: number;
  base_section_versions: Record<string, number>;
  requires_decision: boolean;
  assigned_decider_id?: string | null;
  status: 'pending_review' | 'stale' | 'conflict' | 'approved' | 'rejected' | 'superseded';
  stale_reason?: string | null;
  conflict_reason?: string | null;
  source: 'live_llm' | 'cached_fallback';
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: 'nova' | 'pixel';
  status: 'idle' | 'working' | 'waiting_for_review' | 'failed' | 'offline';
  task_description: string;
  base_context_version: number;
  base_artifact_version: number;
  source: string;
  started_at: string;
  completed_at?: string | null;
}

export interface EventRecord {
  id: string;
  sequence_no: number;
  actor_type: 'human' | 'agent' | 'system';
  actor_id: string;
  event_type: string;
  context_version: number;
  artifact_version: number;
  payload: Record<string, any>;
  created_at: string;
}

export interface ObserverSummary {
  what_changed: string;
  why: string;
  what_happens_next: string;
  source_event_ids: string[];
  context_version: number;
  artifact_version: number;
  source: string;
  is_simulated: boolean;
}

export interface FullProjectState {
  project: ProjectInfo;
  members: ProjectMember[];
  requirements: Requirement[];
  sections: Record<string, ArtifactSection>;
  proposals: Proposal[];
  agent_runs: AgentRun[];
  events: EventRecord[];
  observer_summary: ObserverSummary;
  online_members: string[];
}

export interface GitHubConnectionStatus {
  is_configured: boolean;
  connection_status: 'not_configured' | 'not_connected' | 'connected' | 'synchronizing' | 'sync_successful' | 'sync_failed' | 'auth_expired' | 'permission_denied';
  owner?: string | null;
  repository_name?: string | null;
  repository_full_name?: string | null;
  repository_url?: string | null;
  default_branch?: string;
  authenticated_user?: string | null;
  last_synced_at?: string | null;
  message?: string | null;
}

export interface GitHubRepository {
  name: string;
  full_name: string;
  owner: string;
  description?: string | null;
  default_branch: string;
  html_url: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  is_private: boolean;
  updated_at?: string | null;
}

export interface GitHubBranch {
  name: string;
  commit_sha: string;
  is_default: boolean;
  is_coframe_branch: boolean;
  related_proposal_id?: string | null;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author_name: string;
  author_date: string;
  html_url: string;
  is_coframe_commit: boolean;
  related_proposal_id?: string | null;
  actor_identity?: string | null;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed' | 'merged';
  html_url: string;
  head_branch: string;
  base_branch: string;
  created_at: string;
  updated_at?: string | null;
  merged_at?: string | null;
  author: string;
  related_proposal_id?: string | null;
}

export interface GitHubContribution {
  id: string;
  project_id: string;
  proposal_id: string;
  repository_full_name: string;
  branch_name: string;
  base_branch: string;
  commit_sha?: string | null;
  pr_number?: number | null;
  pr_url?: string | null;
  pr_title?: string | null;
  pr_status: 'open' | 'closed' | 'merged' | 'draft' | 'sync_failed';
  sync_status: 'pending' | 'publishing' | 'branch_created' | 'commit_created' | 'pr_opened' | 'sync_failed' | 'merged' | 'closed';
  error_message?: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
  proposal_summary?: string | null;
  agent_id?: string | null;
  decided_by?: string | null;
  artifact_version?: number | null;
}

export interface PublishProposalResult {
  status: 'success' | 'failed' | 'publishing';
  job_id: string;
  contribution_id?: string | null;
  branch_name?: string | null;
  commit_sha?: string | null;
  pr_number?: number | null;
  pr_url?: string | null;
  message: string;
}

