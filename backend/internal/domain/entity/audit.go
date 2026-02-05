package entity

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID         uuid.UUID        `db:"id" json:"id"`
	UserID     *uuid.UUID       `db:"user_id" json:"user_id"`
	Action     string           `db:"action" json:"action"`
	EntityType *string          `db:"entity_type" json:"entity_type"`
	EntityID   *uuid.UUID       `db:"entity_id" json:"entity_id"`
	OldValue   *json.RawMessage `db:"old_value" json:"old_value"`
	NewValue   *json.RawMessage `db:"new_value" json:"new_value"`
	IPAddress  *string          `db:"ip_address" json:"ip_address"`
	UserAgent  *string          `db:"user_agent" json:"user_agent"`
	CreatedAt  time.Time        `db:"created_at" json:"created_at"`

	// Joined fields
	User *User `db:"-" json:"user,omitempty"`
}

// Audit actions
const (
	AuditActionUserCreated         = "user.created"
	AuditActionUserUpdated         = "user.updated"
	AuditActionUserDeleted         = "user.deleted"
	AuditActionUserLogin           = "user.login"
	AuditActionUserLoginFailed     = "user.login_failed"
	AuditActionUserLogout          = "user.logout"
	AuditActionUserMFAEnabled      = "user.mfa_enabled"
	AuditActionUserMFADisabled     = "user.mfa_disabled"
	AuditActionTechniqueCreated    = "technique.created"
	AuditActionTechniqueUpdated    = "technique.updated"
	AuditActionTechniqueDeleted    = "technique.deleted"
	AuditActionExerciseCreated     = "exercise.created"
	AuditActionExerciseUpdated     = "exercise.updated"
	AuditActionExerciseDeleted     = "exercise.deleted"
	AuditActionExerciseStarted     = "exercise.started"
	AuditActionExerciseCompleted   = "exercise.completed"
	AuditActionMemberAssigned      = "exercise.member_assigned"
	AuditActionMemberRemoved       = "exercise.member_removed"
	AuditActionExecutionCreated    = "execution.created"
	AuditActionExecutionUpdated    = "execution.updated"
	AuditActionDetectionCreated    = "detection.created"
	AuditActionDetectionUpdated    = "detection.updated"
	AuditActionDetectionVoided     = "detection.voided"
	AuditActionEvidenceUploaded    = "evidence.uploaded"
	AuditActionEvidenceDeleted     = "evidence.deleted"
	AuditActionReportGenerated     = "report.generated"
)
