import apiClient from '@/lib/api-client'
import type { PaginatedResponse } from '@/types/api'

export interface Technique {
  id: string
  mitre_id: string | null
  tactic: string | null
  name: string
  description: string | null
  created_at: string
}

export interface CreateTechniqueRequest {
  mitre_id?: string
  tactic?: string
  name: string
  description?: string
}

export interface UpdateTechniqueRequest {
  mitre_id?: string
  tactic?: string
  name?: string
  description?: string
}

export interface TechniqueFilters {
  page?: number
  per_page?: number
  tactic?: string
  search?: string
}

export interface ImportSTIXResponse {
  inserted: number
  updated: number
  skipped: number
  message: string
}

export const techniquesApi = {
  list: async (params?: TechniqueFilters): Promise<PaginatedResponse<Technique>> => {
    const response = await apiClient.get('/techniques', { params })
    return response.data
  },

  getById: async (id: string): Promise<Technique> => {
    const response = await apiClient.get(`/techniques/${id}`)
    return response.data
  },

  create: async (data: CreateTechniqueRequest): Promise<Technique> => {
    const response = await apiClient.post('/techniques', data)
    return response.data
  },

  update: async (id: string, data: UpdateTechniqueRequest): Promise<Technique> => {
    const response = await apiClient.put(`/techniques/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/techniques/${id}`)
  },

  getTactics: async (): Promise<string[]> => {
    const response = await apiClient.get('/techniques/tactics')
    return response.data
  },

  importSTIX: async (stixBundle: object): Promise<ImportSTIXResponse> => {
    const response = await apiClient.post('/techniques/import-stix', stixBundle)
    return response.data
  },
}
