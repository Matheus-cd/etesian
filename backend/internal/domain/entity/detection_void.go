package entity

import (
	"time"

	"github.com/google/uuid"
)

type DetectionVoid struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	DetectionID uuid.UUID  `db:"detection_id" json:"detection_id"`
	VoidedBy    *uuid.UUID `db:"voided_by" json:"voided_by"`
	VoidReason  string     `db:"void_reason" json:"void_reason"`
	VoidedAt    time.Time  `db:"voided_at" json:"voided_at"`

	// Joined fields
	VoidedByUser *User `db:"-" json:"voided_by_user,omitempty"`
}
