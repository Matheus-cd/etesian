package entity

import (
	"time"

	"github.com/google/uuid"
)

type EvidenceEntityType string

const (
	EvidenceEntityExecution     EvidenceEntityType = "execution"
	EvidenceEntityDetectionTool EvidenceEntityType = "detection_tool"
	EvidenceEntityDetectionSIEM EvidenceEntityType = "detection_siem"
)

type Evidence struct {
	ID          uuid.UUID          `db:"id" json:"id"`
	EntityType  EvidenceEntityType `db:"entity_type" json:"entity_type"`
	EntityID    uuid.UUID          `db:"entity_id" json:"entity_id"`
	FileName    string             `db:"file_name" json:"file_name"`
	FilePath    string             `db:"file_path" json:"file_path"`
	FileType    *string            `db:"file_type" json:"file_type"`
	FileSize    *int64             `db:"file_size" json:"file_size"`
	Description *string            `db:"description" json:"description"`
	Caption     *string            `db:"caption" json:"caption"`
	UploadedBy  *uuid.UUID         `db:"uploaded_by" json:"uploaded_by"`
	UploadedAt  time.Time          `db:"uploaded_at" json:"uploaded_at"`

	// Joined fields
	UploadedByUser *User `db:"-" json:"uploaded_by_user,omitempty"`
}

func (e EvidenceEntityType) IsValid() bool {
	switch e {
	case EvidenceEntityExecution, EvidenceEntityDetectionTool, EvidenceEntityDetectionSIEM:
		return true
	}
	return false
}
