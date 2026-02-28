package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
	"github.com/etesian/backend/internal/domain/service"
)

type ExerciseHandler struct {
	exerciseRepo          repository.ExerciseRepository
	memberRepo            repository.ExerciseMemberRepository
	techniqueRepo         repository.ExerciseTechniqueRepository
	userRepo              repository.UserRepository
	clientRepo            repository.ClientRepository
	requirementRepo       repository.ExerciseRequirementRepository
	detectionStatsService *service.DetectionStatsService
}

func NewExerciseHandler(
	exerciseRepo repository.ExerciseRepository,
	memberRepo repository.ExerciseMemberRepository,
	techniqueRepo repository.ExerciseTechniqueRepository,
	userRepo repository.UserRepository,
	clientRepo repository.ClientRepository,
	requirementRepo repository.ExerciseRequirementRepository,
	detectionStatsService *service.DetectionStatsService,
) *ExerciseHandler {
	return &ExerciseHandler{
		exerciseRepo:          exerciseRepo,
		memberRepo:            memberRepo,
		techniqueRepo:         techniqueRepo,
		userRepo:              userRepo,
		clientRepo:            clientRepo,
		requirementRepo:       requirementRepo,
		detectionStatsService: detectionStatsService,
	}
}

type ExerciseRequest struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	ClientID       *string `json:"client_id"`
	ScheduledStart *string `json:"scheduled_start"` // Format: "2006-01-02"
	ScheduledEnd   *string `json:"scheduled_end"`   // Format: "2006-01-02"
}

type ExerciseResponse struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Description    *string         `json:"description"`
	ClientID       *string         `json:"client_id"`
	Client         *ClientResponse `json:"client,omitempty"`
	Status         string          `json:"status"`
	StartedAt      *string         `json:"started_at"`
	CompletedAt    *string         `json:"completed_at"`
	ScheduledStart *string         `json:"scheduled_start"`
	ScheduledEnd   *string         `json:"scheduled_end"`
	CreatedAt      string          `json:"created_at"`
}

func (h *ExerciseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req ExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name == "" {
		response.BadRequest(w, "Name is required")
		return
	}

	// Client is required
	if req.ClientID == nil || *req.ClientID == "" {
		response.BadRequest(w, "Client is required")
		return
	}

	clientID, err := uuid.Parse(*req.ClientID)
	if err != nil {
		response.BadRequest(w, "Invalid client ID")
		return
	}

	// Verify client exists
	client, err := h.clientRepo.GetByID(r.Context(), clientID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if client == nil {
		response.BadRequest(w, "Client not found")
		return
	}

	claims := middleware.GetClaims(r.Context())
	exercise := &entity.Exercise{
		Name:     req.Name,
		Status:   entity.ExerciseStatusDraft,
		ClientID: &clientID,
	}

	if req.Description != "" {
		exercise.Description = &req.Description
	}
	if claims != nil {
		exercise.CreatedBy = &claims.UserID
	}

	// Parse scheduled dates
	if req.ScheduledStart != nil && *req.ScheduledStart != "" {
		t, err := time.Parse("2006-01-02", *req.ScheduledStart)
		if err != nil {
			response.BadRequest(w, "Invalid scheduled_start format. Use YYYY-MM-DD")
			return
		}
		exercise.ScheduledStart = &t
	}
	if req.ScheduledEnd != nil && *req.ScheduledEnd != "" {
		t, err := time.Parse("2006-01-02", *req.ScheduledEnd)
		if err != nil {
			response.BadRequest(w, "Invalid scheduled_end format. Use YYYY-MM-DD")
			return
		}
		exercise.ScheduledEnd = &t
	}

	// Validate scheduled dates
	if exercise.ScheduledStart != nil && exercise.ScheduledEnd != nil {
		if exercise.ScheduledEnd.Before(*exercise.ScheduledStart) {
			response.BadRequest(w, "scheduled_end must be after scheduled_start")
			return
		}
	}

	if err := h.exerciseRepo.Create(r.Context(), exercise); err != nil {
		response.InternalError(w, "Failed to create exercise")
		return
	}

	// Populate client info
	h.populateClient(r.Context(), exercise)

	response.Created(w, toExerciseResponse(exercise))
}

func (h *ExerciseHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	exercise, err := h.exerciseRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	// Populate client info
	h.populateClient(r.Context(), exercise)

	response.Success(w, toExerciseResponse(exercise))
}

func (h *ExerciseHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	exercise, err := h.exerciseRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	var req ExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name != "" {
		exercise.Name = req.Name
	}
	if req.Description != "" {
		exercise.Description = &req.Description
	}
	if req.ClientID != nil {
		if *req.ClientID == "" {
			exercise.ClientID = nil
		} else {
			clientID, err := uuid.Parse(*req.ClientID)
			if err != nil {
				response.BadRequest(w, "Invalid client ID")
				return
			}
			exercise.ClientID = &clientID
		}
	}

	// Parse scheduled dates
	if req.ScheduledStart != nil {
		if *req.ScheduledStart == "" {
			exercise.ScheduledStart = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.ScheduledStart)
			if err != nil {
				response.BadRequest(w, "Invalid scheduled_start format. Use YYYY-MM-DD")
				return
			}
			exercise.ScheduledStart = &t
		}
	}
	if req.ScheduledEnd != nil {
		if *req.ScheduledEnd == "" {
			exercise.ScheduledEnd = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.ScheduledEnd)
			if err != nil {
				response.BadRequest(w, "Invalid scheduled_end format. Use YYYY-MM-DD")
				return
			}
			exercise.ScheduledEnd = &t
		}
	}

	// Validate scheduled dates
	if exercise.ScheduledStart != nil && exercise.ScheduledEnd != nil {
		if exercise.ScheduledEnd.Before(*exercise.ScheduledStart) {
			response.BadRequest(w, "scheduled_end must be after scheduled_start")
			return
		}
	}

	if err := h.exerciseRepo.Update(r.Context(), exercise); err != nil {
		response.InternalError(w, "Failed to update exercise")
		return
	}

	// Populate client info
	h.populateClient(r.Context(), exercise)

	response.Success(w, toExerciseResponse(exercise))
}

func (h *ExerciseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	if err := h.exerciseRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete exercise")
		return
	}

	response.NoContent(w)
}

func (h *ExerciseHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		response.Unauthorized(w, "Not authenticated")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	filters := repository.ExerciseFilters{
		Limit:  perPage,
		Offset: (page - 1) * perPage,
	}

	if status := r.URL.Query().Get("status"); status != "" {
		s := entity.ExerciseStatus(status)
		filters.Status = &s
	}
	if clientID := r.URL.Query().Get("client_id"); clientID != "" {
		cid, err := uuid.Parse(clientID)
		if err == nil {
			filters.ClientID = &cid
		}
	}
	if search := r.URL.Query().Get("search"); search != "" {
		filters.Search = &search
	}

	var exercises []entity.Exercise
	var total int
	var err error

	// Admin and Lead see all exercises
	if claims.Role == entity.RoleAdmin || claims.Role == entity.RolePurpleTeamLead {
		exercises, total, err = h.exerciseRepo.List(r.Context(), filters)
	} else {
		// Others only see exercises they are members of
		exercises, total, err = h.exerciseRepo.ListForUser(r.Context(), claims.UserID, filters)
	}

	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var exerciseResponses []ExerciseResponse
	for i := range exercises {
		h.populateClient(r.Context(), &exercises[i])
		exerciseResponses = append(exerciseResponses, toExerciseResponse(&exercises[i]))
	}

	response.Paginated(w, exerciseResponses, total, page, perPage)
}

func (h *ExerciseHandler) Start(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	exercise, err := h.exerciseRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	if exercise.Status != entity.ExerciseStatusDraft {
		response.BadRequest(w, "Exercise can only be started from draft status")
		return
	}

	now := time.Now()
	exercise.Status = entity.ExerciseStatusActive
	exercise.StartedAt = &now

	if err := h.exerciseRepo.Update(r.Context(), exercise); err != nil {
		response.InternalError(w, "Failed to start exercise")
		return
	}

	response.Success(w, toExerciseResponse(exercise))
}

func (h *ExerciseHandler) Complete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	exercise, err := h.exerciseRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	if exercise.Status != entity.ExerciseStatusActive {
		response.BadRequest(w, "Exercise can only be completed from active status")
		return
	}

	now := time.Now()
	exercise.Status = entity.ExerciseStatusCompleted
	exercise.CompletedAt = &now

	if err := h.exerciseRepo.Update(r.Context(), exercise); err != nil {
		response.InternalError(w, "Failed to complete exercise")
		return
	}

	response.Success(w, toExerciseResponse(exercise))
}

func (h *ExerciseHandler) Reopen(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "exerciseID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	exercise, err := h.exerciseRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	if exercise.Status != entity.ExerciseStatusCompleted {
		response.BadRequest(w, "Only completed exercises can be reopened")
		return
	}

	exercise.Status = entity.ExerciseStatusActive
	exercise.CompletedAt = nil

	if err := h.exerciseRepo.Update(r.Context(), exercise); err != nil {
		response.InternalError(w, "Failed to reopen exercise")
		return
	}

	response.Success(w, toExerciseResponse(exercise))
}

// Member management
type AddMemberRequest struct {
	UserID         string `json:"user_id"`
	RoleInExercise string `json:"role_in_exercise"`
}

func (h *ExerciseHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	var req AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	role := entity.ExerciseRoleInExercise(req.RoleInExercise)
	if !role.IsValid() {
		response.BadRequest(w, "Invalid role")
		return
	}

	// Check user exists
	user, _ := h.userRepo.GetByID(r.Context(), userID)
	if user == nil {
		response.NotFound(w, "User not found")
		return
	}

	claims := middleware.GetClaims(r.Context())
	member := &entity.ExerciseMember{
		ExerciseID:     exerciseID,
		UserID:         userID,
		RoleInExercise: role,
	}
	if claims != nil {
		member.AssignedBy = &claims.UserID
	}

	if err := h.memberRepo.Add(r.Context(), member); err != nil {
		response.InternalError(w, "Failed to add member")
		return
	}

	response.Created(w, map[string]interface{}{
		"id":               member.ID.String(),
		"exercise_id":      member.ExerciseID.String(),
		"user_id":          member.UserID.String(),
		"role_in_exercise": member.RoleInExercise,
		"assigned_at":      member.AssignedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *ExerciseHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	userIDStr := chi.URLParam(r, "userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	if err := h.memberRepo.Remove(r.Context(), exerciseID, userID); err != nil {
		response.InternalError(w, "Failed to remove member")
		return
	}

	response.NoContent(w)
}

func (h *ExerciseHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	members, err := h.memberRepo.GetByExercise(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	// Enrich with user info
	var memberResponses []map[string]interface{}
	for _, m := range members {
		user, _ := h.userRepo.GetByID(r.Context(), m.UserID)
		memberResponse := map[string]interface{}{
			"id":               m.ID.String(),
			"user_id":          m.UserID.String(),
			"role_in_exercise": m.RoleInExercise,
			"assigned_at":      m.AssignedAt.Format("2006-01-02T15:04:05Z"),
		}
		if user != nil {
			memberResponse["user"] = UserResponse{
				ID:       user.ID.String(),
				Username: user.Username,
				Email:    user.Email,
				FullName: user.FullName,
				Role:     user.Role,
			}
		}
		memberResponses = append(memberResponses, memberResponse)
	}

	response.Success(w, memberResponses)
}

// Technique management
type AddTechniqueRequest struct {
	TechniqueID string `json:"technique_id"`
	Order       int    `json:"order"`
	Notes       string `json:"notes"`
}

func (h *ExerciseHandler) AddTechnique(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	var req AddTechniqueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	techniqueID, err := uuid.Parse(req.TechniqueID)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et := &entity.ExerciseTechnique{
		ExerciseID:  exerciseID,
		TechniqueID: techniqueID,
	}

	if req.Order > 0 {
		et.SequenceOrder = &req.Order
	}
	if req.Notes != "" {
		et.Notes = &req.Notes
	}

	if err := h.techniqueRepo.Add(r.Context(), et); err != nil {
		response.InternalError(w, "Failed to add technique")
		return
	}

	response.Created(w, map[string]interface{}{
		"id":           et.ID.String(),
		"exercise_id":  et.ExerciseID.String(),
		"technique_id": et.TechniqueID.String(),
		"order":        et.SequenceOrder,
		"notes":        et.Notes,
	})
}

func (h *ExerciseHandler) RemoveTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	if err := h.techniqueRepo.Remove(r.Context(), techniqueID); err != nil {
		response.InternalError(w, "Failed to remove technique")
		return
	}

	response.NoContent(w)
}

type UpdateExerciseTechniqueRequest struct {
	Order *int    `json:"order"`
	Notes *string `json:"notes"`
}

type ScheduleTechniqueRequest struct {
	ScheduledStartTime *string `json:"scheduled_start_time"` // Format: "2006-01-02T15:04"
	ScheduledEndTime   *string `json:"scheduled_end_time"`   // Format: "2006-01-02T15:04"
}

func (h *ExerciseHandler) UpdateExerciseTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	var req UpdateExerciseTechniqueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Order != nil {
		et.SequenceOrder = req.Order
	}
	if req.Notes != nil {
		et.Notes = req.Notes
	}

	if err := h.techniqueRepo.Update(r.Context(), et); err != nil {
		response.InternalError(w, "Failed to update exercise technique")
		return
	}

	response.Success(w, map[string]interface{}{
		"id":           et.ID.String(),
		"exercise_id":  et.ExerciseID.String(),
		"technique_id": et.TechniqueID.String(),
		"order":        et.SequenceOrder,
		"notes":        et.Notes,
	})
}

func (h *ExerciseHandler) ScheduleTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	var req ScheduleTechniqueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	// Debug: log received request
	fmt.Printf("[ScheduleTechnique] Request received: start=%v, end=%v\n", req.ScheduledStartTime, req.ScheduledEndTime)

	// Parse scheduled times
	if req.ScheduledStartTime != nil {
		if *req.ScheduledStartTime == "" {
			et.ScheduledStartTime = entity.LocalTime{Valid: false}
		} else {
			t, err := time.Parse("2006-01-02T15:04", *req.ScheduledStartTime)
			if err != nil {
				response.BadRequest(w, "Invalid scheduled_start_time format. Use YYYY-MM-DDTHH:mm")
				return
			}
			et.ScheduledStartTime = entity.NewLocalTime(t)
		}
	}
	if req.ScheduledEndTime != nil {
		if *req.ScheduledEndTime == "" {
			et.ScheduledEndTime = entity.LocalTime{Valid: false}
		} else {
			t, err := time.Parse("2006-01-02T15:04", *req.ScheduledEndTime)
			if err != nil {
				response.BadRequest(w, "Invalid scheduled_end_time format. Use YYYY-MM-DDTHH:mm")
				return
			}
			et.ScheduledEndTime = entity.NewLocalTime(t)
		}
	}

	// Debug: log parsed values
	fmt.Printf("[ScheduleTechnique] Parsed values: start=%v (valid=%v), end=%v (valid=%v)\n",
		et.ScheduledStartTime.Time, et.ScheduledStartTime.Valid,
		et.ScheduledEndTime.Time, et.ScheduledEndTime.Valid)

	// Validate scheduled times
	if et.ScheduledStartTime.Valid && et.ScheduledEndTime.Valid {
		if et.ScheduledEndTime.Time.Before(et.ScheduledStartTime.Time) {
			response.BadRequest(w, "scheduled_end_time must be after scheduled_start_time")
			return
		}
	}

	if err := h.techniqueRepo.Update(r.Context(), et); err != nil {
		fmt.Printf("[ScheduleTechnique] Update error: %v\n", err)
		response.InternalError(w, "Failed to schedule technique")
		return
	}
	fmt.Printf("[ScheduleTechnique] Update successful\n")

	// Return updated technique with details
	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) ListTechniques(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	techniques, err := h.techniqueRepo.GetByExerciseWithDetails(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, techniques)
}

type ReorderTechniquesRequest struct {
	TechniqueIDs []string `json:"technique_ids"`
}

func (h *ExerciseHandler) ReorderTechniques(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	var req ReorderTechniquesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if len(req.TechniqueIDs) == 0 {
		response.BadRequest(w, "technique_ids is required")
		return
	}

	// Update each technique's order based on its position in the array
	for i, idStr := range req.TechniqueIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			response.BadRequest(w, "Invalid technique ID: "+idStr)
			return
		}

		order := i + 1
		if err := h.techniqueRepo.UpdateOrder(r.Context(), id, order); err != nil {
			response.InternalError(w, "Failed to update technique order")
			return
		}
	}

	// Return updated list
	techniques, err := h.techniqueRepo.GetByExerciseWithDetails(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, techniques)
}

// Technique status management
func (h *ExerciseHandler) StartTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	if et.Status != entity.TechniqueStatusPending {
		response.BadRequest(w, "Technique can only be started from pending status")
		return
	}

	claims := middleware.GetClaims(r.Context())
	if err := h.techniqueRepo.Start(r.Context(), techniqueID, claims.UserID); err != nil {
		response.InternalError(w, "Failed to start technique")
		return
	}

	// Return updated technique with details
	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) PauseTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	if et.Status != entity.TechniqueStatusInProgress {
		response.BadRequest(w, "Technique can only be paused from in_progress status")
		return
	}

	if err := h.techniqueRepo.Pause(r.Context(), techniqueID); err != nil {
		response.InternalError(w, "Failed to pause technique")
		return
	}

	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) ResumeTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	if et.Status != entity.TechniqueStatusPaused {
		response.BadRequest(w, "Technique can only be resumed from paused status")
		return
	}

	if err := h.techniqueRepo.Resume(r.Context(), techniqueID); err != nil {
		response.InternalError(w, "Failed to resume technique")
		return
	}

	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) CompleteTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	if et.Status != entity.TechniqueStatusInProgress && et.Status != entity.TechniqueStatusPaused {
		response.BadRequest(w, "Technique can only be completed from in_progress or paused status")
		return
	}

	if err := h.techniqueRepo.Complete(r.Context(), techniqueID); err != nil {
		response.InternalError(w, "Failed to complete technique")
		return
	}

	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) ReopenTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByID(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	if et.Status != entity.TechniqueStatusCompleted {
		response.BadRequest(w, "Technique can only be reopened from completed status")
		return
	}

	if err := h.techniqueRepo.Reopen(r.Context(), techniqueID); err != nil {
		response.InternalError(w, "Failed to reopen technique")
		return
	}

	updated, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	response.Success(w, updated)
}

func (h *ExerciseHandler) GetTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	et, err := h.techniqueRepo.GetByIDWithDetails(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if et == nil {
		response.NotFound(w, "Exercise technique not found")
		return
	}

	response.Success(w, et)
}

func toExerciseResponse(e *entity.Exercise) ExerciseResponse {
	resp := ExerciseResponse{
		ID:          e.ID.String(),
		Name:        e.Name,
		Description: e.Description,
		Status:      string(e.Status),
		CreatedAt:   e.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	if e.ClientID != nil {
		cid := e.ClientID.String()
		resp.ClientID = &cid
	}

	if e.Client != nil {
		resp.Client = &ClientResponse{
			ID:          e.Client.ID.String(),
			Name:        e.Client.Name,
			Description: e.Client.Description,
			CreatedAt:   e.Client.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt:   e.Client.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	if e.StartedAt != nil {
		s := e.StartedAt.Format("2006-01-02T15:04:05Z")
		resp.StartedAt = &s
	}
	if e.CompletedAt != nil {
		c := e.CompletedAt.Format("2006-01-02T15:04:05Z")
		resp.CompletedAt = &c
	}
	if e.ScheduledStart != nil {
		s := e.ScheduledStart.Format("2006-01-02")
		resp.ScheduledStart = &s
	}
	if e.ScheduledEnd != nil {
		s := e.ScheduledEnd.Format("2006-01-02")
		resp.ScheduledEnd = &s
	}

	return resp
}

func (h *ExerciseHandler) populateClient(ctx context.Context, exercise *entity.Exercise) {
	if exercise.ClientID == nil {
		return
	}
	client, _ := h.clientRepo.GetByID(ctx, *exercise.ClientID)
	if client != nil {
		exercise.Client = client
	}
}

// DetectionStatsResponse is the response for the detection stats endpoint
type DetectionStatsResponse struct {
	// Total counts
	TotalTechniques    int `json:"total_techniques"`
	TotalWithExecution int `json:"total_with_execution"`
	TotalWithDetection int `json:"total_with_detection"`

	// Tool detection stats
	ToolDetected      int     `json:"tool_detected"`
	ToolNotDetected   int     `json:"tool_not_detected"`
	ToolNotApplicable int     `json:"tool_not_applicable"`
	ToolBlocked       int     `json:"tool_blocked"`
	ToolRate          float64 `json:"tool_rate"`

	// SIEM detection stats
	SIEMDetected      int     `json:"siem_detected"`
	SIEMNotDetected   int     `json:"siem_not_detected"`
	SIEMNotApplicable int     `json:"siem_not_applicable"`
	SIEMRate          float64 `json:"siem_rate"`

	// Final status (combined)
	FinalDetected      int `json:"final_detected"`
	FinalBlocked       int `json:"final_blocked"`
	FinalPartial       int `json:"final_partial"`
	FinalNotDetected   int `json:"final_not_detected"`
	FinalNotApplicable int `json:"final_not_applicable"`
	FinalPending       int `json:"final_pending"`
	FinalNotExecuted   int `json:"final_not_executed"`

	// Tactic stats
	TacticStats []TacticStatResponse `json:"tactic_stats"`
}

// TacticStatResponse is the detection stats for a single tactic
type TacticStatResponse struct {
	Tactic        string  `json:"tactic"`
	Total         int     `json:"total"`
	Detected      int     `json:"detected"`
	Blocked       int     `json:"blocked"`
	Partial       int     `json:"partial"`
	NotDetected   int     `json:"not_detected"`
	NotApplicable int     `json:"not_applicable"`
	Pending       int     `json:"pending"`
	NotExecuted   int     `json:"not_executed"`
	SIEMRate      float64 `json:"siem_rate"`
}

// GetDetectionStats returns the unified detection statistics for an exercise
// This endpoint uses the same calculation service as the reports to ensure consistency
func (h *ExerciseHandler) GetDetectionStats(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	// Get techniques with details
	techniques, err := h.techniqueRepo.GetByExerciseWithDetails(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	// Collect detection results using the unified service
	var detectionResults []*service.TechniqueDetectionResult

	for _, et := range techniques {
		tacticName := "Unknown"
		if et.Technique != nil && et.Technique.Tactic != nil {
			tacticName = *et.Technique.Tactic
		}

		// Use the unified service to calculate detection result for this technique
		detResult, _ := h.detectionStatsService.CalculateForTechnique(
			r.Context(),
			et.ID,
			et.TechniqueID,
			tacticName,
			false, // Don't use exerciseIsCompleted - only count actual executions
			et.Status,
			nil,
			nil,
		)
		detectionResults = append(detectionResults, detResult)
	}

	// Calculate aggregated stats using the unified service
	stats := h.detectionStatsService.CalculateStats(detectionResults)

	// Calculate tactic stats using the unified service
	tacticStatsMap := h.detectionStatsService.CalculateTacticStats(detectionResults)

	// Convert tactic stats to response format
	var tacticStats []TacticStatResponse
	for _, stat := range tacticStatsMap {
		tacticStats = append(tacticStats, TacticStatResponse{
			Tactic:        stat.Tactic,
			Total:         stat.Total,
			Detected:      stat.Detected,
			Blocked:       stat.Blocked,
			Partial:       stat.Partial,
			NotDetected:   stat.NotDetected,
			NotApplicable: stat.NotApplicable,
			Pending:       stat.Pending,
			NotExecuted:   stat.NotExecuted,
			SIEMRate:      stat.SIEMRate,
		})
	}

	resp := DetectionStatsResponse{
		TotalTechniques:    stats.TotalTechniques,
		TotalWithExecution: stats.TotalWithExecution,
		TotalWithDetection: stats.TotalWithDetection,
		ToolDetected:       stats.ToolDetected,
		ToolNotDetected:    stats.ToolNotDetected,
		ToolNotApplicable:  stats.ToolNotApplicable,
		ToolBlocked:        stats.ToolBlocked,
		ToolRate:           stats.ToolRate,
		SIEMDetected:       stats.SIEMDetected,
		SIEMNotDetected:    stats.SIEMNotDetected,
		SIEMNotApplicable:  stats.SIEMNotApplicable,
		SIEMRate:           stats.SIEMRate,
		FinalDetected:      stats.FinalDetected,
		FinalBlocked:       stats.FinalBlocked,
		FinalPartial:       stats.FinalPartial,
		FinalNotDetected:   stats.FinalNotDetected,
		FinalNotApplicable: stats.FinalNotApplicable,
		FinalPending:       stats.FinalPending,
		FinalNotExecuted:   stats.FinalNotExecuted,
		TacticStats:        tacticStats,
	}

	response.Success(w, resp)
}

// Unified exercise state endpoint - replaces multiple polling requests with a single one

type TechniqueDetectionState struct {
	HasExecution    bool              `json:"has_execution"`
	LatestDetection *entity.Detection `json:"latest_detection,omitempty"`
}

type ExerciseStateResponse struct {
	Techniques            interface{}                          `json:"techniques"`
	TechniqueDetections   map[string]*TechniqueDetectionState  `json:"technique_detections"`
	TechniqueRequirements map[string][]RequirementResponse     `json:"technique_requirements"`
	DetectionStats        DetectionStatsResponse               `json:"detection_stats"`
	Requirements          []RequirementResponse                `json:"requirements"`
	RequirementAlerts     RequirementAlertsResponse            `json:"requirement_alerts"`
}

func (h *ExerciseHandler) GetExerciseState(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	ctx := r.Context()

	// 1. Get techniques with details
	techniques, err := h.techniqueRepo.GetByExerciseWithDetails(ctx, exerciseID)
	if err != nil {
		response.InternalError(w, "Failed to load techniques")
		return
	}

	// 2. Per-technique: detection state + scenario requirements
	techniqueDetections := make(map[string]*TechniqueDetectionState)
	techniqueRequirements := make(map[string][]RequirementResponse)
	var detectionResults []*service.TechniqueDetectionResult

	for _, et := range techniques {
		etIDStr := et.ID.String()

		// Detection
		tacticName := "Unknown"
		if et.Technique != nil && et.Technique.Tactic != nil {
			tacticName = *et.Technique.Tactic
		}

		detResult, _ := h.detectionStatsService.CalculateForTechnique(
			ctx, et.ID, et.TechniqueID, tacticName,
			false, et.Status, nil, nil,
		)
		detectionResults = append(detectionResults, detResult)

		techniqueDetections[etIDStr] = &TechniqueDetectionState{
			HasExecution:    detResult.HasExecution,
			LatestDetection: detResult.LatestDetection,
		}

		// Scenario requirements
		reqs, err := h.requirementRepo.GetByScenario(ctx, et.ID)
		if err == nil {
			reqResps := make([]RequirementResponse, 0, len(reqs))
			for i := range reqs {
				reqResps = append(reqResps, h.reqToResponse(ctx, &reqs[i]))
			}
			techniqueRequirements[etIDStr] = reqResps
		} else {
			techniqueRequirements[etIDStr] = []RequirementResponse{}
		}
	}

	// 3. Aggregated detection stats
	stats := h.detectionStatsService.CalculateStats(detectionResults)
	tacticStatsMap := h.detectionStatsService.CalculateTacticStats(detectionResults)

	var tacticStatsResp []TacticStatResponse
	for _, stat := range tacticStatsMap {
		tacticStatsResp = append(tacticStatsResp, TacticStatResponse{
			Tactic:        stat.Tactic,
			Total:         stat.Total,
			Detected:      stat.Detected,
			Blocked:       stat.Blocked,
			Partial:       stat.Partial,
			NotDetected:   stat.NotDetected,
			NotApplicable: stat.NotApplicable,
			Pending:       stat.Pending,
			NotExecuted:   stat.NotExecuted,
			SIEMRate:      stat.SIEMRate,
		})
	}

	detectionStatsResp := DetectionStatsResponse{
		TotalTechniques:    stats.TotalTechniques,
		TotalWithExecution: stats.TotalWithExecution,
		TotalWithDetection: stats.TotalWithDetection,
		ToolDetected:       stats.ToolDetected,
		ToolNotDetected:    stats.ToolNotDetected,
		ToolNotApplicable:  stats.ToolNotApplicable,
		ToolBlocked:        stats.ToolBlocked,
		ToolRate:           stats.ToolRate,
		SIEMDetected:       stats.SIEMDetected,
		SIEMNotDetected:    stats.SIEMNotDetected,
		SIEMNotApplicable:  stats.SIEMNotApplicable,
		SIEMRate:           stats.SIEMRate,
		FinalDetected:      stats.FinalDetected,
		FinalBlocked:       stats.FinalBlocked,
		FinalPartial:       stats.FinalPartial,
		FinalNotDetected:   stats.FinalNotDetected,
		FinalNotApplicable: stats.FinalNotApplicable,
		FinalPending:       stats.FinalPending,
		FinalNotExecuted:   stats.FinalNotExecuted,
		TacticStats:        tacticStatsResp,
	}

	// 4. Exercise-level requirements
	allReqs, err := h.requirementRepo.GetByExercise(ctx, exerciseID)
	if err != nil {
		allReqs = []entity.ExerciseRequirement{}
	}
	requirementResponses := make([]RequirementResponse, 0, len(allReqs))
	for i := range allReqs {
		requirementResponses = append(requirementResponses, h.reqToResponse(ctx, &allReqs[i]))
	}

	// 5. Requirement alerts
	alerts, err := h.requirementRepo.GetUnfulfilledWithSchedule(ctx, exerciseID)
	if err != nil {
		alerts = []entity.RequirementAlert{}
	}
	alertsResp := h.buildAlertsResponse(alerts)

	// 6. Return unified state
	response.Success(w, ExerciseStateResponse{
		Techniques:            techniques,
		TechniqueDetections:   techniqueDetections,
		TechniqueRequirements: techniqueRequirements,
		DetectionStats:        detectionStatsResp,
		Requirements:          requirementResponses,
		RequirementAlerts:     alertsResp,
	})
}

func (h *ExerciseHandler) reqToResponse(ctx context.Context, req *entity.ExerciseRequirement) RequirementResponse {
	if req.CreatedBy != nil && req.CreatedByUsername == "" {
		user, _ := h.userRepo.GetByID(ctx, *req.CreatedBy)
		if user != nil {
			req.CreatedByUsername = user.Username
		}
	}
	if req.FulfilledBy != nil && req.FulfilledByUsername == "" {
		user, _ := h.userRepo.GetByID(ctx, *req.FulfilledBy)
		if user != nil {
			req.FulfilledByUsername = user.Username
		}
	}

	resp := RequirementResponse{
		ID:                  req.ID.String(),
		ExerciseID:          req.ExerciseID.String(),
		Title:               req.Title,
		Description:         req.Description,
		Category:            string(req.Category),
		Fulfilled:           req.Fulfilled,
		CreatedAt:           req.CreatedAt.Format("2006-01-02T15:04:05Z"),
		LinkedScenarios:     req.LinkedScenarios,
		CreatedByUsername:   req.CreatedByUsername,
		FulfilledByUsername: req.FulfilledByUsername,
	}
	if req.CreatedBy != nil {
		s := req.CreatedBy.String()
		resp.CreatedBy = &s
	}
	if req.FulfilledBy != nil {
		s := req.FulfilledBy.String()
		resp.FulfilledBy = &s
	}
	if req.FulfilledAt != nil {
		s := req.FulfilledAt.Format("2006-01-02T15:04:05Z")
		resp.FulfilledAt = &s
	}
	return resp
}

func (h *ExerciseHandler) buildAlertsResponse(alerts []entity.RequirementAlert) RequirementAlertsResponse {
	scenarioMap := make(map[uuid.UUID]*AlertScenarioResponse)
	var scenarioOrder []uuid.UUID

	for _, alert := range alerts {
		etID := alert.ExerciseTechniqueID
		if _, exists := scenarioMap[etID]; !exists {
			scenarioMap[etID] = &AlertScenarioResponse{
				ExerciseTechniqueID: etID.String(),
				TechniqueName:       alert.TechniqueName,
				MitreID:             alert.MitreID,
				ScheduledStartTime:  alert.ScheduledStartTime.Format("2006-01-02T15:04:05Z"),
				PendingRequirements: []AlertRequirementResponse{},
			}
			scenarioOrder = append(scenarioOrder, etID)
		}
		scenarioMap[etID].PendingRequirements = append(scenarioMap[etID].PendingRequirements, AlertRequirementResponse{
			ID:       alert.RequirementID.String(),
			Title:    alert.RequirementTitle,
			Category: alert.RequirementCategory,
		})
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	result := RequirementAlertsResponse{
		Critical: []AlertScenarioResponse{},
		High:     []AlertScenarioResponse{},
		Warning:  []AlertScenarioResponse{},
		Upcoming: []AlertScenarioResponse{},
	}

	for _, etID := range scenarioOrder {
		scenario := scenarioMap[etID]
		var scheduledTime time.Time
		for _, alert := range alerts {
			if alert.ExerciseTechniqueID == etID {
				scheduledTime = alert.ScheduledStartTime
				break
			}
		}

		scheduledDate := time.Date(scheduledTime.Year(), scheduledTime.Month(), scheduledTime.Day(), 0, 0, 0, 0, scheduledTime.Location())
		daysUntil := int(math.Round(scheduledDate.Sub(today).Hours() / 24))

		switch {
		case daysUntil <= 0:
			result.Critical = append(result.Critical, *scenario)
		case daysUntil == 1:
			result.High = append(result.High, *scenario)
		case daysUntil == 2:
			result.Warning = append(result.Warning, *scenario)
		default:
			result.Upcoming = append(result.Upcoming, *scenario)
		}
	}

	return result
}
