-- ==============================================================================
-- COFRAME — SUPABASE POSTGRESQL MIGRATION SCHEMA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    context_version INTEGER NOT NULL DEFAULT 1,
    artifact_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    identity_key VARCHAR(32) NOT NULL, -- 'alex' or 'maya'
    display_name VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL,
    member_type VARCHAR(32) NOT NULL DEFAULT 'human'
);

CREATE TABLE IF NOT EXISTS requirements (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    requirement_key VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_req_proj_key ON requirements(project_id, requirement_key);

CREATE TABLE IF NOT EXISTS artifact_sections (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    section_key VARCHAR(64) NOT NULL,
    data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_art_proj_key ON artifact_sections(project_id, section_key);

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    sequence_no INTEGER NOT NULL,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    actor_type VARCHAR(32) NOT NULL, -- 'human', 'agent', 'system'
    actor_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    context_version INTEGER NOT NULL,
    artifact_version INTEGER NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_proj_seq ON events(project_id, sequence_no);

CREATE TABLE IF NOT EXISTS agent_runs (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    agent_id VARCHAR(32) NOT NULL, -- 'nova' or 'pixel'
    status VARCHAR(32) NOT NULL DEFAULT 'idle',
    task_description TEXT NOT NULL,
    context_pack JSONB NOT NULL,
    base_context_version INTEGER NOT NULL,
    base_artifact_version INTEGER NOT NULL,
    last_checkpoint JSONB,
    source VARCHAR(32) NOT NULL DEFAULT 'live_llm',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS proposals (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    agent_id VARCHAR(32) NOT NULL,
    run_id VARCHAR(64) REFERENCES agent_runs(id),
    supersedes_proposal_id VARCHAR(64) REFERENCES proposals(id),
    summary TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    affected_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    base_context_version INTEGER NOT NULL,
    base_artifact_version INTEGER NOT NULL,
    base_section_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_decision BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_decider_id VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    stale_reason TEXT,
    conflict_reason TEXT,
    source VARCHAR(32) NOT NULL DEFAULT 'live_llm',
    is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposal_proj_status ON proposals(project_id, status);

CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(64) PRIMARY KEY,
    proposal_id VARCHAR(64) REFERENCES proposals(id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL,
    decided_by VARCHAR(32) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
