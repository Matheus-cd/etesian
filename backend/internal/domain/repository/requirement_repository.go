package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

type ExerciseRequirementRepository interface {
	Create(ctx context.Context, req *entity.ExerciseRequirement) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.ExerciseRequirement, error)
	Update(ctx context.Context, req *entity.ExerciseRequirement) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseRequirement, error)
	Fulfill(ctx context.Context, id uuid.UUID, userID uuid.UUID, fulfilled bool) error

	// Scenario links
	SetScenarioRequirements(ctx context.Context, exerciseTechniqueID uuid.UUID, requirementIDs []uuid.UUID) error
	GetByScenario(ctx context.Context, exerciseTechniqueID uuid.UUID) ([]entity.ExerciseRequirement, error)

	// Alerts
	GetUnfulfilledWithSchedule(ctx context.Context, exerciseID uuid.UUID) ([]entity.RequirementAlert, error)
}
