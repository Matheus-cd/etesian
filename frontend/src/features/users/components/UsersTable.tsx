import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Edit2,
  Trash2,
  Key,
  Unlock,
  Shield,
  MoreVertical,
  Crosshair,
  Eye,
  ShieldOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { UserWithStatus } from '../api/usersApi'
import { formatDate } from '@/lib/utils'

interface UsersTableProps {
  users: UserWithStatus[]
  onEdit: (user: UserWithStatus) => void
  onDelete: (user: UserWithStatus) => void
  onResetPassword: (user: UserWithStatus) => void
  onUnlock: (user: UserWithStatus) => void
  onResetMfa: (user: UserWithStatus) => void
  currentUserId?: string
}

interface MenuPosition {
  top: number
  left: number
}

const roleBadgeVariants: Record<string, 'purple' | 'red' | 'blue' | 'default'> = {
  admin: 'purple',
  purple_team_lead: 'purple',
  red_team_operator: 'red',
  blue_team_analyst: 'blue',
  viewer: 'default',
}

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Shield className="h-4 w-4" />,
  purple_team_lead: <Shield className="h-4 w-4" />,
  red_team_operator: <Crosshair className="h-4 w-4" />,
  blue_team_analyst: <Eye className="h-4 w-4" />,
  viewer: <Eye className="h-4 w-4" />,
}

const statusBadgeVariants: Record<string, 'success' | 'default' | 'danger'> = {
  active: 'success',
  inactive: 'default',
  locked: 'danger',
}

export function UsersTable({
  users,
  onEdit,
  onDelete,
  onResetPassword,
  onUnlock,
  onResetMfa,
  currentUserId,
}: UsersTableProps) {
  const { t } = useTranslation()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 })

  const roleLabels: Record<string, string> = {
    admin: t('common.roles.admin'),
    purple_team_lead: t('common.roles.purpleTeamLead'),
    red_team_operator: t('common.roles.redTeam'),
    blue_team_analyst: t('common.roles.blueTeam'),
    viewer: t('common.roles.viewer'),
  }

  const statusLabels: Record<string, string> = {
    active: t('common.status.active'),
    inactive: t('common.status.inactive'),
    locked: t('common.status.locked'),
  }

  const toggleMenu = (userId: string, buttonEl: HTMLButtonElement) => {
    if (openMenuId === userId) {
      setOpenMenuId(null)
    } else {
      const rect = buttonEl.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 192, // 192px = w-48
      })
      setOpenMenuId(userId)
    }
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openMenuId) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.user')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.role')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.status')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.mfa')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.created')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('users.table.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      roleBadgeVariants[user.role] === 'purple'
                        ? 'bg-purple-100 text-purple-600'
                        : roleBadgeVariants[user.role] === 'red'
                          ? 'bg-red-100 text-red-600'
                          : roleBadgeVariants[user.role] === 'blue'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {roleIcons[user.role]}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-500">({t('users.table.you')})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">@{user.username}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge variant={roleBadgeVariants[user.role]}>{roleLabels[user.role]}</Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge variant={statusBadgeVariants[user.status]}>{statusLabels[user.status]}</Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {user.mfa_enabled ? (
                  <Badge variant="success">{t('common.enabled')}</Badge>
                ) : (
                  <Badge variant="default">{t('common.disabled')}</Badge>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(user.created_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => toggleMenu(user.id, e.currentTarget)}
                  className="p-2"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {openMenuId === user.id &&
                  createPortal(
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenMenuId(null)}
                      />
                      {/* Menu */}
                      <div
                        className="fixed z-50 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
                        style={{ top: menuPosition.top, left: menuPosition.left }}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              onEdit(user)
                              setOpenMenuId(null)
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Edit2 className="h-4 w-4 mr-3 text-gray-400" />
                            {t('users.actions.editUser')}
                          </button>
                          <button
                            onClick={() => {
                              onResetPassword(user)
                              setOpenMenuId(null)
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Key className="h-4 w-4 mr-3 text-gray-400" />
                            {t('users.actions.resetPassword')}
                          </button>
                          {user.status === 'locked' && (
                            <button
                              onClick={() => {
                                onUnlock(user)
                                setOpenMenuId(null)
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Unlock className="h-4 w-4 mr-3 text-gray-400" />
                              {t('users.actions.unlockAccount')}
                            </button>
                          )}
                          {user.mfa_enabled && (
                            <button
                              onClick={() => {
                                onResetMfa(user)
                                setOpenMenuId(null)
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <ShieldOff className="h-4 w-4 mr-3 text-gray-400" />
                              {t('users.actions.resetMfa')}
                            </button>
                          )}
                          <hr className="my-1" />
                          <button
                            onClick={() => {
                              onDelete(user)
                              setOpenMenuId(null)
                            }}
                            disabled={user.id === currentUserId}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-4 w-4 mr-3" />
                            {t('users.actions.deleteUser')}
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('users.noUsers')}</p>
        </div>
      )}
    </div>
  )
}
