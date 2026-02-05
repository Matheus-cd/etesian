import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Target, CheckCircle, XCircle, Clock } from 'lucide-react'

export function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.welcome', { name: user?.full_name })}
        </h1>
        <p className="text-gray-600">{t('dashboard.overview')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('dashboard.stats.activeExercises')}</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <Clock className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('dashboard.stats.pendingExecutions')}</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('dashboard.stats.detected')}</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <XCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{t('dashboard.stats.notDetected')}</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions based on role */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickActions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(user?.role === 'admin' || user?.role === 'purple_team_lead') && (
            <>
              <a
                href="/exercises/new"
                className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
              >
                <h3 className="font-medium text-gray-900">{t('dashboard.quickActions.createExercise')}</h3>
                <p className="text-sm text-gray-500">{t('dashboard.quickActions.createExerciseDesc')}</p>
              </a>
              <a
                href="/techniques"
                className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
              >
                <h3 className="font-medium text-gray-900">{t('dashboard.quickActions.manageTechniques')}</h3>
                <p className="text-sm text-gray-500">{t('dashboard.quickActions.manageTechniquesDesc')}</p>
              </a>
            </>
          )}

          {(user?.role === 'red_team_operator' || user?.role === 'admin' || user?.role === 'purple_team_lead') && (
            <a
              href="/exercises"
              className="p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition"
            >
              <h3 className="font-medium text-gray-900">{t('dashboard.quickActions.recordExecution')}</h3>
              <p className="text-sm text-gray-500">{t('dashboard.quickActions.recordExecutionDesc')}</p>
            </a>
          )}

          {(user?.role === 'blue_team_analyst' || user?.role === 'admin' || user?.role === 'purple_team_lead') && (
            <a
              href="/exercises"
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <h3 className="font-medium text-gray-900">{t('dashboard.quickActions.recordDetection')}</h3>
              <p className="text-sm text-gray-500">{t('dashboard.quickActions.recordDetectionDesc')}</p>
            </a>
          )}

          <a
            href="/reports"
            className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
          >
            <h3 className="font-medium text-gray-900">{t('dashboard.quickActions.viewReports')}</h3>
            <p className="text-sm text-gray-500">{t('dashboard.quickActions.viewReportsDesc')}</p>
          </a>
        </div>
      </div>
    </div>
  )
}
