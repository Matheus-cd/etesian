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

type exerciseRepository struct {
	db *sqlx.DB
}

func NewExerciseRepository(db *sqlx.DB) repository.ExerciseRepository {
	return &exerciseRepository{db: db}
}

func (r *exerciseRepository) Create(ctx context.Context, exercise *entity.Exercise) error {
	query := `
		INSERT INTO exercises (id, name, description, client_id, status, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	exercise.ID = uuid.New()
	exercise.CreatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		exercise.ID, exercise.Name, exercise.Description, exercise.ClientID,
		exercise.Status, exercise.CreatedBy, exercise.CreatedAt)
	return err
}

func (r *exerciseRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Exercise, error) {
	var exercise entity.Exercise
	query := `SELECT * FROM exercises WHERE id = $1`
	err := r.db.GetContext(ctx, &exercise, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &exercise, err
}

func (r *exerciseRepository) Update(ctx context.Context, exercise *entity.Exercise) error {
	query := `
		UPDATE exercises SET
			name = $2, description = $3, client_id = $4, status = $5,
			started_at = $6, completed_at = $7
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		exercise.ID, exercise.Name, exercise.Description, exercise.ClientID,
		exercise.Status, exercise.StartedAt, exercise.CompletedAt)
	return err
}

func (r *exerciseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM exercises WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *exerciseRepository) List(ctx context.Context, filters repository.ExerciseFilters) ([]entity.Exercise, int, error) {
	var exercises []entity.Exercise
	var total int

	whereClause, args := buildExerciseWhere(filters)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM exercises %s`, whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	query := fmt.Sprintf(`SELECT * FROM exercises %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, len(args)-1, len(args))

	if err := r.db.SelectContext(ctx, &exercises, query, args...); err != nil {
		return nil, 0, err
	}

	return exercises, total, nil
}

func (r *exerciseRepository) ListForUser(ctx context.Context, userID uuid.UUID, filters repository.ExerciseFilters) ([]entity.Exercise, int, error) {
	var exercises []entity.Exercise
	var total int

	whereClause, args := buildExerciseWhere(filters)
	memberJoin := `INNER JOIN exercise_members em ON e.id = em.exercise_id`

	argNum := len(args) + 1
	if whereClause == "" {
		whereClause = fmt.Sprintf("WHERE em.user_id = $%d", argNum)
	} else {
		whereClause = strings.Replace(whereClause, "WHERE", fmt.Sprintf("WHERE em.user_id = $%d AND", argNum), 1)
	}
	args = append(args, userID)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM exercises e %s %s`, memberJoin, whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	query := fmt.Sprintf(`SELECT e.* FROM exercises e %s %s ORDER BY e.created_at DESC LIMIT $%d OFFSET $%d`,
		memberJoin, whereClause, len(args)-1, len(args))

	if err := r.db.SelectContext(ctx, &exercises, query, args...); err != nil {
		return nil, 0, err
	}

	return exercises, total, nil
}

func (r *exerciseRepository) UserHasAccess(ctx context.Context, userID, exerciseID uuid.UUID) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM exercise_members WHERE user_id = $1 AND exercise_id = $2`
	err := r.db.GetContext(ctx, &count, query, userID, exerciseID)
	return count > 0, err
}

func (r *exerciseRepository) GetUserRoleInExercise(ctx context.Context, userID, exerciseID uuid.UUID) (*entity.ExerciseRoleInExercise, error) {
	var role entity.ExerciseRoleInExercise
	query := `SELECT role_in_exercise FROM exercise_members WHERE user_id = $1 AND exercise_id = $2`
	err := r.db.GetContext(ctx, &role, query, userID, exerciseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &role, err
}

func buildExerciseWhere(filters repository.ExerciseFilters) (string, []interface{}) {
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters.Status != nil {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argNum))
		args = append(args, *filters.Status)
		argNum++
	}

	if filters.ClientID != nil {
		conditions = append(conditions, fmt.Sprintf("client_id = $%d", argNum))
		args = append(args, *filters.ClientID)
		argNum++
	}

	if filters.Search != nil {
		conditions = append(conditions, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", argNum, argNum))
		args = append(args, "%"+*filters.Search+"%")
		argNum++
	}

	if len(conditions) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}

// Exercise Member Repository
type exerciseMemberRepository struct {
	db *sqlx.DB
}

func NewExerciseMemberRepository(db *sqlx.DB) repository.ExerciseMemberRepository {
	return &exerciseMemberRepository{db: db}
}

func (r *exerciseMemberRepository) Add(ctx context.Context, member *entity.ExerciseMember) error {
	query := `
		INSERT INTO exercise_members (id, exercise_id, user_id, role_in_exercise, assigned_by, assigned_at)
		VALUES ($1, $2, $3, $4, $5, $6)`

	member.ID = uuid.New()
	member.AssignedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		member.ID, member.ExerciseID, member.UserID, member.RoleInExercise, member.AssignedBy, member.AssignedAt)
	return err
}

func (r *exerciseMemberRepository) Remove(ctx context.Context, exerciseID, userID uuid.UUID) error {
	query := `DELETE FROM exercise_members WHERE exercise_id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, exerciseID, userID)
	return err
}

func (r *exerciseMemberRepository) GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseMember, error) {
	var members []entity.ExerciseMember
	query := `SELECT * FROM exercise_members WHERE exercise_id = $1 ORDER BY assigned_at`
	err := r.db.SelectContext(ctx, &members, query, exerciseID)
	return members, err
}

func (r *exerciseMemberRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]entity.ExerciseMember, error) {
	var members []entity.ExerciseMember
	query := `SELECT * FROM exercise_members WHERE user_id = $1`
	err := r.db.SelectContext(ctx, &members, query, userID)
	return members, err
}

func (r *exerciseMemberRepository) GetMember(ctx context.Context, exerciseID, userID uuid.UUID) (*entity.ExerciseMember, error) {
	var member entity.ExerciseMember
	query := `SELECT * FROM exercise_members WHERE exercise_id = $1 AND user_id = $2`
	err := r.db.GetContext(ctx, &member, query, exerciseID, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &member, err
}

func (r *exerciseMemberRepository) UpdateRole(ctx context.Context, exerciseID, userID uuid.UUID, role entity.ExerciseRoleInExercise) error {
	query := `UPDATE exercise_members SET role_in_exercise = $3 WHERE exercise_id = $1 AND user_id = $2`
	_, err := r.db.ExecContext(ctx, query, exerciseID, userID, role)
	return err
}

// Exercise Technique Repository
type exerciseTechniqueRepository struct {
	db *sqlx.DB
}

func NewExerciseTechniqueRepository(db *sqlx.DB) repository.ExerciseTechniqueRepository {
	return &exerciseTechniqueRepository{db: db}
}

func (r *exerciseTechniqueRepository) Add(ctx context.Context, et *entity.ExerciseTechnique) error {
	query := `
		INSERT INTO exercise_techniques (id, exercise_id, technique_id, sequence_order, notes, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	et.ID = uuid.New()
	et.CreatedAt = time.Now()
	if et.Status == "" {
		et.Status = entity.TechniqueStatusPending
	}

	_, err := r.db.ExecContext(ctx, query,
		et.ID, et.ExerciseID, et.TechniqueID, et.SequenceOrder, et.Notes, et.Status, et.CreatedAt)
	return err
}

func (r *exerciseTechniqueRepository) Remove(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM exercise_techniques WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *exerciseTechniqueRepository) GetByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseTechnique, error) {
	var ets []entity.ExerciseTechnique
	query := `SELECT * FROM exercise_techniques WHERE exercise_id = $1 ORDER BY sequence_order, created_at`
	err := r.db.SelectContext(ctx, &ets, query, exerciseID)
	return ets, err
}

func (r *exerciseTechniqueRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.ExerciseTechnique, error) {
	var et entity.ExerciseTechnique
	query := `SELECT * FROM exercise_techniques WHERE id = $1`
	err := r.db.GetContext(ctx, &et, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &et, err
}

func (r *exerciseTechniqueRepository) Update(ctx context.Context, et *entity.ExerciseTechnique) error {
	query := `UPDATE exercise_techniques SET
		sequence_order = $2,
		notes = $3,
		scheduled_start_time = $4,
		scheduled_end_time = $5
		WHERE id = $1`
	// Use ToPtr() to get *time.Time values that sqlx can handle properly
	_, err := r.db.ExecContext(ctx, query, et.ID, et.SequenceOrder, et.Notes, et.ScheduledStartTime.ToPtr(), et.ScheduledEndTime.ToPtr())
	return err
}

func (r *exerciseTechniqueRepository) UpdateOrder(ctx context.Context, id uuid.UUID, order int) error {
	query := `UPDATE exercise_techniques SET sequence_order = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, order)
	return err
}

func (r *exerciseTechniqueRepository) UpdateNotes(ctx context.Context, id uuid.UUID, notes string) error {
	query := `UPDATE exercise_techniques SET notes = $2 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, notes)
	return err
}

func (r *exerciseTechniqueRepository) Start(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	now := time.Now()
	query := `UPDATE exercise_techniques SET status = $2, started_at = $3, started_by = $4 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, entity.TechniqueStatusInProgress, now, userID)
	return err
}

func (r *exerciseTechniqueRepository) Pause(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	query := `UPDATE exercise_techniques SET status = $2, paused_at = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, entity.TechniqueStatusPaused, now)
	return err
}

func (r *exerciseTechniqueRepository) Resume(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE exercise_techniques SET status = $2, paused_at = NULL WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, entity.TechniqueStatusInProgress)
	return err
}

func (r *exerciseTechniqueRepository) Complete(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	query := `UPDATE exercise_techniques SET status = $2, completed_at = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, entity.TechniqueStatusCompleted, now)
	return err
}

func (r *exerciseTechniqueRepository) Reopen(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE exercise_techniques SET status = $2, completed_at = NULL WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, entity.TechniqueStatusInProgress)
	return err
}

func (r *exerciseTechniqueRepository) GetByExerciseWithDetails(ctx context.Context, exerciseID uuid.UUID) ([]entity.ExerciseTechnique, error) {
	// First get exercise techniques with technique info
	query := `
		SELECT et.id, et.exercise_id, et.technique_id, et.sequence_order, et.notes,
		       et.status, et.started_at, et.paused_at, et.completed_at, et.started_by,
		       et.scheduled_start_time, et.scheduled_end_time, et.created_at,
		       t.id as "technique.id", t.mitre_id as "technique.mitre_id",
		       t.tactic as "technique.tactic", t.name as "technique.name",
		       u.id as "user.id", u.username as "user.username", u.full_name as "user.full_name"
		FROM exercise_techniques et
		LEFT JOIN techniques t ON et.technique_id = t.id
		LEFT JOIN users u ON et.started_by = u.id
		WHERE et.exercise_id = $1
		ORDER BY et.sequence_order, et.created_at`

	rows, err := r.db.QueryxContext(ctx, query, exerciseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []entity.ExerciseTechnique
	for rows.Next() {
		var et entity.ExerciseTechnique
		var tech entity.Technique
		var userID, userUsername, userFullName sql.NullString

		if err := rows.Scan(
			&et.ID, &et.ExerciseID, &et.TechniqueID, &et.SequenceOrder, &et.Notes,
			&et.Status, &et.StartedAt, &et.PausedAt, &et.CompletedAt, &et.StartedBy,
			&et.ScheduledStartTime, &et.ScheduledEndTime, &et.CreatedAt,
			&tech.ID, &tech.MitreID, &tech.Tactic, &tech.Name,
			&userID, &userUsername, &userFullName,
		); err != nil {
			return nil, err
		}
		et.Technique = &tech

		if userID.Valid {
			uid, _ := uuid.Parse(userID.String)
			et.StartedByUser = &entity.User{
				ID:       uid,
				Username: userUsername.String,
				FullName: userFullName.String,
			}
		}

		results = append(results, et)
	}

	return results, nil
}

func (r *exerciseTechniqueRepository) GetByIDWithDetails(ctx context.Context, id uuid.UUID) (*entity.ExerciseTechnique, error) {
	query := `
		SELECT et.id, et.exercise_id, et.technique_id, et.sequence_order, et.notes,
		       et.status, et.started_at, et.paused_at, et.completed_at, et.started_by,
		       et.scheduled_start_time, et.scheduled_end_time, et.created_at,
		       t.id as "technique.id", t.mitre_id as "technique.mitre_id",
		       t.tactic as "technique.tactic", t.name as "technique.name", t.description as "technique.description"
		FROM exercise_techniques et
		LEFT JOIN techniques t ON et.technique_id = t.id
		WHERE et.id = $1`

	var et entity.ExerciseTechnique
	var tech entity.Technique

	row := r.db.QueryRowxContext(ctx, query, id)
	if err := row.Scan(
		&et.ID, &et.ExerciseID, &et.TechniqueID, &et.SequenceOrder, &et.Notes,
		&et.Status, &et.StartedAt, &et.PausedAt, &et.CompletedAt, &et.StartedBy,
		&et.ScheduledStartTime, &et.ScheduledEndTime, &et.CreatedAt,
		&tech.ID, &tech.MitreID, &tech.Tactic, &tech.Name, &tech.Description,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	et.Technique = &tech

	return &et, nil
}
