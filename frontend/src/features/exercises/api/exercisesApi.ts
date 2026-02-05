import apiClient from '@/lib/api-client'
import type { PaginatedResponse } from '@/types/api'

export type ExerciseStatus = 'draft' | 'active' | 'completed'

export interface Client {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  description: string | null
  client_id: string | null
  client: Client | null
  status: ExerciseStatus
  started_at: string | null
  completed_at: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  created_at: string
}

export interface ExerciseMember {
  id: string
  user_id: string
  role_in_exercise: 'red_team' | 'blue_team' | 'lead' | 'viewer'
  assigned_at: string
  user?: {
    id: string
    username: string
    email: string
    full_name: string
    role: string
  }
}

export type TechniqueStatus = 'pending' | 'in_progress' | 'paused' | 'completed'

export interface ExerciseTechnique {
  id: string
  exercise_id: string
  technique_id: string
  sequence_order: number | null
  notes: string | null
  status: TechniqueStatus
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  started_by: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  started_by_user?: {
    id: string
    username: string
    full_name: string
  }
  technique?: {
    id: string
    mitre_id: string | null
    name: string
    tactic: string | null
    description: string | null
  }
  executions?: Execution[]
}

export interface Execution {
  id: string
  exercise_technique_id: string
  executed_by: string | null
  executed_at: string
  target_system: string | null
  command_used: string | null
  notes: string | null
  created_at: string
  evidences?: Evidence[]
}

export interface Evidence {
  id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  description: string | null
  caption: string | null
  uploaded_at: string
}

export type DetectionStatus = 'pending' | 'detected' | 'partial' | 'not_detected' | 'not_applicable' | 'voided'

export interface Detection {
  id: string
  execution_id: string
  detected_by: string | null

  // Tool detection
  tool_detected: boolean
  tool_name: string | null
  tool_detected_at: string | null
  tool_alert_id: string | null
  tool_notes: string | null
  tool_not_applicable: boolean
  tool_na_reason: string | null

  // SIEM detection
  siem_detected: boolean
  siem_name: string | null
  siem_detected_at: string | null
  siem_alert_id: string | null
  siem_notes: string | null
  siem_not_applicable: boolean
  siem_na_reason: string | null

  // Status
  detection_status: DetectionStatus
  analyst_notes: string | null
  created_at: string

  // Calculated
  tool_response_seconds?: number
  siem_response_seconds?: number
  tool_to_siem_gap_seconds?: number

  // Related
  tool_evidences?: Evidence[]
  siem_evidences?: Evidence[]
  void?: {
    id: string
    void_reason: string
    voided_by: string | null
    voided_at: string
  }
}

export interface CreateDetectionRequest {
  execution_id: string

  tool_detected?: boolean
  tool_name?: string
  tool_detected_at?: string
  tool_alert_id?: string
  tool_notes?: string
  tool_not_applicable?: boolean
  tool_na_reason?: string

  siem_detected?: boolean
  siem_name?: string
  siem_detected_at?: string
  siem_alert_id?: string
  siem_notes?: string
  siem_not_applicable?: boolean
  siem_na_reason?: string

  detection_status?: DetectionStatus
  analyst_notes?: string
}

export interface CreateExecutionRequest {
  exercise_technique_id: string
  executed_at: string
  target_system?: string
  command_used?: string
  notes?: string
}

export interface CreateExerciseRequest {
  name: string
  description?: string
  client_id: string
}

export interface UpdateExerciseRequest {
  name?: string
  description?: string
  client_id?: string | null
}

export interface AddMemberRequest {
  user_id: string
  role_in_exercise: 'red_team' | 'blue_team' | 'lead' | 'viewer'
}

export interface AddTechniqueRequest {
  technique_id: string
  order?: number
  notes?: string
}

export interface UpdateExerciseTechniqueRequest {
  order?: number
  notes?: string
}

export interface ExerciseFilters {
  page?: number
  per_page?: number
  status?: ExerciseStatus
  search?: string
  client_id?: string
}

export interface TacticStat {
  tactic: string
  total: number
  detected: number
  partial: number
  not_detected: number
  not_applicable: number
  pending: number
  not_executed: number
  siem_rate: number
}

export interface DetectionStatsResponse {
  total_techniques: number
  total_with_execution: number
  total_with_detection: number
  tool_detected: number
  tool_not_detected: number
  tool_not_applicable: number
  tool_rate: number
  siem_detected: number
  siem_not_detected: number
  siem_not_applicable: number
  siem_rate: number
  final_detected: number
  final_partial: number
  final_not_detected: number
  final_not_applicable: number
  final_pending: number
  final_not_executed: number
  tactic_stats: TacticStat[]
}

export const exercisesApi = {
  list: async (params?: ExerciseFilters): Promise<PaginatedResponse<Exercise>> => {
    const response = await apiClient.get('/exercises', { params })
    return response.data
  },

  getById: async (id: string): Promise<Exercise> => {
    const response = await apiClient.get(`/exercises/${id}`)
    return response.data
  },

  create: async (data: CreateExerciseRequest): Promise<Exercise> => {
    const response = await apiClient.post('/exercises', data)
    return response.data
  },

  update: async (id: string, data: UpdateExerciseRequest): Promise<Exercise> => {
    const response = await apiClient.put(`/exercises/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/exercises/${id}`)
  },

  start: async (id: string): Promise<Exercise> => {
    const response = await apiClient.post(`/exercises/${id}/start`)
    return response.data
  },

  complete: async (id: string): Promise<Exercise> => {
    const response = await apiClient.post(`/exercises/${id}/complete`)
    return response.data
  },

  reopen: async (id: string): Promise<Exercise> => {
    const response = await apiClient.post(`/exercises/${id}/reopen`)
    return response.data
  },

  // Members
  getMembers: async (exerciseId: string): Promise<ExerciseMember[]> => {
    const response = await apiClient.get(`/exercises/${exerciseId}/members`)
    return response.data
  },

  addMember: async (exerciseId: string, data: AddMemberRequest): Promise<ExerciseMember> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/members`, data)
    return response.data
  },

  removeMember: async (exerciseId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/exercises/${exerciseId}/members/${userId}`)
  },

  // Techniques
  getTechniques: async (exerciseId: string): Promise<ExerciseTechnique[]> => {
    const response = await apiClient.get(`/exercises/${exerciseId}/techniques`)
    return response.data
  },

  addTechnique: async (exerciseId: string, data: AddTechniqueRequest): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques`, data)
    return response.data
  },

  updateExerciseTechnique: async (
    exerciseId: string,
    techniqueId: string,
    data: UpdateExerciseTechniqueRequest
  ): Promise<ExerciseTechnique> => {
    const response = await apiClient.put(`/exercises/${exerciseId}/techniques/${techniqueId}`, data)
    return response.data
  },

  scheduleTechnique: async (
    exerciseId: string,
    techniqueId: string,
    data: { scheduled_start_time: string | null; scheduled_end_time: string | null }
  ): Promise<ExerciseTechnique> => {
    const response = await apiClient.patch(`/exercises/${exerciseId}/techniques/${techniqueId}/schedule`, data)
    return response.data
  },

  removeTechnique: async (exerciseId: string, techniqueId: string): Promise<void> => {
    await apiClient.delete(`/exercises/${exerciseId}/techniques/${techniqueId}`)
  },

  reorderTechniques: async (
    exerciseId: string,
    techniqueIds: string[]
  ): Promise<ExerciseTechnique[]> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/reorder`, {
      technique_ids: techniqueIds,
    })
    return response.data
  },

  // Technique details and status
  getTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.get(`/exercises/${exerciseId}/techniques/${techniqueId}`)
    return response.data
  },

  startTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/${techniqueId}/start`)
    return response.data
  },

  pauseTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/${techniqueId}/pause`)
    return response.data
  },

  resumeTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/${techniqueId}/resume`)
    return response.data
  },

  completeTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/${techniqueId}/complete`)
    return response.data
  },

  reopenTechnique: async (exerciseId: string, techniqueId: string): Promise<ExerciseTechnique> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/techniques/${techniqueId}/reopen`)
    return response.data
  },

  getTechniqueExecutions: async (exerciseId: string, techniqueId: string): Promise<Execution[]> => {
    const response = await apiClient.get(`/exercises/${exerciseId}/techniques/${techniqueId}/executions`)
    return response.data
  },

  // Executions
  createExecution: async (exerciseId: string, data: CreateExecutionRequest): Promise<Execution> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/executions`, data)
    return response.data
  },

  getExecution: async (executionId: string): Promise<Execution> => {
    const response = await apiClient.get(`/executions/${executionId}`)
    return response.data
  },

  updateExecution: async (executionId: string, data: Partial<CreateExecutionRequest>): Promise<Execution> => {
    const response = await apiClient.put(`/executions/${executionId}`, data)
    return response.data
  },

  deleteExecution: async (executionId: string): Promise<void> => {
    await apiClient.delete(`/executions/${executionId}`)
  },

  // Evidence upload
  uploadEvidence: async (executionId: string, file: File, caption?: string, description?: string): Promise<Evidence> => {
    const formData = new FormData()
    formData.append('file', file)
    if (caption) formData.append('caption', caption)
    if (description) formData.append('description', description)

    const response = await apiClient.post(`/executions/${executionId}/evidences`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteEvidence: async (executionId: string, evidenceId: string): Promise<void> => {
    await apiClient.delete(`/executions/${executionId}/evidences/${evidenceId}`)
  },

  updateEvidenceCaption: async (executionId: string, evidenceId: string, caption: string): Promise<Evidence> => {
    const response = await apiClient.put(`/executions/${executionId}/evidences/${evidenceId}`, { caption })
    return response.data
  },

  // Fetch evidence image as blob (includes auth token)
  fetchEvidenceBlob: async (evidenceId: string): Promise<string> => {
    const response = await apiClient.get(`/evidences/${evidenceId}/file`, {
      responseType: 'blob',
    })
    return URL.createObjectURL(response.data)
  },

  // Detections
  getDetectionsByExecution: async (executionId: string): Promise<Detection[]> => {
    const response = await apiClient.get(`/executions/${executionId}/detections`)
    return response.data
  },

  createDetection: async (exerciseId: string, data: CreateDetectionRequest): Promise<Detection> => {
    const response = await apiClient.post(`/exercises/${exerciseId}/detections`, data)
    return response.data
  },

  updateDetection: async (detectionId: string, data: Partial<CreateDetectionRequest>): Promise<Detection> => {
    const response = await apiClient.put(`/detections/${detectionId}`, data)
    return response.data
  },

  deleteDetection: async (detectionId: string): Promise<void> => {
    await apiClient.delete(`/detections/${detectionId}`)
  },

  // Upload evidence for detection (tool or siem)
  uploadDetectionEvidence: async (
    detectionId: string,
    file: File,
    evidenceType: 'tool' | 'siem',
    caption?: string
  ): Promise<Evidence> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('evidence_type', evidenceType)
    if (caption) formData.append('caption', caption)

    const response = await apiClient.post(`/detections/${detectionId}/evidences`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteDetectionEvidence: async (detectionId: string, evidenceId: string): Promise<void> => {
    await apiClient.delete(`/detections/${detectionId}/evidences/${evidenceId}`)
  },

  updateDetectionEvidenceCaption: async (detectionId: string, evidenceId: string, caption: string): Promise<Evidence> => {
    const response = await apiClient.put(`/detections/${detectionId}/evidences/${evidenceId}`, { caption })
    return response.data
  },

  // Void a detection (Red Team can void invalid detections)
  voidDetection: async (detectionId: string, voidReason: string): Promise<{ message: string; detection_id: string; void_reason: string }> => {
    const response = await apiClient.post(`/detections/${detectionId}/void`, { void_reason: voidReason })
    return response.data
  },

  // Detection Statistics
  getDetectionStats: async (exerciseId: string): Promise<DetectionStatsResponse> => {
    const response = await apiClient.get(`/exercises/${exerciseId}/detection-stats`)
    return response.data
  },
}
