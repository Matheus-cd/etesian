package entity

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// LocalTime is a time.Time wrapper that serializes without timezone information.
// This is useful for scheduled times where we want to preserve the local time
// the user selected without timezone conversion in the frontend.
type LocalTime struct {
	time.Time
	Valid bool
}

const localTimeFormat = "2006-01-02T15:04"

// MarshalJSON implements json.Marshaler
func (lt LocalTime) MarshalJSON() ([]byte, error) {
	if !lt.Valid {
		return json.Marshal(nil)
	}
	// Always use UTC to ensure consistent serialization
	return json.Marshal(lt.Time.UTC().Format(localTimeFormat))
}

// UnmarshalJSON implements json.Unmarshaler
func (lt *LocalTime) UnmarshalJSON(data []byte) error {
	var s *string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if s == nil || *s == "" {
		lt.Valid = false
		lt.Time = time.Time{}
		return nil
	}
	t, err := time.Parse(localTimeFormat, *s)
	if err != nil {
		return fmt.Errorf("invalid time format, expected %s: %w", localTimeFormat, err)
	}
	lt.Time = t
	lt.Valid = true
	return nil
}

// Scan implements sql.Scanner
func (lt *LocalTime) Scan(value interface{}) error {
	if value == nil {
		lt.Valid = false
		lt.Time = time.Time{}
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		lt.Time = v
		lt.Valid = true
		return nil
	case []byte:
		t, err := time.Parse(time.RFC3339Nano, string(v))
		if err != nil {
			// Try parsing without timezone
			t, err = time.Parse("2006-01-02T15:04:05", string(v))
			if err != nil {
				return fmt.Errorf("cannot parse time from bytes: %w", err)
			}
		}
		lt.Time = t
		lt.Valid = true
		return nil
	case string:
		t, err := time.Parse(time.RFC3339Nano, v)
		if err != nil {
			// Try parsing without timezone
			t, err = time.Parse("2006-01-02T15:04:05", v)
			if err != nil {
				return fmt.Errorf("cannot parse time from string: %w", err)
			}
		}
		lt.Time = t
		lt.Valid = true
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into LocalTime", value)
	}
}

// Value implements driver.Valuer
func (lt LocalTime) Value() (driver.Value, error) {
	if !lt.Valid {
		return nil, nil
	}
	return lt.Time, nil
}

// NewLocalTime creates a new LocalTime from a time.Time
func NewLocalTime(t time.Time) LocalTime {
	return LocalTime{Time: t, Valid: true}
}

// LocalTimeFromPtr creates a LocalTime from a *time.Time
func LocalTimeFromPtr(t *time.Time) LocalTime {
	if t == nil {
		return LocalTime{Valid: false}
	}
	return LocalTime{Time: *t, Valid: true}
}

// ToPtr returns a *time.Time or nil if not valid
func (lt LocalTime) ToPtr() *time.Time {
	if !lt.Valid {
		return nil
	}
	return &lt.Time
}

type ExerciseStatus string

const (
	ExerciseStatusDraft     ExerciseStatus = "draft"
	ExerciseStatusActive    ExerciseStatus = "active"
	ExerciseStatusCompleted ExerciseStatus = "completed"
)

type Exercise struct {
	ID             uuid.UUID      `db:"id" json:"id"`
	Name           string         `db:"name" json:"name"`
	Description    *string        `db:"description" json:"description"`
	ClientID       *uuid.UUID     `db:"client_id" json:"client_id"`
	Status         ExerciseStatus `db:"status" json:"status"`
	CreatedBy      *uuid.UUID     `db:"created_by" json:"created_by"`
	StartedAt      *time.Time     `db:"started_at" json:"started_at"`
	CompletedAt    *time.Time     `db:"completed_at" json:"completed_at"`
	ScheduledStart *time.Time     `db:"scheduled_start" json:"scheduled_start"`
	ScheduledEnd   *time.Time     `db:"scheduled_end" json:"scheduled_end"`
	CreatedAt      time.Time      `db:"created_at" json:"created_at"`

	// Joined fields
	Client *Client `db:"-" json:"client,omitempty"`
}

type ExerciseRoleInExercise string

const (
	RoleInExerciseRedTeam  ExerciseRoleInExercise = "red_team"
	RoleInExerciseBlueTeam ExerciseRoleInExercise = "blue_team"
	RoleInExerciseLead     ExerciseRoleInExercise = "lead"
	RoleInExerciseViewer   ExerciseRoleInExercise = "viewer"
)

type ExerciseMember struct {
	ID             uuid.UUID              `db:"id" json:"id"`
	ExerciseID     uuid.UUID              `db:"exercise_id" json:"exercise_id"`
	UserID         uuid.UUID              `db:"user_id" json:"user_id"`
	RoleInExercise ExerciseRoleInExercise `db:"role_in_exercise" json:"role_in_exercise"`
	AssignedBy     *uuid.UUID             `db:"assigned_by" json:"assigned_by"`
	AssignedAt     time.Time              `db:"assigned_at" json:"assigned_at"`

	// Joined fields
	User *User `db:"-" json:"user,omitempty"`
}

type ExerciseTechniqueStatus string

const (
	TechniqueStatusPending    ExerciseTechniqueStatus = "pending"
	TechniqueStatusInProgress ExerciseTechniqueStatus = "in_progress"
	TechniqueStatusPaused     ExerciseTechniqueStatus = "paused"
	TechniqueStatusCompleted  ExerciseTechniqueStatus = "completed"
)

type ExerciseTechnique struct {
	ID                 uuid.UUID               `db:"id" json:"id"`
	ExerciseID         uuid.UUID               `db:"exercise_id" json:"exercise_id"`
	TechniqueID        uuid.UUID               `db:"technique_id" json:"technique_id"`
	SequenceOrder      *int                    `db:"sequence_order" json:"sequence_order"`
	Notes              *string                 `db:"notes" json:"notes"`
	Status             ExerciseTechniqueStatus `db:"status" json:"status"`
	StartedAt          *time.Time              `db:"started_at" json:"started_at"`
	PausedAt           *time.Time              `db:"paused_at" json:"paused_at"`
	CompletedAt        *time.Time              `db:"completed_at" json:"completed_at"`
	StartedBy          *uuid.UUID              `db:"started_by" json:"started_by"`
	ScheduledStartTime LocalTime               `db:"scheduled_start_time" json:"scheduled_start_time"`
	ScheduledEndTime   LocalTime               `db:"scheduled_end_time" json:"scheduled_end_time"`
	CreatedAt          time.Time               `db:"created_at" json:"created_at"`

	// Joined fields
	Technique     *Technique  `db:"-" json:"technique,omitempty"`
	Executions    []Execution `db:"-" json:"executions,omitempty"`
	Detection     *Detection  `db:"-" json:"detection,omitempty"`
	StartedByUser *User       `db:"-" json:"started_by_user,omitempty"`
}

func (s ExerciseTechniqueStatus) IsValid() bool {
	switch s {
	case TechniqueStatusPending, TechniqueStatusInProgress, TechniqueStatusPaused, TechniqueStatusCompleted:
		return true
	}
	return false
}

func (s ExerciseStatus) IsValid() bool {
	switch s {
	case ExerciseStatusDraft, ExerciseStatusActive, ExerciseStatusCompleted:
		return true
	}
	return false
}

func (r ExerciseRoleInExercise) IsValid() bool {
	switch r {
	case RoleInExerciseRedTeam, RoleInExerciseBlueTeam, RoleInExerciseLead, RoleInExerciseViewer:
		return true
	}
	return false
}

func (r ExerciseRoleInExercise) CanExecute() bool {
	return r == RoleInExerciseRedTeam || r == RoleInExerciseLead
}

func (r ExerciseRoleInExercise) CanDetect() bool {
	return r == RoleInExerciseBlueTeam || r == RoleInExerciseLead
}

func (r ExerciseRoleInExercise) CanVoidDetection() bool {
	return r == RoleInExerciseRedTeam || r == RoleInExerciseLead
}
