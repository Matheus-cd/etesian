-- Migration: Add clients table
-- This migration creates a clients table and migrates existing client_name data from exercises

-- UP
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on name to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name ON clients(LOWER(name));

-- Add client_id column to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Migrate existing client_name values to clients table
INSERT INTO clients (name)
SELECT DISTINCT client_name FROM exercises
WHERE client_name IS NOT NULL AND client_name != ''
ON CONFLICT DO NOTHING;

-- Update exercises to reference the new clients
UPDATE exercises e
SET client_id = c.id
FROM clients c
WHERE LOWER(e.client_name) = LOWER(c.name);

-- Drop old client_name column
ALTER TABLE exercises DROP COLUMN IF EXISTS client_name;

-- DOWN (rollback)
-- ALTER TABLE exercises ADD COLUMN client_name VARCHAR(200);
-- UPDATE exercises e SET client_name = c.name FROM clients c WHERE e.client_id = c.id;
-- ALTER TABLE exercises DROP COLUMN client_id;
-- DROP TABLE IF EXISTS clients;
