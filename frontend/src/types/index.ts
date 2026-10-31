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
