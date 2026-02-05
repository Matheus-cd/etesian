import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import type { MFASetupResponse } from '@/types/api'

export function MFASetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)

  const setupToken = location.state?.setupToken as string | undefined

  const [step, setStep] = useState<'loading' | 'setup' | 'verify'>('loading')
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!setupToken) {
      navigate('/login', { replace: true })
      return
    }

    const fetchSetup = async () => {
      try {
        const data = await authApi.mfaSetup({ setup_token: setupToken })
        setSetupData(data)
        setStep('setup')
      } catch {
        setError(t('auth.mfa.setup.failed'))
        setTimeout(() => navigate('/login', { replace: true }), 2000)
      }
    }

    fetchSetup()
  }, [setupToken, navigate, t])

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    if (pasted.length > 0) {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError(t('auth.mfa.enterCode'))
      return
    }

    if (!setupToken) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await authApi.mfaVerify({
        setup_token: setupToken,
        code: fullCode,
      })

      // MFA verified - store tokens and redirect
      login(response.user, response.access_token, response.refresh_token)
      navigate('/dashboard', { replace: true })
    } catch {
      setError(t('auth.mfa.invalidCode'))
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('auth.mfa.setup.loading')}</p>
          {error && <p className="mt-2 text-red-600">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-700">{t('auth.appName')}</h1>
          <h2 className="mt-2 text-xl font-semibold text-gray-900">
            {step === 'setup' ? t('auth.mfa.setup.title') : t('auth.mfa.verify.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === 'setup'
              ? t('auth.mfa.setup.scanQR')
              : t('auth.mfa.enterCode')}
          </p>
        </div>

        {step === 'setup' && setupData && (
          <div className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              <img
                src={setupData.qr_code}
                alt={t('auth.mfa.setup.qrAlt')}
                className="w-48 h-48 border rounded-lg"
              />
            </div>

            {/* Manual entry option */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">
                {t('auth.mfa.setup.cantScan')}
              </p>
              <code className="block bg-gray-100 px-4 py-2 rounded text-sm font-mono break-all">
                {setupData.secret}
              </code>
              <p className="text-xs text-gray-400 mt-2">
                {t('auth.mfa.setup.issuer')}: {setupData.issuer} | {t('auth.mfa.setup.account')}: {setupData.account_name}
              </p>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {t('auth.mfa.setup.scanned')}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            {/* Code input */}
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <div className="space-y-3">
              <button
                onClick={handleVerify}
                disabled={isSubmitting || code.join('').length !== 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {isSubmitting ? t('auth.mfa.verifying') : t('auth.mfa.verifyAndContinue')}
              </button>

              <button
                onClick={() => setStep('setup')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {t('auth.mfa.setup.backToQR')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
