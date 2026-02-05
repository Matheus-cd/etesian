package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

const ExerciseRoleContextKey contextKey = "exercise_role"

type ExerciseAccessMiddleware struct {
	exerciseRepo repository.ExerciseRepository
}

func NewExerciseAccessMiddleware(exerciseRepo repository.ExerciseRepository) *ExerciseAccessMiddleware {
	return &ExerciseAccessMiddleware{exerciseRepo: exerciseRepo}
}

// RequireExerciseAccess checks if user has access to the exercise
// Admin and Lead roles have access to all exercises
// Other roles only have access to exercises they are members of
func (m *ExerciseAccessMiddleware) RequireExerciseAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := GetClaims(r.Context())
		if claims == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Admin and Lead can access all exercises
		if claims.Role == entity.RoleAdmin || claims.Role == entity.RolePurpleTeamLead {
			next.ServeHTTP(w, r)
			return
		}

		// Get exercise ID from URL
		exerciseIDStr := chi.URLParam(r, "exerciseID")
		if exerciseIDStr == "" {
			http.Error(w, "Exercise ID required", http.StatusBadRequest)
			return
		}

		exerciseID, err := uuid.Parse(exerciseIDStr)
		if err != nil {
			http.Error(w, "Invalid exercise ID", http.StatusBadRequest)
			return
		}

		// Check if user has access
		hasAccess, err := m.exerciseRepo.UserHasAccess(r.Context(), claims.UserID, exerciseID)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if !hasAccess {
			http.Error(w, "Forbidden: no access to this exercise", http.StatusForbidden)
			return
		}

		// Get user's role in exercise and add to context
		role, err := m.exerciseRepo.GetUserRoleInExercise(r.Context(), claims.UserID, exerciseID)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		ctx := context.WithValue(r.Context(), ExerciseRoleContextKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetExerciseRole extracts exercise role from context
func GetExerciseRole(ctx context.Context) *entity.ExerciseRoleInExercise {
	role, ok := ctx.Value(ExerciseRoleContextKey).(*entity.ExerciseRoleInExercise)
	if !ok {
		return nil
	}
	return role
}

// RequireExerciseRole checks if user has specific role in exercise
func RequireExerciseRole(allowedRoles ...entity.ExerciseRoleInExercise) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Admin and Lead always have full access
			if claims.Role == entity.RoleAdmin || claims.Role == entity.RolePurpleTeamLead {
				next.ServeHTTP(w, r)
				return
			}

			role := GetExerciseRole(r.Context())
			if role == nil {
				http.Error(w, "Forbidden: no role in exercise", http.StatusForbidden)
				return
			}

			hasRole := false
			for _, allowedRole := range allowedRoles {
				if *role == allowedRole {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, "Forbidden: insufficient role in exercise", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireCanExecute checks if user can record executions (Red Team or Lead)
func RequireCanExecute(next http.Handler) http.Handler {
	return RequireExerciseRole(entity.RoleInExerciseRedTeam, entity.RoleInExerciseLead)(next)
}

// RequireCanDetect checks if user can record detections (Blue Team or Lead)
func RequireCanDetect(next http.Handler) http.Handler {
	return RequireExerciseRole(entity.RoleInExerciseBlueTeam, entity.RoleInExerciseLead)(next)
}

// RequireCanVoid checks if user can void detections (Red Team or Lead)
func RequireCanVoid(next http.Handler) http.Handler {
	return RequireExerciseRole(entity.RoleInExerciseRedTeam, entity.RoleInExerciseLead)(next)
}
