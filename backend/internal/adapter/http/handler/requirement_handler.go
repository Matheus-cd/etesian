package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type RequirementHandler struct {
	requirementRepo repository.ExerciseRequirementRepository
	userRepo        repository.UserRepository
}

func NewRequirementHandler(
	requirementRepo repository.ExerciseRequirementRepository,
	userRepo repository.UserRepository,
) *RequirementHandler {
	return &RequirementHandler{
		requirementRepo: requirementRepo,
		userRepo:        userRepo,
	}
}

// Request/Response types

type CreateRequirementRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Category    string  `json:"category"`
}

type UpdateRequirementRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Category    string  `json:"category"`
}

type FulfillRequirementRequest struct {
	Fulfilled bool `json:"fulfilled"`
}

type SetScenarioRequirementsRequest struct {
	RequirementIDs []string `json:"requirement_ids"`
}

type RequirementResponse struct {
	ID                  string  `json:"id"`
	ExerciseID          string  `json:"exercise_id"`
	Title               string  `json:"title"`
	Description         *string `json:"description"`
	Category            string  `json:"category"`
	Fulfilled           bool    `json:"fulfilled"`
	FulfilledBy         *string `json:"fulfilled_by"`
	FulfilledAt         *string `json:"fulfilled_at"`
	CreatedBy           *string `json:"created_by"`
	CreatedAt           string  `json:"created_at"`
	LinkedScenarios     int     `json:"linked_scenarios"`
	CreatedByUsername   string  `json:"created_by_username,omitempty"`
	FulfilledByUsername string  `json:"fulfilled_by_username,omitempty"`
}

type AlertScenarioResponse struct {
	ExerciseTechniqueID string                       `json:"exercise_technique_id"`
	TechniqueName       string                       `json:"technique_name"`
	MitreID             string                       `json:"mitre_id"`
	ScheduledStartTime  string                       `json:"scheduled_start_time"`
	PendingRequirements []AlertRequirementResponse    `json:"pending_requirements"`
}

type AlertRequirementResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Category string `json:"category"`
}

type RequirementAlertsResponse struct {
	Critical []AlertScenarioResponse `json:"critical"`
	High     []AlertScenarioResponse `json:"high"`
	Warning  []AlertScenarioResponse `json:"warning"`
	Upcoming []AlertScenarioResponse `json:"upcoming"`
}

// Handlers

func (h *RequirementHandler) Create(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	var req CreateRequirementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Title == "" {
		response.BadRequest(w, "Title is required")
		return
	}

	category := entity.RequirementCategory(req.Category)
	if req.Category == "" {
		category = entity.RequirementCategoryOther
	}
	if !category.IsValid() {
		response.BadRequest(w, "Invalid category")
		return
	}

	claims := middleware.GetClaims(r.Context())

	requirement := &entity.ExerciseRequirement{
		ExerciseID:  exerciseID,
		Title:       req.Title,
		Description: req.Description,
		Category:    category,
	}
	if claims != nil {
		requirement.CreatedBy = &claims.UserID
	}

	if err := h.requirementRepo.Create(r.Context(), requirement); err != nil {
		response.InternalError(w, "Failed to create requirement")
		return
	}

	// Fetch back to get linked_scenarios count
	created, err := h.requirementRepo.GetByID(r.Context(), requirement.ID)
	if err != nil || created == nil {
		response.Created(w, h.toRequirementResponse(r, requirement))
		return
	}

	response.Created(w, h.toRequirementResponse(r, created))
}

func (h *RequirementHandler) List(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	requirements, err := h.requirementRepo.GetByExercise(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var responses []RequirementResponse
	for i := range requirements {
		responses = append(responses, h.toRequirementResponse(r, &requirements[i]))
	}

	if responses == nil {
		responses = []RequirementResponse{}
	}

	response.Success(w, responses)
}

func (h *RequirementHandler) Update(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "requirementID")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid requirement ID")
		return
	}

	existing, err := h.requirementRepo.GetByID(r.Context(), reqID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if existing == nil {
		response.NotFound(w, "Requirement not found")
		return
	}

	var req UpdateRequirementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Title == "" {
		response.BadRequest(w, "Title is required")
		return
	}

	category := entity.RequirementCategory(req.Category)
	if req.Category == "" {
		category = existing.Category
	}
	if !category.IsValid() {
		response.BadRequest(w, "Invalid category")
		return
	}

	existing.Title = req.Title
	existing.Description = req.Description
	existing.Category = category

	if err := h.requirementRepo.Update(r.Context(), existing); err != nil {
		response.InternalError(w, "Failed to update requirement")
		return
	}

	updated, _ := h.requirementRepo.GetByID(r.Context(), reqID)
	if updated == nil {
		updated = existing
	}

	response.Success(w, h.toRequirementResponse(r, updated))
}

func (h *RequirementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "requirementID")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid requirement ID")
		return
	}

	existing, err := h.requirementRepo.GetByID(r.Context(), reqID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if existing == nil {
		response.NotFound(w, "Requirement not found")
		return
	}

	if err := h.requirementRepo.Delete(r.Context(), reqID); err != nil {
		response.InternalError(w, "Failed to delete requirement")
		return
	}

	response.NoContent(w)
}

func (h *RequirementHandler) Fulfill(w http.ResponseWriter, r *http.Request) {
	reqIDStr := chi.URLParam(r, "requirementID")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid requirement ID")
		return
	}

	existing, err := h.requirementRepo.GetByID(r.Context(), reqID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if existing == nil {
		response.NotFound(w, "Requirement not found")
		return
	}

	var req FulfillRequirementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	if err := h.requirementRepo.Fulfill(r.Context(), reqID, claims.UserID, req.Fulfilled); err != nil {
		response.InternalError(w, "Failed to update requirement")
		return
	}

	updated, _ := h.requirementRepo.GetByID(r.Context(), reqID)
	if updated == nil {
		existing.Fulfilled = req.Fulfilled
		updated = existing
	}

	response.Success(w, h.toRequirementResponse(r, updated))
}

func (h *RequirementHandler) SetScenarioRequirements(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	var req SetScenarioRequirementsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	var requirementIDs []uuid.UUID
	for _, idStr := range req.RequirementIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			response.BadRequest(w, fmt.Sprintf("Invalid requirement ID: %s", idStr))
			return
		}
		requirementIDs = append(requirementIDs, id)
	}

	if err := h.requirementRepo.SetScenarioRequirements(r.Context(), techniqueID, requirementIDs); err != nil {
		response.InternalError(w, "Failed to set scenario requirements")
		return
	}

	// Return updated list
	requirements, err := h.requirementRepo.GetByScenario(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var responses []RequirementResponse
	for i := range requirements {
		responses = append(responses, h.toRequirementResponse(r, &requirements[i]))
	}
	if responses == nil {
		responses = []RequirementResponse{}
	}

	response.Success(w, responses)
}

func (h *RequirementHandler) GetScenarioRequirements(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	requirements, err := h.requirementRepo.GetByScenario(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var responses []RequirementResponse
	for i := range requirements {
		responses = append(responses, h.toRequirementResponse(r, &requirements[i]))
	}
	if responses == nil {
		responses = []RequirementResponse{}
	}

	response.Success(w, responses)
}

func (h *RequirementHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	alerts, err := h.requirementRepo.GetUnfulfilledWithSchedule(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	// Group by scenario, then by urgency
	type scenarioKey struct {
		ExerciseTechniqueID uuid.UUID
	}

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

	// Classify by urgency
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

		// Find matching alert to get scheduled time
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

	response.Success(w, result)
}

func (h *RequirementHandler) Export(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	requirements, err := h.requirementRepo.GetByExercise(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=requirements.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Header
	writer.Write([]string{"Title", "Category", "Status", "Fulfilled By", "Fulfilled At", "Linked Scenarios", "Created By", "Created At"})

	for i := range requirements {
		req := &requirements[i]
		h.populateUsernames(r, req)

		status := "Pending"
		if req.Fulfilled {
			status = "Fulfilled"
		}

		fulfilledAt := ""
		if req.FulfilledAt != nil {
			fulfilledAt = req.FulfilledAt.Format("2006-01-02T15:04:05Z")
		}

		writer.Write([]string{
			req.Title,
			string(req.Category),
			status,
			req.FulfilledByUsername,
			fulfilledAt,
			fmt.Sprintf("%d", req.LinkedScenarios),
			req.CreatedByUsername,
			req.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
}

// Helper functions

func (h *RequirementHandler) toRequirementResponse(r *http.Request, req *entity.ExerciseRequirement) RequirementResponse {
	h.populateUsernames(r, req)

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

func (h *RequirementHandler) populateUsernames(r *http.Request, req *entity.ExerciseRequirement) {
	if req.CreatedBy != nil && req.CreatedByUsername == "" {
		user, _ := h.userRepo.GetByID(r.Context(), *req.CreatedBy)
		if user != nil {
			req.CreatedByUsername = user.Username
		}
	}
	if req.FulfilledBy != nil && req.FulfilledByUsername == "" {
		user, _ := h.userRepo.GetByID(r.Context(), *req.FulfilledBy)
		if user != nil {
			req.FulfilledByUsername = user.Username
		}
	}
}
