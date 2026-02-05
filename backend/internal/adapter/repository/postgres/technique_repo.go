package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type techniqueRepository struct {
	db *sqlx.DB
}

func NewTechniqueRepository(db *sqlx.DB) repository.TechniqueRepository {
	return &techniqueRepository{db: db}
}

func (r *techniqueRepository) Create(ctx context.Context, technique *entity.Technique) error {
	query := `
		INSERT INTO techniques (id, mitre_id, tactic, name, description, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	technique.ID = uuid.New()
	technique.CreatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		technique.ID, technique.MitreID, technique.Tactic, technique.Name,
		technique.Description, technique.CreatedBy, technique.CreatedAt)
	return err
}

func (r *techniqueRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Technique, error) {
	var technique entity.Technique
	query := `SELECT * FROM techniques WHERE id = $1`
	err := r.db.GetContext(ctx, &technique, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &technique, err
}

func (r *techniqueRepository) GetByMitreID(ctx context.Context, mitreID string) (*entity.Technique, error) {
	var technique entity.Technique
	query := `SELECT * FROM techniques WHERE mitre_id = $1`
	err := r.db.GetContext(ctx, &technique, query, mitreID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &technique, err
}

func (r *techniqueRepository) Update(ctx context.Context, technique *entity.Technique) error {
	query := `
		UPDATE techniques SET
			mitre_id = $2, tactic = $3, name = $4, description = $5
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		technique.ID, technique.MitreID, technique.Tactic, technique.Name, technique.Description)
	return err
}

func (r *techniqueRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM techniques WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *techniqueRepository) List(ctx context.Context, filters repository.TechniqueFilters) ([]entity.Technique, int, error) {
	var techniques []entity.Technique
	var total int

	whereClause, args := buildTechniqueWhere(filters)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM techniques %s`, whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	query := fmt.Sprintf(`SELECT * FROM techniques %s ORDER BY tactic, mitre_id, name LIMIT $%d OFFSET $%d`,
		whereClause, len(args)-1, len(args))

	if err := r.db.SelectContext(ctx, &techniques, query, args...); err != nil {
		return nil, 0, err
	}

	return techniques, total, nil
}

func buildTechniqueWhere(filters repository.TechniqueFilters) (string, []interface{}) {
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters.Tactic != nil {
		conditions = append(conditions, fmt.Sprintf("tactic = $%d", argNum))
		args = append(args, *filters.Tactic)
		argNum++
	}

	if filters.Search != nil {
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR mitre_id ILIKE $%d OR description ILIKE $%d)", argNum, argNum, argNum))
		args = append(args, "%"+*filters.Search+"%")
		argNum++
	}

	if len(conditions) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}

func (r *techniqueRepository) BulkUpsert(ctx context.Context, techniques []entity.Technique) (inserted int, updated int, err error) {
	if len(techniques) == 0 {
		return 0, 0, nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	for _, t := range techniques {
		// Check if technique with this mitre_id already exists
		var existing entity.Technique
		err := tx.GetContext(ctx, &existing, `SELECT * FROM techniques WHERE mitre_id = $1`, t.MitreID)

		if errors.Is(err, sql.ErrNoRows) {
			// Insert new technique
			t.ID = uuid.New()
			t.CreatedAt = time.Now()
			_, err = tx.ExecContext(ctx, `
				INSERT INTO techniques (id, mitre_id, tactic, name, description, created_by, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				t.ID, t.MitreID, t.Tactic, t.Name, t.Description, t.CreatedBy, t.CreatedAt)
			if err != nil {
				return 0, 0, err
			}
			inserted++
		} else if err == nil {
			// Update existing technique
			_, err = tx.ExecContext(ctx, `
				UPDATE techniques SET tactic = $2, name = $3, description = $4 WHERE id = $1`,
				existing.ID, t.Tactic, t.Name, t.Description)
			if err != nil {
				return 0, 0, err
			}
			updated++
		} else {
			return 0, 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}

	return inserted, updated, nil
}
