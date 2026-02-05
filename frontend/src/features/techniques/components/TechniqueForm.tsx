import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useCreateTechnique, useUpdateTechnique, useTactics } from '../hooks/useTechniques'
import type { Technique } from '../api/techniquesApi'

interface TechniqueFormProps {
  technique?: Technique
  onSuccess: () => void
  onCancel: () => void
}

export function TechniqueForm({ technique, onSuccess, onCancel }: TechniqueFormProps) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    mitre_id: '',
    tactic: '',
    name: '',
    description: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: tactics } = useTactics()
  const createTechnique = useCreateTechnique()
  const updateTechnique = useUpdateTechnique()

  const isEditing = !!technique

  useEffect(() => {
    if (technique) {
      setFormData({
        mitre_id: technique.mitre_id || '',
        tactic: technique.tactic || '',
        name: technique.name,
        description: technique.description || '',
      })
    }
  }, [technique])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError(t('technique.form.validation.nameRequired'))
      return
    }

    const data = {
      name: formData.name.trim(),
      mitre_id: formData.mitre_id.trim() || undefined,
      tactic: formData.tactic || undefined,
      description: formData.description.trim() || undefined,
    }

    try {
      if (isEditing) {
        await updateTechnique.mutateAsync({ id: technique.id, data })
      } else {
        await createTechnique.mutateAsync(data)
      }
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || t('technique.form.saveFailed'))
      } else {
        setError(t('technique.form.saveFailed'))
      }
    }
  }

  const isLoading = createTechnique.isPending || updateTechnique.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('technique.fields.mitreId')}</label>
        <input
          type="text"
          value={formData.mitre_id}
          onChange={(e) => setFormData((prev) => ({ ...prev, mitre_id: e.target.value }))}
          placeholder={t('technique.form.mitreIdPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('technique.fields.name')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t('technique.form.namePlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('technique.fields.tactic')}</label>
        <select
          value={formData.tactic}
          onChange={(e) => setFormData((prev) => ({ ...prev, tactic: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('technique.form.selectTactic')}</option>
          {tactics?.map((tactic) => (
            <option key={tactic} value={tactic}>
              {tactic}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('technique.fields.description')}</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={t('technique.form.descriptionPlaceholder')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('common.saving') : isEditing ? t('common.update') : t('common.create')}
        </Button>
      </div>
    </form>
  )
}
