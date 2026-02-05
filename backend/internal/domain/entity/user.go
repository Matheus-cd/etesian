package entity

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleAdmin           UserRole = "admin"
	RolePurpleTeamLead  UserRole = "purple_team_lead"
	RoleRedTeamOperator UserRole = "red_team_operator"
	RoleBlueTeamAnalyst UserRole = "blue_team_analyst"
	RoleViewer          UserRole = "viewer"
)

type UserStatus string

const (
	StatusActive   UserStatus = "active"
	StatusInactive UserStatus = "inactive"
	StatusLocked   UserStatus = "locked"
	StatusPending  UserStatus = "pending"
)

type User struct {
	ID                  uuid.UUID  `db:"id" json:"id"`
	Username            string     `db:"username" json:"username"`
	Email               string     `db:"email" json:"email"`
	PasswordHash        string     `db:"password_hash" json:"-"`
	FullName            string     `db:"full_name" json:"full_name"`
	Role                UserRole   `db:"role" json:"role"`
	Status              UserStatus `db:"status" json:"status"`
	MFAEnabled          bool       `db:"mfa_enabled" json:"mfa_enabled"`
	MFASecret           *string    `db:"mfa_secret" json:"-"`
	FailedLoginAttempts int        `db:"failed_login_attempts" json:"-"`
	LockedUntil         *time.Time `db:"locked_until" json:"-"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
}

func (u *User) IsLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}

func (u *User) CanAccessAllExercises() bool {
	return u.Role == RoleAdmin || u.Role == RolePurpleTeamLead
}

func (r UserRole) IsValid() bool {
	switch r {
	case RoleAdmin, RolePurpleTeamLead, RoleRedTeamOperator, RoleBlueTeamAnalyst, RoleViewer:
		return true
	}
	return false
}
