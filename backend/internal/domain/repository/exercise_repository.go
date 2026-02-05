package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

type ExerciseRepository interface {
	Create(ctx context.Context, exercise *entity.Exercise) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Exercise, error)
	Update(ctx context.Context, exercise *entity.Exercise) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filters ExerciseFilters) ([]entity.Exercise, int, error)

	// For users with restricted access (only exercises they are members of)
	ListForUser(ctx context.Context, userID uuid.UUID, filters ExerciseFilters) ([]entity.Exercise, int, error)
	UserHasAccess(ctx context.Context, userID, exerciseID uuid.UUID) (bool, error)
	GetUserRoleInExercise(ctx context.Context, userID, exerciseID uuid.UUID) (*entity.ExerciseRoleInExercise, error)
}

type ExerciseFilters struct {
	Status   *entity.ExerciseStatus
	ClientID *uuid.UUID
	Search   *string
	Limit    int
	Offset   int
}

type ExerciseMemberRepository interface {
	Add(ctx context.Context, member *entity.ExerciseMember) error
	Remove(ctx context.Context, exerciseID, userID uuid.UUID) error
	GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseMember, error)
	GetByUser(ctx context.Context, userID uuid.UUID) ([]entity.ExerciseMember, error)
	GetMember(ctx context.Context, exerciseID, userID uuid.UUID) (*entity.ExerciseMember, error)
	UpdateRole(ctx context.Context, exerciseID, userID uuid.UUID, role entity.ExerciseRoleInExercise) error
}

type ExerciseTechniqueRepository interface {
	Add(ctx context.Context, et *entity.ExerciseTechnique) error
	Remove(ctx context.Context, id uuid.UUID) error
	GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseTechnique, error)
	GetByID(ctx context.Context, id uuid.UUID) (*entity.ExerciseTechnique, error)
	Update(ctx context.Context, et *entity.ExerciseTechnique) error
	UpdateOrder(ctx context.Context, id uuid.UUID, order int) error
	UpdateNotes(ctx context.Context, id uuid.UUID, notes string) error

	// Status management
	Start(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	Pause(ctx context.Context, id uuid.UUID) error
	Resume(ctx context.Context, id uuid.UUID) error
	Complete(ctx context.Context, id uuid.UUID) error
	Reopen(ctx context.Context, id uuid.UUID) error

	// Get with related data (execution, detection)
	GetByExerciseWithDetails(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseTechnique, error)
	GetByIDWithDetails(ctx context.Context, id uuid.UUID) (*entity.ExerciseTechnique, error)
}
