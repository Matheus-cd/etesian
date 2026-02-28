package entity

import (
	"time"

	"github.com/google/uuid"
)

type DetectionStatus string

const (
	DetectionStatusPending       DetectionStatus = "pending"
	DetectionStatusDetected      DetectionStatus = "detected"
	DetectionStatusBlocked       DetectionStatus = "blocked"
	DetectionStatusPartial       DetectionStatus = "partial"
	DetectionStatusNotDetected   DetectionStatus = "not_detected"
	DetectionStatusNotApplicable DetectionStatus = "not_applicable"
	DetectionStatusVoided        DetectionStatus = "voided"
)

type Detection struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	ExecutionID uuid.UUID  `db:"execution_id" json:"execution_id"`
	DetectedBy  *uuid.UUID `db:"detected_by" json:"detected_by"`

	// Tool detection (EDR, AV, etc)
	ToolDetected      bool       `db:"tool_detected" json:"tool_detected"`
	ToolName          *string    `db:"tool_name" json:"tool_name"`
	ToolDetectedAt    *time.Time `db:"tool_detected_at" json:"tool_detected_at"`
	ToolAlertID       *string    `db:"tool_alert_id" json:"tool_alert_id"`
	ToolNotes         *string    `db:"tool_notes" json:"tool_notes"`
	ToolNotApplicable bool       `db:"tool_not_applicable" json:"tool_not_applicable"`
	ToolNAReason      *string    `db:"tool_na_reason" json:"tool_na_reason"`
	ToolBlocked       bool       `db:"tool_blocked" json:"tool_blocked"`

	// SIEM detection
	SIEMDetected      bool       `db:"siem_detected" json:"siem_detected"`
	SIEMName          *string    `db:"siem_name" json:"siem_name"`
	SIEMDetectedAt    *time.Time `db:"siem_detected_at" json:"siem_detected_at"`
	SIEMAlertID       *string    `db:"siem_alert_id" json:"siem_alert_id"`
	SIEMNotes         *string    `db:"siem_notes" json:"siem_notes"`
	SIEMNotApplicable bool       `db:"siem_not_applicable" json:"siem_not_applicable"`
	SIEMNAReason      *string    `db:"siem_na_reason" json:"siem_na_reason"`

	// General status
	DetectionStatus DetectionStatus `db:"detection_status" json:"detection_status"`
	AnalystNotes    *string         `db:"analyst_notes" json:"analyst_notes"`
	CreatedAt       time.Time       `db:"created_at" json:"created_at"`

	// Joined fields
	DetectedByUser *User           `db:"-" json:"detected_by_user,omitempty"`
	ToolEvidences  []Evidence      `db:"-" json:"tool_evidences,omitempty"`
	SIEMEvidences  []Evidence      `db:"-" json:"siem_evidences,omitempty"`
	Void           *DetectionVoid  `db:"-" json:"void,omitempty"`
}

// CalculateToolResponseTime returns response time in seconds
// Only returns a value if ToolDetected is true AND ToolDetectedAt is set
func (d *Detection) CalculateToolResponseTime(executedAt time.Time) *int64 {
	if !d.ToolDetected || d.ToolDetectedAt == nil {
		return nil
	}
	seconds := int64(d.ToolDetectedAt.Sub(executedAt).Seconds())
	return &seconds
}

// CalculateSIEMResponseTime returns response time in seconds
// Only returns a value if SIEMDetected is true AND SIEMDetectedAt is set
func (d *Detection) CalculateSIEMResponseTime(executedAt time.Time) *int64 {
	if !d.SIEMDetected || d.SIEMDetectedAt == nil {
		return nil
	}
	seconds := int64(d.SIEMDetectedAt.Sub(executedAt).Seconds())
	return &seconds
}

// CalculateToolToSIEMGap returns gap in seconds between tool and SIEM detection
// Only returns a value if both ToolDetected and SIEMDetected are true with valid timestamps
func (d *Detection) CalculateToolToSIEMGap() *int64 {
	if !d.ToolDetected || !d.SIEMDetected || d.ToolDetectedAt == nil || d.SIEMDetectedAt == nil {
		return nil
	}
	seconds := int64(d.SIEMDetectedAt.Sub(*d.ToolDetectedAt).Seconds())
	return &seconds
}

func (s DetectionStatus) IsValid() bool {
	switch s {
	case DetectionStatusPending, DetectionStatusDetected, DetectionStatusBlocked, DetectionStatusPartial, DetectionStatusNotDetected, DetectionStatusNotApplicable, DetectionStatusVoided:
		return true
	}
	return false
}
