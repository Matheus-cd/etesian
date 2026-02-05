package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type clientRepository struct {
	db *sqlx.DB
}

func NewClientRepository(db *sqlx.DB) repository.ClientRepository {
	return &clientRepository{db: db}
}

func (r *clientRepository) Create(ctx context.Context, client *entity.Client) error {
	query := `
		INSERT INTO clients (id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)`

	client.ID = uuid.New()
	client.CreatedAt = time.Now()
	client.UpdatedAt = client.CreatedAt

	_, err := r.db.ExecContext(ctx, query,
		client.ID, client.Name, client.Description, client.CreatedAt, client.UpdatedAt)
	return err
}

func (r *clientRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Client, error) {
	var client entity.Client
	query := `SELECT * FROM clients WHERE id = $1`
	err := r.db.GetContext(ctx, &client, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &client, err
}

func (r *clientRepository) GetAll(ctx context.Context) ([]entity.Client, error) {
	var clients []entity.Client
	query := `SELECT * FROM clients ORDER BY name ASC`
	err := r.db.SelectContext(ctx, &clients, query)
	return clients, err
}

func (r *clientRepository) Update(ctx context.Context, client *entity.Client) error {
	query := `
		UPDATE clients SET
			name = $2, description = $3, updated_at = $4
		WHERE id = $1`

	client.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, query,
		client.ID, client.Name, client.Description, client.UpdatedAt)
	return err
}

func (r *clientRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM clients WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *clientRepository) HasExercises(ctx context.Context, id uuid.UUID) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM exercises WHERE client_id = $1`
	err := r.db.GetContext(ctx, &count, query, id)
	return count > 0, err
}
