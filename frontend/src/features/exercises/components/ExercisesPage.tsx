import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Search,
  FileText,
  Play,
  CheckCircle,
  Clock,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { ExerciseForm } from './ExerciseForm'
import {
  useExercises,
  useDeleteExercise,
  useStartExercise,
  useCompleteExercise,
} from '../hooks/useExercises'
import type { Exercise, ExerciseStatus } from '../api/exercisesApi'

export function ExercisesPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExerciseStatus | ''>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null)

  const statusConfig: Record<
    ExerciseStatus,
    { label: string; variant: 'default' | 'warning' | 'success'; icon: React.ReactNode }
  > = {
    draft: {
      label: t('exercise.status.draft'),
      variant: 'default',
      icon: <FileText className="h-4 w-4" />,
    },
    active: {
      label: t('exercise.status.active'),
      variant: 'warning',
      icon: <Play className="h-4 w-4" />,
    },
    completed: {
      label: t('exercise.status.completed'),
      variant: 'success',
      icon: <CheckCircle className="h-4 w-4" />,
    },
  }

  const { data, isLoading } = useExercises({
    search: search || undefined,
    status: statusFilter || undefined,
  })

  const deleteExercise = useDeleteExercise()
  const startExercise = useStartExercise()
  const completeExercise = useCompleteExercise()

  const handleDelete = () => {
    if (!deletingExercise) return
    deleteExercise.mutate(deletingExercise.id, {
      onSuccess: () => setDeletingExercise(null),
    })
  }

  const handleStart = (exercise: Exercise) => {
    startExercise.mutate(exercise.id)
  }

  const handleComplete = (exercise: Exercise) => {
    completeExercise.mutate(exercise.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('exercise.title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('exercise.description')}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('exercise.new')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('exercise.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExerciseStatus | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('exercise.allStatus')}</option>
          <option value="draft">{t('exercise.status.draft')}</option>
          <option value="active">{t('exercise.status.active')}</option>
          <option value="completed">{t('exercise.status.completed')}</option>
        </select>
      </div>

      {/* Exercise Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !data?.data?.length ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t('exercise.noExercises')}</h3>
          <p className="text-gray-500 mt-1">
            {t('exercise.createFirst')}
          </p>
          <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('exercise.createExercise')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              statusConfig={statusConfig}
              onEdit={() => setEditingExercise(exercise)}
              onDelete={() => setDeletingExercise(exercise)}
              onStart={() => handleStart(exercise)}
              onComplete={() => handleComplete(exercise)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('exercise.createExercise')}
      >
        <ExerciseForm
          onSuccess={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingExercise}
        onClose={() => setEditingExercise(null)}
        title={t('exercise.edit')}
      >
        {editingExercise && (
          <ExerciseForm
            exercise={editingExercise}
            onSuccess={() => setEditingExercise(null)}
            onCancel={() => setEditingExercise(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingExercise}
        onClose={() => setDeletingExercise(null)}
        onConfirm={handleDelete}
        title={t('exercise.delete')}
        message={t('exercise.confirm.delete', { name: deletingExercise?.name })}
        confirmText={t('common.delete')}
        variant="danger"
        isLoading={deleteExercise.isPending}
      />
    </div>
  )
}

interface ExerciseCardProps {
  exercise: Exercise
  statusConfig: Record<
    ExerciseStatus,
    { label: string; variant: 'default' | 'warning' | 'success'; icon: React.ReactNode }
  >
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
  onComplete: () => void
}

function ExerciseCard({
  exercise,
  statusConfig,
  onEdit,
  onDelete,
  onStart,
  onComplete,
}: ExerciseCardProps) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()
  const status = statusConfig[exercise.status]

  const handleCardClick = () => {
    navigate(`/exercises/${exercise.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={status.variant as 'default' | 'purple' | 'success'}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">{exercise.name}</h3>
          {exercise.client && (
            <p className="text-sm text-gray-500 mt-1">{exercise.client.name}</p>
          )}
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleMenuClick}
            className="p-1 rounded hover:bg-gray-100"
          >
            <MoreVertical className="h-5 w-5 text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                <button
                  onClick={() => {
                    onEdit()
                    setShowMenu(false)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  {t('common.edit')}
                </button>
                {exercise.status === 'draft' && (
                  <button
                    onClick={() => {
                      onStart()
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-gray-50"
                  >
                    <Play className="h-4 w-4" />
                    {t('exercise.actions.start')}
                  </button>
                )}
                {exercise.status === 'active' && (
                  <button
                    onClick={() => {
                      onComplete()
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-gray-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t('exercise.actions.complete')}
                  </button>
                )}
                <hr className="my-1" />
                <button
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {exercise.description && (
        <p className="text-sm text-gray-600 mt-3 line-clamp-2">
          {exercise.description}
        </p>
      )}

      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {new Date(exercise.created_at).toLocaleDateString()}
        </div>
        {exercise.started_at && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {t('exercise.started')} {new Date(exercise.started_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  )
}
