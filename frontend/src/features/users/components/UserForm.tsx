import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { UserRole } from '@/types/api'
import type { UserWithStatus, CreateUserRequest, UpdateUserRequest } from '../api/usersApi'

interface UserFormProps {
  user?: UserWithStatus | null
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => void
  onCancel: () => void
  isLoading?: boolean
  mode: 'create' | 'edit'
  apiError?: string | null
}

export function UserForm({ user, onSubmit, onCancel, isLoading, mode, apiError }: UserFormProps) {
  const { t } = useTranslation()

  const roleOptions = [
    { value: 'admin', label: t('common.roles.admin') },
    { value: 'purple_team_lead', label: t('common.roles.purpleTeamLead') },
    { value: 'red_team_operator', label: t('common.roles.redTeamOperator') },
    { value: 'blue_team_analyst', label: t('common.roles.blueTeamAnalyst') },
    { value: 'viewer', label: t('common.roles.viewer') },
  ]

  const statusOptions = [
    { value: 'active', label: t('common.status.active') },
    { value: 'inactive', label: t('common.status.inactive') },
  ]

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'viewer' as UserRole,
    status: 'active' as 'active' | 'inactive',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user && mode === 'edit') {
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        confirmPassword: '',
        full_name: user.full_name,
        role: user.role,
        status: user.status === 'locked' ? 'active' : user.status,
      })
    }
  }, [user, mode])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (mode === 'create') {
      if (!formData.username.trim()) {
        newErrors.username = t('users.form.validation.usernameRequired')
      } else if (formData.username.length < 3) {
        newErrors.username = t('users.form.validation.usernameMinLength')
      }

      if (!formData.password) {
        newErrors.password = t('users.form.validation.passwordRequired')
      } else if (formData.password.length < 8) {
        newErrors.password = t('users.form.validation.passwordMinLength')
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('users.form.validation.passwordsNotMatch')
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = t('users.form.validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('users.form.validation.emailInvalid')
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = t('users.form.validation.fullNameRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    if (mode === 'create') {
      onSubmit({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
      })
    } else {
      onSubmit({
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        status: formData.status,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {apiError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {mode === 'create' && (
        <Input
          label={t('users.form.username')}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          error={errors.username}
          placeholder={t('users.form.usernamePlaceholder')}
          autoComplete="off"
        />
      )}

      {mode === 'edit' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.form.username')}</label>
          <p className="text-gray-900 py-2">{user?.username}</p>
        </div>
      )}

      <Input
        label={t('users.form.fullName')}
        value={formData.full_name}
        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
        error={errors.full_name}
        placeholder={t('users.form.fullNamePlaceholder')}
      />

      <Input
        label={t('users.form.email')}
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        error={errors.email}
        placeholder={t('users.form.emailPlaceholder')}
      />

      {mode === 'create' && (
        <>
          <Input
            label={t('users.form.password')}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
            placeholder={t('users.form.passwordPlaceholder')}
            autoComplete="new-password"
          />

          <Input
            label={t('users.form.confirmPassword')}
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
            placeholder={t('users.form.confirmPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </>
      )}

      <Select
        label={t('users.form.role')}
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
        options={roleOptions}
      />

      {mode === 'edit' && (
        <Select
          label={t('users.form.status')}
          value={formData.status}
          onChange={(e) =>
            setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
          }
          options={statusOptions}
        />
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {mode === 'create' ? t('users.createUser') : t('common.saveChanges')}
        </Button>
      </div>
    </form>
  )
}
