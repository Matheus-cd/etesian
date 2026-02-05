package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/infrastructure/crypto"
)

type contextKey string

const (
	UserContextKey   contextKey = "user"
	ClaimsContextKey contextKey = "claims"
)

type AuthMiddleware struct {
	jwtManager *crypto.JWTManager
}

func NewAuthMiddleware(jwtManager *crypto.JWTManager) *AuthMiddleware {
	return &AuthMiddleware{jwtManager: jwtManager}
}

// Authenticate validates JWT token and sets user claims in context
func (m *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		claims, err := m.jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			if err == crypto.ErrExpiredToken {
				http.Error(w, "Token expired", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Add claims to context
		ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetClaims extracts claims from context
func GetClaims(ctx context.Context) *crypto.Claims {
	claims, ok := ctx.Value(ClaimsContextKey).(*crypto.Claims)
	if !ok {
		return nil
	}
	return claims
}

// RequireRole middleware checks if user has required role
func RequireRole(roles ...entity.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			hasRole := false
			for _, role := range roles {
				if claims.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, "Forbidden: insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin is shorthand for requiring admin role
func RequireAdmin(next http.Handler) http.Handler {
	return RequireRole(entity.RoleAdmin)(next)
}

// RequireLeadOrAdmin is shorthand for requiring lead or admin role
func RequireLeadOrAdmin(next http.Handler) http.Handler {
	return RequireRole(entity.RoleAdmin, entity.RolePurpleTeamLead)(next)
}

// RequireRedTeamOrLeadOrAdmin is for operations that Red Team operators can also perform
// Used for: reordering techniques, managing executions, etc.
func RequireRedTeamOrLeadOrAdmin(next http.Handler) http.Handler {
	return RequireRole(entity.RoleAdmin, entity.RolePurpleTeamLead, entity.RoleRedTeamOperator)(next)
}

// RequireBlueTeamOrLeadOrAdmin is for operations that Blue Team analysts can also perform
// Used for: managing detections, etc.
func RequireBlueTeamOrLeadOrAdmin(next http.Handler) http.Handler {
	return RequireRole(entity.RoleAdmin, entity.RolePurpleTeamLead, entity.RoleBlueTeamAnalyst)(next)
}
