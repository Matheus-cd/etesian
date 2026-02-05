import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Loader2, Users } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UsersTable } from './UsersTable'
import { UserForm } from './UserForm'
import { ResetPasswordForm } from './ResetPasswordForm'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
  useUnlockUser,
  useResetMfa,
} from '../hooks/useUsers'
import type { UserWithStatus, CreateUserRequest, UpdateUserRequest, UsersQueryParams } from '../api/usersApi'
import type { UserRole, ApiError } from '@/types/api'
import type { AxiosError } from 'axios'

function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiError>
  if (axiosError?.response?.data?.message) {
    return axiosError.response.data.message
  }
  return 'An unexpected error occurred. Please try again.'
}

type ModalType = 'create' | 'edit' | 'resetPassword' | 'delete' | 'unlock' | 'resetMfa' | null

export function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuthStore()

  const roleFilterOptions = [
    { value: '', label: t('users.filters.allRoles') },
    { value: 'admin', label: t('common.roles.admin') },
    { value: 'purple_team_lead', label: t('common.roles.purpleTeamLead') },
    { value: 'red_team_operator', label: t('common.roles.redTeam') },
    { value: 'blue_team_analyst', label: t('common.roles.blueTeam') },
    { value: 'viewer', label: t('common.roles.viewer') },
  ]

  const statusFilterOptions = [
    { value: '', label: t('users.filters.allStatus') },
    { value: 'active', label: t('common.status.active') },
    { value: 'inactive', label: t('common.status.inactive') },
    { value: 'locked', label: t('common.status.locked') },
  ]

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selectedUser, setSelectedUser] = useState<UserWithStatus | null>(null)

  // Build query params
  const queryParams: UsersQueryParams = {
    search: searchTerm || undefined,
    role: roleFilter ? (roleFilter as UserRole) : undefined,
    status: statusFilter ? (statusFilter as 'active' | 'inactive' | 'locked') : undefined,
  }

  // Queries
  const { data, isLoading, error } = useUsers(queryParams)

  // Mutations
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const resetPassword = useResetPassword()
  const unlockUser = useUnlockUser()
  const resetMfa = useResetMfa()

  const closeModal = () => {
    setModalType(null)
    setSelectedUser(null)
    // Reset mutation states to clear errors
    createUser.reset()
    updateUser.reset()
    deleteUser.reset()
    resetPassword.reset()
    unlockUser.reset()
    resetMfa.reset()
  }

  const handleCreateUser = (userData: CreateUserRequest | UpdateUserRequest) => {
    createUser.mutate(userData as CreateUserRequest, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  const handleUpdateUser = (userData: CreateUserRequest | UpdateUserRequest) => {
    if (!selectedUser) return
    updateUser.mutate(
      { id: selectedUser.id, data: userData as UpdateUserRequest },
      {
        onSuccess: () => {
          closeModal()
        },
      }
    )
  }

  const handleDeleteUser = () => {
    if (!selectedUser) return
    deleteUser.mutate(selectedUser.id, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  const handleResetPassword = (password: string) => {
    if (!selectedUser) return
    resetPassword.mutate(
      { id: selectedUser.id, password },
      {
        onSuccess: () => {
          closeModal()
        },
      }
    )
  }

  const handleUnlockUser = () => {
    if (!selectedUser) return
    unlockUser.mutate(selectedUser.id, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  const handleResetMfa = () => {
    if (!selectedUser) return
    resetMfa.mutate(selectedUser.id, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="h-7 w-7 text-purple-600" />
              {t('users.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('users.description')}
            </p>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setModalType('create')}
          >
            {t('users.addUser')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('users.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Select
              options={roleFilterOptions}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-40"
            />
            <Select
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">{t('users.stats.totalUsers')}</div>
          <div className="text-2xl font-semibold text-gray-900">{data?.total || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">{t('users.stats.active')}</div>
          <div className="text-2xl font-semibold text-green-600">
            {data?.data?.filter((u) => u.status === 'active').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">{t('users.stats.locked')}</div>
          <div className="text-2xl font-semibold text-red-600">
            {data?.data?.filter((u) => u.status === 'locked').length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">{t('users.stats.mfaEnabled')}</div>
          <div className="text-2xl font-semibold text-purple-600">
            {data?.data?.filter((u) => u.mfa_enabled).length || 0}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {t('users.error.loading')}
        </div>
      ) : (
        <UsersTable
          users={data?.data || []}
          currentUserId={currentUser?.id}
          onEdit={(user) => {
            setSelectedUser(user)
            setModalType('edit')
          }}
          onDelete={(user) => {
            setSelectedUser(user)
            setModalType('delete')
          }}
          onResetPassword={(user) => {
            setSelectedUser(user)
            setModalType('resetPassword')
          }}
          onUnlock={(user) => {
            setSelectedUser(user)
            setModalType('unlock')
          }}
          onResetMfa={(user) => {
            setSelectedUser(user)
            setModalType('resetMfa')
          }}
        />
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={modalType === 'create'}
        onClose={closeModal}
        title={t('users.createUser')}
        size="md"
      >
        <UserForm
          mode="create"
          onSubmit={handleCreateUser}
          onCancel={closeModal}
          isLoading={createUser.isPending}
          apiError={createUser.isError ? getApiErrorMessage(createUser.error) : null}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={modalType === 'edit'}
        onClose={closeModal}
        title={t('users.editUser')}
        size="md"
      >
        <UserForm
          mode="edit"
          user={selectedUser}
          onSubmit={handleUpdateUser}
          onCancel={closeModal}
          isLoading={updateUser.isPending}
          apiError={updateUser.isError ? getApiErrorMessage(updateUser.error) : null}
        />
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={modalType === 'resetPassword'}
        onClose={closeModal}
        title={t('users.actions.resetPassword')}
        size="sm"
      >
        {selectedUser && (
          <ResetPasswordForm
            user={selectedUser}
            onSubmit={handleResetPassword}
            onCancel={closeModal}
            isLoading={resetPassword.isPending}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={modalType === 'delete'}
        onClose={closeModal}
        onConfirm={handleDeleteUser}
        title={t('users.actions.deleteUser')}
        message={t('users.confirm.delete', { name: selectedUser?.full_name })}
        confirmText={t('common.delete')}
        variant="danger"
        isLoading={deleteUser.isPending}
      />

      {/* Unlock Confirmation */}
      <ConfirmDialog
        isOpen={modalType === 'unlock'}
        onClose={closeModal}
        onConfirm={handleUnlockUser}
        title={t('users.actions.unlockAccount')}
        message={t('users.confirm.unlock', { name: selectedUser?.full_name })}
        confirmText={t('users.actions.unlock')}
        variant="warning"
        isLoading={unlockUser.isPending}
      />

      {/* Reset MFA Confirmation */}
      <ConfirmDialog
        isOpen={modalType === 'resetMfa'}
        onClose={closeModal}
        onConfirm={handleResetMfa}
        title={t('users.actions.resetMfa')}
        message={t('users.confirm.resetMfa', { name: selectedUser?.full_name })}
        confirmText={t('users.actions.resetMfa')}
        variant="warning"
        isLoading={resetMfa.isPending}
      />
    </div>
  )
}
