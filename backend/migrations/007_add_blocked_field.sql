-- Migration: Add blocked support for Tool detections
-- Allows Blue Team to indicate that the Tool (EDR/AV) actively blocked/prevented the attack

-- Add blocked field for Tool detection
ALTER TABLE detections ADD COLUMN tool_blocked BOOLEAN DEFAULT FALSE;

-- Update detection_status check constraint to include 'blocked'
ALTER TABLE detections DROP CONSTRAINT IF EXISTS detections_detection_status_check;

ALTER TABLE detections ADD CONSTRAINT detections_detection_status_check
CHECK (detection_status IN ('pending', 'detected', 'blocked', 'partial', 'not_detected', 'not_applicable', 'voided'));
