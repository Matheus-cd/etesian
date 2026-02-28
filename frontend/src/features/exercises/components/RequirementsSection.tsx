import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ClipboardList,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useCreateRequirement,
  useUpdateRequirement,
  useDeleteRequirement,
  useFulfillRequirement,
} from '../hooks/useExercises'
import apiClient from '@/lib/api-client'
import type { ExerciseRequirement, RequirementCategory } from '../api/exercisesApi'

interface RequirementsSectionProps {
  exerciseId: string
  canManage: boolean  // Red/Lead/Admin
  canFulfill: boolean // Blue/Lead
  requirements?: ExerciseRequirement[]
}

const categories: RequirementCategory[] = ['acesso', 'credencial', 'configuracao', 'software', 'rede', 'outro']

const categoryColors: Record<RequirementCategory, string> = {
  acesso: 'bg-purple-100 text-purple-800',
  credencial: 'bg-indigo-100 text-indigo-800',
  configuracao: 'bg-cyan-100 text-cyan-800',
  software: 'bg-teal-100 text-teal-800',
  rede: 'bg-orange-100 text-orange-800',
  outro: 'bg-gray-100 text-gray-800',
}

export function RequirementsSection({ exerciseId, canManage, canFulfill, requirements = [] }: RequirementsSectionProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingReq, setEditingReq] = useState<ExerciseRequirement | null>(null)
  const [deleteReq, setDeleteReq] = useState<ExerciseRequirement | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState<RequirementCategory>('outro')

  const createMutation = useCreateRequirement()
  const updateMutation = useUpdateRequirement()
  const deleteMutation = useDeleteRequirement()
  const fulfillMutation = useFulfillRequirement()

  const fulfilledCount = requirements.filter((r) => r.fulfilled).length
  const totalCount = requirements.length

  const openCreateModal = () => {
    setEditingReq(null)
    setFormTitle('')
    setFormDescription('')
    setFormCategory('outro')
    setShowModal(true)
  }

  const openEditModal = (req: ExerciseRequirement) => {
    setEditingReq(req)
    setFormTitle(req.title)
    setFormDescription(req.description || '')
    setFormCategory(req.category)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    const data = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      category: formCategory,
    }

    if (editingReq) {
      await updateMutation.mutateAsync({ exerciseId, requirementId: editingReq.id, data })
    } else {
      await createMutation.mutateAsync({ exerciseId, data })
    }
    setShowModal(false)
  }

  const handleDelete = async () => {
    if (!deleteReq) return
    await deleteMutation.mutateAsync({ exerciseId, requirementId: deleteReq.id })
    setDeleteReq(null)
  }

  const handleFulfill = (req: ExerciseRequirement) => {
    fulfillMutation.mutate({ exerciseId, requirementId: req.id, fulfilled: !req.fulfilled })
  }

  const handleExport = async () => {
    try {
      const response = await apiClient.get(`/exercises/${exerciseId}/requirements/export`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'requirements.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">{t('requirement.title')}</h3>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500">
              ({fulfilledCount}/{totalCount})
            </span>
          )}
          {totalCount > 0 && (
            <div className="ml-2 h-1.5 w-24 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${totalCount > 0 ? (fulfilledCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-3">
          {/* Actions bar */}
          <div className="flex items-center gap-2 mb-3">
            {canManage && (
              <Button size="sm" onClick={openCreateModal}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('requirement.add')}
              </Button>
            )}
            {totalCount > 0 && (
              <Button size="sm" variant="ghost" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" />
                {t('requirement.export')}
              </Button>
            )}
          </div>

          {/* Requirements list */}
          {totalCount === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>{t('requirement.noRequirements')}</p>
              <p className="text-xs mt-1">{t('requirement.noRequirementsHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requirements.map((req) => (
                <div
                  key={req.id}
                  onClick={() => canManage && openEditModal(req)}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    canManage ? 'cursor-pointer' : ''
                  } ${
                    req.fulfilled
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {/* Fulfill checkbox */}
                  {canFulfill ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFulfill(req) }}
                      className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                        req.fulfilled
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white hover:border-green-400'
                      }`}
                      title={req.fulfilled ? t('requirement.actions.unfulfill') : t('requirement.actions.fulfill')}
                    >
                      {req.fulfilled && <CheckCircle className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <div
                      className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center ${
                        req.fulfilled
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {req.fulfilled && <CheckCircle className="h-3.5 w-3.5" />}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${req.fulfilled ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {req.title}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[req.category]}`}>
                        {t(`requirement.categories.${req.category}`)}
                      </span>
                    </div>
                    {req.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{req.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {req.linked_scenarios > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Link2 className="h-3 w-3" />
                          {req.linked_scenarios} {req.linked_scenarios === 1 ? 'scenario' : 'scenarios'}
                        </span>
                      )}
                      {req.fulfilled && req.fulfilled_by_username && (
                        <span className="text-green-600">
                          {t('requirement.status.fulfilledBy', { user: req.fulfilled_by_username })}
                        </span>
                      )}
                      {req.created_by_username && (
                        <span>{t('common.created')}: {req.created_by_username}</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge / fulfill action */}
                  {canFulfill ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFulfill(req) }}
                      className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        req.fulfilled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-green-100 hover:text-green-800'
                      }`}
                      title={req.fulfilled ? t('requirement.actions.unfulfill') : t('requirement.actions.fulfill')}
                    >
                      {req.fulfilled ? t('requirement.status.fulfilled') : t('requirement.actions.fulfill')}
                    </button>
                  ) : (
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.fulfilled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {req.fulfilled ? t('requirement.status.fulfilled') : t('requirement.status.pending')}
                    </span>
                  )}

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(req) }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title={t('requirement.edit')}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteReq(req) }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title={t('requirement.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingReq ? t('requirement.edit') : t('requirement.add')}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('requirement.fields.title')} *
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t('requirement.fields.titlePlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('requirement.fields.category')}
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as RequirementCategory)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`requirement.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('requirement.fields.description')}
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={t('requirement.fields.descriptionPlaceholder')}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!formTitle.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? t('common.saving')
                : editingReq
                  ? t('common.saveChanges')
                  : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteReq}
        onClose={() => setDeleteReq(null)}
        onConfirm={handleDelete}
        title={t('requirement.delete')}
        message={t('requirement.confirm.delete')}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  )
}
