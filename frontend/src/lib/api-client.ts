import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store/authStore'

const API_URL = '/api/v1'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    console.log('[API Client] Error response:', {
      status: error.response?.status,
      url: originalRequest?.url,
      retry: originalRequest?._retry,
    })

    // If not 401 or no config, reject immediately
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    // If already retried, don't try again
    if (originalRequest._retry) {
      console.log('[API Client] Already retried, giving up')
      return Promise.reject(error)
    }

    const refreshToken = useAuthStore.getState().refreshToken
    console.log('[API Client] Refresh token exists:', !!refreshToken)

    // No refresh token available, logout and redirect
    if (!refreshToken) {
      console.log('[API Client] No refresh token, logging out')
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      console.log('[API Client] Already refreshing, queueing request')
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          },
          reject: (err: unknown) => {
            reject(err)
          },
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    console.log('[API Client] Attempting token refresh...')

    try {
      // Use a separate axios instance to avoid interceptor loop
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      })

      console.log('[API Client] Refresh successful!')

      const { access_token, refresh_token: newRefreshToken } = response.data
      useAuthStore.getState().setTokens(access_token, newRefreshToken)

      // Process queued requests with new token
      processQueue(null, access_token)

      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      console.log('[API Client] Refresh failed:', refreshError)

      // Refresh failed, process queue with error
      processQueue(refreshError, null)

      // Logout and redirect
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient
