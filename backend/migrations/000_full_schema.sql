-- Etesian Purple Team Platform
-- Full Schema Migration (Consolidated)
-- Use this migration when setting up the database from scratch
--
-- This file consolidates:
-- - 001_initial_schema.sql (base tables and indexes)
-- - 002_technique_execution_status.sql (status tracking for techniques, evidence captions)
--
-- Note: Execution notes use key-based format [field_key]: value for i18n support
-- Example: "[source_ip]: 192.168.1.100" instead of "Source (IP): 192.168.1.100"

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'purple_team_lead', 'red_team_operator', 'blue_team_analyst', 'viewer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked', 'pending')),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TECHNIQUES TABLE (MITRE ATT&CK)
-- =====================================================
CREATE TABLE techniques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mitre_id VARCHAR(20),
    tactic VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- EXERCISES TABLE
-- =====================================================
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    client_name VARCHAR(200),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- EXERCISE MEMBERS (Isolation per exercise)
-- =====================================================
CREATE TABLE exercise_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_exercise VARCHAR(30) NOT NULL CHECK (role_in_exercise IN ('red_team', 'blue_team', 'lead', 'viewer')),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(exercise_id, user_id)
);

-- =====================================================
-- EXERCISE TECHNIQUES
-- Includes status tracking: pending -> in_progress -> paused -> completed
-- =====================================================
CREATE TABLE exercise_techniques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    technique_id UUID NOT NULL REFERENCES techniques(id) ON DELETE CASCADE,
    sequence_order INT,
    notes TEXT,
    -- Status tracking (added in migration 002)
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed')),
    started_at TIMESTAMP,
    paused_at TIMESTAMP,
    completed_at TIMESTAMP,
    started_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- EXECUTIONS (Red Team records)
-- Notes field uses key-based format for i18n:
--   [source_ip]: value
--   [hostname]: value
--   [username]: value
--   [target_system]: value
--   [references]: value
--   [notes]:
--   multiline notes content
-- =====================================================
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_technique_id UUID NOT NULL REFERENCES exercise_techniques(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    executed_at TIMESTAMP NOT NULL,
    target_system VARCHAR(255),
    command_used TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON COLUMN executions.notes IS 'Uses key-based format [field_key]: value for i18n support. Known keys: source_ip, hostname, username, target_system, references, notes';

-- =====================================================
-- DETECTIONS (Blue Team records)
-- =====================================================
CREATE TABLE detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    detected_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Tool detection (EDR, AV, etc)
    tool_detected BOOLEAN DEFAULT FALSE,
    tool_name VARCHAR(100),
    tool_detected_at TIMESTAMP,
    tool_alert_id VARCHAR(255),
    tool_notes TEXT,

    -- SIEM detection
    siem_detected BOOLEAN DEFAULT FALSE,
    siem_name VARCHAR(100),
    siem_detected_at TIMESTAMP,
    siem_alert_id VARCHAR(255),
    siem_notes TEXT,

    -- General status
    detection_status VARCHAR(20) DEFAULT 'pending' CHECK (detection_status IN ('pending', 'detected', 'partial', 'not_detected', 'voided')),
    analyst_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- DETECTION VOIDS (Red Team can void detections)
-- =====================================================
CREATE TABLE detection_voids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID NOT NULL REFERENCES detections(id) ON DELETE CASCADE,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT NOT NULL,
    voided_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- EVIDENCES (Attached files)
-- Includes caption field for report generation (added in migration 002)
-- =====================================================
CREATE TABLE evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('execution', 'detection_tool', 'detection_siem')),
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    description TEXT,
    caption VARCHAR(500),  -- Added in migration 002
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- EXERCISE METRICS (Calculated cache)
-- =====================================================
CREATE TABLE exercise_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE UNIQUE,
    total_techniques INT DEFAULT 0,
    total_executed INT DEFAULT 0,
    tool_detected_count INT DEFAULT 0,
    siem_detected_count INT DEFAULT 0,
    both_detected_count INT DEFAULT 0,
    not_detected_count INT DEFAULT 0,
    voided_count INT DEFAULT 0,
    avg_tool_response_seconds INT,
    avg_siem_response_seconds INT,
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOGS (Immutable)
-- =====================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- REFRESH TOKENS
-- =====================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Techniques
CREATE INDEX idx_techniques_mitre_id ON techniques(mitre_id);
CREATE INDEX idx_techniques_tactic ON techniques(tactic);

-- Exercises
CREATE INDEX idx_exercises_status ON exercises(status);
CREATE INDEX idx_exercises_client ON exercises(client_name);
CREATE INDEX idx_exercises_created_by ON exercises(created_by);

-- Exercise Members
CREATE INDEX idx_exercise_members_user ON exercise_members(user_id);
CREATE INDEX idx_exercise_members_exercise ON exercise_members(exercise_id);

-- Exercise Techniques
CREATE INDEX idx_exercise_techniques_exercise ON exercise_techniques(exercise_id);
CREATE INDEX idx_exercise_techniques_technique ON exercise_techniques(technique_id);
CREATE INDEX idx_exercise_techniques_status ON exercise_techniques(status);

-- Executions
CREATE INDEX idx_executions_exercise_technique ON executions(exercise_technique_id);
CREATE INDEX idx_executions_executed_by ON executions(executed_by);
CREATE INDEX idx_executions_executed_at ON executions(executed_at);

-- Detections
CREATE INDEX idx_detections_execution ON detections(execution_id);
CREATE INDEX idx_detections_status ON detections(detection_status);

-- Detection Voids
CREATE INDEX idx_detection_voids_detection ON detection_voids(detection_id);

-- Evidences
CREATE INDEX idx_evidences_entity ON evidences(entity_type, entity_id);

-- Audit Logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Refresh Tokens
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =====================================================
-- INSERT DEFAULT ADMIN USER
-- Password: admin123 (change immediately!)
-- =====================================================
INSERT INTO users (username, email, password_hash, full_name, role, status, mfa_enabled)
VALUES (
    'admin',
    'admin@etesian.local',
    '$2a$12$wzD3D1VX3SxCqmFfIwMaBucE3jZvcmkW/aTkLRv9M2cRSxzKMMt/G', -- bcrypt hash of 'admin123'
    'System Administrator',
    'admin',
    'active',
    FALSE
);

-- =====================================================
-- SCHEMA VERSION TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES
    ('000_full_schema'),
    ('001_initial_schema'),
    ('002_technique_execution_status'),
    ('003_convert_execution_notes_format');
