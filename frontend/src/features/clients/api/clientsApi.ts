import apiClient from '@/lib/api-client'

export interface Client {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface CreateClientRequest {
  name: string
  description?: string
}

export interface UpdateClientRequest {
  name?: string
  description?: string
}

export const clientsApi = {
  list: async (): Promise<Client[]> => {
    const response = await apiClient.get('/clients')
    return response.data
  },

  getById: async (id: string): Promise<Client> => {
    const response = await apiClient.get(`/clients/${id}`)
    return response.data
  },

  create: async (data: CreateClientRequest): Promise<Client> => {
    const response = await apiClient.post('/clients', data)
    return response.data
  },

  update: async (id: string, data: UpdateClientRequest): Promise<Client> => {
    const response = await apiClient.put(`/clients/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/clients/${id}`)
  },
}
