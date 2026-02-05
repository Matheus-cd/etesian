import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi, isMFARequired } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import type { LoginRequest, LoginResponse, MFARequiredResponse } from '@/types/api'

type LoginStep = 'credentials' | 'mfa_code'

export function LoginForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const [step, setStep] = useState<LoginStep>('credentials')
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 'mfa_code') {
      inputRefs.current[0]?.focus()
    }
  }, [step])

  const handleLoginResponse = (response: LoginResponse | MFARequiredResponse) => {
    if (isMFARequired(response)) {
      if (response.mfa_setup) {
        // User needs to setup MFA - redirect to setup page
        navigate('/mfa-setup', {
          state: { setupToken: response.setup_token },
          replace: true,
        })
      } else {
        // User has MFA, needs to enter code
        setStep('mfa_code')
      }
    } else {
      // Full login successful
      login(response.user, response.access_token, response.refresh_token)
      navigate('/dashboard', { replace: true })
    }
  }

  const onSubmitCredentials = async (data: LoginRequest) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await authApi.login(data)
      setCredentials({ username: data.username, password: data.password })
      handleLoginResponse(response)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } }
      setError(axiosError.response?.data?.message || t('auth.invalidCredentials'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMfaCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...mfaCode]
    newCode[index] = value.slice(-1)
    setMfaCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleMfaPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...mfaCode]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setMfaCode(newCode)
    if (pasted.length > 0) {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  const onSubmitMfaCode = async () => {
    if (!credentials) return

    const fullCode = mfaCode.join('')
    if (fullCode.length !== 6) {
      setError(t('auth.mfa.enterCode'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await authApi.login({
        ...credentials,
        mfa_code: fullCode,
      })
      handleLoginResponse(response)
    } catch {
      setError(t('auth.mfa.invalidCode'))
      setMfaCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackToCredentials = () => {
    setStep('credentials')
    setMfaCode(['', '', '', '', '', ''])
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-center text-primary-700">{t('auth.appName')}</h1>
          <h2 className="mt-2 text-center text-gray-600">{t('auth.subtitle')}</h2>
        </div>

        {step === 'credentials' && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmitCredentials)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  {t('auth.username')}
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  {...register('username', { required: t('auth.usernameRequired') })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password', { required: t('auth.passwordRequired') })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>
        )}

        {step === 'mfa_code' && (
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {t('auth.mfa.enterCode')}
              </p>
            </div>

            <div className="flex justify-center gap-2" onPaste={handleMfaPaste}>
              {mfaCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleMfaCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleMfaKeyDown(index, e)}
                  disabled={isSubmitting}
                  className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                />
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}

            <div className="space-y-3">
              <button
                onClick={onSubmitMfaCode}
                disabled={isSubmitting || mfaCode.join('').length !== 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isSubmitting ? t('auth.mfa.verifying') : t('auth.mfa.verify')}
              </button>

              <button
                onClick={handleBackToCredentials}
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
