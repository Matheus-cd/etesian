package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
	"github.com/etesian/backend/internal/infrastructure/crypto"
)

type UserHandler struct {
	userRepo repository.UserRepository
}

func NewUserHandler(userRepo repository.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
}

type CreateUserRequest struct {
	Username string          `json:"username"`
	Email    string          `json:"email"`
	Password string          `json:"password"`
	FullName string          `json:"full_name"`
	Role     entity.UserRole `json:"role"`
}

type UpdateUserRequest struct {
	Username string            `json:"username,omitempty"`
	Email    string            `json:"email,omitempty"`
	FullName string            `json:"full_name,omitempty"`
	Role     entity.UserRole   `json:"role,omitempty"`
	Status   entity.UserStatus `json:"status,omitempty"`
}

type UserListResponse struct {
	ID         string            `json:"id"`
	Username   string            `json:"username"`
	Email      string            `json:"email"`
	FullName   string            `json:"full_name"`
	Role       entity.UserRole   `json:"role"`
	Status     entity.UserStatus `json:"status"`
	MFAEnabled bool              `json:"mfa_enabled"`
	CreatedAt  time.Time         `json:"created_at"`
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" || req.FullName == "" {
		response.BadRequest(w, "All fields are required")
		return
	}

	if !req.Role.IsValid() {
		response.BadRequest(w, "Invalid role")
		return
	}

	// Check username exists
	existing, _ := h.userRepo.GetByUsername(r.Context(), req.Username)
	if existing != nil {
		response.Conflict(w, "Username already exists")
		return
	}

	// Check email exists
	existing, _ = h.userRepo.GetByEmail(r.Context(), req.Email)
	if existing != nil {
		response.Conflict(w, "Email already exists")
		return
	}

	passwordHash, err := crypto.HashPassword(req.Password)
	if err != nil {
		response.InternalError(w, "Failed to hash password")
		return
	}

	user := &entity.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: passwordHash,
		FullName:     req.FullName,
		Role:         req.Role,
		Status:       entity.StatusActive,
		MFAEnabled:   false,
	}

	if err := h.userRepo.Create(r.Context(), user); err != nil {
		response.InternalError(w, "Failed to create user")
		return
	}

	response.Created(w, UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     user.Role,
	})
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if user == nil {
		response.NotFound(w, "User not found")
		return
	}

	response.Success(w, UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     user.Role,
	})
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if user == nil {
		response.NotFound(w, "User not found")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Username != "" {
		user.Username = req.Username
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.Role != "" && req.Role.IsValid() {
		user.Role = req.Role
	}
	if req.Status != "" {
		user.Status = req.Status
	}

	if err := h.userRepo.Update(r.Context(), user); err != nil {
		response.InternalError(w, "Failed to update user")
		return
	}

	response.Success(w, UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     user.Role,
	})
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	if err := h.userRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete user")
		return
	}

	response.NoContent(w)
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage

	users, total, err := h.userRepo.List(r.Context(), perPage, offset)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var userResponses []UserListResponse
	for _, u := range users {
		userResponses = append(userResponses, UserListResponse{
			ID:         u.ID.String(),
			Username:   u.Username,
			Email:      u.Email,
			FullName:   u.FullName,
			Role:       u.Role,
			Status:     u.Status,
			MFAEnabled: u.MFAEnabled,
			CreatedAt:  u.CreatedAt,
		})
	}

	response.Paginated(w, userResponses, total, page, perPage)
}

func (h *UserHandler) ResetMFA(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if user == nil {
		response.NotFound(w, "User not found")
		return
	}

	// Reset MFA - set secret to nil and enabled to false
	if err := h.userRepo.UpdateMFASecret(r.Context(), id, nil, false); err != nil {
		response.InternalError(w, "Failed to reset MFA")
		return
	}

	response.Success(w, map[string]string{"message": "MFA reset successfully"})
}
