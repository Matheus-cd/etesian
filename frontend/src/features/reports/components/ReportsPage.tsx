import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Building,
  FileText,
  ChevronDown,
  ChevronRight,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useClientsWithExercises, useClientExercises } from '../hooks/useReports'
import type { ClientWithExercises, ExerciseReportSummary } from '../api/reportsApi'

export function ReportsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const { data: clients, isLoading } = useClientsWithExercises()

  const filteredClients = clients?.filter((c) =>
    c.client.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleClient = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('report.title')}</h1>
        <p className="text-gray-500 mt-1">{t('report.description')}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('report.searchClients')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !filteredClients?.length ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t('report.noClients')}</h3>
          <p className="text-gray-500 mt-1">{t('report.noClientsDescription')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClients.map((clientData) => (
            <ClientCard
              key={clientData.client.id}
              clientData={clientData}
              isExpanded={expandedClient === clientData.client.id}
              onToggle={() => toggleClient(clientData.client.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ClientCardProps {
  clientData: ClientWithExercises
  isExpanded: boolean
  onToggle: () => void
}

function ClientCard({ clientData, isExpanded, onToggle }: ClientCardProps) {
  const { t } = useTranslation()
  const { client, exercise_count, completed_count, avg_detection_rate, latest_exercise } = clientData

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Client Header */}
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <Building className="h-6 w-6 text-primary-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
            {client.description && (
              <p className="text-sm text-gray-500 line-clamp-1">{client.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Stats */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="h-4 w-4" />
              <span>
                {exercise_count} {t('report.exercises')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                {completed_count} {t('report.completed')}
              </span>
            </div>
            {avg_detection_rate > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-blue-600">
                  {Math.round(avg_detection_rate)}% {t('report.avgDetection')}
                </span>
              </div>
            )}
            {latest_exercise && (
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>{new Date(latest_exercise).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Expand Icon */}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content - Exercise List */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          <ClientExerciseList clientId={client.id} />
        </div>
      )}
    </div>
  )
}

interface ClientExerciseListProps {
  clientId: string
}

function ClientExerciseList({ clientId }: ClientExerciseListProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: exercises, isLoading } = useClientExercises(clientId)

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!exercises?.length) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t('report.noExercisesForClient')}
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {exercises.map((exercise) => (
        <ExerciseRow
          key={exercise.id}
          exercise={exercise}
          onClick={() => navigate(`/reports/${exercise.id}`)}
        />
      ))}
    </div>
  )
}

interface ExerciseRowProps {
  exercise: ExerciseReportSummary
  onClick: () => void
}

function ExerciseRow({ exercise, onClick }: ExerciseRowProps) {
  const { t } = useTranslation()

  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
    draft: { color: 'bg-gray-100 text-gray-700', icon: Clock },
    active: { color: 'bg-green-100 text-green-700', icon: Clock },
    completed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  }

  const status = statusConfig[exercise.status] || statusConfig.draft
  const StatusIcon = status.icon

  return (
    <button
      onClick={onClick}
      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-medium text-gray-900">{exercise.name}</h4>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {t(`exercise.status.${exercise.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>
              {exercise.technique_count} {t('report.techniques')}
            </span>
            {exercise.started_at && (
              <span>
                {t('report.startedOn')} {new Date(exercise.started_at).toLocaleDateString()}
              </span>
            )}
            {exercise.completed_at && (
              <span>
                {t('report.completedOn')} {new Date(exercise.completed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Detection Rates */}
        {exercise.status !== 'draft' && (
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-green-600">
                {Math.round(exercise.tool_rate)}%
              </div>
              <div className="text-xs text-gray-500">{t('report.tool')}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600">
                {Math.round(exercise.siem_rate)}%
              </div>
              <div className="text-xs text-gray-500">{t('report.siem')}</div>
            </div>
          </div>
        )}

        <Badge variant="purple">{t('report.viewReport')}</Badge>
      </div>
    </button>
  )
}
