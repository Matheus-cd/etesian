-- Migration: Add schedule fields for calendar functionality
-- Adds scheduled period to exercises and scheduled time slots to techniques

-- UP

-- Add scheduled period to exercises (date range for the exercise)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS scheduled_start DATE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS scheduled_end DATE;

-- Add scheduled time slots to exercise_techniques (specific time for execution)
ALTER TABLE exercise_techniques ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE exercise_techniques ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMP WITH TIME ZONE;

-- Add constraint to ensure end date is after start date for exercises
ALTER TABLE exercises ADD CONSTRAINT chk_exercise_schedule_dates
    CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end >= scheduled_start);

-- Add constraint to ensure end time is after start time for techniques
ALTER TABLE exercise_techniques ADD CONSTRAINT chk_technique_schedule_times
    CHECK (scheduled_end_time IS NULL OR scheduled_start_time IS NULL OR scheduled_end_time >= scheduled_start_time);

-- DOWN (rollback)
-- ALTER TABLE exercise_techniques DROP CONSTRAINT IF EXISTS chk_technique_schedule_times;
-- ALTER TABLE exercises DROP CONSTRAINT IF EXISTS chk_exercise_schedule_dates;
-- ALTER TABLE exercise_techniques DROP COLUMN IF EXISTS scheduled_end_time;
-- ALTER TABLE exercise_techniques DROP COLUMN IF EXISTS scheduled_start_time;
-- ALTER TABLE exercises DROP COLUMN IF EXISTS scheduled_end;
-- ALTER TABLE exercises DROP COLUMN IF EXISTS scheduled_start;
