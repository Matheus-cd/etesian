import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Building,
  Calendar,
  Users,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Shield,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DonutChart, type ChartSegment } from '@/components/ui/DonutChart'
import { useExerciseReport } from '../hooks/useReports'
import type { TacticCoverageData, Recommendation, TechniqueReportData, ResponseMetrics } from '../api/reportsApi'

export function ReportGeneratorPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { data: report, isLoading } = useExerciseReport(exerciseId)

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    detection: true,
    tactics: true,
    techniques: false,
    timeline: false,
    response: true,
    recommendations: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t('report.notFound')}</h2>
        <Link to="/reports" className="text-primary-600 hover:underline mt-2 inline-block">
          {t('report.backToReports')}
        </Link>
      </div>
    )
  }

  const { exercise, members, detection_summary, response_metrics, tactic_coverage, recommendations, techniques } = report

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{exercise.name}</h1>
              <Badge variant={exercise.status === 'completed' ? 'success' : 'default'}>
                {t(`exercise.status.${exercise.status}`)}
              </Badge>
            </div>
            {exercise.client && (
              <p className="text-gray-500 flex items-center gap-1 mt-1">
                <Building className="h-4 w-4" />
                {exercise.client.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" disabled>
            <Download className="h-4 w-4 mr-2" />
            {t('report.export.pdf')}
          </Button>
        </div>
      </div>

      {/* Executive Summary Section */}
      <CollapsibleSection
        title={t('report.sections.summary')}
        isExpanded={expandedSections.summary}
        onToggle={() => toggleSection('summary')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-primary-600" />}
            label={t('common.created')}
            value={new Date(exercise.created_at).toLocaleDateString()}
          />
          {exercise.started_at && (
            <StatCard
              icon={<Clock className="h-5 w-5 text-green-600" />}
              label={t('exercise.fields.startedAt')}
              value={new Date(exercise.started_at).toLocaleDateString()}
            />
          )}
          {exercise.completed_at && (
            <StatCard
              icon={<CheckCircle className="h-5 w-5 text-blue-600" />}
              label={t('exercise.fields.completedAt')}
              value={new Date(exercise.completed_at).toLocaleDateString()}
            />
          )}
          <StatCard
            icon={<Users className="h-5 w-5 text-purple-600" />}
            label={t('exercise.teamMembers')}
            value={members?.length?.toString() || '0'}
          />
          <StatCard
            icon={<FileText className="h-5 w-5 text-orange-600" />}
            label={t('technique.title')}
            value={detection_summary.total_techniques.toString()}
          />
          <StatCard
            icon={<Eye className="h-5 w-5 text-green-600" />}
            label={t('report.metrics.siemDetectionRate')}
            value={`${Math.round(detection_summary.siem_rate)}%`}
          />
          <StatCard
            icon={<Shield className="h-5 w-5 text-blue-600" />}
            label={t('report.metrics.toolDetectionRate')}
            value={`${Math.round(detection_summary.tool_rate)}%`}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-gray-600" />}
            label={t('report.metrics.executed')}
            value={`${detection_summary.total_with_execution}/${detection_summary.total_techniques}`}
          />
        </div>

        {/* Team Members */}
        {members && members.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">{t('exercise.teamMembers')}</h4>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                >
                  <span className="font-medium">{member.full_name}</span>
                  <span className="text-gray-500">({member.role_in_exercise.replace('_', ' ')})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Detection Analysis Section */}
      <CollapsibleSection
        title={t('report.sections.detection')}
        isExpanded={expandedSections.detection}
        onToggle={() => toggleSection('detection')}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left side: Tool & SIEM Detection */}
          <div className="flex-1 flex flex-wrap justify-center gap-8 md:gap-12">
            {/* Tool Detection Chart */}
            <DonutChart
              title={t('detection.toolLabel')}
              size={140}
              centerValue={`${Math.round(detection_summary.tool_rate)}%`}
              centerLabel={t('detection.detected')}
              segments={[
                {
                  label: t('detection.detected'),
                  value: detection_summary.tool_detected - detection_summary.tool_blocked,
                  color: '#22c55e',
                },
                {
                  label: t('detection.status.blocked'),
                  value: detection_summary.tool_blocked,
                  color: '#3b82f6',
                },
                {
                  label: t('detection.notDetected'),
                  value: detection_summary.total_techniques - detection_summary.tool_detected - detection_summary.tool_not_applicable,
                  color: '#ef4444',
                },
                {
                  label: t('detection.status.not_applicable'),
                  value: detection_summary.tool_not_applicable,
                  color: '#4b5563',
                },
              ] as ChartSegment[]}
            />

            {/* SIEM Detection Chart */}
            <DonutChart
              title={t('detection.siemLabel')}
              size={140}
              centerValue={`${Math.round(detection_summary.siem_rate)}%`}
              centerLabel={t('detection.detected')}
              segments={[
                {
                  label: t('detection.detected'),
                  value: detection_summary.siem_detected,
                  color: '#22c55e',
                },
                {
                  label: t('detection.notDetected'),
                  value: detection_summary.total_techniques - detection_summary.siem_detected - detection_summary.siem_not_applicable,
                  color: '#ef4444',
                },
                {
                  label: t('detection.status.not_applicable'),
                  value: detection_summary.siem_not_applicable,
                  color: '#4b5563',
                },
              ] as ChartSegment[]}
            />
          </div>

          {/* Separator */}
          <div className="hidden lg:block w-px bg-gray-200 self-stretch min-h-[200px]" />

          {/* Right side: Final Result */}
          <div className="flex-1 flex justify-center">
            <DonutChart
              title={t('detection.finalResult')}
              size={150}
              centerValue={`${detection_summary.total_techniques > 0 ? Math.round((detection_summary.final_detected / detection_summary.total_techniques) * 100) : 0}%`}
              centerLabel={t('detection.detected')}
              segments={[
                {
                  label: t('detection.status.detected'),
                  value: detection_summary.final_detected,
                  color: '#22c55e',
                },
                {
                  label: t('detection.status.blocked'),
                  value: detection_summary.final_blocked,
                  color: '#3b82f6',
                },
                {
                  label: t('detection.status.partial'),
                  value: detection_summary.final_partial,
                  color: '#f59e0b',
                },
                {
                  label: t('detection.status.not_detected'),
                  value: detection_summary.final_not_detected,
                  color: '#ef4444',
                },
                {
                  label: t('detection.status.not_applicable'),
                  value: detection_summary.final_not_applicable,
                  color: '#4b5563',
                },
                {
                  label: t('detection.notExecuted'),
                  value: detection_summary.final_not_executed,
                  color: '#9ca3af',
                },
              ] as ChartSegment[]}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Response Metrics Section */}
      <CollapsibleSection
        title={t('report.sections.response')}
        isExpanded={expandedSections.response}
        onToggle={() => toggleSection('response')}
      >
        <ResponseMetricsSection metrics={response_metrics} />
      </CollapsibleSection>

      {/* Tactic Coverage Section */}
      <CollapsibleSection
        title={t('report.sections.tactics')}
        isExpanded={expandedSections.tactics}
        onToggle={() => toggleSection('tactics')}
      >
        <TacticCoverageSection coverage={tactic_coverage} />
      </CollapsibleSection>

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <CollapsibleSection
          title={t('report.sections.recommendations')}
          isExpanded={expandedSections.recommendations}
          onToggle={() => toggleSection('recommendations')}
        >
          <RecommendationsSection recommendations={recommendations} />
        </CollapsibleSection>
      )}

      {/* Techniques Detail Section */}
      <CollapsibleSection
        title={t('report.sections.techniques')}
        isExpanded={expandedSections.techniques}
        onToggle={() => toggleSection('techniques')}
      >
        <TechniquesTable techniques={techniques} />
      </CollapsibleSection>
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleSection({ title, isExpanded, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-600 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

interface ResponseMetricsSectionProps {
  metrics: ResponseMetrics
}

function ResponseMetricsSection({ metrics }: ResponseMetricsSectionProps) {
  const { t } = useTranslation()

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '-'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  // Sort time ranges in logical order
  const sortTimeRanges = (entries: [string, number][]) => {
    const order = ['< 1min', '1-5min', '5-15min', '> 15min']
    return entries.sort((a, b) => {
      const aIdx = order.indexOf(a[0])
      const bIdx = order.indexOf(b[0])
      if (aIdx === -1 && bIdx === -1) return a[0].localeCompare(b[0])
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  }

  const toolTimeEntries = sortTimeRanges(Object.entries(metrics.tool_by_time_range || {}))
  const siemTimeEntries = sortTimeRanges(Object.entries(metrics.siem_by_time_range || {}))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tool Detection Metrics */}
        <div className="space-y-3">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700">{t('report.metrics.mttdTool')}</p>
            <p className="text-2xl font-bold text-green-800">{formatTime(metrics.mttd_tool)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50/50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">{t('report.metrics.fastestTool')}</p>
              <p className="text-lg font-semibold text-green-700">{formatTime(metrics.fastest_tool)}</p>
            </div>
            <div className="bg-green-50/50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">{t('report.metrics.slowestTool')}</p>
              <p className="text-lg font-semibold text-green-700">{formatTime(metrics.slowest_tool)}</p>
            </div>
          </div>

          {/* Tool Time Distribution */}
          {(toolTimeEntries.length > 0 || metrics.tool_not_detected_count > 0) && (
            <div>
              <h4 className="text-xs font-medium text-green-700 mb-2">{t('report.metrics.timeDistributionTool')}</h4>
              <div className="flex flex-wrap gap-2">
                {toolTimeEntries.map(([range, count]) => (
                  <div key={range} className="bg-green-100 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-sm font-semibold text-green-800">{count}</p>
                    <p className="text-xs text-green-600">{range}</p>
                  </div>
                ))}
                {metrics.tool_not_detected_count > 0 && (
                  <div className="bg-red-100 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-sm font-semibold text-red-800">{metrics.tool_not_detected_count}</p>
                    <p className="text-xs text-red-600">{t('report.metrics.notDetectedTool')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIEM Detection Metrics */}
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-700">{t('report.metrics.mttdSiem')}</p>
            <p className="text-2xl font-bold text-blue-800">{formatTime(metrics.mttd_siem)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600">{t('report.metrics.fastestSiem')}</p>
              <p className="text-lg font-semibold text-blue-700">{formatTime(metrics.fastest_siem)}</p>
            </div>
            <div className="bg-blue-50/50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600">{t('report.metrics.slowestSiem')}</p>
              <p className="text-lg font-semibold text-blue-700">{formatTime(metrics.slowest_siem)}</p>
            </div>
          </div>

          {/* SIEM Time Distribution */}
          {(siemTimeEntries.length > 0 || metrics.siem_not_detected_count > 0) && (
            <div>
              <h4 className="text-xs font-medium text-blue-700 mb-2">{t('report.metrics.timeDistributionSiem')}</h4>
              <div className="flex flex-wrap gap-2">
                {siemTimeEntries.map(([range, count]) => (
                  <div key={range} className="bg-blue-100 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-sm font-semibold text-blue-800">{count}</p>
                    <p className="text-xs text-blue-600">{range}</p>
                  </div>
                ))}
                {metrics.siem_not_detected_count > 0 && (
                  <div className="bg-red-100 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-sm font-semibold text-red-800">{metrics.siem_not_detected_count}</p>
                    <p className="text-xs text-red-600">{t('report.metrics.notDetectedSiem')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface TacticCoverageSectionProps {
  coverage: TacticCoverageData[]
}

function TacticCoverageSection({ coverage }: TacticCoverageSectionProps) {
  const { t } = useTranslation()

  const getHealthColor = (rate: number, total: number, notExecuted: number) => {
    if (total === 0) return 'bg-gray-50 border-gray-200 text-gray-400'
    if (total === notExecuted) return 'bg-gray-100 border-gray-200 text-gray-500'
    if (rate >= 80) return 'bg-green-100 border-green-300 text-green-700'
    if (rate >= 60) return 'bg-lime-100 border-lime-300 text-lime-700'
    if (rate >= 40) return 'bg-yellow-100 border-yellow-300 text-yellow-700'
    if (rate >= 20) return 'bg-orange-100 border-orange-300 text-orange-700'
    return 'bg-red-100 border-red-300 text-red-700'
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
          <span className="text-gray-600">80-100%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-lime-200 border border-lime-300" />
          <span className="text-gray-600">60-80%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300" />
          <span className="text-gray-600">40-60%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-orange-200 border border-orange-300" />
          <span className="text-gray-600">20-40%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          <span className="text-gray-600">0-20%</span>
        </div>
      </div>

      {/* Tactic Cards */}
      <div className="flex flex-wrap justify-center gap-3">
        {coverage.map((tactic) => (
          <div
            key={tactic.tactic}
            className={`rounded-lg border-2 p-3 min-w-[120px] max-w-[140px] flex flex-col items-center transition-all hover:shadow-md ${getHealthColor(tactic.siem_rate, tactic.total, tactic.not_executed)}`}
            title={`${tactic.tactic}\n${t('detection.tacticCoverage.techniques')}: ${tactic.total}\nSIEM: ${tactic.detected}/${tactic.total - tactic.not_applicable - tactic.not_executed}`}
          >
            <span className="text-xs font-medium text-center line-clamp-2 h-8 leading-4">
              {tactic.tactic}
            </span>
            <span className="text-lg font-bold mt-1">
              {tactic.total === 0 || tactic.total === tactic.not_executed
                ? '-'
                : `${Math.round(tactic.siem_rate)}%`}
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5">
              {tactic.total} {t('detection.tacticCoverage.techniques')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface RecommendationsSectionProps {
  recommendations: Recommendation[]
}

function RecommendationsSection({ recommendations }: RecommendationsSectionProps) {
  const { t } = useTranslation()

  const priorityConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
    high: { color: 'bg-red-50 border-red-200 text-red-800', icon: AlertTriangle },
    medium: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: AlertTriangle },
    low: { color: 'bg-blue-50 border-blue-200 text-blue-800', icon: AlertTriangle },
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, index) => {
        const config = priorityConfig[rec.priority] || priorityConfig.low
        const Icon = config.icon
        return (
          <div key={index} className={`rounded-lg border p-4 ${config.color}`}>
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{rec.title}</h4>
                  <Badge variant={rec.priority === 'high' ? 'default' : rec.priority === 'medium' ? 'warning' : 'success'}>
                    {t(`report.recommendations.priority.${rec.priority}`)}
                  </Badge>
                </div>
                <p className="text-sm opacity-90">{rec.description}</p>
                {rec.mitre_ids && rec.mitre_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rec.mitre_ids.map((id) => (
                      <span key={id} className="text-xs font-mono bg-white/50 px-1.5 py-0.5 rounded">
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface TechniquesTableProps {
  techniques: TechniqueReportData[]
}

function TechniquesTable({ techniques }: TechniquesTableProps) {
  const { t } = useTranslation()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'in_progress':
        return 'bg-blue-100 text-blue-700'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatResponseTime = (seconds: number | null | undefined): string => {
    if (seconds == null) return '-'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('technique.fields.mitreId')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('technique.fields.name')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('technique.fields.tactic')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('common.status')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('detection.toolLabel')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('detection.siemLabel')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('report.responseTimeTool')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('report.responseTimeSiem')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {techniques.map((tech, index) => {
            const latestDetection = tech.detections?.[tech.detections.length - 1]
            const hasExecutions = tech.executions && tech.executions.length > 0
            return (
              <tr key={tech.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {index + 1}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-mono text-primary-600">
                    {tech.mitre_id || '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{tech.name}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {tech.tactic ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {tech.tactic}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tech.status)}`}>
                    {t(`technique.status.${tech.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {latestDetection ? (
                    latestDetection.tool_not_applicable ? (
                      <span className="text-gray-400 text-xs">N/A</span>
                    ) : latestDetection.tool_detected ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-red-500 mx-auto" />
                    )
                  ) : hasExecutions ? (
                    <EyeOff className="h-4 w-4 text-red-500 mx-auto" title={t('detection.notDetected')} />
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {latestDetection ? (
                    latestDetection.siem_not_applicable ? (
                      <span className="text-gray-400 text-xs">N/A</span>
                    ) : latestDetection.siem_detected ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-red-500 mx-auto" />
                    )
                  ) : hasExecutions ? (
                    <EyeOff className="h-4 w-4 text-red-500 mx-auto" title={t('detection.notDetected')} />
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                  {formatResponseTime(tech.response_time?.tool_response_seconds)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                  {formatResponseTime(tech.response_time?.siem_response_seconds)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
