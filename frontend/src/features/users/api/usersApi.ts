import apiClient from '@/lib/api-client'
import type { User, UserRole, PaginatedResponse } from '@/types/api'

export interface UserWithStatus extends User {
  status: 'active' | 'inactive' | 'locked'
  mfa_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  full_name: string
  role: UserRole
}

export interface UpdateUserRequest {
  email?: string
  full_name?: string
  role?: UserRole
  status?: 'active' | 'inactive'
}

export interface UsersQueryParams {
  page?: number
  per_page?: number
  search?: string
  role?: UserRole
  status?: 'active' | 'inactive' | 'locked'
}

export const usersApi = {
  list: async (params?: UsersQueryParams): Promise<PaginatedResponse<UserWithStatus>> => {
    const response = await apiClient.get('/users', { params })
    return response.data
  },

  getById: async (id: string): Promise<UserWithStatus> => {
    const response = await apiClient.get(`/users/${id}`)
    return response.data
  },

  create: async (data: CreateUserRequest): Promise<UserWithStatus> => {
    const response = await apiClient.post('/users', data)
    return response.data
  },

  update: async (id: string, data: UpdateUserRequest): Promise<UserWithStatus> => {
    const response = await apiClient.put(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },

  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    await apiClient.post(`/users/${id}/reset-password`, { password: newPassword })
  },

  unlock: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/unlock`)
  },

  resetMfa: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/reset-mfa`)
  },
}
