import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useCreateExercise, useUpdateExercise } from '../hooks/useExercises'
import { useClients } from '@/features/clients/hooks/useClients'
import type { Exercise, CreateExerciseRequest } from '../api/exercisesApi'

interface ExerciseFormProps {
  exercise?: Exercise
  onSuccess: () => void
  onCancel: () => void
}

interface FormData {
  name: string
  description?: string
  client_id: string
}

export function ExerciseForm({ exercise, onSuccess, onCancel }: ExerciseFormProps) {
  const { t } = useTranslation()
  const isEditing = !!exercise

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: exercise
      ? {
          name: exercise.name,
          description: exercise.description || '',
          client_id: exercise.client_id || '',
        }
      : {},
  })

  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const { data: clients, isLoading: clientsLoading } = useClients()

  const isLoading = createExercise.isPending || updateExercise.isPending

  const onSubmit = (data: FormData) => {
    const payload: CreateExerciseRequest = {
      name: data.name,
      description: data.description || undefined,
      client_id: data.client_id,
    }

    if (isEditing) {
      updateExercise.mutate(
        { id: exercise.id, data: payload },
        { onSuccess }
      )
    } else {
      createExercise.mutate(payload, { onSuccess })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('exercise.fields.name')} *
        </label>
        <input
          type="text"
          {...register('name', { required: t('validation.required') })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={t('exercise.fields.name')}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('client.title')} *
        </label>
        <select
          {...register('client_id', { required: t('validation.required') })}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
            errors.client_id ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={clientsLoading}
        >
          <option value="">{t('client.selectClient')}</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {errors.client_id && (
          <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('exercise.fields.description')}
        </label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={t('exercise.fields.description')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('common.loading') : isEditing ? t('technique.saveChanges') : t('exercise.new')}
        </Button>
      </div>
    </form>
  )
}
