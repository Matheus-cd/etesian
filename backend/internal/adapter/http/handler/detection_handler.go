package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

// Helper functions for file operations
func createDirIfNotExists(dir string) error {
	return os.MkdirAll(dir, 0755)
}

func createFile(path string) (*os.File, error) {
	return os.Create(path)
}

func copyFile(dst *os.File, src io.Reader) (int64, error) {
	return io.Copy(dst, src)
}

type DetectionHandler struct {
	detectionRepo repository.DetectionRepository
	voidRepo      repository.DetectionVoidRepository
	evidenceRepo  repository.EvidenceRepository
	executionRepo repository.ExecutionRepository
}

func NewDetectionHandler(
	detectionRepo repository.DetectionRepository,
	voidRepo repository.DetectionVoidRepository,
	evidenceRepo repository.EvidenceRepository,
	executionRepo repository.ExecutionRepository,
) *DetectionHandler {
	return &DetectionHandler{
		detectionRepo: detectionRepo,
		voidRepo:      voidRepo,
		evidenceRepo:  evidenceRepo,
		executionRepo: executionRepo,
	}
}

type CreateDetectionRequest struct {
	ExecutionID string `json:"execution_id"`

	// Tool detection
	ToolDetected      bool   `json:"tool_detected"`
	ToolName          string `json:"tool_name"`
	ToolDetectedAt    string `json:"tool_detected_at"`
	ToolAlertID       string `json:"tool_alert_id"`
	ToolNotes         string `json:"tool_notes"`
	ToolNotApplicable bool   `json:"tool_not_applicable"`
	ToolNAReason      string `json:"tool_na_reason"`

	// SIEM detection
	SIEMDetected      bool   `json:"siem_detected"`
	SIEMName          string `json:"siem_name"`
	SIEMDetectedAt    string `json:"siem_detected_at"`
	SIEMAlertID       string `json:"siem_alert_id"`
	SIEMNotes         string `json:"siem_notes"`
	SIEMNotApplicable bool   `json:"siem_not_applicable"`
	SIEMNAReason      string `json:"siem_na_reason"`

	// General
	DetectionStatus string `json:"detection_status"`
	AnalystNotes    string `json:"analyst_notes"`
}

type DetectionResponse struct {
	ID          string  `json:"id"`
	ExecutionID string  `json:"execution_id"`
	DetectedBy  *string `json:"detected_by"`

	// Tool detection
	ToolDetected      bool    `json:"tool_detected"`
	ToolName          *string `json:"tool_name"`
	ToolDetectedAt    *string `json:"tool_detected_at"`
	ToolAlertID       *string `json:"tool_alert_id"`
	ToolNotes         *string `json:"tool_notes"`
	ToolNotApplicable bool    `json:"tool_not_applicable"`
	ToolNAReason      *string `json:"tool_na_reason"`

	// SIEM detection
	SIEMDetected      bool    `json:"siem_detected"`
	SIEMName          *string `json:"siem_name"`
	SIEMDetectedAt    *string `json:"siem_detected_at"`
	SIEMAlertID       *string `json:"siem_alert_id"`
	SIEMNotes         *string `json:"siem_notes"`
	SIEMNotApplicable bool    `json:"siem_not_applicable"`
	SIEMNAReason      *string `json:"siem_na_reason"`

	// General
	DetectionStatus string  `json:"detection_status"`
	AnalystNotes    *string `json:"analyst_notes"`
	CreatedAt       string  `json:"created_at"`

	// Calculated
	ToolResponseSeconds *int64 `json:"tool_response_seconds,omitempty"`
	SIEMResponseSeconds *int64 `json:"siem_response_seconds,omitempty"`
	ToolToSIEMGapSec    *int64 `json:"tool_to_siem_gap_seconds,omitempty"`

	// Related
	ToolEvidences []Evidence    `json:"tool_evidences,omitempty"`
	SIEMEvidences []Evidence    `json:"siem_evidences,omitempty"`
	Void          *VoidResponse `json:"void,omitempty"`
}

type VoidResponse struct {
	ID         string  `json:"id"`
	VoidReason string  `json:"void_reason"`
	VoidedBy   *string `json:"voided_by"`
	VoidedAt   string  `json:"voided_at"`
}

func (h *DetectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateDetectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.ExecutionID == "" {
		response.BadRequest(w, "execution_id is required")
		return
	}

	executionID, err := uuid.Parse(req.ExecutionID)
	if err != nil {
		response.BadRequest(w, "Invalid execution_id")
		return
	}

	claims := middleware.GetClaims(r.Context())
	detection := &entity.Detection{
		ExecutionID:  executionID,
		ToolDetected: req.ToolDetected,
		SIEMDetected: req.SIEMDetected,
	}

	if claims != nil {
		detection.DetectedBy = &claims.UserID
	}

	// Tool detection
	if req.ToolName != "" {
		detection.ToolName = &req.ToolName
	}
	if req.ToolDetectedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ToolDetectedAt); err == nil {
			detection.ToolDetectedAt = &t
		}
	}
	if req.ToolAlertID != "" {
		detection.ToolAlertID = &req.ToolAlertID
	}
	if req.ToolNotes != "" {
		detection.ToolNotes = &req.ToolNotes
	}
	detection.ToolNotApplicable = req.ToolNotApplicable
	if req.ToolNAReason != "" {
		detection.ToolNAReason = &req.ToolNAReason
	}

	// SIEM detection
	if req.SIEMName != "" {
		detection.SIEMName = &req.SIEMName
	}
	if req.SIEMDetectedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.SIEMDetectedAt); err == nil {
			detection.SIEMDetectedAt = &t
		}
	}
	if req.SIEMAlertID != "" {
		detection.SIEMAlertID = &req.SIEMAlertID
	}
	if req.SIEMNotes != "" {
		detection.SIEMNotes = &req.SIEMNotes
	}
	detection.SIEMNotApplicable = req.SIEMNotApplicable
	if req.SIEMNAReason != "" {
		detection.SIEMNAReason = &req.SIEMNAReason
	}

	// Status - auto-determine based on detection priority
	if req.DetectionStatus != "" {
		detection.DetectionStatus = entity.DetectionStatus(req.DetectionStatus)
	} else {
		// Logic:
		// - Both N/A → not_applicable
		// - SIEM detected (and Tool detected or N/A) → detected
		// - Only Tool detected (SIEM not detected or N/A) → partial
		// - Neither detected → not_detected
		if req.ToolNotApplicable && req.SIEMNotApplicable {
			detection.DetectionStatus = entity.DetectionStatusNotApplicable
		} else if req.SIEMDetected {
			detection.DetectionStatus = entity.DetectionStatusDetected
		} else if req.ToolDetected {
			detection.DetectionStatus = entity.DetectionStatusPartial
		} else {
			detection.DetectionStatus = entity.DetectionStatusNotDetected
		}
	}

	if req.AnalystNotes != "" {
		detection.AnalystNotes = &req.AnalystNotes
	}

	if err := h.detectionRepo.Create(r.Context(), detection); err != nil {
		response.InternalError(w, "Failed to create detection")
		return
	}

	// Get execution for response times
	execution, _ := h.executionRepo.GetByID(r.Context(), executionID)

	response.Created(w, h.toDetectionResponse(detection, execution, nil, nil, nil))
}

func (h *DetectionHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "detectionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid detection ID")
		return
	}

	detection, err := h.detectionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if detection == nil {
		response.NotFound(w, "Detection not found")
		return
	}

	execution, _ := h.executionRepo.GetByID(r.Context(), detection.ExecutionID)
	toolEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionTool, detection.ID)
	siemEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionSIEM, detection.ID)
	void, _ := h.voidRepo.GetByDetection(r.Context(), detection.ID)

	response.Success(w, h.toDetectionResponse(detection, execution, toolEvidences, siemEvidences, void))
}

func (h *DetectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "detectionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid detection ID")
		return
	}

	detection, err := h.detectionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if detection == nil {
		response.NotFound(w, "Detection not found")
		return
	}

	// If voided, Blue Team can still update/resubmit
	// The void record stays for audit, but status will be recalculated

	var req CreateDetectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	// Update tool detection
	detection.ToolDetected = req.ToolDetected
	if req.ToolName != "" {
		detection.ToolName = &req.ToolName
	}
	if req.ToolDetectedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ToolDetectedAt); err == nil {
			detection.ToolDetectedAt = &t
		}
	}
	if req.ToolAlertID != "" {
		detection.ToolAlertID = &req.ToolAlertID
	}
	if req.ToolNotes != "" {
		detection.ToolNotes = &req.ToolNotes
	}
	detection.ToolNotApplicable = req.ToolNotApplicable
	if req.ToolNAReason != "" {
		detection.ToolNAReason = &req.ToolNAReason
	}

	// Update SIEM detection
	detection.SIEMDetected = req.SIEMDetected
	if req.SIEMName != "" {
		detection.SIEMName = &req.SIEMName
	}
	if req.SIEMDetectedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.SIEMDetectedAt); err == nil {
			detection.SIEMDetectedAt = &t
		}
	}
	if req.SIEMAlertID != "" {
		detection.SIEMAlertID = &req.SIEMAlertID
	}
	if req.SIEMNotes != "" {
		detection.SIEMNotes = &req.SIEMNotes
	}
	detection.SIEMNotApplicable = req.SIEMNotApplicable
	if req.SIEMNAReason != "" {
		detection.SIEMNAReason = &req.SIEMNAReason
	}

	// Update status - auto-recalculate based on detection priority
	if req.DetectionStatus != "" {
		detection.DetectionStatus = entity.DetectionStatus(req.DetectionStatus)
	} else {
		// Logic:
		// - Both N/A → not_applicable
		// - SIEM detected (and Tool detected or N/A) → detected
		// - Only Tool detected (SIEM not detected or N/A) → partial
		// - Neither detected → not_detected
		if detection.ToolNotApplicable && detection.SIEMNotApplicable {
			detection.DetectionStatus = entity.DetectionStatusNotApplicable
		} else if detection.SIEMDetected {
			detection.DetectionStatus = entity.DetectionStatusDetected
		} else if detection.ToolDetected {
			detection.DetectionStatus = entity.DetectionStatusPartial
		} else {
			detection.DetectionStatus = entity.DetectionStatusNotDetected
		}
	}
	if req.AnalystNotes != "" {
		detection.AnalystNotes = &req.AnalystNotes
	}

	if err := h.detectionRepo.Update(r.Context(), detection); err != nil {
		response.InternalError(w, "Failed to update detection")
		return
	}

	execution, _ := h.executionRepo.GetByID(r.Context(), detection.ExecutionID)

	response.Success(w, h.toDetectionResponse(detection, execution, nil, nil, nil))
}

// Delete deletes a detection record
func (h *DetectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "detectionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid detection ID")
		return
	}

	// Check if detection exists
	detection, err := h.detectionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w, "Detection not found")
		return
	}

	// Delete all evidences associated with this detection first
	toolEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionTool, detection.ID)
	for _, ev := range toolEvidences {
		_ = h.evidenceRepo.Delete(r.Context(), ev.ID)
	}
	siemEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionSIEM, detection.ID)
	for _, ev := range siemEvidences {
		_ = h.evidenceRepo.Delete(r.Context(), ev.ID)
	}

	// Delete the detection
	if err := h.detectionRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete detection")
		return
	}

	response.NoContent(w)
}

// Void detection (Red Team can void invalid detections)
type VoidDetectionRequest struct {
	VoidReason string `json:"void_reason"`
}

func (h *DetectionHandler) Void(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "detectionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid detection ID")
		return
	}

	var req VoidDetectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.VoidReason == "" {
		response.BadRequest(w, "void_reason is required")
		return
	}

	detection, err := h.detectionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if detection == nil {
		response.NotFound(w, "Detection not found")
		return
	}

	if detection.DetectionStatus == entity.DetectionStatusVoided {
		response.BadRequest(w, "Detection already voided")
		return
	}

	claims := middleware.GetClaims(r.Context())
	void := &entity.DetectionVoid{
		DetectionID: id,
		VoidReason:  req.VoidReason,
	}
	if claims != nil {
		void.VoidedBy = &claims.UserID
	}

	if err := h.voidRepo.Create(r.Context(), void); err != nil {
		response.InternalError(w, "Failed to create void record")
		return
	}

	// Update detection status
	detection.DetectionStatus = entity.DetectionStatusVoided
	if err := h.detectionRepo.Update(r.Context(), detection); err != nil {
		response.InternalError(w, "Failed to update detection status")
		return
	}

	response.Success(w, map[string]interface{}{
		"message":      "Detection voided successfully",
		"detection_id": id.String(),
		"void_reason":  req.VoidReason,
	})
}

func (h *DetectionHandler) ListByExercise(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	detections, err := h.detectionRepo.ListByExercise(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	detectionResponses := make([]DetectionResponse, 0, len(detections))
	for _, d := range detections {
		execution, _ := h.executionRepo.GetByID(r.Context(), d.ExecutionID)
		toolEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionTool, d.ID)
		siemEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionSIEM, d.ID)
		void, _ := h.voidRepo.GetByDetection(r.Context(), d.ID)
		detectionResponses = append(detectionResponses, h.toDetectionResponse(&d, execution, toolEvidences, siemEvidences, void))
	}

	response.Success(w, detectionResponses)
}

func (h *DetectionHandler) ListByExecution(w http.ResponseWriter, r *http.Request) {
	executionIDStr := chi.URLParam(r, "executionID")
	executionID, err := uuid.Parse(executionIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid execution ID")
		return
	}

	detections, err := h.detectionRepo.ListByExecution(r.Context(), executionID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	execution, _ := h.executionRepo.GetByID(r.Context(), executionID)

	detectionResponses := make([]DetectionResponse, 0, len(detections))
	for _, d := range detections {
		toolEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionTool, d.ID)
		siemEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionSIEM, d.ID)
		void, _ := h.voidRepo.GetByDetection(r.Context(), d.ID)
		detectionResponses = append(detectionResponses, h.toDetectionResponse(&d, execution, toolEvidences, siemEvidences, void))
	}

	response.Success(w, detectionResponses)
}

// UploadEvidence uploads evidence for a detection (tool or siem)
func (h *DetectionHandler) UploadEvidence(w http.ResponseWriter, r *http.Request) {
	detectionIDStr := chi.URLParam(r, "detectionID")
	detectionID, err := uuid.Parse(detectionIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid detection ID")
		return
	}

	detection, err := h.detectionRepo.GetByID(r.Context(), detectionID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if detection == nil {
		response.NotFound(w, "Detection not found")
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.BadRequest(w, "Invalid form data")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.BadRequest(w, "File is required")
		return
	}
	defer file.Close()

	evidenceType := r.FormValue("evidence_type")
	if evidenceType != "tool" && evidenceType != "siem" {
		response.BadRequest(w, "evidence_type must be 'tool' or 'siem'")
		return
	}

	caption := r.FormValue("caption")

	claims := middleware.GetClaims(r.Context())

	// Determine entity type based on evidence_type
	entityType := entity.EvidenceEntityDetectionTool
	if evidenceType == "siem" {
		entityType = entity.EvidenceEntityDetectionSIEM
	}

	evidence := &entity.Evidence{
		EntityType: entityType,
		EntityID:   detectionID,
		FileName:   header.Filename,
		FileSize:   &header.Size,
	}

	if caption != "" {
		evidence.Caption = &caption
	}
	if claims != nil {
		evidence.UploadedBy = &claims.UserID
	}

	// Get file content type
	contentType := header.Header.Get("Content-Type")
	if contentType != "" {
		evidence.FileType = &contentType
	}

	// Save file to disk (using the same function from execution_handler would be ideal, but for now inline)
	// For simplicity, we'll reuse the uploads directory structure
	uploadsDir := "uploads/evidences"
	dir := detectionID.String()
	fullDir := uploadsDir + "/" + dir

	if err := createDirIfNotExists(fullDir); err != nil {
		response.InternalError(w, "Failed to create directory")
		return
	}

	filePath := fullDir + "/" + header.Filename
	dst, err := createFile(filePath)
	if err != nil {
		response.InternalError(w, "Failed to save file")
		return
	}
	defer dst.Close()

	if _, err := copyFile(dst, file); err != nil {
		response.InternalError(w, "Failed to save file")
		return
	}

	evidence.FilePath = filePath

	if err := h.evidenceRepo.Create(r.Context(), evidence); err != nil {
		response.InternalError(w, "Failed to create evidence record")
		return
	}

	response.Created(w, Evidence{
		ID:          evidence.ID.String(),
		FileName:    evidence.FileName,
		FileType:    evidence.FileType,
		FileSize:    evidence.FileSize,
		Description: evidence.Description,
		Caption:     evidence.Caption,
		UploadedAt:  evidence.UploadedAt.Format(time.RFC3339),
	})
}

// DeleteEvidence deletes an evidence from a detection
func (h *DetectionHandler) DeleteEvidence(w http.ResponseWriter, r *http.Request) {
	evidenceIDStr := chi.URLParam(r, "evidenceID")
	evidenceID, err := uuid.Parse(evidenceIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid evidence ID")
		return
	}

	// Check if evidence exists
	evidence, err := h.evidenceRepo.GetByID(r.Context(), evidenceID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if evidence == nil {
		response.NotFound(w, "Evidence not found")
		return
	}

	// Delete file from disk
	if evidence.FilePath != "" {
		os.Remove(evidence.FilePath)
	}

	// Delete from database
	if err := h.evidenceRepo.Delete(r.Context(), evidenceID); err != nil {
		response.InternalError(w, "Failed to delete evidence")
		return
	}

	response.NoContent(w)
}

// UpdateEvidenceCaption updates the caption of a detection evidence
func (h *DetectionHandler) UpdateEvidenceCaption(w http.ResponseWriter, r *http.Request) {
	evidenceIDStr := chi.URLParam(r, "evidenceID")
	evidenceID, err := uuid.Parse(evidenceIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid evidence ID")
		return
	}

	var req struct {
		Caption string `json:"caption"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	// Check if evidence exists
	evidence, err := h.evidenceRepo.GetByID(r.Context(), evidenceID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if evidence == nil {
		response.NotFound(w, "Evidence not found")
		return
	}

	if err := h.evidenceRepo.UpdateCaption(r.Context(), evidenceID, req.Caption); err != nil {
		response.InternalError(w, "Failed to update evidence caption")
		return
	}

	// Return updated evidence
	evidence.Caption = &req.Caption
	response.JSON(w, http.StatusOK, Evidence{
		ID:          evidence.ID.String(),
		FileName:    evidence.FileName,
		FileType:    evidence.FileType,
		FileSize:    evidence.FileSize,
		Description: evidence.Description,
		Caption:     evidence.Caption,
		UploadedAt:  evidence.UploadedAt.Format(time.RFC3339),
	})
}

func (h *DetectionHandler) toDetectionResponse(
	d *entity.Detection,
	execution *entity.Execution,
	toolEvidences, siemEvidences []entity.Evidence,
	void *entity.DetectionVoid,
) DetectionResponse {
	resp := DetectionResponse{
		ID:                d.ID.String(),
		ExecutionID:       d.ExecutionID.String(),
		ToolDetected:      d.ToolDetected,
		ToolName:          d.ToolName,
		ToolAlertID:       d.ToolAlertID,
		ToolNotes:         d.ToolNotes,
		ToolNotApplicable: d.ToolNotApplicable,
		ToolNAReason:      d.ToolNAReason,
		SIEMDetected:      d.SIEMDetected,
		SIEMName:          d.SIEMName,
		SIEMAlertID:       d.SIEMAlertID,
		SIEMNotes:         d.SIEMNotes,
		SIEMNotApplicable: d.SIEMNotApplicable,
		SIEMNAReason:      d.SIEMNAReason,
		DetectionStatus:   string(d.DetectionStatus),
		AnalystNotes:      d.AnalystNotes,
		CreatedAt:         d.CreatedAt.Format(time.RFC3339),
	}

	if d.DetectedBy != nil {
		s := d.DetectedBy.String()
		resp.DetectedBy = &s
	}

	if d.ToolDetectedAt != nil {
		s := d.ToolDetectedAt.Format(time.RFC3339)
		resp.ToolDetectedAt = &s
	}
	if d.SIEMDetectedAt != nil {
		s := d.SIEMDetectedAt.Format(time.RFC3339)
		resp.SIEMDetectedAt = &s
	}

	// Calculate response times
	if execution != nil {
		resp.ToolResponseSeconds = d.CalculateToolResponseTime(execution.ExecutedAt)
		resp.SIEMResponseSeconds = d.CalculateSIEMResponseTime(execution.ExecutedAt)
	}
	resp.ToolToSIEMGapSec = d.CalculateToolToSIEMGap()

	// Add evidences
	for _, ev := range toolEvidences {
		resp.ToolEvidences = append(resp.ToolEvidences, Evidence{
			ID:          ev.ID.String(),
			FileName:    ev.FileName,
			FileType:    ev.FileType,
			FileSize:    ev.FileSize,
			Description: ev.Description,
			Caption:     ev.Caption,
			UploadedAt:  ev.UploadedAt.Format(time.RFC3339),
		})
	}
	for _, ev := range siemEvidences {
		resp.SIEMEvidences = append(resp.SIEMEvidences, Evidence{
			ID:          ev.ID.String(),
			FileName:    ev.FileName,
			FileType:    ev.FileType,
			FileSize:    ev.FileSize,
			Description: ev.Description,
			Caption:     ev.Caption,
			UploadedAt:  ev.UploadedAt.Format(time.RFC3339),
		})
	}

	// Add void info
	if void != nil {
		resp.Void = &VoidResponse{
			ID:         void.ID.String(),
			VoidReason: void.VoidReason,
			VoidedAt:   void.VoidedAt.Format(time.RFC3339),
		}
		if void.VoidedBy != nil {
			s := void.VoidedBy.String()
			resp.Void.VoidedBy = &s
		}
	}

	return resp
}
