package entity

import (
	"time"

	"github.com/google/uuid"
)

type RequirementCategory string

const (
	RequirementCategoryAccess       RequirementCategory = "acesso"
	RequirementCategoryCredential   RequirementCategory = "credencial"
	RequirementCategoryConfig       RequirementCategory = "configuracao"
	RequirementCategorySoftware     RequirementCategory = "software"
	RequirementCategoryNetwork      RequirementCategory = "rede"
	RequirementCategoryOther        RequirementCategory = "outro"
)

func (c RequirementCategory) IsValid() bool {
	switch c {
	case RequirementCategoryAccess, RequirementCategoryCredential, RequirementCategoryConfig,
		RequirementCategorySoftware, RequirementCategoryNetwork, RequirementCategoryOther:
		return true
	}
	return false
}

type ExerciseRequirement struct {
	ID          uuid.UUID           `db:"id" json:"id"`
	ExerciseID  uuid.UUID           `db:"exercise_id" json:"exercise_id"`
	Title       string              `db:"title" json:"title"`
	Description *string             `db:"description" json:"description"`
	Category    RequirementCategory `db:"category" json:"category"`
	Fulfilled   bool                `db:"fulfilled" json:"fulfilled"`
	FulfilledBy *uuid.UUID          `db:"fulfilled_by" json:"fulfilled_by"`
	FulfilledAt *time.Time          `db:"fulfilled_at" json:"fulfilled_at"`
	CreatedBy   *uuid.UUID          `db:"created_by" json:"created_by"`
	CreatedAt   time.Time           `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time           `db:"updated_at" json:"updated_at"`

	// Joined fields
	LinkedScenarios    int    `db:"linked_scenarios" json:"linked_scenarios"`
	CreatedByUsername   string `db:"-" json:"created_by_username,omitempty"`
	FulfilledByUsername string `db:"-" json:"fulfilled_by_username,omitempty"`
}

type ScenarioRequirementLink struct {
	ID                  uuid.UUID `db:"id" json:"id"`
	ExerciseTechniqueID uuid.UUID `db:"exercise_technique_id" json:"exercise_technique_id"`
	RequirementID       uuid.UUID `db:"requirement_id" json:"requirement_id"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
}

// RequirementAlert represents a scenario with unfulfilled requirements near execution
type RequirementAlert struct {
	ExerciseTechniqueID uuid.UUID `db:"exercise_technique_id" json:"exercise_technique_id"`
	TechniqueName       string    `db:"technique_name" json:"technique_name"`
	MitreID             string    `db:"mitre_id" json:"mitre_id"`
	ScheduledStartTime  time.Time `db:"scheduled_start_time" json:"scheduled_start_time"`
	RequirementID       uuid.UUID `db:"requirement_id" json:"requirement_id"`
	RequirementTitle    string    `db:"requirement_title" json:"requirement_title"`
	RequirementCategory string    `db:"requirement_category" json:"requirement_category"`
}
