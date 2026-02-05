package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type TechniqueHandler struct {
	techniqueRepo repository.TechniqueRepository
}

func NewTechniqueHandler(techniqueRepo repository.TechniqueRepository) *TechniqueHandler {
	return &TechniqueHandler{techniqueRepo: techniqueRepo}
}

type TechniqueRequest struct {
	MitreID     string `json:"mitre_id"`
	Tactic      string `json:"tactic"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type TechniqueResponse struct {
	ID          string  `json:"id"`
	MitreID     *string `json:"mitre_id"`
	Tactic      *string `json:"tactic"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	CreatedAt   string  `json:"created_at"`
}

func (h *TechniqueHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req TechniqueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name == "" {
		response.BadRequest(w, "Name is required")
		return
	}

	claims := middleware.GetClaims(r.Context())
	technique := &entity.Technique{
		Name: req.Name,
	}

	if req.MitreID != "" {
		technique.MitreID = &req.MitreID
	}
	if req.Tactic != "" {
		technique.Tactic = &req.Tactic
	}
	if req.Description != "" {
		technique.Description = &req.Description
	}
	if claims != nil {
		technique.CreatedBy = &claims.UserID
	}

	if err := h.techniqueRepo.Create(r.Context(), technique); err != nil {
		response.InternalError(w, "Failed to create technique")
		return
	}

	response.Created(w, TechniqueResponse{
		ID:          technique.ID.String(),
		MitreID:     technique.MitreID,
		Tactic:      technique.Tactic,
		Name:        technique.Name,
		Description: technique.Description,
		CreatedAt:   technique.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *TechniqueHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	technique, err := h.techniqueRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if technique == nil {
		response.NotFound(w, "Technique not found")
		return
	}

	response.Success(w, TechniqueResponse{
		ID:          technique.ID.String(),
		MitreID:     technique.MitreID,
		Tactic:      technique.Tactic,
		Name:        technique.Name,
		Description: technique.Description,
		CreatedAt:   technique.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *TechniqueHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	technique, err := h.techniqueRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if technique == nil {
		response.NotFound(w, "Technique not found")
		return
	}

	var req TechniqueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name != "" {
		technique.Name = req.Name
	}
	if req.MitreID != "" {
		technique.MitreID = &req.MitreID
	}
	if req.Tactic != "" {
		technique.Tactic = &req.Tactic
	}
	if req.Description != "" {
		technique.Description = &req.Description
	}

	if err := h.techniqueRepo.Update(r.Context(), technique); err != nil {
		response.InternalError(w, "Failed to update technique")
		return
	}

	response.Success(w, TechniqueResponse{
		ID:          technique.ID.String(),
		MitreID:     technique.MitreID,
		Tactic:      technique.Tactic,
		Name:        technique.Name,
		Description: technique.Description,
		CreatedAt:   technique.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *TechniqueHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	if err := h.techniqueRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete technique")
		return
	}

	response.NoContent(w)
}

func (h *TechniqueHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 {
		perPage = 20
	}
	// Allow up to 2000 for bulk fetching (e.g., technique selector)
	if perPage > 2000 {
		perPage = 2000
	}

	filters := repository.TechniqueFilters{
		Limit:  perPage,
		Offset: (page - 1) * perPage,
	}

	if tactic := r.URL.Query().Get("tactic"); tactic != "" {
		filters.Tactic = &tactic
	}
	if search := r.URL.Query().Get("search"); search != "" {
		filters.Search = &search
	}

	techniques, total, err := h.techniqueRepo.List(r.Context(), filters)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	var techniqueResponses []TechniqueResponse
	for _, t := range techniques {
		techniqueResponses = append(techniqueResponses, TechniqueResponse{
			ID:          t.ID.String(),
			MitreID:     t.MitreID,
			Tactic:      t.Tactic,
			Name:        t.Name,
			Description: t.Description,
			CreatedAt:   t.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	response.Paginated(w, techniqueResponses, total, page, perPage)
}

func (h *TechniqueHandler) GetTactics(w http.ResponseWriter, r *http.Request) {
	response.Success(w, entity.MITRETactics)
}

// STIX Import structures
type STIXBundle struct {
	Type    string       `json:"type"`
	ID      string       `json:"id"`
	Objects []STIXObject `json:"objects"`
}

type STIXObject struct {
	Type               string               `json:"type"`
	ID                 string               `json:"id"`
	Name               string               `json:"name"`
	Description        string               `json:"description"`
	ExternalReferences []STIXExternalRef    `json:"external_references"`
	KillChainPhases    []STIXKillChainPhase `json:"kill_chain_phases"`
	XMitreDeprecated   bool                 `json:"x_mitre_deprecated"`
	Revoked            bool                 `json:"revoked"`
}

type STIXExternalRef struct {
	SourceName string `json:"source_name"`
	ExternalID string `json:"external_id"`
	URL        string `json:"url"`
}

type STIXKillChainPhase struct {
	KillChainName string `json:"kill_chain_name"`
	PhaseName     string `json:"phase_name"`
}

type ImportSTIXResponse struct {
	Inserted int    `json:"inserted"`
	Updated  int    `json:"updated"`
	Skipped  int    `json:"skipped"`
	Message  string `json:"message"`
}

// ImportSTIX imports techniques from a MITRE ATT&CK STIX bundle JSON
func (h *TechniqueHandler) ImportSTIX(w http.ResponseWriter, r *http.Request) {
	// Limit request body size to 100MB
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)

	var bundle STIXBundle
	if err := json.NewDecoder(r.Body).Decode(&bundle); err != nil {
		response.BadRequest(w, "Invalid STIX JSON format: "+err.Error())
		return
	}

	if bundle.Type != "bundle" {
		response.BadRequest(w, "Invalid STIX bundle: type must be 'bundle'")
		return
	}

	claims := middleware.GetClaims(r.Context())

	// Extract attack-patterns (techniques)
	var techniques []entity.Technique
	skipped := 0

	for _, obj := range bundle.Objects {
		if obj.Type != "attack-pattern" {
			continue
		}

		// Skip deprecated or revoked techniques
		if obj.XMitreDeprecated || obj.Revoked {
			skipped++
			continue
		}

		// Extract MITRE ID from external references
		var mitreID string
		for _, ref := range obj.ExternalReferences {
			if ref.SourceName == "mitre-attack" && ref.ExternalID != "" {
				mitreID = ref.ExternalID
				break
			}
		}

		if mitreID == "" || obj.Name == "" {
			skipped++
			continue
		}

		// Extract tactic (first kill chain phase)
		var tactic string
		if len(obj.KillChainPhases) > 0 {
			// Convert phase_name to display format (e.g., "defense-evasion" -> "Defense Evasion")
			tactic = formatTactic(obj.KillChainPhases[0].PhaseName)
		}

		technique := entity.Technique{
			Name: obj.Name,
		}

		technique.MitreID = &mitreID
		if tactic != "" {
			technique.Tactic = &tactic
		}
		if obj.Description != "" {
			technique.Description = &obj.Description
		}
		if claims != nil {
			technique.CreatedBy = &claims.UserID
		}

		techniques = append(techniques, technique)
	}

	if len(techniques) == 0 {
		response.BadRequest(w, "No valid techniques found in STIX bundle")
		return
	}

	// Bulk upsert techniques
	inserted, updated, err := h.techniqueRepo.BulkUpsert(r.Context(), techniques)
	if err != nil {
		response.InternalError(w, "Failed to import techniques: "+err.Error())
		return
	}

	response.Success(w, ImportSTIXResponse{
		Inserted: inserted,
		Updated:  updated,
		Skipped:  skipped,
		Message:  "STIX import completed successfully",
	})
}

// formatTactic converts STIX phase_name to display format
// e.g., "defense-evasion" -> "Defense Evasion"
func formatTactic(phaseName string) string {
	parts := strings.Split(phaseName, "-")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(string(part[0])) + part[1:]
		}
	}
	return strings.Join(parts, " ")
}
