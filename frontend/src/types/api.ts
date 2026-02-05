// User types
export type UserRole = 'admin' | 'purple_team_lead' | 'red_team_operator' | 'blue_team_analyst' | 'viewer'

export interface User {
  id: string
  username: string
  email: string
  full_name: string
  role: UserRole
  mfa_enabled?: boolean
}

export interface LoginRequest {
  username: string
  password: string
  mfa_code?: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: User
}

export interface MFARequiredResponse {
  mfa_required: boolean
  mfa_setup: boolean
  setup_token?: string
  message: string
}

export interface MFASetupRequest {
  setup_token: string
}

export interface MFASetupResponse {
  secret: string
  qr_code: string
  issuer: string
  account_name: string
}

export interface MFAVerifyRequest {
  setup_token: string
  code: string
}

// Technique types
export interface Technique {
  id: string
  mitre_id: string | null
  tactic: string | null
  name: string
  description: string | null
  created_at: string
}

// Client types
export interface Client {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

// Exercise types
export type ExerciseStatus = 'draft' | 'active' | 'completed'
export type ExerciseRoleInExercise = 'red_team' | 'blue_team' | 'lead' | 'viewer'

export interface Exercise {
  id: string
  name: string
  description: string | null
  client_id: string | null
  client: Client | null
  status: ExerciseStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ExerciseMember {
  id: string
  user_id: string
  role_in_exercise: ExerciseRoleInExercise
  assigned_at: string
  user?: User
}

export interface ExerciseTechnique {
  id: string
  exercise_id: string
  technique_id: string
  sequence_order: number | null
  notes: string | null
  technique?: Technique
  execution?: Execution
  detection?: Detection
}

// Execution types
export interface Evidence {
  id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  description: string | null
  uploaded_at: string
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

// Detection types
export type DetectionStatus = 'pending' | 'detected' | 'partial' | 'not_detected' | 'voided'

export interface DetectionVoid {
  id: string
  void_reason: string
  voided_by: string | null
  voided_at: string
}

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

  // SIEM detection
  siem_detected: boolean
  siem_name: string | null
  siem_detected_at: string | null
  siem_alert_id: string | null
  siem_notes: string | null

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
  void?: DetectionVoid
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  error: string
  message: string
}
