import apiClient from '@/lib/api-client'
import type { Client } from '@/features/exercises/api/exercisesApi'

// DTOs for Reports

export interface ClientWithExercises {
  client: Client
  exercise_count: number
  latest_exercise: string | null
  avg_detection_rate: number
  completed_count: number
}

export interface ExerciseReportSummary {
  id: string
  name: string
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  technique_count: number
  detection_rate: number
  siem_rate: number
  tool_rate: number
}

export interface TechniqueReportData {
  id: string
  technique_id: string
  mitre_id: string | null
  name: string
  tactic: string | null
  status: string
  notes: string | null
  executions: ExecutionDetail[]
  detections: DetectionDetail[]
  response_time: ResponseTimeDetail | null
}

export interface ExecutionDetail {
  id: string
  executed_by: string | null
  executed_by_id: string | null
  executed_at: string
  target_system: string | null
  command_used: string | null
  notes: string | null
}

export interface DetectionDetail {
  id: string
  detected_by: string | null
  detected_by_id: string | null
  detection_status: string

  tool_detected: boolean
  tool_name: string | null
  tool_detected_at: string | null
  tool_alert_id: string | null
  tool_not_applicable: boolean

  siem_detected: boolean
  siem_name: string | null
  siem_detected_at: string | null
  siem_alert_id: string | null
  siem_not_applicable: boolean

  analyst_notes: string | null
  created_at: string
}

export interface ResponseTimeDetail {
  tool_response_seconds: number | null
  siem_response_seconds: number | null
  gap_seconds: number | null
}

export interface ResponseMetrics {
  mttd_tool: number | null
  mttd_siem: number | null
  fastest_tool: number | null
  slowest_tool: number | null
  fastest_siem: number | null
  slowest_siem: number | null
  tool_by_time_range: Record<string, number>
  siem_by_time_range: Record<string, number>
  tool_not_detected_count: number
  siem_not_detected_count: number
  by_time_range: Record<string, number> // Deprecated: kept for backwards compatibility
}

export interface DetectionSummary {
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
  final_not_executed: number
}

export interface TacticCoverageData {
  tactic: string
  total: number
  detected: number
  partial: number
  not_detected: number
  not_applicable: number
  not_executed: number
  siem_rate: number
}

export interface EvidenceSummary {
  id: string
  type: string
  file_name: string | null
  caption: string | null
  uploaded_at: string
  uploaded_by: string | null
  related_to: string
  related_to_id: string
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  techniques: string[]
  mitre_ids: string[]
}

export interface MemberResponse {
  id: string
  user_id: string
  username: string
  full_name: string
  email: string
  role_in_exercise: string
}

export interface ExerciseReportData {
  exercise: {
    id: string
    name: string
    description: string | null
    client_id: string | null
    client: Client | null
    status: string
    started_at: string | null
    completed_at: string | null
    created_at: string
  }
  members: MemberResponse[]
  techniques: TechniqueReportData[]
  detection_summary: DetectionSummary
  response_metrics: ResponseMetrics
  tactic_coverage: TacticCoverageData[]
  evidence: EvidenceSummary[]
  recommendations: Recommendation[]
}

export const reportsApi = {
  // Get all clients with their exercise stats
  getClientsWithExercises: async (): Promise<ClientWithExercises[]> => {
    const response = await apiClient.get('/reports/clients')
    return response.data
  },

  // Get exercises for a specific client
  getClientExercises: async (clientId: string): Promise<ExerciseReportSummary[]> => {
    const response = await apiClient.get(`/reports/clients/${clientId}/exercises`)
    return response.data
  },

  // Get full report data for an exercise
  getExerciseReport: async (exerciseId: string): Promise<ExerciseReportData> => {
    const response = await apiClient.get(`/reports/exercises/${exerciseId}`)
    return response.data
  },

  // Export report (future implementation)
  exportReport: async (
    exerciseId: string,
    format: 'pdf' | 'excel' | 'json'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/reports/exercises/${exerciseId}/export`,
      {
        params: { format },
        responseType: 'blob',
      }
    )
    return response.data
  },
}
