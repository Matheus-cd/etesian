package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

// DetectionStats holds the calculated detection statistics for an exercise
type DetectionStats struct {
	// Total counts
	TotalTechniques    int `json:"total_techniques"`
	TotalWithExecution int `json:"total_with_execution"`
	TotalWithDetection int `json:"total_with_detection"`

	// Tool detection stats (count per technique)
	ToolDetected      int `json:"tool_detected"`
	ToolNotDetected   int `json:"tool_not_detected"`
	ToolNotApplicable int `json:"tool_not_applicable"`

	// SIEM detection stats (count per technique)
	SIEMDetected      int `json:"siem_detected"`
	SIEMNotDetected   int `json:"siem_not_detected"`
	SIEMNotApplicable int `json:"siem_not_applicable"`

	// Final status (combined, count per technique)
	FinalDetected      int `json:"final_detected"`      // SIEM detected
	FinalPartial       int `json:"final_partial"`       // Only tool detected
	FinalNotDetected   int `json:"final_not_detected"`  // Neither detected (has detection but none detected)
	FinalNotApplicable int `json:"final_not_applicable"` // Both N/A
	FinalPending       int `json:"final_pending"`       // Has execution but no detection registered
	FinalNotExecuted   int `json:"final_not_executed"`  // No execution at all

	// Calculated rates
	ToolRate float64 `json:"tool_rate"`
	SIEMRate float64 `json:"siem_rate"`
}

// TacticStats holds detection stats per tactic
type TacticStats struct {
	Tactic        string  `json:"tactic"`
	Total         int     `json:"total"`
	Detected      int     `json:"detected"`
	Partial       int     `json:"partial"`
	NotDetected   int     `json:"not_detected"`
	NotApplicable int     `json:"not_applicable"`
	Pending       int     `json:"pending"`
	NotExecuted   int     `json:"not_executed"`
	SIEMRate      float64 `json:"siem_rate"`
}

// TechniqueDetectionResult holds the detection result for a single technique
type TechniqueDetectionResult struct {
	TechniqueID        uuid.UUID
	ExerciseTechniqueID uuid.UUID
	TacticName         string
	HasExecution       bool
	HasDetection       bool
	LatestDetection    *entity.Detection
	FirstExecution     *entity.Execution
}

// DetectionStatsService calculates detection statistics for exercises
// This service ensures consistent calculation across all endpoints (reports, exercise details, etc.)
type DetectionStatsService struct {
	executionRepo repository.ExecutionRepository
	detectionRepo repository.DetectionRepository
}

// NewDetectionStatsService creates a new DetectionStatsService
func NewDetectionStatsService(
	executionRepo repository.ExecutionRepository,
	detectionRepo repository.DetectionRepository,
) *DetectionStatsService {
	return &DetectionStatsService{
		executionRepo: executionRepo,
		detectionRepo: detectionRepo,
	}
}

// CalculateForTechnique calculates detection result for a single technique
// Algorithm (matching frontend ExerciseDetailPage.tsx):
// 1. Get executions for the technique
// 2. If executions exist: use FIRST execution (executions[0])
// 3. Get detections for that first execution
// 4. If detections exist: use LATEST detection (detections[length-1])
// 5. Calculate stats based on that single latest detection
func (s *DetectionStatsService) CalculateForTechnique(
	ctx context.Context,
	exerciseTechniqueID uuid.UUID,
	techniqueID uuid.UUID,
	tacticName string,
	exerciseIsCompleted bool,
	techniqueStatus entity.ExerciseTechniqueStatus,
	techniqueStartedAt *bool,
	techniqueCompletedAt *bool,
) (*TechniqueDetectionResult, error) {
	result := &TechniqueDetectionResult{
		TechniqueID:        techniqueID,
		ExerciseTechniqueID: exerciseTechniqueID,
		TacticName:         tacticName,
		HasExecution:       false,
		HasDetection:       false,
	}

	// Get executions for this technique
	executions, err := s.executionRepo.ListByTechnique(ctx, exerciseTechniqueID)
	if err != nil {
		return result, err
	}

	// Determine if technique was executed
	hasStartedAt := techniqueStartedAt != nil && *techniqueStartedAt
	hasCompletedAt := techniqueCompletedAt != nil && *techniqueCompletedAt
	techniqueWasExecuted := exerciseIsCompleted ||
		len(executions) > 0 ||
		techniqueStatus != entity.TechniqueStatusPending ||
		hasStartedAt ||
		hasCompletedAt

	if !techniqueWasExecuted {
		// No execution at all
		return result, nil
	}

	result.HasExecution = true

	// If no actual execution records, return (has execution status but no detection possible)
	if len(executions) == 0 {
		return result, nil
	}

	// Use FIRST execution (matching frontend: executions[0])
	firstExec := executions[0]
	result.FirstExecution = &firstExec

	// Get detections for the first execution
	detections, err := s.detectionRepo.ListByExecution(ctx, firstExec.ID)
	if err != nil {
		return result, err
	}

	if len(detections) == 0 {
		// Has execution but no detection registered
		return result, nil
	}

	// Use LATEST detection (matching frontend: detections[detections.length - 1])
	latestDetection := detections[len(detections)-1]
	result.HasDetection = true
	result.LatestDetection = &latestDetection

	return result, nil
}

// CalculateStats calculates aggregated detection statistics from technique results
func (s *DetectionStatsService) CalculateStats(results []*TechniqueDetectionResult) *DetectionStats {
	stats := &DetectionStats{
		TotalTechniques: len(results),
	}

	for _, result := range results {
		if !result.HasExecution {
			// No execution at all
			stats.FinalNotExecuted++
			continue
		}

		stats.TotalWithExecution++

		if result.LatestDetection == nil {
			// Has execution but no detection registered
			// Count as not detected for both tool and SIEM (no detection = no alert)
			stats.ToolNotDetected++
			stats.SIEMNotDetected++
			stats.FinalPending++
			continue
		}

		stats.TotalWithDetection++
		det := result.LatestDetection

		// Tool detection stats (N/A tracked separately)
		if det.ToolNotApplicable {
			stats.ToolNotApplicable++
		} else if det.ToolDetected {
			stats.ToolDetected++
		} else {
			stats.ToolNotDetected++
		}

		// SIEM detection stats (N/A tracked separately)
		if det.SIEMNotApplicable {
			stats.SIEMNotApplicable++
		} else if det.SIEMDetected {
			stats.SIEMDetected++
		} else {
			stats.SIEMNotDetected++
		}

		// Final status calculation (same logic as frontend ExerciseDetailPage.tsx)
		if det.ToolNotApplicable && det.SIEMNotApplicable {
			stats.FinalNotApplicable++
		} else if det.SIEMDetected && !det.SIEMNotApplicable {
			stats.FinalDetected++
		} else if det.ToolDetected && !det.ToolNotApplicable {
			stats.FinalPartial++
		} else {
			stats.FinalNotDetected++
		}
	}

	// Calculate rates
	// Applicable = Total - NotApplicable - NotExecuted
	applicable := stats.TotalTechniques - stats.FinalNotApplicable - stats.FinalNotExecuted
	if applicable > 0 {
		stats.ToolRate = float64(stats.ToolDetected) / float64(applicable) * 100
		stats.SIEMRate = float64(stats.SIEMDetected) / float64(applicable) * 100
	}

	return stats
}

// CalculateTacticStats calculates detection statistics grouped by tactic
func (s *DetectionStatsService) CalculateTacticStats(results []*TechniqueDetectionResult) map[string]*TacticStats {
	tacticMap := make(map[string]*TacticStats)

	for _, result := range results {
		tacticName := result.TacticName
		if tacticName == "" {
			tacticName = "Unknown"
		}

		stat, ok := tacticMap[tacticName]
		if !ok {
			stat = &TacticStats{Tactic: tacticName}
			tacticMap[tacticName] = stat
		}

		stat.Total++

		if !result.HasExecution {
			stat.NotExecuted++
			continue
		}

		if result.LatestDetection == nil {
			stat.Pending++
			continue
		}

		det := result.LatestDetection

		// Final status calculation for tactic
		if det.ToolNotApplicable && det.SIEMNotApplicable {
			stat.NotApplicable++
		} else if det.SIEMDetected && !det.SIEMNotApplicable {
			stat.Detected++
		} else if det.ToolDetected && !det.ToolNotApplicable {
			stat.Partial++
		} else {
			stat.NotDetected++
		}
	}

	// Calculate SIEM rate for each tactic
	for _, stat := range tacticMap {
		applicable := stat.Total - stat.NotApplicable - stat.NotExecuted
		if applicable > 0 {
			stat.SIEMRate = float64(stat.Detected) / float64(applicable) * 100
		}
	}

	return tacticMap
}
