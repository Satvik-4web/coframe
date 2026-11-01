-- Migration: Add nova_review JSONB column to proposals table
-- Description: Stores structured findings from independent NOVA AI proposal re-verification

ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS nova_review JSONB;

COMMENT ON COLUMN proposals.nova_review IS 'Validated structured findings from independent NOVA AI re-verification (status, missing dependencies, affected sections, impact explanation, recommended action, confidence, reviewed versions)';

