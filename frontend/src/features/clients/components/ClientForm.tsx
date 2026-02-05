import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Client, CreateClientRequest, UpdateClientRequest } from '../api/clientsApi'

interface ClientFormProps {
  mode: 'create' | 'edit'
  client?: Client | null
  onSubmit: (data: CreateClientRequest | UpdateClientRequest) => void
  onCancel: () => void
  isLoading?: boolean
  apiError?: string | null
}

export function ClientForm({
  mode,
  client,
  onSubmit,
  onCancel,
  isLoading = false,
  apiError,
}: ClientFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{ name?: string }>({})

  useEffect(() => {
    if (client && mode === 'edit') {
      setName(client.name)
      setDescription(client.description || '')
    }
  }, [client, mode])

  const validate = (): boolean => {
    const newErrors: { name?: string } = {}

    if (!name.trim()) {
      newErrors.name = t('validation.required')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    const data: CreateClientRequest | UpdateClientRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
    }

    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {apiError}
        </div>
      )}

      <Input
        label={t('client.fields.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
        autoFocus
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('client.fields.description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          placeholder={t('client.fields.descriptionPlaceholder')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {mode === 'create' ? t('common.add') : t('common.save')}
        </Button>
      </div>
    </form>
  )
}
