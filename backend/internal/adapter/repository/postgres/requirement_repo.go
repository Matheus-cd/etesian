package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type exerciseRequirementRepository struct {
	db *sqlx.DB
}

func NewExerciseRequirementRepository(db *sqlx.DB) repository.ExerciseRequirementRepository {
	return &exerciseRequirementRepository{db: db}
}

func (r *exerciseRequirementRepository) Create(ctx context.Context, req *entity.ExerciseRequirement) error {
	req.ID = uuid.New()
	req.CreatedAt = time.Now()
	req.UpdatedAt = time.Now()

	query := `
		INSERT INTO exercise_requirements (id, exercise_id, title, description, category, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	_, err := r.db.ExecContext(ctx, query,
		req.ID, req.ExerciseID, req.Title, req.Description, req.Category,
		req.CreatedBy, req.CreatedAt, req.UpdatedAt,
	)
	return err
}

func (r *exerciseRequirementRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.ExerciseRequirement, error) {
	var req entity.ExerciseRequirement
	query := `
		SELECT er.*,
			COALESCE((SELECT COUNT(*) FROM scenario_requirement_links srl WHERE srl.requirement_id = er.id), 0) AS linked_scenarios
		FROM exercise_requirements er
		WHERE er.id = $1`

	err := r.db.GetContext(ctx, &req, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func (r *exerciseRequirementRepository) Update(ctx context.Context, req *entity.ExerciseRequirement) error {
	req.UpdatedAt = time.Now()

	query := `
		UPDATE exercise_requirements
		SET title = $2, description = $3, category = $4, updated_at = $5
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, req.ID, req.Title, req.Description, req.Category, req.UpdatedAt)
	return err
}

func (r *exerciseRequirementRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM exercise_requirements WHERE id = $1`, id)
	return err
}

func (r *exerciseRequirementRepository) GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseRequirement, error) {
	query := `
		SELECT er.*,
			COALESCE((SELECT COUNT(*) FROM scenario_requirement_links srl WHERE srl.requirement_id = er.id), 0) AS linked_scenarios
		FROM exercise_requirements er
		WHERE er.exercise_id = $1
		ORDER BY er.created_at ASC`

	var requirements []entity.ExerciseRequirement
	err := r.db.SelectContext(ctx, &requirements, query, exerciseID)
	if err != nil {
		return nil, err
	}
	return requirements, nil
}

func (r *exerciseRequirementRepository) Fulfill(ctx context.Context, id uuid.UUID, userID uuid.UUID, fulfilled bool) error {
	var query string
	if fulfilled {
		now := time.Now()
		query = `UPDATE exercise_requirements SET fulfilled = TRUE, fulfilled_by = $2, fulfilled_at = $3, updated_at = $3 WHERE id = $1`
		_, err := r.db.ExecContext(ctx, query, id, userID, now)
		return err
	}

	query = `UPDATE exercise_requirements SET fulfilled = FALSE, fulfilled_by = NULL, fulfilled_at = NULL, updated_at = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, time.Now())
	return err
}

func (r *exerciseRequirementRepository) SetScenarioRequirements(ctx context.Context, exerciseTechniqueID uuid.UUID, requirementIDs []uuid.UUID) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing links
	_, err = tx.ExecContext(ctx, `DELETE FROM scenario_requirement_links WHERE exercise_technique_id = $1`, exerciseTechniqueID)
	if err != nil {
		return err
	}

	// Insert new links
	if len(requirementIDs) > 0 {
		valueStrings := make([]string, 0, len(requirementIDs))
		valueArgs := make([]interface{}, 0, len(requirementIDs)*2)

		for i, reqID := range requirementIDs {
			valueStrings = append(valueStrings, fmt.Sprintf("(gen_random_uuid(), $%d, $%d, NOW())", i*2+1, i*2+2))
			valueArgs = append(valueArgs, exerciseTechniqueID, reqID)
		}

		query := fmt.Sprintf(
			`INSERT INTO scenario_requirement_links (id, exercise_technique_id, requirement_id, created_at) VALUES %s`,
			strings.Join(valueStrings, ", "),
		)

		_, err = tx.ExecContext(ctx, query, valueArgs...)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *exerciseRequirementRepository) GetByScenario(ctx context.Context, exerciseTechniqueID uuid.UUID) ([]entity.ExerciseRequirement, error) {
	query := `
		SELECT er.*,
			COALESCE((SELECT COUNT(*) FROM scenario_requirement_links srl2 WHERE srl2.requirement_id = er.id), 0) AS linked_scenarios
		FROM exercise_requirements er
		JOIN scenario_requirement_links srl ON srl.requirement_id = er.id
		WHERE srl.exercise_technique_id = $1
		ORDER BY er.created_at ASC`

	var requirements []entity.ExerciseRequirement
	err := r.db.SelectContext(ctx, &requirements, query, exerciseTechniqueID)
	if err != nil {
		return nil, err
	}
	return requirements, nil
}

func (r *exerciseRequirementRepository) GetUnfulfilledWithSchedule(ctx context.Context, exerciseID uuid.UUID) ([]entity.RequirementAlert, error) {
	query := `
		SELECT et.id AS exercise_technique_id,
			t.name AS technique_name,
			COALESCE(t.mitre_id, '') AS mitre_id,
			et.scheduled_start_time,
			er.id AS requirement_id,
			er.title AS requirement_title,
			er.category AS requirement_category
		FROM exercise_techniques et
		JOIN scenario_requirement_links srl ON srl.exercise_technique_id = et.id
		JOIN exercise_requirements er ON er.id = srl.requirement_id
		JOIN techniques t ON t.id = et.technique_id
		WHERE et.exercise_id = $1
			AND er.fulfilled = FALSE
			AND et.scheduled_start_time IS NOT NULL
			AND et.scheduled_start_time::date <= (CURRENT_DATE + INTERVAL '3 days')
			AND et.scheduled_start_time::date >= CURRENT_DATE
		ORDER BY et.scheduled_start_time ASC, t.name ASC`

	var alerts []entity.RequirementAlert
	err := r.db.SelectContext(ctx, &alerts, query, exerciseID)
	if err != nil {
		return nil, err
	}
	return alerts, nil
}
