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

type userRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) repository.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *entity.User) error {
	query := `
		INSERT INTO users (id, username, email, password_hash, full_name, role, status, mfa_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Username, user.Email, user.PasswordHash, user.FullName,
		user.Role, user.Status, user.MFAEnabled, user.CreatedAt, user.UpdatedAt)
	return err
}

func (r *userRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.User, error) {
	var user entity.User
	query := `SELECT * FROM users WHERE id = $1`
	err := r.db.GetContext(ctx, &user, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &user, err
}

func (r *userRepository) GetByUsername(ctx context.Context, username string) (*entity.User, error) {
	var user entity.User
	query := `SELECT * FROM users WHERE username = $1`
	err := r.db.GetContext(ctx, &user, query, username)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &user, err
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*entity.User, error) {
	var user entity.User
	query := `SELECT * FROM users WHERE email = $1`
	err := r.db.GetContext(ctx, &user, query, email)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &user, err
}

func (r *userRepository) Update(ctx context.Context, user *entity.User) error {
	query := `
		UPDATE users SET
			username = $2, email = $3, full_name = $4, role = $5, status = $6, updated_at = $7
		WHERE id = $1`

	user.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Username, user.Email, user.FullName, user.Role, user.Status, user.UpdatedAt)
	return err
}

func (r *userRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *userRepository) List(ctx context.Context, limit, offset int) ([]entity.User, int, error) {
	var users []entity.User
	var total int

	countQuery := `SELECT COUNT(*) FROM users`
	if err := r.db.GetContext(ctx, &total, countQuery); err != nil {
		return nil, 0, err
	}

	query := `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	if err := r.db.SelectContext(ctx, &users, query, limit, offset); err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *userRepository) IncrementFailedAttempts(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *userRepository) ResetFailedAttempts(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *userRepository) LockUser(ctx context.Context, id uuid.UUID, user *entity.User) error {
	query := `UPDATE users SET locked_until = $2, status = 'locked' WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, user.LockedUntil)
	return err
}

func (r *userRepository) UpdateMFASecret(ctx context.Context, id uuid.UUID, secret *string, enabled bool) error {
	query := `UPDATE users SET mfa_secret = $2, mfa_enabled = $3, updated_at = $4 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id, secret, enabled, time.Now())
	return err
}

// Refresh Token Repository
type refreshTokenRepository struct {
	db *sqlx.DB
}

func NewRefreshTokenRepository(db *sqlx.DB) repository.RefreshTokenRepository {
	return &refreshTokenRepository{db: db}
}

func (r *refreshTokenRepository) Create(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt interface{}) error {
	query := `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := r.db.ExecContext(ctx, query, userID, tokenHash, expiresAt)
	return err
}

func (r *refreshTokenRepository) GetByHash(ctx context.Context, tokenHash string) (*repository.RefreshToken, error) {
	var token repository.RefreshToken
	query := `SELECT id, user_id, token_hash, expires_at, created_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`
	err := r.db.GetContext(ctx, &token, query, tokenHash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *refreshTokenRepository) Revoke(ctx context.Context, tokenHash string) error {
	query := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`
	_, err := r.db.ExecContext(ctx, query, tokenHash)
	return err
}

func (r *refreshTokenRepository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *refreshTokenRepository) DeleteExpired(ctx context.Context) error {
	query := `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
	_, err := r.db.ExecContext(ctx, query)
	return err
}
