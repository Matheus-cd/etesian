import { Outlet, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useLogout } from '@/features/auth/hooks/useAuth'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import { TimezoneSelector } from '@/components/ui/TimezoneSelector'
import {
  LayoutDashboard,
  Target,
  FileText,
  Users,
  Settings,
  LogOut,
  Shield,
  Crosshair,
  Eye,
  Building2,
} from 'lucide-react'

const navigation = [
  { name: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'nav.exercises', href: '/exercises', icon: Target },
  { name: 'nav.techniques', href: '/techniques', icon: Crosshair },
  { name: 'nav.reports', href: '/reports', icon: FileText },
]

const adminNavigation = [
  { name: 'nav.users', href: '/admin/users', icon: Users },
  { name: 'nav.clients', href: '/admin/clients', icon: Building2 },
  { name: 'nav.settings', href: '/admin/settings', icon: Settings },
]

const roleColors: Record<string, string> = {
  admin: 'bg-purple-600',
  purple_team_lead: 'bg-purple-500',
  red_team_operator: 'bg-red-500',
  blue_team_analyst: 'bg-blue-500',
  viewer: 'bg-gray-500',
}

const roleKeys: Record<string, string> = {
  admin: 'roles.admin',
  purple_team_lead: 'roles.purple_team_lead',
  red_team_operator: 'roles.red_team_operator',
  blue_team_analyst: 'roles.blue_team_analyst',
  viewer: 'roles.viewer',
}

export function MainLayout() {
  const location = useLocation()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const logoutMutation = useLogout()

  const isAdmin = user?.role === 'admin' || user?.role === 'purple_team_lead'

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gray-900">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 bg-gray-800">
            <Shield className="h-8 w-8 text-primary-500" />
            <span className="ml-2 text-xl font-bold text-white">Etesian</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {t(item.name)}
                </Link>
              )
            })}

            {isAdmin && (
              <>
                <div className="pt-4">
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t('nav.admin')}
                  </p>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = location.pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {t(item.name)}
                    </Link>
                  )
                })}
              </>
            )}
          </nav>

          {/* Language and Timezone selectors */}
          <div className="px-2 py-2 border-t border-gray-700 space-y-1">
            <LanguageSelector />
            <TimezoneSelector />
          </div>

          {/* User info */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`h-10 w-10 rounded-full ${roleColors[user?.role || 'viewer']} flex items-center justify-center`}>
                  {user?.role === 'red_team_operator' && <Crosshair className="h-5 w-5 text-white" />}
                  {user?.role === 'blue_team_analyst' && <Eye className="h-5 w-5 text-white" />}
                  {user?.role !== 'red_team_operator' && user?.role !== 'blue_team_analyst' && (
                    <Shield className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-400">{t(roleKeys[user?.role || 'viewer'])}</p>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                className="text-gray-400 hover:text-white"
                title={t('nav.logout')}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
