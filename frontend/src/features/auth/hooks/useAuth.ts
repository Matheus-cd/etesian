import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi, isMFARequired } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import type { LoginRequest, MFAVerifyRequest } from '@/types/api'

export function useLogin() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      if (isMFARequired(data)) {
        if (data.mfa_setup) {
          navigate('/mfa-setup', { state: { setupToken: data.setup_token } })
        }
        // If MFA code is required, the component handles it
      } else {
        login(data.user, data.access_token, data.refresh_token)
        navigate('/dashboard')
      }
    },
  })
}

export function useMFAVerify() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  return useMutation({
    mutationFn: (data: MFAVerifyRequest) => authApi.mfaVerify(data),
    onSuccess: (data) => {
      login(data.user, data.access_token, data.refresh_token)
      navigate('/dashboard')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout()
      navigate('/login')
    },
    onError: () => {
      // Even if API fails, clear local state
      logout()
      navigate('/login')
    },
  })
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await authApi.getMe()
      setUser(user)
      return user
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
