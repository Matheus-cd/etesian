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

type executionRepository struct {
	db *sqlx.DB
}

func NewExecutionRepository(db *sqlx.DB) repository.ExecutionRepository {
	return &executionRepository{db: db}
}

func (r *executionRepository) Create(ctx context.Context, execution *entity.Execution) error {
	query := `
		INSERT INTO executions (id, exercise_technique_id, executed_by, executed_at, target_system, command_used, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	execution.ID = uuid.New()
	execution.CreatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		execution.ID, execution.ExerciseTechniqueID, execution.ExecutedBy, execution.ExecutedAt,
		execution.TargetSystem, execution.CommandUsed, execution.Notes, execution.CreatedAt)
	return err
}

func (r *executionRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Execution, error) {
	var execution entity.Execution
	query := `SELECT * FROM executions WHERE id = $1`
	err := r.db.GetContext(ctx, &execution, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &execution, err
}

func (r *executionRepository) GetByExerciseTechnique(ctx context.Context, etID uuid.UUID) (*entity.Execution, error) {
	var execution entity.Execution
	query := `SELECT * FROM executions WHERE exercise_technique_id = $1`
	err := r.db.GetContext(ctx, &execution, query, etID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &execution, err
}

func (r *executionRepository) Update(ctx context.Context, execution *entity.Execution) error {
	query := `
		UPDATE executions SET
			executed_at = $2, target_system = $3, command_used = $4, notes = $5
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		execution.ID, execution.ExecutedAt, execution.TargetSystem, execution.CommandUsed, execution.Notes)
	return err
}

func (r *executionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM executions WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *executionRepository) ListByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.Execution, error) {
	var executions []entity.Execution
	query := `
		SELECT e.* FROM executions e
		INNER JOIN exercise_techniques et ON e.exercise_technique_id = et.id
		WHERE et.exercise_id = $1
		ORDER BY e.executed_at`
	err := r.db.SelectContext(ctx, &executions, query, exerciseID)
	return executions, err
}

func (r *executionRepository) ListByTechnique(ctx context.Context, exerciseTechniqueID uuid.UUID) ([]entity.Execution, error) {
	var executions []entity.Execution
	query := `SELECT * FROM executions WHERE exercise_technique_id = $1 ORDER BY executed_at DESC`
	err := r.db.SelectContext(ctx, &executions, query, exerciseTechniqueID)
	return executions, err
}

// Detection Repository
type detectionRepository struct {
	db *sqlx.DB
}

func NewDetectionRepository(db *sqlx.DB) repository.DetectionRepository {
	return &detectionRepository{db: db}
}

func (r *detectionRepository) Create(ctx context.Context, detection *entity.Detection) error {
	query := `
		INSERT INTO detections (id, execution_id, detected_by,
			tool_detected, tool_name, tool_detected_at, tool_alert_id, tool_notes,
			tool_not_applicable, tool_na_reason, tool_blocked,
			siem_detected, siem_name, siem_detected_at, siem_alert_id, siem_notes,
			siem_not_applicable, siem_na_reason,
			detection_status, analyst_notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`

	detection.ID = uuid.New()
	detection.CreatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		detection.ID, detection.ExecutionID, detection.DetectedBy,
		detection.ToolDetected, detection.ToolName, detection.ToolDetectedAt, detection.ToolAlertID, detection.ToolNotes,
		detection.ToolNotApplicable, detection.ToolNAReason, detection.ToolBlocked,
		detection.SIEMDetected, detection.SIEMName, detection.SIEMDetectedAt, detection.SIEMAlertID, detection.SIEMNotes,
		detection.SIEMNotApplicable, detection.SIEMNAReason,
		detection.DetectionStatus, detection.AnalystNotes, detection.CreatedAt)
	return err
}

func (r *detectionRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Detection, error) {
	var detection entity.Detection
	query := `SELECT * FROM detections WHERE id = $1`
	err := r.db.GetContext(ctx, &detection, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &detection, err
}

func (r *detectionRepository) GetByExecution(ctx context.Context, executionID uuid.UUID) (*entity.Detection, error) {
	var detection entity.Detection
	query := `SELECT * FROM detections WHERE execution_id = $1`
	err := r.db.GetContext(ctx, &detection, query, executionID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &detection, err
}

func (r *detectionRepository) Update(ctx context.Context, detection *entity.Detection) error {
	query := `
		UPDATE detections SET
			tool_detected = $2, tool_name = $3, tool_detected_at = $4, tool_alert_id = $5, tool_notes = $6,
			tool_not_applicable = $7, tool_na_reason = $8, tool_blocked = $9,
			siem_detected = $10, siem_name = $11, siem_detected_at = $12, siem_alert_id = $13, siem_notes = $14,
			siem_not_applicable = $15, siem_na_reason = $16,
			detection_status = $17, analyst_notes = $18
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		detection.ID,
		detection.ToolDetected, detection.ToolName, detection.ToolDetectedAt, detection.ToolAlertID, detection.ToolNotes,
		detection.ToolNotApplicable, detection.ToolNAReason, detection.ToolBlocked,
		detection.SIEMDetected, detection.SIEMName, detection.SIEMDetectedAt, detection.SIEMAlertID, detection.SIEMNotes,
		detection.SIEMNotApplicable, detection.SIEMNAReason,
		detection.DetectionStatus, detection.AnalystNotes)
	return err
}

func (r *detectionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM detections WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *detectionRepository) ListByExercise(ctx context.Context, exerciseID uuid.UUID) ([]entity.Detection, error) {
	var detections []entity.Detection
	query := `
		SELECT d.* FROM detections d
		INNER JOIN executions ex ON d.execution_id = ex.id
		INNER JOIN exercise_techniques et ON ex.exercise_technique_id = et.id
		WHERE et.exercise_id = $1
		ORDER BY d.created_at`
	err := r.db.SelectContext(ctx, &detections, query, exerciseID)
	return detections, err
}

func (r *detectionRepository) ListByExecution(ctx context.Context, executionID uuid.UUID) ([]entity.Detection, error) {
	var detections []entity.Detection
	query := `SELECT * FROM detections WHERE execution_id = $1 ORDER BY created_at`
	err := r.db.SelectContext(ctx, &detections, query, executionID)
	return detections, err
}

// Detection Void Repository
type detectionVoidRepository struct {
	db *sqlx.DB
}

func NewDetectionVoidRepository(db *sqlx.DB) repository.DetectionVoidRepository {
	return &detectionVoidRepository{db: db}
}

func (r *detectionVoidRepository) Create(ctx context.Context, void *entity.DetectionVoid) error {
	query := `INSERT INTO detection_voids (id, detection_id, voided_by, void_reason, voided_at) VALUES ($1, $2, $3, $4, $5)`

	void.ID = uuid.New()
	void.VoidedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query, void.ID, void.DetectionID, void.VoidedBy, void.VoidReason, void.VoidedAt)
	return err
}

func (r *detectionVoidRepository) GetByDetection(ctx context.Context, detectionID uuid.UUID) (*entity.DetectionVoid, error) {
	var void entity.DetectionVoid
	query := `SELECT * FROM detection_voids WHERE detection_id = $1`
	err := r.db.GetContext(ctx, &void, query, detectionID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &void, err
}

// Evidence Repository
type evidenceRepository struct {
	db *sqlx.DB
}

func NewEvidenceRepository(db *sqlx.DB) repository.EvidenceRepository {
	return &evidenceRepository{db: db}
}

func (r *evidenceRepository) Create(ctx context.Context, evidence *entity.Evidence) error {
	query := `
		INSERT INTO evidences (id, entity_type, entity_id, file_name, file_path, file_type, file_size, description, caption, uploaded_by, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	evidence.ID = uuid.New()
	evidence.UploadedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		evidence.ID, evidence.EntityType, evidence.EntityID, evidence.FileName, evidence.FilePath,
		evidence.FileType, evidence.FileSize, evidence.Description, evidence.Caption, evidence.UploadedBy, evidence.UploadedAt)
	return err
}

func (r *evidenceRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Evidence, error) {
	var evidence entity.Evidence
	query := `SELECT * FROM evidences WHERE id = $1`
	err := r.db.GetContext(ctx, &evidence, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &evidence, err
}

func (r *evidenceRepository) GetByEntity(ctx context.Context, entityType entity.EvidenceEntityType, entityID uuid.UUID) ([]entity.Evidence, error) {
	var evidences []entity.Evidence
	query := `SELECT * FROM evidences WHERE entity_type = $1 AND entity_id = $2 ORDER BY uploaded_at`
	err := r.db.SelectContext(ctx, &evidences, query, entityType, entityID)
	return evidences, err
}

func (r *evidenceRepository) UpdateCaption(ctx context.Context, id uuid.UUID, caption string) error {
	query := `UPDATE evidences SET caption = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, caption, id)
	return err
}

func (r *evidenceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM evidences WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Audit Log Repository
type auditLogRepository struct {
	db *sqlx.DB
}

func NewAuditLogRepository(db *sqlx.DB) repository.AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(ctx context.Context, log *entity.AuditLog) error {
	query := `
		INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	log.ID = uuid.New()
	log.CreatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		log.ID, log.UserID, log.Action, log.EntityType, log.EntityID,
		log.OldValue, log.NewValue, log.IPAddress, log.UserAgent, log.CreatedAt)
	return err
}

func (r *auditLogRepository) List(ctx context.Context, filters repository.AuditFilters) ([]entity.AuditLog, int, error) {
	// Simplified - in production add proper filtering
	var logs []entity.AuditLog
	var total int

	countQuery := `SELECT COUNT(*) FROM audit_logs`
	if err := r.db.GetContext(ctx, &total, countQuery); err != nil {
		return nil, 0, err
	}

	query := `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	if err := r.db.SelectContext(ctx, &logs, query, filters.Limit, filters.Offset); err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
