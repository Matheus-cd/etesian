-- Add status tracking to exercise_techniques
-- This allows tracking: pending -> in_progress -> paused -> completed

ALTER TABLE exercise_techniques
ADD COLUMN status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed')),
ADD COLUMN started_at TIMESTAMP,
ADD COLUMN paused_at TIMESTAMP,
ADD COLUMN completed_at TIMESTAMP,
ADD COLUMN started_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for status queries
CREATE INDEX idx_exercise_techniques_status ON exercise_techniques(status);

-- Add caption field to evidences for report generation
ALTER TABLE evidences
ADD COLUMN caption VARCHAR(500);
