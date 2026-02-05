-- Add Not Applicable (N/A) support for detections
-- Allows Blue Team to mark Tool or SIEM detection as not applicable with a reason

-- Add N/A fields for Tool detection
ALTER TABLE detections
ADD COLUMN tool_not_applicable BOOLEAN DEFAULT FALSE,
ADD COLUMN tool_na_reason VARCHAR(500);

-- Add N/A fields for SIEM detection
ALTER TABLE detections
ADD COLUMN siem_not_applicable BOOLEAN DEFAULT FALSE,
ADD COLUMN siem_na_reason VARCHAR(500);

-- Update detection_status check constraint to include 'not_applicable'
ALTER TABLE detections
DROP CONSTRAINT IF EXISTS detections_detection_status_check;

ALTER TABLE detections
ADD CONSTRAINT detections_detection_status_check
CHECK (detection_status IN ('pending', 'detected', 'partial', 'not_detected', 'not_applicable', 'voided'));
