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
  agent_id?: string | null;
  created_by?: string | null;
  author?: string;
  author_type?: 'agent' | 'human' | 'system' | 'unknown';
  author_role?: string;
  author_label?: string;
  contribution_type?: 'PRODUCT REQUIREMENTS' | 'IMPLEMENTATION' | 'HUMAN CONTRIBUTION' | string;
  task_id?: string | null;
  reviewed_by?: string | null;
  review_outcome?: 'PASS' | 'WARNING' | 'BLOCK' | null;
  review_findings?: Array<{ code: string; severity: string; message: string }> | null;
  run_id?: string;
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
  proposal_type?: 'prototype_modification' | 'prd_requirement' | 'strategic_recommendation' | 'human_contribution' | string;
  source: 'live_llm' | 'cached_fallback' | 'human_entry' | string;
  is_simulated: boolean;
  prune_metadata?: PruneMetadata | null;
  prd_data?: PRDData | null;
  implementation_data?: ImplementationData | null;
  created_at: string;
  updated_at: string;
}

export interface PruneMetadata {
  receipt_id: string;
  timestamp: string;
  model: string;
  cache_hit: boolean;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_cached: number;
  cost_usd: number;
  cost_saved_usd: number;
  shield_status: 'passed' | 'blocked';
  shield_violation?: string | null;
  shield_reason?: string | null;
  ed25519_signature: string;
  public_key: string;
  verified: boolean;
  issuer?: string;
  workshop?: string;
}

export interface PruneStatus {
  status: string;
  service: string;
  base_url: string;
  vault: {
    enabled: boolean;
    status: string;
    encryption: string;
    keys_out_of_code: boolean;
  };
  shield: {
    status: string;
    prompt_injection_defense: boolean;
    secret_leak_defense: boolean;
    pii_tokenization: boolean;
    blocked_threats_count: number;
  };
  savings: {
    exact_cache_enabled: boolean;
    total_requests: number;
    cache_hits: number;
    cache_hit_rate_pct: number;
    total_cost_usd: number;
    total_saved_usd: number;
    cheaper_vs_baseline_pct: number;
  };
  signatures: {
    algorithm: string;
    public_key: string;
  };
  recent_receipts: PruneMetadata[];
}

export interface PruneDemoStep {
  step: number;
  name: string;
  prompt: string;
  cache_hit?: boolean;
  cost_usd?: number;
  cost_saved_usd?: number;
  receipt_id?: string;
  signature?: string;
  status: string;
  result_preview?: string;
  shield_blocked?: boolean;
  blocked?: boolean;
  reason?: string;
  violation_type?: string;
}

export interface PruneDemoTrace {
  title: string;
  timestamp: string;
  steps: PruneDemoStep[];
  receipts: PruneMetadata[];
  stats: {
    total_requests: number;
    cache_hits: number;
    cache_hit_rate: number;
    total_cost_usd: number;
    total_saved_usd: number;
    shield_blocks: number;
  };
  public_key: string;
}

export interface AgentRun {
  id: string;
  agent_id: 'nova' | 'pixel';
  status: 'idle' | 'working' | 'waiting_for_review' | 'failed' | 'offline';
  lifecycle_state?: 'offline' | 'idle' | 'working' | 'waiting_for_approval' | 'recovering_context' | 'failed';
  task_description: string;
  base_context_version: number;
  base_artifact_version: number;
  current_task?: string | null;
  current_proposal_id?: string | null;
  task_start_time?: string | null;
  last_completed_task?: string | null;
  last_heartbeat?: string | null;
  source: string;
  started_at: string;
  completed_at?: string | null;
}

export interface EventRecord {
  id: string;
  event_id?: string;
  sequence_no: number;
  workspace_id?: string;
  actor_type: 'human' | 'agent' | 'system';
  actor_id: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  context_version: number;
  artifact_version: number;
  payload: Record<string, any>;
  correlation_id?: string | null;
  causation_id?: string | null;
  timestamp?: number;
  created_at: string;
}

export interface Delegation {
  id: string;
  source_agent: 'nova' | 'pixel';
  target_agent: 'nova' | 'pixel';
  task: string;
  scope?: string | null;
  acceptance_criteria: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  result_proposal_id?: string | null;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  requested_by: string;
  title: string;
  explanation: string;
  escalation_reason: string;
  affected_requirements: string[];
  affected_sections: string[];
  expected_impact: 'low' | 'medium' | 'high' | 'critical';
  assigned_decider_id: string;
  proposal_id?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'redirected' | 'clarification_requested';
  resolved_by?: string | null;
  created_at: string;
}

export interface SharedResource {
  id: string;
  resource_type: 'prototype' | 'requirement' | 'proposal' | 'event' | 'file' | 'version_snapshot';
  title: string;
  description?: string | null;
  creator_type: 'human' | 'agent' | 'system';
  creator_id: string;
  data: Record<string, any>;
  related_proposal_id?: string | null;
  related_event_id?: string | null;
  artifact_version: number;
  visibility: 'workspace' | 'restricted';
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  expense_date: string;
  reference?: string | null;
  status: 'pending_approval' | 'approved' | 'rejected';
  threshold_exceeded: boolean;
  submitted_by: string;
  decided_by?: string | null;
  decision_reason?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export interface ExpenseMetrics {
  total_submitted: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_approved_amount: number;
  spending_by_category: Record<string, number>;
}

export interface MCPToolManifest {
  name: string;
  description: string;
  allowed_callers: string[];
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
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
  delegations?: Delegation[];
  approvals?: ApprovalRequest[];
  resources?: SharedResource[];
  observer_summary: ObserverSummary;
  online_members: string[];
  is_clean_baseline?: boolean;
  scenario_label?: string;
}

export interface PRDFunctionalRequirement {
  id: string;
  title: string;
  description: string;
  priority: string;
}

export interface PRDNonFunctionalRequirement {
  id: string;
  title: string;
  description: string;
}

export interface PRDAcceptanceCriteria {
  req_id: string;
  criteria: string[];
}

export interface PRD {
  id: string;
  version: number;
  prompt: string;
  title: string;
  product_name: string;
  objective: string;
  target_audience: string;
  problem_statement: string;
  product_direction: string;
  functional_requirements: PRDFunctionalRequirement[];
  non_functional_requirements: PRDNonFunctionalRequirement[];
  constraints: string[];
  assumptions: string[];
  dependencies: string[];
  acceptance_criteria: PRDAcceptanceCriteria[];
  missing_information: string[];
  status: 'draft' | 'awaiting_confirmation' | 'confirmed';
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
}

export interface ImplementationTask {
  id: string;
  task?: string;
  title?: string;
  section?: string;
  status: 'completed' | 'in_progress' | 'planned' | string;
  dependencies?: string[];
}

export interface ImplementationPlan {
  id: string;
  prd_id?: string;
  proposal_id?: string;
  agent_id: string;
  title: string;
  tasks: ImplementationTask[];
  target_sections: string[];
  dependencies: string[];
  expected_ui_changes: string[];
  acceptance_criteria_mapping: Array<{ req_id: string; section?: string; verified: boolean }>;
  status: string;
  created_at: string;
}

export interface WorkflowStageInfo {
  current_stage: 'discovery' | 'requirements_review' | 'implementation_planning' | 'prototype_development' | 'agent_review' | 'human_approval' | 'completed';
  stage_label: string;
  description: string;
  actor: string;
  active_index: number;
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



export interface ConversationParticipant {
  participant_id: string;
  participant_type: 'human' | 'agent' | string;
  joined_at: string;
  last_read_at?: string | null;
}

export interface LinkedProposalSummary {
  id: string;
  proposal_id?: string;
  summary: string;
  status: string;
  author?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_key?: string;
  sender_name: string;
  sender_role: string;
  sender_type: 'human' | 'agent' | 'system' | string;
  recipient_id: string;
  recipient_type: 'human' | 'agent' | 'team' | string;
  message_content: string;
  content?: string;
  message_type: 'human_message' | 'agent_message' | 'system_notification' | string;
  status: string;
  related_task_id?: string | null;
  related_proposal_id?: string | null;
  related_proposal?: LinkedProposalSummary | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  title: string;
  conversation_type: string;
  associated_task_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: ChatMessage | null;
  participants: ConversationParticipant[];
}


export interface PRDFunctionalRequirement {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low' | string;
}

export interface PRDNonFunctionalRequirement {
  id: string;
  title: string;
  description: string;
  category: 'Performance' | 'Security' | 'Reliability' | 'Accessibility' | string;
}

export interface PRDUserStory {
  role: string;
  action: string;
  benefit: string;
  text?: string;
}

export interface PRDAcceptanceCriteriaItem {
  id: string;
  req_id?: string;
  criterion: string;
  measurable?: boolean;
}

export interface PRDData {
  title: string;
  version?: number;
  executive_summary: {
    what_proposed: string;
    problem_solved: string;
    expected_outcome: string;
  };
  problem_statement: {
    current_problem: string;
    pain_points: string[];
    why_needed: string;
  };
  target_users: {
    primary_users: string;
    goals_and_needs: string[];
  };
  proposed_solution: {
    summary: string;
    user_interaction_flow: string[];
  };
  functional_requirements: PRDFunctionalRequirement[];
  non_functional_requirements: PRDNonFunctionalRequirement[];
  user_stories: PRDUserStory[];
  acceptance_criteria: PRDAcceptanceCriteriaItem[];
  constraints: string[];
  assumptions: string[];
  dependencies: string[];
  risks: string[];
  open_questions: string[];
  revision_number: number;
  status: 'draft' | 'ready_for_review' | 'confirmed' | string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
}


export interface ChangedFileOrSection {
  name: string;
  type: 'artifact_section' | 'source_file' | string;
  change_type: 'Added' | 'Modified' | 'Deleted' | string;
  description: string;
  before_snippet?: string;
  after_snippet?: string;
}

export interface RequirementTraceabilityItem {
  requirement_id: string;
  title: string;
  implementation: string;
  validation: 'Passed' | 'Failed' | 'Not run' | 'Blocked' | string;
}

export interface ImplementationData {
  title: string;
  implementation_summary: {
    what_implemented: string;
    why_changes_made: string;
    how_satisfies_prd: string;
    what_is_incomplete?: string;
  };
  implementation_plan: ImplementationTask[];
  affected_sections: string[];
  changed_files_or_sections: ChangedFileOrSection[];
  artifact_diff?: Array<{
    section: string;
    label: string;
    before?: any;
    after?: any;
    diff_type: 'changed' | 'added' | 'removed' | string;
  }>;
  code_diff?: Array<{
    file: string;
    old_code?: string;
    new_code?: string;
    unified_diff?: string;
  }>;
  preview_reference?: {
    target_section: string;
    operations?: any[];
    mock_payload?: Record<string, any>;
  };
  validation_results: {
    schema_validation: { status: 'passed' | 'failed' | 'not_run' | string; message: string };
    build_result: { status: 'passed' | 'failed' | 'not_run' | string; message: string };
    type_checking: { status: 'passed' | 'failed' | 'not_run' | string; message: string };
  };
  test_results: {
    executed: number;
    passed: number;
    failed: number;
    status: 'passed' | 'failed' | 'not_run' | string;
    details?: string[];
  };
  requirement_traceability: RequirementTraceabilityItem[];
  known_limitations: string[];
  base_requirements_version?: number;
}


export interface ContextProvenance {
  source_id: string;
  source_type: string;
  project_id: string;
  version: number;
  timestamp: string;
  approval_status: string;
  retrieval_reason: string;
  relevance_score: number;
  scoring_breakdown?: {
    keyword_score?: number;
    semantic_score?: number;
    task_dependency_score?: number;
    freshness_score?: number;
    source_reliability?: number;
    approval_multiplier?: number;
  };
}

export interface HistoricalContextItem {
  source_id: string;
  source_type: string;
  key: string;
  title?: string;
  value: any;
  version: number;
  status: string;
  timestamp: string;
  reason_archived?: string;
  superseded_by_version?: number;
}

export interface ContextRetrievalMetrics {
  retrieval_latency_ms: number;
  estimated_token_count: number;
  total_candidates_evaluated: number;
  items_retrieved: number;
}
