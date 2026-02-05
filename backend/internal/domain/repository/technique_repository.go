package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

type TechniqueRepository interface {
	Create(ctx context.Context, technique *entity.Technique) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Technique, error)
	GetByMitreID(ctx context.Context, mitreID string) (*entity.Technique, error)
	Update(ctx context.Context, technique *entity.Technique) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filters TechniqueFilters) ([]entity.Technique, int, error)
	BulkUpsert(ctx context.Context, techniques []entity.Technique) (inserted int, updated int, err error)
}

type TechniqueFilters struct {
	Tactic  *string
	Search  *string
	Limit   int
	Offset  int
}
