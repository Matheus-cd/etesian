import axios from 'axios'
import apiClient from '@/lib/api-client'
import type {
  LoginRequest,
  LoginResponse,
  User,
  MFARequiredResponse,
  MFASetupRequest,
  MFASetupResponse,
  MFAVerifyRequest,
} from '@/types/api'

// Type guard to check if response is MFA required
export function isMFARequired(response: LoginResponse | MFARequiredResponse): response is MFARequiredResponse {
  return 'mfa_required' in response && response.mfa_required === true
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse | MFARequiredResponse> => {
    // Use raw axios to handle 202 status code properly
    const response = await axios.post<LoginResponse | MFARequiredResponse>(
      '/api/v1/auth/login',
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status === 200 || status === 202,
      }
    )
    return response.data
  },

  mfaSetup: async (data: MFASetupRequest): Promise<MFASetupResponse> => {
    const response = await axios.post<MFASetupResponse>('/api/v1/auth/mfa/setup', data, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  mfaVerify: async (data: MFAVerifyRequest): Promise<LoginResponse> => {
    const response = await axios.post<LoginResponse>('/api/v1/auth/mfa/verify', data, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },

  refresh: async (refreshToken: string): Promise<{ access_token: string; refresh_token: string }> => {
    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
    return response.data
  },
}
