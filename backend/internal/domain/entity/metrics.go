package entity

import (
	"time"

	"github.com/google/uuid"
)

type ExerciseMetrics struct {
	ID                     uuid.UUID `db:"id" json:"id"`
	ExerciseID             uuid.UUID `db:"exercise_id" json:"exercise_id"`
	TotalTechniques        int       `db:"total_techniques" json:"total_techniques"`
	TotalExecuted          int       `db:"total_executed" json:"total_executed"`
	ToolDetectedCount      int       `db:"tool_detected_count" json:"tool_detected_count"`
	SIEMDetectedCount      int       `db:"siem_detected_count" json:"siem_detected_count"`
	BothDetectedCount      int       `db:"both_detected_count" json:"both_detected_count"`
	NotDetectedCount       int       `db:"not_detected_count" json:"not_detected_count"`
	VoidedCount            int       `db:"voided_count" json:"voided_count"`
	AvgToolResponseSeconds *int      `db:"avg_tool_response_seconds" json:"avg_tool_response_seconds"`
	AvgSIEMResponseSeconds *int      `db:"avg_siem_response_seconds" json:"avg_siem_response_seconds"`
	CalculatedAt           time.Time `db:"calculated_at" json:"calculated_at"`
}

// ToolDetectionRate returns percentage of tool detections
func (m *ExerciseMetrics) ToolDetectionRate() float64 {
	if m.TotalExecuted == 0 {
		return 0
	}
	return float64(m.ToolDetectedCount) / float64(m.TotalExecuted) * 100
}

// SIEMDetectionRate returns percentage of SIEM detections
func (m *ExerciseMetrics) SIEMDetectionRate() float64 {
	if m.TotalExecuted == 0 {
		return 0
	}
	return float64(m.SIEMDetectedCount) / float64(m.TotalExecuted) * 100
}

// BothDetectionRate returns percentage detected by both
func (m *ExerciseMetrics) BothDetectionRate() float64 {
	if m.TotalExecuted == 0 {
		return 0
	}
	return float64(m.BothDetectedCount) / float64(m.TotalExecuted) * 100
}

// NotDetectedRate returns percentage not detected
func (m *ExerciseMetrics) NotDetectedRate() float64 {
	if m.TotalExecuted == 0 {
		return 0
	}
	return float64(m.NotDetectedCount) / float64(m.TotalExecuted) * 100
}
