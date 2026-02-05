package entity

import (
	"time"

	"github.com/google/uuid"
)

type Technique struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	MitreID     *string    `db:"mitre_id" json:"mitre_id"`
	Tactic      *string    `db:"tactic" json:"tactic"`
	Name        string     `db:"name" json:"name"`
	Description *string    `db:"description" json:"description"`
	CreatedBy   *uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// MITRE ATT&CK Tactics
var MITRETactics = []string{
	"Reconnaissance",
	"Resource Development",
	"Initial Access",
	"Execution",
	"Persistence",
	"Privilege Escalation",
	"Defense Evasion",
	"Credential Access",
	"Discovery",
	"Lateral Movement",
	"Collection",
	"Command and Control",
	"Exfiltration",
	"Impact",
}

func IsValidTactic(tactic string) bool {
	for _, t := range MITRETactics {
		if t == tactic {
			return true
		}
	}
	return false
}
