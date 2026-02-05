package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
)

type ClientRepository interface {
	Create(ctx context.Context, client *entity.Client) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Client, error)
	GetAll(ctx context.Context) ([]entity.Client, error)
	Update(ctx context.Context, client *entity.Client) error
	Delete(ctx context.Context, id uuid.UUID) error
	HasExercises(ctx context.Context, id uuid.UUID) (bool, error)
}
