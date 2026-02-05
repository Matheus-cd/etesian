package handler

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
	"github.com/etesian/backend/internal/domain/service"
)

// Report DTOs

type ClientWithExercises struct {
	Client            ClientResponse `json:"client"`
	ExerciseCount     int            `json:"exercise_count"`
	LatestExercise    *string        `json:"latest_exercise"`
	AvgDetectionRate  float64        `json:"avg_detection_rate"`
	CompletedCount    int            `json:"completed_count"`
}

type ExerciseReportSummary struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	StartedAt      *string `json:"started_at"`
	CompletedAt    *string `json:"completed_at"`
	CreatedAt      string  `json:"created_at"`
	TechniqueCount int     `json:"technique_count"`
	DetectionRate  float64 `json:"detection_rate"`
	SIEMRate       float64 `json:"siem_rate"`
	ToolRate       float64 `json:"tool_rate"`
}

type TechniqueReportData struct {
	ID           string               `json:"id"`
	TechniqueID  string               `json:"technique_id"`
	MitreID      *string              `json:"mitre_id"`
	Name         string               `json:"name"`
	Tactic       *string              `json:"tactic"`
	Status       string               `json:"status"`
	Notes        *string              `json:"notes"`
	Executions   []ExecutionDetail    `json:"executions"`
	Detections   []DetectionDetail    `json:"detections"`
	ResponseTime *ResponseTimeDetail  `json:"response_time,omitempty"`
}

type ExecutionDetail struct {
	ID           string  `json:"id"`
	ExecutedBy   *string `json:"executed_by"`
	ExecutedByID *string `json:"executed_by_id"`
	ExecutedAt   string  `json:"executed_at"`
	TargetSystem *string `json:"target_system"`
	CommandUsed  *string `json:"command_used"`
	Notes        *string `json:"notes"`
}

type DetectionDetail struct {
	ID              string  `json:"id"`
	DetectedBy      *string `json:"detected_by"`
	DetectedByID    *string `json:"detected_by_id"`
	DetectionStatus string  `json:"detection_status"`

	ToolDetected      bool    `json:"tool_detected"`
	ToolName          *string `json:"tool_name"`
	ToolDetectedAt    *string `json:"tool_detected_at"`
	ToolAlertID       *string `json:"tool_alert_id"`
	ToolNotApplicable bool    `json:"tool_not_applicable"`

	SIEMDetected      bool    `json:"siem_detected"`
	SIEMName          *string `json:"siem_name"`
	SIEMDetectedAt    *string `json:"siem_detected_at"`
	SIEMAlertID       *string `json:"siem_alert_id"`
	SIEMNotApplicable bool    `json:"siem_not_applicable"`

	AnalystNotes *string `json:"analyst_notes"`
	CreatedAt    string  `json:"created_at"`
}

type ResponseTimeDetail struct {
	ToolResponseSeconds *int64 `json:"tool_response_seconds,omitempty"`
	SIEMResponseSeconds *int64 `json:"siem_response_seconds,omitempty"`
	GapSeconds          *int64 `json:"gap_seconds,omitempty"`
}

type ResponseMetrics struct {
	MeanTimeToDetectTool *float64       `json:"mttd_tool"`
	MeanTimeToDetectSIEM *float64       `json:"mttd_siem"`
	FastestToolDetection *float64       `json:"fastest_tool"`
	SlowestToolDetection *float64       `json:"slowest_tool"`
	FastestSIEMDetection *float64       `json:"fastest_siem"`
	SlowestSIEMDetection *float64       `json:"slowest_siem"`
	ToolByTimeRange      map[string]int `json:"tool_by_time_range"`
	SIEMByTimeRange      map[string]int `json:"siem_by_time_range"`
	ToolNotDetectedCount int            `json:"tool_not_detected_count"`
	SIEMNotDetectedCount int            `json:"siem_not_detected_count"`
	ByTimeRange          map[string]int `json:"by_time_range"` // Deprecated: kept for backwards compatibility
}

type DetectionSummary struct {
	TotalTechniques    int     `json:"total_techniques"`
	TotalWithExecution int     `json:"total_with_execution"`
	TotalWithDetection int     `json:"total_with_detection"`

	ToolDetected      int     `json:"tool_detected"`
	ToolNotDetected   int     `json:"tool_not_detected"`
	ToolNotApplicable int     `json:"tool_not_applicable"`
	ToolRate          float64 `json:"tool_rate"`

	SIEMDetected      int     `json:"siem_detected"`
	SIEMNotDetected   int     `json:"siem_not_detected"`
	SIEMNotApplicable int     `json:"siem_not_applicable"`
	SIEMRate          float64 `json:"siem_rate"`

	FinalDetected      int     `json:"final_detected"`
	FinalPartial       int     `json:"final_partial"`
	FinalNotDetected   int     `json:"final_not_detected"`
	FinalNotApplicable int     `json:"final_not_applicable"`
	FinalNotExecuted   int     `json:"final_not_executed"`
}

type TacticCoverageData struct {
	Tactic        string  `json:"tactic"`
	Total         int     `json:"total"`
	Detected      int     `json:"detected"`
	Partial       int     `json:"partial"`
	NotDetected   int     `json:"not_detected"`
	NotApplicable int     `json:"not_applicable"`
	NotExecuted   int     `json:"not_executed"`
	SIEMRate      float64 `json:"siem_rate"`
}

type EvidenceSummary struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	FileName    *string `json:"file_name"`
	Caption     *string `json:"caption"`
	UploadedAt  string  `json:"uploaded_at"`
	UploadedBy  *string `json:"uploaded_by"`
	RelatedTo   string  `json:"related_to"`
	RelatedToID string  `json:"related_to_id"`
}

type Recommendation struct {
	Priority    string   `json:"priority"`
	Category    string   `json:"category"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Techniques  []string `json:"techniques"`
	MitreIDs    []string `json:"mitre_ids"`
}

type ExerciseReportData struct {
	Exercise         ExerciseResponse      `json:"exercise"`
	Members          []MemberResponse      `json:"members"`
	Techniques       []TechniqueReportData `json:"techniques"`
	DetectionSummary DetectionSummary      `json:"detection_summary"`
	ResponseMetrics  ResponseMetrics       `json:"response_metrics"`
	TacticCoverage   []TacticCoverageData  `json:"tactic_coverage"`
	Evidence         []EvidenceSummary     `json:"evidence"`
	Recommendations  []Recommendation      `json:"recommendations"`
}

type MemberResponse struct {
	ID             string `json:"id"`
	UserID         string `json:"user_id"`
	Username       string `json:"username"`
	FullName       string `json:"full_name"`
	Email          string `json:"email"`
	RoleInExercise string `json:"role_in_exercise"`
}

// MITRE ATT&CK tactic order
var tacticOrder = []string{
	"Reconnaissance",
	"Resource Development",
	"Initial Access",
	"Execution",
	"Persistence",
	"Privilege Escalation",
	"Defense Evasion",
	"Credential Access",
	"Discovery",
	"Lateral Movement",
	"Collection",
	"Command and Control",
	"Exfiltration",
	"Impact",
}

// ReportHandler handles report-related endpoints
type ReportHandler struct {
	clientRepo            repository.ClientRepository
	exerciseRepo          repository.ExerciseRepository
	memberRepo            repository.ExerciseMemberRepository
	exerciseTechniqueRepo repository.ExerciseTechniqueRepository
	executionRepo         repository.ExecutionRepository
	detectionRepo         repository.DetectionRepository
	evidenceRepo          repository.EvidenceRepository
	userRepo              repository.UserRepository
	detectionStatsService *service.DetectionStatsService
}

func NewReportHandler(
	clientRepo repository.ClientRepository,
	exerciseRepo repository.ExerciseRepository,
	memberRepo repository.ExerciseMemberRepository,
	exerciseTechniqueRepo repository.ExerciseTechniqueRepository,
	executionRepo repository.ExecutionRepository,
	detectionRepo repository.DetectionRepository,
	evidenceRepo repository.EvidenceRepository,
	userRepo repository.UserRepository,
	detectionStatsService *service.DetectionStatsService,
) *ReportHandler {
	return &ReportHandler{
		clientRepo:            clientRepo,
		exerciseRepo:          exerciseRepo,
		memberRepo:            memberRepo,
		exerciseTechniqueRepo: exerciseTechniqueRepo,
		executionRepo:         executionRepo,
		detectionRepo:         detectionRepo,
		evidenceRepo:          evidenceRepo,
		userRepo:              userRepo,
		detectionStatsService: detectionStatsService,
	}
}

// ListClientsWithExercises returns all clients with their exercise stats
func (h *ReportHandler) ListClientsWithExercises(w http.ResponseWriter, r *http.Request) {
	clients, err := h.clientRepo.GetAll(r.Context())
	if err != nil {
		response.InternalError(w, "Failed to fetch clients")
		return
	}

	var result []ClientWithExercises
	for _, client := range clients {
		// Get exercises for this client
		filters := repository.ExerciseFilters{
			ClientID: &client.ID,
			Limit:    1000, // Get all exercises
		}
		exercises, _, err := h.exerciseRepo.List(r.Context(), filters)
		if err != nil {
			continue
		}

		clientData := ClientWithExercises{
			Client: ClientResponse{
				ID:          client.ID.String(),
				Name:        client.Name,
				Description: client.Description,
				CreatedAt:   client.CreatedAt.Format(time.RFC3339),
				UpdatedAt:   client.UpdatedAt.Format(time.RFC3339),
			},
			ExerciseCount:    len(exercises),
			CompletedCount:   0,
			AvgDetectionRate: 0,
		}

		var latestDate *time.Time
		var totalDetectionRate float64
		completedWithDetection := 0

		for _, ex := range exercises {
			if ex.Status == entity.ExerciseStatusCompleted {
				clientData.CompletedCount++

				// Calculate detection rate for completed exercises
				rate, hasDetections := h.calculateExerciseDetectionRate(r.Context(), ex.ID, ex.Status == entity.ExerciseStatusCompleted)
				if hasDetections {
					totalDetectionRate += rate
					completedWithDetection++
				}
			}

			if latestDate == nil || ex.CreatedAt.After(*latestDate) {
				latestDate = &ex.CreatedAt
			}
		}

		if latestDate != nil {
			s := latestDate.Format(time.RFC3339)
			clientData.LatestExercise = &s
		}

		if completedWithDetection > 0 {
			clientData.AvgDetectionRate = totalDetectionRate / float64(completedWithDetection)
		}

		result = append(result, clientData)
	}

	response.Success(w, result)
}

// GetClientExercises returns all exercises for a specific client
func (h *ReportHandler) GetClientExercises(w http.ResponseWriter, r *http.Request) {
	clientIDStr := chi.URLParam(r, "clientID")
	clientID, err := uuid.Parse(clientIDStr)
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
		response.NotFound(w, "Client not found")
		return
	}

	// Get exercises
	filters := repository.ExerciseFilters{
		ClientID: &clientID,
		Limit:    1000,
	}
	exercises, _, err := h.exerciseRepo.List(r.Context(), filters)
	if err != nil {
		response.InternalError(w, "Failed to fetch exercises")
		return
	}

	var result []ExerciseReportSummary
	for _, ex := range exercises {
		techniques, _ := h.exerciseTechniqueRepo.GetByExercise(r.Context(), ex.ID)

		summary := ExerciseReportSummary{
			ID:             ex.ID.String(),
			Name:           ex.Name,
			Status:         string(ex.Status),
			CreatedAt:      ex.CreatedAt.Format(time.RFC3339),
			TechniqueCount: len(techniques),
		}

		if ex.StartedAt != nil {
			s := ex.StartedAt.Format(time.RFC3339)
			summary.StartedAt = &s
		}
		if ex.CompletedAt != nil {
			c := ex.CompletedAt.Format(time.RFC3339)
			summary.CompletedAt = &c
		}

		// Calculate detection rates
		exerciseCompleted := ex.Status == entity.ExerciseStatusCompleted
		summary.DetectionRate, _ = h.calculateExerciseDetectionRate(r.Context(), ex.ID, exerciseCompleted)
		summary.SIEMRate, summary.ToolRate = h.calculateExerciseSIEMAndToolRates(r.Context(), ex.ID, exerciseCompleted)

		result = append(result, summary)
	}

	// Sort by created date (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt > result[j].CreatedAt
	})

	response.Success(w, result)
}

// GetExerciseReport returns full report data for an exercise
func (h *ReportHandler) GetExerciseReport(w http.ResponseWriter, r *http.Request) {
	exerciseIDStr := chi.URLParam(r, "exerciseID")
	exerciseID, err := uuid.Parse(exerciseIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid exercise ID")
		return
	}

	// Get exercise
	exercise, err := h.exerciseRepo.GetByID(r.Context(), exerciseID)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}
	if exercise == nil {
		response.NotFound(w, "Exercise not found")
		return
	}

	// Populate client
	if exercise.ClientID != nil {
		client, _ := h.clientRepo.GetByID(r.Context(), *exercise.ClientID)
		exercise.Client = client
	}

	// Build report data
	report := ExerciseReportData{
		Exercise: toExerciseResponse(exercise),
	}

	// Get members
	members, _ := h.memberRepo.GetByExercise(r.Context(), exerciseID)
	for _, m := range members {
		user, _ := h.userRepo.GetByID(r.Context(), m.UserID)
		if user != nil {
			report.Members = append(report.Members, MemberResponse{
				ID:             m.ID.String(),
				UserID:         m.UserID.String(),
				Username:       user.Username,
				FullName:       user.FullName,
				Email:          user.Email,
				RoleInExercise: string(m.RoleInExercise),
			})
		}
	}

	// Get techniques with full details
	techniques, _ := h.exerciseTechniqueRepo.GetByExerciseWithDetails(r.Context(), exerciseID)

	// Initialize response metrics
	responseMetrics := ResponseMetrics{
		ToolByTimeRange: make(map[string]int),
		SIEMByTimeRange: make(map[string]int),
		ByTimeRange:     make(map[string]int), // Deprecated: kept for backwards compatibility
	}
	var toolResponseTimes []float64
	var siemResponseTimes []float64

	// Tactic stats map (will be populated by service)
	tacticMap := make(map[string]*TacticCoverageData)
	for _, tactic := range tacticOrder {
		tacticMap[tactic] = &TacticCoverageData{Tactic: tactic}
	}

	// Evidence collection
	var allEvidence []EvidenceSummary

	// Recommendations data
	techniquesWithoutSIEM := []string{}
	techniquesWithoutSIEMMitreIDs := []string{}
	techniquesNotDetected := []string{}
	techniquesNotDetectedMitreIDs := []string{}

	// Collect detection results using the unified service
	var detectionResults []*service.TechniqueDetectionResult

	for _, et := range techniques {
		techData := TechniqueReportData{
			ID:          et.ID.String(),
			TechniqueID: et.TechniqueID.String(),
			Status:      string(et.Status),
			Notes:       et.Notes,
		}

		if et.Technique != nil {
			techData.Name = et.Technique.Name
			techData.MitreID = et.Technique.MitreID
			techData.Tactic = et.Technique.Tactic
		}

		// Get tactic name for stats
		tacticName := "Unknown"
		if et.Technique != nil && et.Technique.Tactic != nil {
			tacticName = *et.Technique.Tactic
		}

		// Initialize tactic stat if needed
		if _, ok := tacticMap[tacticName]; !ok {
			tacticMap[tacticName] = &TacticCoverageData{Tactic: tacticName}
		}

		// Use the unified service to calculate detection result for this technique
		// Note: For stats, we DON'T consider exercise completion - only actual executions
		// This matches the frontend algorithm exactly
		detResult, _ := h.detectionStatsService.CalculateForTechnique(
			r.Context(),
			et.ID,
			et.TechniqueID,
			tacticName,
			false, // Don't use exerciseIsCompleted - stats should only count actual executions
			et.Status,
			nil, // StartedAt check not needed for basic stats
			nil, // CompletedAt check not needed for basic stats
		)
		detectionResults = append(detectionResults, detResult)

		// Get executions for report details
		executions, _ := h.executionRepo.ListByTechnique(r.Context(), et.ID)

		for _, exec := range executions {
			execDetail := ExecutionDetail{
				ID:           exec.ID.String(),
				ExecutedAt:   exec.ExecutedAt.Format(time.RFC3339),
				TargetSystem: exec.TargetSystem,
				CommandUsed:  exec.CommandUsed,
				Notes:        exec.Notes,
			}

			if exec.ExecutedBy != nil {
				user, _ := h.userRepo.GetByID(r.Context(), *exec.ExecutedBy)
				if user != nil {
					execDetail.ExecutedBy = &user.FullName
					id := user.ID.String()
					execDetail.ExecutedByID = &id
				}
			}

			techData.Executions = append(techData.Executions, execDetail)

			// Get execution evidence
			execEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityExecution, exec.ID)
			for _, ev := range execEvidences {
				allEvidence = append(allEvidence, h.toEvidenceSummary(r.Context(), &ev, "execution", exec.ID.String()))
			}
		}

		// Collect ALL detections for report details
		if len(executions) > 0 {
			for _, exec := range executions {
				detections, _ := h.detectionRepo.ListByExecution(r.Context(), exec.ID)

				for _, det := range detections {
					detDetail := DetectionDetail{
						ID:                det.ID.String(),
						DetectionStatus:   string(det.DetectionStatus),
						ToolDetected:      det.ToolDetected,
						ToolName:          det.ToolName,
						ToolNotApplicable: det.ToolNotApplicable,
						SIEMDetected:      det.SIEMDetected,
						SIEMName:          det.SIEMName,
						SIEMNotApplicable: det.SIEMNotApplicable,
						AnalystNotes:      det.AnalystNotes,
						CreatedAt:         det.CreatedAt.Format(time.RFC3339),
					}

					if det.DetectedBy != nil {
						user, _ := h.userRepo.GetByID(r.Context(), *det.DetectedBy)
						if user != nil {
							detDetail.DetectedBy = &user.FullName
							id := user.ID.String()
							detDetail.DetectedByID = &id
						}
					}

					if det.ToolDetectedAt != nil {
						s := det.ToolDetectedAt.Format(time.RFC3339)
						detDetail.ToolDetectedAt = &s
					}
					if det.SIEMDetectedAt != nil {
						s := det.SIEMDetectedAt.Format(time.RFC3339)
						detDetail.SIEMDetectedAt = &s
					}
					detDetail.ToolAlertID = det.ToolAlertID
					detDetail.SIEMAlertID = det.SIEMAlertID

					techData.Detections = append(techData.Detections, detDetail)

					// Calculate response times using the execution this detection belongs to
					responseTime := &ResponseTimeDetail{}

					if toolResp := det.CalculateToolResponseTime(exec.ExecutedAt); toolResp != nil {
						responseTime.ToolResponseSeconds = toolResp
						toolResponseTimes = append(toolResponseTimes, float64(*toolResp))
						h.categorizeResponseTime(responseMetrics.ToolByTimeRange, float64(*toolResp))
						h.categorizeResponseTime(responseMetrics.ByTimeRange, float64(*toolResp)) // Deprecated: kept for backwards compatibility
					}
					if siemResp := det.CalculateSIEMResponseTime(exec.ExecutedAt); siemResp != nil {
						responseTime.SIEMResponseSeconds = siemResp
						siemResponseTimes = append(siemResponseTimes, float64(*siemResp))
						h.categorizeResponseTime(responseMetrics.SIEMByTimeRange, float64(*siemResp))
					}
					if gap := det.CalculateToolToSIEMGap(); gap != nil {
						responseTime.GapSeconds = gap
					}

					if responseTime.ToolResponseSeconds != nil || responseTime.SIEMResponseSeconds != nil {
						techData.ResponseTime = responseTime
					}

					// Get detection evidence
					toolEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionTool, det.ID)
					for _, ev := range toolEvidences {
						allEvidence = append(allEvidence, h.toEvidenceSummary(r.Context(), &ev, "detection_tool", det.ID.String()))
					}
					siemEvidences, _ := h.evidenceRepo.GetByEntity(r.Context(), entity.EvidenceEntityDetectionSIEM, det.ID)
					for _, ev := range siemEvidences {
						allEvidence = append(allEvidence, h.toEvidenceSummary(r.Context(), &ev, "detection_siem", det.ID.String()))
					}
				}
			}
		}

		// Track recommendations based on detection result
		if detResult.HasExecution && detResult.LatestDetection != nil {
			det := detResult.LatestDetection
			if det.ToolNotApplicable && det.SIEMNotApplicable {
				// Not applicable - no recommendation needed
			} else if det.SIEMDetected && !det.SIEMNotApplicable {
				// Fully detected - no recommendation needed
			} else if det.ToolDetected && !det.ToolNotApplicable {
				// Partial - only tool detected, missing SIEM
				techniquesWithoutSIEM = append(techniquesWithoutSIEM, techData.Name)
				if techData.MitreID != nil {
					techniquesWithoutSIEMMitreIDs = append(techniquesWithoutSIEMMitreIDs, *techData.MitreID)
				}
			} else {
				// Not detected
				techniquesNotDetected = append(techniquesNotDetected, techData.Name)
				if techData.MitreID != nil {
					techniquesNotDetectedMitreIDs = append(techniquesNotDetectedMitreIDs, *techData.MitreID)
				}
			}
		} else if detResult.HasExecution && detResult.LatestDetection == nil {
			// Has execution but no detection - count as not detected
			techniquesNotDetected = append(techniquesNotDetected, techData.Name)
			if techData.MitreID != nil {
				techniquesNotDetectedMitreIDs = append(techniquesNotDetectedMitreIDs, *techData.MitreID)
			}
		}

		report.Techniques = append(report.Techniques, techData)
	}

	// Calculate detection summary using the unified service
	serviceStats := h.detectionStatsService.CalculateStats(detectionResults)
	summary := DetectionSummary{
		TotalTechniques:    serviceStats.TotalTechniques,
		TotalWithExecution: serviceStats.TotalWithExecution,
		TotalWithDetection: serviceStats.TotalWithDetection,
		ToolDetected:       serviceStats.ToolDetected,
		ToolNotDetected:    serviceStats.ToolNotDetected,
		ToolNotApplicable:  serviceStats.ToolNotApplicable,
		ToolRate:           serviceStats.ToolRate,
		SIEMDetected:       serviceStats.SIEMDetected,
		SIEMNotDetected:    serviceStats.SIEMNotDetected,
		SIEMNotApplicable:  serviceStats.SIEMNotApplicable,
		SIEMRate:           serviceStats.SIEMRate,
		FinalDetected:      serviceStats.FinalDetected,
		FinalPartial:       serviceStats.FinalPartial,
		FinalNotDetected:   serviceStats.FinalNotDetected + serviceStats.FinalPending, // Merge pending into not detected for backwards compatibility
		FinalNotApplicable: serviceStats.FinalNotApplicable,
		FinalNotExecuted:   serviceStats.FinalNotExecuted,
	}

	// Calculate tactic stats using the unified service
	serviceTacticStats := h.detectionStatsService.CalculateTacticStats(detectionResults)
	for tacticName, stat := range serviceTacticStats {
		if _, ok := tacticMap[tacticName]; !ok {
			tacticMap[tacticName] = &TacticCoverageData{Tactic: tacticName}
		}
		tacticMap[tacticName].Total = stat.Total
		tacticMap[tacticName].Detected = stat.Detected
		tacticMap[tacticName].Partial = stat.Partial
		tacticMap[tacticName].NotDetected = stat.NotDetected + stat.Pending // Merge pending into not detected
		tacticMap[tacticName].NotApplicable = stat.NotApplicable
		tacticMap[tacticName].NotExecuted = stat.NotExecuted
		tacticMap[tacticName].SIEMRate = stat.SIEMRate
	}

	// Calculate MTTD
	if len(toolResponseTimes) > 0 {
		sum := 0.0
		min := toolResponseTimes[0]
		max := toolResponseTimes[0]
		for _, t := range toolResponseTimes {
			sum += t
			if t < min {
				min = t
			}
			if t > max {
				max = t
			}
		}
		avg := sum / float64(len(toolResponseTimes))
		responseMetrics.MeanTimeToDetectTool = &avg
		responseMetrics.FastestToolDetection = &min
		responseMetrics.SlowestToolDetection = &max
	}

	if len(siemResponseTimes) > 0 {
		sum := 0.0
		min := siemResponseTimes[0]
		max := siemResponseTimes[0]
		for _, t := range siemResponseTimes {
			sum += t
			if t < min {
				min = t
			}
			if t > max {
				max = t
			}
		}
		avg := sum / float64(len(siemResponseTimes))
		responseMetrics.MeanTimeToDetectSIEM = &avg
		responseMetrics.FastestSIEMDetection = &min
		responseMetrics.SlowestSIEMDetection = &max
	}

	// Set not detected counts from the calculated stats
	responseMetrics.ToolNotDetectedCount = serviceStats.ToolNotDetected
	responseMetrics.SIEMNotDetectedCount = serviceStats.SIEMNotDetected

	// Build tactic coverage
	var tacticCoverage []TacticCoverageData
	for _, tactic := range tacticOrder {
		if stat, ok := tacticMap[tactic]; ok {
			applicable := stat.Total - stat.NotApplicable - stat.NotExecuted
			if applicable > 0 {
				stat.SIEMRate = float64(stat.Detected) / float64(applicable) * 100
			}
			tacticCoverage = append(tacticCoverage, *stat)
		}
	}
	// Add any non-standard tactics
	for tactic, stat := range tacticMap {
		found := false
		for _, t := range tacticOrder {
			if t == tactic {
				found = true
				break
			}
		}
		if !found {
			applicable := stat.Total - stat.NotApplicable - stat.NotExecuted
			if applicable > 0 {
				stat.SIEMRate = float64(stat.Detected) / float64(applicable) * 100
			}
			tacticCoverage = append(tacticCoverage, *stat)
		}
	}

	// Build recommendations
	var recommendations []Recommendation

	if len(techniquesNotDetected) > 0 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "high",
			Category:    "detection_gap",
			Title:       "Techniques Not Detected",
			Description: "The following techniques were executed but not detected by either tool or SIEM. Consider improving detection coverage for these techniques.",
			Techniques:  techniquesNotDetected,
			MitreIDs:    techniquesNotDetectedMitreIDs,
		})
	}

	if len(techniquesWithoutSIEM) > 0 {
		recommendations = append(recommendations, Recommendation{
			Priority:    "medium",
			Category:    "siem_gap",
			Title:       "Techniques Missing SIEM Detection",
			Description: "The following techniques were detected by security tools but not by SIEM. Consider creating or tuning SIEM rules for these techniques.",
			Techniques:  techniquesWithoutSIEM,
			MitreIDs:    techniquesWithoutSIEMMitreIDs,
		})
	}

	// Check for tactics with low coverage
	for _, tc := range tacticCoverage {
		if tc.Total > 0 && tc.SIEMRate < 50 && tc.Total-tc.NotApplicable-tc.NotExecuted > 0 {
			recommendations = append(recommendations, Recommendation{
				Priority:    "medium",
				Category:    "coverage",
				Title:       "Low Detection Rate for " + tc.Tactic,
				Description: "This tactic has a SIEM detection rate below 50%. Consider improving detection capabilities for techniques in this category.",
				Techniques:  []string{},
				MitreIDs:    []string{},
			})
		}
	}

	report.DetectionSummary = summary
	report.ResponseMetrics = responseMetrics
	report.TacticCoverage = tacticCoverage
	report.Evidence = allEvidence
	report.Recommendations = recommendations

	response.Success(w, report)
}

// Helper functions

// calculateExerciseDetectionRate uses the unified detection stats service to calculate
// the SIEM detection rate for an exercise
func (h *ReportHandler) calculateExerciseDetectionRate(ctx context.Context, exerciseID uuid.UUID, _ bool) (float64, bool) {
	techniques, _ := h.exerciseTechniqueRepo.GetByExercise(ctx, exerciseID)
	if len(techniques) == 0 {
		return 0, false
	}

	// Collect detection results using the unified service
	var detectionResults []*service.TechniqueDetectionResult
	for _, et := range techniques {
		tacticName := "Unknown"
		// Note: et.Technique is nil here since we're using GetByExercise not GetByExerciseWithDetails
		detResult, _ := h.detectionStatsService.CalculateForTechnique(
			ctx,
			et.ID,
			et.TechniqueID,
			tacticName,
			false, // Don't use exerciseCompleted - only count actual executions
			et.Status,
			nil,
			nil,
		)
		detectionResults = append(detectionResults, detResult)
	}

	// Calculate stats using the unified service
	stats := h.detectionStatsService.CalculateStats(detectionResults)

	// Calculate applicable (total minus not applicable minus not executed)
	applicable := stats.TotalTechniques - stats.FinalNotApplicable - stats.FinalNotExecuted
	if applicable == 0 {
		return 0, false
	}

	return stats.SIEMRate, true
}

// calculateExerciseSIEMAndToolRates uses the unified detection stats service to calculate
// both SIEM and Tool detection rates for an exercise
func (h *ReportHandler) calculateExerciseSIEMAndToolRates(ctx context.Context, exerciseID uuid.UUID, _ bool) (float64, float64) {
	techniques, _ := h.exerciseTechniqueRepo.GetByExercise(ctx, exerciseID)
	if len(techniques) == 0 {
		return 0, 0
	}

	// Collect detection results using the unified service
	var detectionResults []*service.TechniqueDetectionResult
	for _, et := range techniques {
		tacticName := "Unknown"
		detResult, _ := h.detectionStatsService.CalculateForTechnique(
			ctx,
			et.ID,
			et.TechniqueID,
			tacticName,
			false, // Don't use exerciseCompleted - only count actual executions
			et.Status,
			nil,
			nil,
		)
		detectionResults = append(detectionResults, detResult)
	}

	// Calculate stats using the unified service
	stats := h.detectionStatsService.CalculateStats(detectionResults)

	return stats.SIEMRate, stats.ToolRate
}

func (h *ReportHandler) categorizeResponseTime(byTimeRange map[string]int, seconds float64) {
	switch {
	case seconds < 60:
		byTimeRange["< 1min"]++
	case seconds < 300:
		byTimeRange["1-5min"]++
	case seconds < 900:
		byTimeRange["5-15min"]++
	default:
		byTimeRange["> 15min"]++
	}
}

func (h *ReportHandler) toEvidenceSummary(ctx context.Context, ev *entity.Evidence, relatedTo, relatedToID string) EvidenceSummary {
	fileName := ev.FileName
	summary := EvidenceSummary{
		ID:          ev.ID.String(),
		Type:        string(ev.EntityType),
		FileName:    &fileName,
		Caption:     ev.Caption,
		UploadedAt:  ev.UploadedAt.Format(time.RFC3339),
		RelatedTo:   relatedTo,
		RelatedToID: relatedToID,
	}

	if ev.UploadedBy != nil {
		user, _ := h.userRepo.GetByID(ctx, *ev.UploadedBy)
		if user != nil {
			summary.UploadedBy = &user.FullName
		}
	}

	return summary
}
