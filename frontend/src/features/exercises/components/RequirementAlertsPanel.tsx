import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { useFulfillRequirement } from '../hooks/useExercises'
import type { AlertScenario, RequirementAlerts } from '../api/exercisesApi'

interface RequirementAlertsPanelProps {
  exerciseId: string
  canFulfill: boolean
  alerts?: RequirementAlerts
}

const urgencyConfig = {
  critical: { color: 'border-red-500 bg-red-50', badgeColor: 'bg-red-100 text-red-800', icon: '🔴' },
  high: { color: 'border-orange-500 bg-orange-50', badgeColor: 'bg-orange-100 text-orange-800', icon: '🟠' },
  warning: { color: 'border-yellow-500 bg-yellow-50', badgeColor: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
  upcoming: { color: 'border-blue-500 bg-blue-50', badgeColor: 'bg-blue-100 text-blue-800', icon: '🔵' },
} as const

export function RequirementAlertsPanel({ exerciseId, canFulfill, alerts }: RequirementAlertsPanelProps) {
  const { t } = useTranslation()
  const fulfillMutation = useFulfillRequirement()

  if (!alerts) return null

  const hasAlerts =
    alerts.critical.length > 0 ||
    alerts.high.length > 0 ||
    alerts.warning.length > 0 ||
    alerts.upcoming.length > 0

  if (!hasAlerts) return null

  const handleFulfill = (requirementId: string) => {
    fulfillMutation.mutate({ exerciseId, requirementId, fulfilled: true })
  }

  const renderScenarios = (scenarios: AlertScenario[], urgency: keyof typeof urgencyConfig) => {
    if (scenarios.length === 0) return null
    const config = urgencyConfig[urgency]

    return (
      <div key={urgency} className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>{config.icon}</span>
          <span>{t(`requirement.alerts.${urgency}`)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${config.badgeColor}`}>
            {scenarios.length}
          </span>
        </div>
        <div className="space-y-1.5 ml-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.exercise_technique_id}
              className={`flex items-center justify-between rounded-md border-l-4 px-3 py-2 text-sm ${config.color}`}
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">
                  {scenario.mitre_id && (
                    <span className="text-gray-500 mr-1">{scenario.mitre_id}</span>
                  )}
                  {scenario.technique_name}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {scenario.pending_requirements.map((req) => (
                    <span
                      key={req.id}
                      className="inline-flex items-center gap-1 rounded bg-white/70 px-2 py-0.5 text-xs text-gray-700"
                    >
                      <span className="text-gray-400">{t(`requirement.categories.${req.category}`)}</span>
                      <span>{req.title}</span>
                      {canFulfill && (
                        <button
                          onClick={() => handleFulfill(req.id)}
                          className="ml-1 text-green-600 hover:text-green-800"
                          title={t('requirement.actions.fulfill')}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-3 flex-shrink-0 text-xs text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(scenario.scheduled_start_time).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">
          {t('requirement.alerts.title')}
        </h3>
      </div>
      <div className="space-y-3">
        {renderScenarios(alerts.critical, 'critical')}
        {renderScenarios(alerts.high, 'high')}
        {renderScenarios(alerts.warning, 'warning')}
        {renderScenarios(alerts.upcoming, 'upcoming')}
      </div>
    </div>
  )
}
