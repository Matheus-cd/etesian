package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

type ExecutionRepository interface {
	Create(ctx context.Context, execution *entity.Execution) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Execution, error)
	GetByExerciseTechnique(ctx context.Context, etID uuid.UUID) (*entity.Execution, error)
	Update(ctx context.Context, execution *entity.Execution) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.Execution, error)
	ListByTechnique(ctx context.Context, exerciseTechniqueID uuid.UUID) ([]entity.Execution, error)
}

type DetectionRepository interface {
	Create(ctx context.Context, detection *entity.Detection) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Detection, error)
	GetByExecution(ctx context.Context, executionID uuid.UUID) (*entity.Detection, error)
	Update(ctx context.Context, detection *entity.Detection) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.Detection, error)
	ListByExecution(ctx context.Context, executionID uuid.UUID) ([]entity.Detection, error)
}

type DetectionVoidRepository interface {
	Create(ctx context.Context, void *entity.DetectionVoid) error
	GetByDetection(ctx context.Context, detectionID uuid.UUID) (*entity.DetectionVoid, error)
}

type EvidenceRepository interface {
	Create(ctx context.Context, evidence *entity.Evidence) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Evidence, error)
	GetByEntity(ctx context.Context, entityType entity.EvidenceEntityType, entityID uuid.UUID) ([]entity.Evidence, error)
	UpdateCaption(ctx context.Context, id uuid.UUID, caption string) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type AuditLogRepository interface {
	Create(ctx context.Context, log *entity.AuditLog) error
	List(ctx context.Context, filters AuditFilters) ([]entity.AuditLog, int, error)
}

type AuditFilters struct {
	UserID     *uuid.UUID
	Action     *string
	EntityType *string
	EntityID   *uuid.UUID
	FromDate   *string
	ToDate     *string
	Limit      int
	Offset     int
}

type MetricsRepository interface {
	Upsert(ctx context.Context, metrics *entity.ExerciseMetrics) error
	GetByExercise(ctx context.Context, exerciseID uuid.UUID) (*entity.ExerciseMetrics, error)
	CalculateAndStore(ctx context.Context, exerciseID uuid.UUID) (*entity.ExerciseMetrics, error)
}
