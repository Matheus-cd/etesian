import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { MFASetupPage } from '@/features/auth/components/MFASetupPage'
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { Dashboard } from '@/features/dashboard/components/Dashboard'
import { UsersPage } from '@/features/users'
import { ExercisesPage, ExerciseDetailPage } from '@/features/exercises'
import { TechniquesPage } from '@/features/techniques'
import { ClientsPage } from '@/features/clients'
import { ReportsPage, ReportGeneratorPage } from '@/features/reports'

function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('settings.title')}</h1>
      <p className="text-gray-600">{t('settings.description')}</p>
    </div>
  )
}

function UnauthorizedPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('errors.403.title')}</h1>
        <p className="text-gray-600">{t('errors.403.message')}</p>
        <a href="/dashboard" className="mt-4 inline-block text-primary-600 hover:underline">
          {t('errors.403.backToDashboard')}
        </a>
      </div>
    </div>
  )
}

function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('errors.404.title')}</h1>
        <p className="text-gray-600">{t('errors.404.message')}</p>
        <a href="/dashboard" className="mt-4 inline-block text-primary-600 hover:underline">
          {t('errors.404.backToDashboard')}
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/mfa-setup" element={<MFASetupPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
          <Route path="/techniques" element={<TechniquesPage />} />

          {/* Reports - Lead or Admin only */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'purple_team_lead']} />}>
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:exerciseId" element={<ReportGeneratorPage />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'purple_team_lead']} />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/clients" element={<ClientsPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
