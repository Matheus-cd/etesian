package entity

import (
	"time"

	"github.com/google/uuid"
)

type Execution struct {
	ID                  uuid.UUID  `db:"id" json:"id"`
	ExerciseTechniqueID uuid.UUID  `db:"exercise_technique_id" json:"exercise_technique_id"`
	ExecutedBy          *uuid.UUID `db:"executed_by" json:"executed_by"`
	ExecutedAt          time.Time  `db:"executed_at" json:"executed_at"`
	TargetSystem        *string    `db:"target_system" json:"target_system"`
	CommandUsed         *string    `db:"command_used" json:"command_used"`
	Notes               *string    `db:"notes" json:"notes"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`

	// Joined fields
	ExecutedByUser *User      `db:"-" json:"executed_by_user,omitempty"`
	Evidences      []Evidence `db:"-" json:"evidences,omitempty"`
}
