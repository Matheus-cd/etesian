package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

const uploadsDir = "uploads/evidences"

// OWASP-compliant allowed image types with magic bytes validation
var allowedImageTypes = map[string][]byte{
	"image/jpeg": {0xFF, 0xD8, 0xFF},
	"image/png":  {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
	"image/gif":  {0x47, 0x49, 0x46, 0x38},
	"image/webp": {0x52, 0x49, 0x46, 0x46}, // RIFF header, followed by WEBP
}

// Max file size: 10MB
const maxImageSize = 10 << 20

// validateImageFile validates that the uploaded file is a legitimate image
// following OWASP guidelines for secure file upload
func validateImageFile(file multipart.File, header *multipart.FileHeader) (string, error) {
	// 1. Check file size
	if header.Size > maxImageSize {
		return "", fmt.Errorf("arquivo muito grande (máximo 10MB)")
	}

	// 2. Get and validate extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExtensions := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	}
	if !allowedExtensions[ext] {
		return "", fmt.Errorf("extensão de arquivo inválida, apenas imagens são permitidas (.jpg, .jpeg, .png, .gif, .webp)")
	}

	// 3. Read magic bytes from file content (first 12 bytes for webp validation)
	magicBytes := make([]byte, 12)
	n, err := file.Read(magicBytes)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("falha ao ler arquivo")
	}
	magicBytes = magicBytes[:n]

	// Reset file reader position
	if seeker, ok := file.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	}

	// 4. Validate magic bytes match declared content type
	var detectedMimeType string
	for mimeType, magic := range allowedImageTypes {
		if len(magicBytes) >= len(magic) && bytes.HasPrefix(magicBytes, magic) {
			// Special case for webp: check for WEBP signature after RIFF
			if mimeType == "image/webp" {
				if len(magicBytes) >= 12 && string(magicBytes[8:12]) == "WEBP" {
					detectedMimeType = mimeType
					break
				}
				continue
			}
			detectedMimeType = mimeType
			break
		}
	}

	if detectedMimeType == "" {
		return "", fmt.Errorf("formato de imagem inválido, o conteúdo do arquivo não corresponde a um tipo de imagem permitido")
	}

	// 5. Validate that extension matches detected type
	extensionMimeMap := map[string][]string{
		".jpg":  {"image/jpeg"},
		".jpeg": {"image/jpeg"},
		".png":  {"image/png"},
		".gif":  {"image/gif"},
		".webp": {"image/webp"},
	}

	validMimes := extensionMimeMap[ext]
	mimeMatches := false
	for _, validMime := range validMimes {
		if validMime == detectedMimeType {
			mimeMatches = true
			break
		}
	}

	if !mimeMatches {
		return "", fmt.Errorf("a extensão do arquivo não corresponde ao conteúdo")
	}

	return detectedMimeType, nil
}

type ExecutionHandler struct {
	executionRepo repository.ExecutionRepository
	detectionRepo repository.DetectionRepository
	voidRepo      repository.DetectionVoidRepository
	evidenceRepo  repository.EvidenceRepository
}

func NewExecutionHandler(
	executionRepo repository.ExecutionRepository,
	detectionRepo repository.DetectionRepository,
	voidRepo repository.DetectionVoidRepository,
	evidenceRepo repository.EvidenceRepository,
) *ExecutionHandler {
	return &ExecutionHandler{
		executionRepo: executionRepo,
		detectionRepo: detectionRepo,
		voidRepo:      voidRepo,
		evidenceRepo:  evidenceRepo,
	}
}

type CreateExecutionRequest struct {
	ExerciseTechniqueID string `json:"exercise_technique_id"`
	ExecutedAt          string `json:"executed_at"` // ISO 8601 format
	TargetSystem        string `json:"target_system"`
	CommandUsed         string `json:"command_used"`
	Notes               string `json:"notes"`
}

type ExecutionResponse struct {
	ID                  string     `json:"id"`
	ExerciseTechniqueID string     `json:"exercise_technique_id"`
	ExecutedBy          *string    `json:"executed_by"`
	ExecutedAt          string     `json:"executed_at"`
	TargetSystem        *string    `json:"target_system"`
	CommandUsed         *string    `json:"command_used"`
	Notes               *string    `json:"notes"`
	CreatedAt           string     `json:"created_at"`
	Evidences           []Evidence `json:"evidences,omitempty"`
}

type Evidence struct {
	ID          string  `json:"id"`
	FileName    string  `json:"file_name"`
	FileType    *string `json:"file_type"`
	FileSize    *int64  `json:"file_size"`
	Description *string `json:"description"`
	Caption     *string `json:"caption"`
	UploadedAt  string  `json:"uploaded_at"`
}

func (h *ExecutionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.ExerciseTechniqueID == "" || req.ExecutedAt == "" {
		response.BadRequest(w, "exercise_technique_id and executed_at are required")
		return
	}

	etID, err := uuid.Parse(req.ExerciseTechniqueID)
	if err != nil {
		response.BadRequest(w, "Invalid exercise_technique_id")
		return
	}

	executedAt, err := time.Parse(time.RFC3339, req.ExecutedAt)
	if err != nil {
		response.BadRequest(w, "Invalid executed_at format (use ISO 8601)")
		return
	}

	claims := middleware.GetClaims(r.Context())
	execution := &entity.Execution{
		ExerciseTechniqueID: etID,
		ExecutedAt:          executedAt,
	}

	if claims != nil {
		execution.ExecutedBy = &claims.UserID
	}
	if req.TargetSystem != "" {
		execution.TargetSystem = &req.TargetSystem
	}
	if req.CommandUsed != "" {
		execution.CommandUsed = &req.CommandUsed
	}
	if req.Notes != "" {
		execution.Notes = &req.Notes
	}

	if err := h.executionRepo.Create(r.Context(), execution); err != nil {
		response.InternalError(w, "Failed to create execution")
		return
	}

	response.Created(w, toExecutionResponse(execution, nil))
}

func (h *ExecutionHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "executionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid execution ID")
		return
	}

	execution, err := h.executionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if execution == nil {
		response.NotFound(w, "Execution not found")
		return
	}

	// Get evidences
	evidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityExecution, execution.ID)

	response.Success(w, toExecutionResponse(execution, evidences))
}

func (h *ExecutionHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "executionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid execution ID")
		return
	}

	execution, err := h.executionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if execution == nil {
		response.NotFound(w, "Execution not found")
		return
	}

	var req CreateExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.ExecutedAt != "" {
		executedAt, err := time.Parse(time.RFC3339, req.ExecutedAt)
		if err == nil {
			execution.ExecutedAt = executedAt
		}
	}
	if req.TargetSystem != "" {
		execution.TargetSystem = &req.TargetSystem
	}
	if req.CommandUsed != "" {
		execution.CommandUsed = &req.CommandUsed
	}
	if req.Notes != "" {
		execution.Notes = &req.Notes
	}

	if err := h.executionRepo.Update(r.Context(), execution); err != nil {
		response.InternalError(w, "Failed to update execution")
		return
	}

	response.Success(w, toExecutionResponse(execution, nil))
}

func (h *ExecutionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "executionID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid execution ID")
		return
	}

	execution, err := h.executionRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if execution == nil {
		response.NotFound(w, "Execution not found")
		return
	}

	// Delete all evidences associated with this execution
	evidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityExecution, execution.ID)
	for _, ev := range evidences {
		// Remove file from disk
		os.Remove(ev.FilePath)
		// Delete evidence record
		h.evidenceRepo.Delete(r.Context(), ev.ID)
	}

	// Delete the execution
	if err := h.executionRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete execution")
		return
	}

	response.NoContent(w)
}

func (h *ExecutionHandler) ListByExercise(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	executions, err := h.executionRepo.ListByExercise(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	executionResponses := make([]ExecutionResponse, 0, len(executions))
	for _, e := range executions {
		evidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityExecution, e.ID)
		executionResponses = append(executionResponses, toExecutionResponse(&e, evidences))
	}

	response.Success(w, executionResponses)
}

func toExecutionResponse(e *entity.Execution, evidences []entity.Evidence) ExecutionResponse {
	resp := ExecutionResponse{
		ID:                  e.ID.String(),
		ExerciseTechniqueID: e.ExerciseTechniqueID.String(),
		ExecutedAt:          e.ExecutedAt.Format(time.RFC3339),
		TargetSystem:        e.TargetSystem,
		CommandUsed:         e.CommandUsed,
		Notes:               e.Notes,
		CreatedAt:           e.CreatedAt.Format(time.RFC3339),
	}

	if e.ExecutedBy != nil {
		s := e.ExecutedBy.String()
		resp.ExecutedBy = &s
	}

	for _, ev := range evidences {
		resp.Evidences = append(resp.Evidences, Evidence{
			ID:          ev.ID.String(),
			FileName:    ev.FileName,
			FileType:    ev.FileType,
			FileSize:    ev.FileSize,
			Description: ev.Description,
			Caption:     ev.Caption,
			UploadedAt:  ev.UploadedAt.Format(time.RFC3339),
		})
	}

	return resp
}

// Upload evidence for an execution (images only - OWASP compliant)
func (h *ExecutionHandler) UploadEvidence(w http.ResponseWriter, r *http.Request) {
	executionIDStr := chi.URLParam(r, "executionID")
	executionID, err := uuid.Parse(executionIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid execution ID")
		return
	}

	// Verify execution exists
	execution, err := h.executionRepo.GetByID(r.Context(), executionID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if execution == nil {
		response.NotFound(w, "Execution not found")
		return
	}

	// Parse multipart form (max 10MB for images)
	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		response.BadRequest(w, "Dados de formulário inválidos ou arquivo muito grande (máximo 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.BadRequest(w, "Arquivo é obrigatório")
		return
	}
	defer file.Close()

	// OWASP: Validate image file (extension, magic bytes, size)
	detectedMimeType, err := validateImageFile(file, header)
	if err != nil {
		response.BadRequest(w, err.Error())
		return
	}

	caption := r.FormValue("caption")
	description := r.FormValue("description")

	claims := middleware.GetClaims(r.Context())

	// Create evidence record with validated content type
	evidence := &entity.Evidence{
		EntityType: entity.EvidenceEntityExecution,
		EntityID:   executionID,
		FileName:   sanitizeFilename(header.Filename),
		FileType:   &detectedMimeType,
		FileSize:   &header.Size,
	}

	if caption != "" {
		evidence.Caption = &caption
	}
	if description != "" {
		evidence.Description = &description
	}
	if claims != nil {
		evidence.UploadedBy = &claims.UserID
	}

	// Save file to disk with sanitized filename
	filePath, err := saveEvidenceFile(file, executionID.String(), evidence.FileName, detectedMimeType)
	if err != nil {
		response.InternalError(w, "Falha ao salvar arquivo")
		return
	}
	evidence.FilePath = filePath

	if err := h.evidenceRepo.Create(r.Context(), evidence); err != nil {
		response.InternalError(w, "Falha ao criar registro de evidência")
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

// sanitizeFilename removes potentially dangerous characters from filename
func sanitizeFilename(filename string) string {
	// Get base name without path
	filename = filepath.Base(filename)

	// Remove null bytes and other control characters
	var sanitized strings.Builder
	for _, r := range filename {
		if r >= 32 && r != 127 && r != '/' && r != '\\' && r != ':' && r != '*' && r != '?' && r != '"' && r != '<' && r != '>' && r != '|' {
			sanitized.WriteRune(r)
		}
	}

	result := sanitized.String()
	if result == "" {
		result = "image"
	}

	return result
}

// Delete evidence
func (h *ExecutionHandler) DeleteEvidence(w http.ResponseWriter, r *http.Request) {
	evidenceIDStr := chi.URLParam(r, "evidenceID")
	evidenceID, err := uuid.Parse(evidenceIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid evidence ID")
		return
	}

	// Get evidence to delete file from disk
	evidence, err := h.evidenceRepo.GetByID(r.Context(), evidenceID)
	if err == nil && evidence != nil {
		// Remove file from disk
		os.Remove(evidence.FilePath)
	}

	if err := h.evidenceRepo.Delete(r.Context(), evidenceID); err != nil {
		response.InternalError(w, "Failed to delete evidence")
		return
	}

	response.NoContent(w)
}

// UpdateEvidenceCaption updates the caption of an evidence
func (h *ExecutionHandler) UpdateEvidenceCaption(w http.ResponseWriter, r *http.Request) {
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
	response.JSON(w, http.StatusOK, evidence)
}

// GetEvidenceFile serves an evidence image file
func (h *ExecutionHandler) GetEvidenceFile(w http.ResponseWriter, r *http.Request) {
	evidenceIDStr := chi.URLParam(r, "evidenceID")
	evidenceID, err := uuid.Parse(evidenceIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid evidence ID")
		return
	}

	evidence, err := h.evidenceRepo.GetByID(r.Context(), evidenceID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if evidence == nil {
		response.NotFound(w, "Evidence not found")
		return
	}

	// Validate file path is within uploads directory (prevent path traversal)
	absDir, _ := filepath.Abs(uploadsDir)
	absPath, _ := filepath.Abs(evidence.FilePath)
	if !strings.HasPrefix(absPath, absDir) {
		response.BadRequest(w, "Invalid file path")
		return
	}

	// Open file
	file, err := os.Open(evidence.FilePath)
	if err != nil {
		response.NotFound(w, "File not found")
		return
	}
	defer file.Close()

	// Set content type
	contentType := "image/jpeg"
	if evidence.FileType != nil {
		contentType = *evidence.FileType
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")

	// Serve file
	io.Copy(w, file)
}

// List executions by exercise technique
func (h *ExecutionHandler) ListByTechnique(w http.ResponseWriter, r *http.Request) {
	techniqueIDStr := chi.URLParam(r, "techniqueID")
	techniqueID, err := uuid.Parse(techniqueIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid technique ID")
		return
	}

	executions, err := h.executionRepo.ListByTechnique(r.Context(), techniqueID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	executionResponses := make([]ExecutionResponse, 0, len(executions))
	for _, e := range executions {
		evidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityExecution, e.ID)
		executionResponses = append(executionResponses, toExecutionResponse(&e, evidences))
	}

	response.Success(w, executionResponses)
}

// saveEvidenceFile saves an uploaded file to disk and returns the file path
// Uses the validated MIME type to determine the correct extension
func saveEvidenceFile(file multipart.File, entityID, filename string, mimeType string) (string, error) {
	// Create directory structure
	dir := filepath.Join(uploadsDir, entityID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}

	// Determine extension from validated MIME type (not from user input)
	mimeToExt := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}

	ext := mimeToExt[mimeType]
	if ext == "" {
		ext = ".jpg" // Default fallback
	}

	// Generate unique filename to prevent conflicts and path traversal
	uniqueName := fmt.Sprintf("%s_%s%s", uuid.New().String()[:8], time.Now().Format("20060102150405"), ext)
	filePath := filepath.Join(dir, uniqueName)

	// Ensure the final path is still within the uploads directory (prevent path traversal)
	absDir, _ := filepath.Abs(uploadsDir)
	absPath, _ := filepath.Abs(filePath)
	if !strings.HasPrefix(absPath, absDir) {
		return "", fmt.Errorf("invalid file path")
	}

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	// Copy file contents
	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return filePath, nil
}
