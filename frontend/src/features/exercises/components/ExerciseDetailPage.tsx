import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Play,
  CheckCircle,
  Users,
  FileText,
  Plus,
  Trash2,
  Calendar,
  Building,
  Edit,
  RotateCcw,
  GripVertical,
  Pause,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  List,
  CalendarDays,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DonutChart, type ChartSegment } from '@/components/ui/DonutChart'
import {
  useExercise,
  useExerciseMembers,
  useExerciseTechniques,
  useStartExercise,
  useCompleteExercise,
  useReopenExercise,
  useRemoveMember,
  useRemoveTechnique,
  useUpdateExerciseTechnique,
  useReorderTechniques,
  useScheduleTechnique,
} from '../hooks/useExercises'
import { ExerciseForm } from './ExerciseForm'
import { AddMemberModal } from './AddMemberModal'
import { AddTechniqueModal } from './AddTechniqueModal'
import { TechniqueExecutionModal } from './TechniqueExecutionModal'
import { CalendarView } from './CalendarView'
import { exercisesApi } from '../api/exercisesApi'
import type { ExerciseStatus, ExerciseTechnique, TechniqueStatus, DetectionStatus, Detection, DetectionStatsResponse, TacticStat } from '../api/exercisesApi'
import { useAuthStore } from '@/features/auth/store/authStore'

// Roles that can reorder techniques (Red Team and leads)
const REORDER_ROLES = ['admin', 'purple_team_lead', 'red_team_operator']

// Roles that can manage exercise members (admin and lead only)
const MEMBER_MANAGEMENT_ROLES = ['admin', 'purple_team_lead']

// Roles that can manage techniques (add/remove/edit)
const TECHNIQUE_MANAGEMENT_ROLES = ['admin', 'purple_team_lead', 'red_team_operator']

const statusConfig: Record<ExerciseStatus, { labelKey: string; color: string }> = {
  draft: { labelKey: 'exercise.status.draft', color: 'bg-gray-100 text-gray-800' },
  active: { labelKey: 'exercise.status.active', color: 'bg-green-100 text-green-800' },
  completed: { labelKey: 'exercise.status.completed', color: 'bg-blue-100 text-blue-800' },
}

const techniqueStatusConfig: Record<
  TechniqueStatus,
  { labelKey: string; color: string; icon: typeof Clock }
> = {
  pending: { labelKey: 'technique.status.pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
  in_progress: { labelKey: 'technique.status.in_progress', color: 'bg-blue-100 text-blue-700', icon: Play },
  paused: { labelKey: 'technique.status.paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  completed: { labelKey: 'technique.status.completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

const detectionStatusConfig: Record<DetectionStatus, { labelKey: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { labelKey: 'detection.status.pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
  detected: { labelKey: 'detection.status.detected', color: 'bg-green-100 text-green-700', icon: Eye },
  partial: { labelKey: 'detection.status.partial', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  not_detected: { labelKey: 'detection.status.not_detected', color: 'bg-red-100 text-red-700', icon: EyeOff },
  not_applicable: { labelKey: 'detection.status.not_applicable', color: 'bg-gray-200 text-gray-600', icon: EyeOff },
  voided: { labelKey: 'detection.status.voided', color: 'bg-gray-100 text-gray-500', icon: AlertTriangle },
}

// Calculate detection status based on detection priority
// SIEM detection is the ideal scenario:
// - Both N/A → not_applicable
// - SIEM detected → detected (regardless of tool)
// - Only tool detected → partial
// - Neither detected → not_detected
function calculateDetectionStatus(detection: Detection): DetectionStatus {
  // Keep voided status as-is
  if (detection.detection_status === 'voided') {
    return 'voided'
  }

  // Both N/A → not_applicable
  if (detection.tool_not_applicable && detection.siem_not_applicable) {
    return 'not_applicable'
  }

  if (detection.siem_detected) {
    return 'detected'
  } else if (detection.tool_detected) {
    return 'partial'
  }
  return 'not_detected'
}

interface EditExerciseTechniqueFormProps {
  exerciseId: string
  technique: ExerciseTechnique
  onSuccess: () => void
  onCancel: () => void
  updateMutation: ReturnType<typeof useUpdateExerciseTechnique>
}

function EditExerciseTechniqueForm({
  exerciseId,
  technique,
  onSuccess,
  onCancel,
  updateMutation,
}: EditExerciseTechniqueFormProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState(technique.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await updateMutation.mutateAsync({
        exerciseId,
        techniqueId: technique.id,
        data: {
          notes: notes.trim() || undefined,
        },
      })
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || t('technique.failedToUpdate'))
      } else {
        setError(t('technique.failedToUpdate'))
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-50 p-3 rounded-lg">
        <p className="font-medium text-gray-900">
          {technique.technique?.name || 'Unknown Technique'}
        </p>
        {technique.technique?.mitre_id && (
          <p className="text-sm text-gray-500">{technique.technique.mitre_id}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('technique.fields.notes')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('technique.fields.notesPlaceholder')}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          {t('technique.fields.notesHelp')}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? t('technique.saving') : t('technique.saveChanges')}
        </Button>
      </div>
    </form>
  )
}

interface SortableTechniqueItemProps {
  technique: ExerciseTechnique
  index: number
  onEdit: (technique: ExerciseTechnique) => void
  onRemove: (techniqueId: string) => void
  onOpenExecution: (technique: ExerciseTechnique) => void
  exerciseActive: boolean
  exerciseId: string
  refreshKey?: number
  canReorder?: boolean
  t: (key: string) => string
}

// Detection status indicator colors for the left border
const detectionBorderColors: Record<DetectionStatus, string> = {
  pending: 'border-l-gray-300',
  detected: 'border-l-green-500',
  partial: 'border-l-yellow-500',
  not_detected: 'border-l-red-500',
  not_applicable: 'border-l-gray-400',
  voided: 'border-l-gray-400',
}

// Detection status background colors for the indicator
const detectionBgColors: Record<DetectionStatus, string> = {
  pending: 'bg-gray-100',
  detected: 'bg-green-100',
  partial: 'bg-yellow-100',
  not_detected: 'bg-red-100',
  not_applicable: 'bg-gray-200',
  voided: 'bg-gray-100',
}

const detectionTextColors: Record<DetectionStatus, string> = {
  pending: 'text-gray-500',
  detected: 'text-green-700',
  partial: 'text-yellow-700',
  not_detected: 'text-red-700',
  not_applicable: 'text-gray-600',
  voided: 'text-gray-500',
}

// Tactic stats type for grouping detection by MITRE tactic
interface TacticStats {
  tactic: string
  total: number
  detected: number      // SIEM detected (full detection)
  partial: number       // Only tool detected
  notDetected: number   // Neither detected
  notApplicable: number // Both N/A
  pending: number       // Has execution but no detection
  notExecuted: number   // No execution
}

// MITRE ATT&CK tactic order for consistent sorting
const TACTIC_ORDER = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
]

function SortableTechniqueItem({
  technique,
  index,
  onEdit,
  onRemove,
  onOpenExecution,
  exerciseActive,
  exerciseId,
  refreshKey,
  canReorder = true,
  t,
}: SortableTechniqueItemProps) {
  const [detectionStatus, setDetectionStatus] = useState<Detection | null>(null)
  const [loadingDetection, setLoadingDetection] = useState(false)
  const [hasExecutions, setHasExecutions] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: technique.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const status = technique.status || 'pending'
  const statusInfo = techniqueStatusConfig[status]
  const StatusIcon = statusInfo?.icon || Clock

  // Track if this is the initial load (to show loading indicator only on first load)
  const isInitialLoad = useRef(true)

  // Load executions and detection status directly from API
  useEffect(() => {
    if (!exerciseActive) {
      return
    }

    let isMounted = true

    // Only show loading on initial load, not on polling updates
    if (isInitialLoad.current) {
      setLoadingDetection(true)
    }

    const loadExecutionsAndDetections = async () => {
      try {
        // Fetch executions for this technique
        const executions = await exercisesApi.getTechniqueExecutions(exerciseId, technique.id)

        if (!isMounted) return

        if (Array.isArray(executions) && executions.length > 0) {
          setHasExecutions(true)

          // Get detections for the first execution
          const executionId = executions[0].id
          const detections = await exercisesApi.getDetectionsByExecution(executionId)

          if (isMounted) {
            if (Array.isArray(detections) && detections.length > 0) {
              setDetectionStatus(detections[detections.length - 1])
            } else {
              setDetectionStatus(null)
            }
          }
        } else {
          setHasExecutions(false)
          setDetectionStatus(null)
        }
      } catch (error) {
        console.error('Error loading executions/detections:', error)
        if (isMounted) {
          setHasExecutions(false)
          setDetectionStatus(null)
        }
      } finally {
        if (isMounted) {
          setLoadingDetection(false)
          isInitialLoad.current = false
        }
      }
    }

    loadExecutionsAndDetections()

    return () => {
      isMounted = false
    }
  }, [technique.id, exerciseId, exerciseActive, refreshKey])

  // Calculate the real detection status based on tool/siem detection values
  const calculatedStatus = detectionStatus ? calculateDetectionStatus(detectionStatus) : null
  const detectionInfo = calculatedStatus ? detectionStatusConfig[calculatedStatus] : null

  // Determine what to show in the detection indicator
  const getDetectionDisplay = () => {
    if (!exerciseActive) {
      return { icon: Clock, label: t('detection.inactive'), color: 'pending' as DetectionStatus }
    }
    if (loadingDetection) {
      return { icon: Clock, label: t('detection.loading'), color: 'pending' as DetectionStatus }
    }
    if (!hasExecutions) {
      return { icon: Clock, label: t('detection.noExecution'), color: 'pending' as DetectionStatus }
    }
    if (detectionStatus && calculatedStatus) {
      return {
        icon: detectionInfo?.icon || Shield,
        label: detectionInfo?.labelKey ? t(detectionInfo.labelKey) : t('detection.status.pending'),
        color: calculatedStatus
      }
    }
    // Has executions but no detection registered yet = Not Detected
    return { icon: EyeOff, label: t('detection.status.not_detected'), color: 'not_detected' as DetectionStatus }
  }

  const displayInfo = getDetectionDisplay()
  const DisplayIcon = displayInfo.icon

  // Handle click on the card (not on buttons)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on a button or drag handle
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[data-drag-handle]')) {
      return
    }
    if (exerciseActive) {
      onOpenExecution(technique)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch rounded-lg overflow-hidden shadow-sm border border-gray-200 transition-all duration-200 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${exerciseActive && !isDragging ? 'cursor-pointer hover:shadow-md hover:border-primary-300' : ''} ${
        isHovered && exerciseActive ? 'ring-2 ring-primary-200' : ''
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Detection Status Indicator - Always show */}
      <div
        className={`w-24 flex-shrink-0 flex flex-col items-center justify-center py-3 px-2 border-l-4 ${detectionBorderColors[displayInfo.color]} ${detectionBgColors[displayInfo.color]}`}
      >
        {loadingDetection ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500" />
        ) : (
          <>
            <DisplayIcon className={`h-6 w-6 ${detectionTextColors[displayInfo.color]}`} />
            <span className={`text-xs font-medium mt-1.5 text-center leading-tight ${detectionTextColors[displayInfo.color]}`}>
              {displayInfo.label}
            </span>
            {/* Tool/SIEM indicators */}
            {detectionStatus && (detectionStatus.tool_detected || detectionStatus.siem_detected) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {detectionStatus.tool_detected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" title={t('detection.detectedByTool')} />
                )}
                {detectionStatus.siem_detected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" title={t('detection.detectedBySiem')} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-start p-3 bg-white gap-3 overflow-hidden">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {canReorder ? (
            <button
              type="button"
              data-drag-handle
              className="mt-1 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5" />
            </button>
          ) : (
            <div className="mt-1 p-1 w-7 flex-shrink-0" />
          )}
          <span className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700 flex-shrink-0">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900 truncate max-w-[300px]" title={technique.technique?.name}>
                {technique.technique?.name || 'Unknown Technique'}
              </p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusInfo?.color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusInfo?.labelKey ? t(statusInfo.labelKey) : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {technique.technique?.mitre_id && (
                <span className="text-sm text-gray-500 font-mono">{technique.technique.mitre_id}</span>
              )}
              {technique.technique?.tactic && (
                <Badge variant="default" className="text-xs">
                  {technique.technique.tactic}
                </Badge>
              )}
            </div>
            {technique.notes && (
              <p className="text-sm text-gray-600 mt-1 italic line-clamp-2" title={technique.notes}>
                {technique.notes}
              </p>
            )}
          </div>
        </div>
        {/* Action Buttons - More visible design */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {exerciseActive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenExecution(technique)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
              title={t('common.open')}
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.open')}</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(technique)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title={t('common.edit')}
          >
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.edit')}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(technique.id)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            title={t('common.remove')}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.remove')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Tactic Card Component - Shows health color based on detection rate
interface TacticCardProps {
  stat: TacticStats
  t: (key: string) => string
}

function TacticCard({ stat, t }: TacticCardProps) {
  // Check if this tactic has no scenarios in the exercise
  const hasNoScenarios = stat.total === 0

  // Calculate executed scenarios (excluding only not executed)
  // pending = has execution but no detection registered, so it counts as executed
  const executedCount = stat.detected + stat.partial + stat.notDetected + stat.notApplicable + stat.pending
  const hasExecutions = executedCount > 0

  // SIEM Detection Rate - only SIEM detection counts as "real" detection
  // Applicable = all scenarios that should be detected (excluding N/A)
  // Pending scenarios (no detection registered) count as NOT detected
  const applicableCount = stat.detected + stat.partial + stat.notDetected + stat.pending

  // SIEM rate = scenarios with SIEM detection / total applicable
  // stat.detected = SIEM detected (full detection)
  // stat.partial = Tool only (no SIEM)
  // stat.notDetected = neither detected (detection registered but not detected)
  // stat.pending = no detection registered yet (counts as not detected)
  const siemRate = applicableCount > 0 ? (stat.detected / applicableCount) * 100 : 0

  // Determine card color based on SIEM detection rate (heatmap style)
  // - Hatched gray: No scenarios in this tactic
  // - Gray: No executions yet
  // - Green: High SIEM detection (>= 80%) - "cool" / healthy
  // - Lime: Good SIEM detection (60-80%)
  // - Yellow: Moderate SIEM detection (40-60%)
  // - Orange: Poor SIEM detection (20-40%)
  // - Red: Very poor SIEM detection (< 20%) - "hot" / needs attention
  const getHealthColor = () => {
    // No scenarios - special grayed out state
    if (hasNoScenarios) {
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-400',
        label: t('detection.tacticCoverage.noScenarios'),
        isEmpty: true,
      }
    }

    if (!hasExecutions) {
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-200',
        text: 'text-gray-500',
        label: t('detection.notExecuted'),
        isEmpty: false,
      }
    }

    // Color gradient based on SIEM detection rate
    if (siemRate >= 80) {
      return {
        bg: 'bg-green-100',
        border: 'border-green-300',
        text: 'text-green-700',
        label: `${Math.round(siemRate)}%`,
        isEmpty: false,
      }
    }
    if (siemRate >= 60) {
      return {
        bg: 'bg-lime-100',
        border: 'border-lime-300',
        text: 'text-lime-700',
        label: `${Math.round(siemRate)}%`,
        isEmpty: false,
      }
    }
    if (siemRate >= 40) {
      return {
        bg: 'bg-yellow-100',
        border: 'border-yellow-300',
        text: 'text-yellow-700',
        label: `${Math.round(siemRate)}%`,
        isEmpty: false,
      }
    }
    if (siemRate >= 20) {
      return {
        bg: 'bg-orange-100',
        border: 'border-orange-300',
        text: 'text-orange-700',
        label: `${Math.round(siemRate)}%`,
        isEmpty: false,
      }
    }
    return {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-700',
      label: `${Math.round(siemRate)}%`,
      isEmpty: false,
    }
  }

  const health = getHealthColor()

  // Use translation for "No Tactic" if applicable
  const displayTactic = stat.tactic === 'No Tactic' ? t('detection.tacticCoverage.noTactic') : stat.tactic

  // Build tooltip with detailed stats
  // notDetectedTotal = explicit not detected + pending (no detection registered)
  const notDetectedTotal = stat.notDetected + stat.pending
  const tooltipLines = hasNoScenarios
    ? t('detection.tacticCoverage.noScenariosTooltip')
    : [
        `${displayTactic}`,
        `${t('detection.tacticCoverage.techniques')}: ${stat.total}`,
        '',
        `SIEM: ${stat.detected}/${applicableCount}`,
        `Tool: ${stat.detected + stat.partial}/${applicableCount}`,
        '',
        notDetectedTotal > 0 ? `${t('detection.status.not_detected')}: ${notDetectedTotal}` : '',
        stat.notApplicable > 0 ? `${t('detection.status.not_applicable')}: ${stat.notApplicable}` : '',
        stat.notExecuted > 0 ? `${t('detection.notExecuted')}: ${stat.notExecuted}` : '',
      ].filter(Boolean).join('\n')

  // Hatched pattern style for empty tactics
  const hatchedStyle = health.isEmpty ? {
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 8px)',
  } : {}

  return (
    <div
      className={`relative rounded-lg border-2 p-3 min-w-[120px] max-w-[140px] flex flex-col items-center transition-all ${health.isEmpty ? 'opacity-70' : 'hover:shadow-md'} ${health.bg} ${health.border}`}
      style={hatchedStyle}
      title={tooltipLines}
    >
      <span className={`text-xs font-medium text-center line-clamp-2 h-8 leading-4 ${health.isEmpty ? 'text-gray-400' : 'text-gray-600'}`}>
        {displayTactic}
      </span>
      <span className={`text-lg font-bold mt-1 ${health.text}`}>
        {health.label}
      </span>
      {!hasNoScenarios && (
        <span className="text-[10px] text-gray-500 mt-0.5">
          {stat.total} {t('detection.tacticCoverage.techniques')}
        </span>
      )}
    </div>
  )
}

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Get current user to check permissions
  const { user } = useAuthStore()
  const userRole = user?.role || ''
  const canReorder = REORDER_ROLES.includes(userRole)
  const canManageMembers = MEMBER_MANAGEMENT_ROLES.includes(userRole)
  const canManageTechniques = TECHNIQUE_MANAGEMENT_ROLES.includes(userRole)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddTechnique, setShowAddTechnique] = useState(false)
  const [editingTechnique, setEditingTechnique] = useState<ExerciseTechnique | null>(null)
  const [executionTechnique, setExecutionTechnique] = useState<ExerciseTechnique | null>(null)
  const [detectionRefreshKey, setDetectionRefreshKey] = useState(0)
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [localTechniques, setLocalTechniques] = useState<ExerciseTechnique[] | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [isClearingSchedules, setIsClearingSchedules] = useState(false)

  // Tactic coverage section collapsed state
  const [tacticSectionExpanded, setTacticSectionExpanded] = useState(true)

  // Tactic-level statistics
  const [tacticStats, setTacticStats] = useState<TacticStats[]>([])

  // Detection statistics for donut charts
  const [detectionStats, setDetectionStats] = useState({
    // Tool detection
    toolDetected: 0,
    toolNotDetected: 0,
    toolNotApplicable: 0,
    // SIEM detection
    siemDetected: 0,
    siemNotDetected: 0,
    siemNotApplicable: 0,
    // Final status (combined)
    finalDetected: 0,      // SIEM detected
    finalPartial: 0,       // Only tool detected
    finalNotDetected: 0,   // Neither detected (has detection but none detected)
    finalNotApplicable: 0, // Both N/A (counts as not detected but shown separately)
    finalPending: 0,       // Has execution but no detection registered
    finalNotExecuted: 0,   // No execution at all
    // Totals
    totalTechniques: 0,
    totalWithExecutions: 0,
    totalWithDetections: 0,
  })

  // Polling interval for real-time updates (5 seconds)
  const POLLING_INTERVAL = 5000

  const { data: exercise, isLoading } = useExercise(id!)
  const { data: members } = useExerciseMembers(id!)
  // Enable polling for techniques - but pause during drag to avoid conflicts
  const { data: techniques, dataUpdatedAt } = useExerciseTechniques(id!, {
    refetchInterval: isDragging ? false : POLLING_INTERVAL,
  })

  const startExercise = useStartExercise()
  const completeExercise = useCompleteExercise()
  const reopenExercise = useReopenExercise()
  const removeMember = useRemoveMember()
  const removeTechnique = useRemoveTechnique()
  const updateExerciseTechnique = useUpdateExerciseTechnique()
  const reorderTechniques = useReorderTechniques()
  const scheduleTechnique = useScheduleTechnique()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Use local state during drag, fall back to server data
  const displayTechniques = localTechniques ?? techniques ?? []

  // Auto-increment detection refresh key when techniques data updates from polling
  // Using dataUpdatedAt ensures we refresh on every poll cycle, even if data hasn't changed
  useEffect(() => {
    if (dataUpdatedAt && !isDragging && !localTechniques) {
      // Trigger detection refresh when server data updates
      setDetectionRefreshKey(prev => prev + 1)
    }
  }, [dataUpdatedAt, isDragging, localTechniques])

  // Fetch detection statistics from the unified backend endpoint
  useEffect(() => {
    if (!id || !exercise || exercise.status === 'draft') {
      setDetectionStats({
        toolDetected: 0,
        toolNotDetected: 0,
        toolNotApplicable: 0,
        siemDetected: 0,
        siemNotDetected: 0,
        siemNotApplicable: 0,
        finalDetected: 0,
        finalPartial: 0,
        finalNotDetected: 0,
        finalNotApplicable: 0,
        finalPending: 0,
        finalNotExecuted: 0,
        totalTechniques: 0,
        totalWithExecutions: 0,
        totalWithDetections: 0,
      })
      setTacticStats([])
      return
    }

    let isMounted = true

    const fetchStats = async () => {
      try {
        const stats: DetectionStatsResponse = await exercisesApi.getDetectionStats(id)

        if (!isMounted) return

        // Map API response to local state
        setDetectionStats({
          toolDetected: stats.tool_detected,
          toolNotDetected: stats.tool_not_detected,
          toolNotApplicable: stats.tool_not_applicable,
          siemDetected: stats.siem_detected,
          siemNotDetected: stats.siem_not_detected,
          siemNotApplicable: stats.siem_not_applicable,
          finalDetected: stats.final_detected,
          finalPartial: stats.final_partial,
          finalNotDetected: stats.final_not_detected,
          finalNotApplicable: stats.final_not_applicable,
          finalPending: stats.final_pending,
          finalNotExecuted: stats.final_not_executed,
          totalTechniques: stats.total_techniques,
          totalWithExecutions: stats.total_with_execution,
          totalWithDetections: stats.total_with_detection,
        })

        // Map tactic stats from API (snake_case to camelCase) and ensure all MITRE tactics are present
        const tacticMap = new Map<string, TacticStats>()

        // Pre-populate all MITRE ATT&CK tactics with empty stats
        for (const tactic of TACTIC_ORDER) {
          tacticMap.set(tactic, {
            tactic,
            total: 0,
            detected: 0,
            partial: 0,
            notDetected: 0,
            notApplicable: 0,
            pending: 0,
            notExecuted: 0,
          })
        }

        // Merge API data into the tactic map
        for (const apiStat of stats.tactic_stats) {
          const tacticName = apiStat.tactic || 'No Tactic'
          tacticMap.set(tacticName, {
            tactic: tacticName,
            total: apiStat.total,
            detected: apiStat.detected,
            partial: apiStat.partial,
            notDetected: apiStat.not_detected,
            notApplicable: apiStat.not_applicable,
            pending: apiStat.pending,
            notExecuted: apiStat.not_executed,
          })
        }

        // Sort tactics by MITRE order, put unknown tactics at the end
        const sortedTactics = Array.from(tacticMap.values()).sort((a, b) => {
          const aIndex = TACTIC_ORDER.indexOf(a.tactic)
          const bIndex = TACTIC_ORDER.indexOf(b.tactic)
          // Put unknown tactics at end
          if (aIndex === -1 && bIndex === -1) return a.tactic.localeCompare(b.tactic)
          if (aIndex === -1) return 1
          if (bIndex === -1) return -1
          return aIndex - bIndex
        })
        setTacticStats(sortedTactics)
      } catch (error) {
        console.error('Error fetching detection stats:', error)
        // Reset stats on error
        setDetectionStats({
          toolDetected: 0,
          toolNotDetected: 0,
          toolNotApplicable: 0,
          siemDetected: 0,
          siemNotDetected: 0,
          siemNotApplicable: 0,
          finalDetected: 0,
          finalPartial: 0,
          finalNotDetected: 0,
          finalNotApplicable: 0,
          finalPending: 0,
          finalNotExecuted: 0,
          totalTechniques: 0,
          totalWithExecutions: 0,
          totalWithDetections: 0,
        })
        setTacticStats([])
      }
    }

    fetchStats()

    return () => {
      isMounted = false
    }
  }, [id, exercise, detectionRefreshKey])

  const handleDragStart = () => {
    setIsDragging(true)
    // Capture current state to prevent polling from interfering
    if (techniques) {
      setLocalTechniques([...techniques])
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setIsDragging(false)

    if (over && active.id !== over.id && exercise) {
      const oldIndex = displayTechniques.findIndex((t) => t.id === active.id)
      const newIndex = displayTechniques.findIndex((t) => t.id === over.id)

      const newOrder = arrayMove(displayTechniques, oldIndex, newIndex)
      setLocalTechniques(newOrder)

      // Send reorder request to backend
      const techniqueIds = newOrder.map((t) => t.id)
      reorderTechniques.mutate(
        { exerciseId: exercise.id, techniqueIds },
        {
          onSuccess: () => {
            setLocalTechniques(null) // Reset to server data
          },
          onError: () => {
            setLocalTechniques(null) // Reset on error
          },
        }
      )
    } else {
      // No reorder happened, reset local state
      setLocalTechniques(null)
    }
  }

  const handleDragCancel = () => {
    setIsDragging(false)
    setLocalTechniques(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t('exercise.notFound')}</h2>
        <Link to="/exercises" className="text-primary-600 hover:underline mt-2 inline-block">
          {t('exercise.backToExercises')}
        </Link>
      </div>
    )
  }

  const handleStart = () => {
    startExercise.mutate(exercise.id, {
      onSuccess: () => setConfirmStart(false),
    })
  }

  const handleComplete = () => {
    completeExercise.mutate(exercise.id, {
      onSuccess: () => setConfirmComplete(false),
    })
  }

  const handleReopen = () => {
    reopenExercise.mutate(exercise.id, {
      onSuccess: () => setConfirmReopen(false),
    })
  }

  const handleRemoveMember = (userId: string) => {
    removeMember.mutate({ userId, exerciseId: exercise.id })
  }

  const handleRemoveTechnique = (techniqueId: string) => {
    removeTechnique.mutate({ exerciseId: exercise.id, techniqueId })
  }

  const status = statusConfig[exercise.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/exercises')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{exercise.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {t(status.labelKey)}
              </span>
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
          <Button variant="secondary" onClick={() => setShowEditModal(true)}>
            <Edit className="h-4 w-4 mr-2" />
            {t('common.edit')}
          </Button>
          {exercise.status === 'draft' && (
            <Button onClick={() => setConfirmStart(true)}>
              <Play className="h-4 w-4 mr-2" />
              {t('exercise.start')}
            </Button>
          )}
          {exercise.status === 'active' && (
            <Button onClick={() => setConfirmComplete(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('exercise.complete')}
            </Button>
          )}
          {exercise.status === 'completed' && (
            <Button variant="secondary" onClick={() => setConfirmReopen(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('exercise.reopen')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">{t('common.created')}</span>
          </div>
          <p className="font-semibold">
            {new Date(exercise.created_at).toLocaleDateString()}
          </p>
        </div>
        {exercise.started_at && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">{t('exercise.fields.startedAt')}</span>
            </div>
            <p className="font-semibold">
              {new Date(exercise.started_at).toLocaleDateString()}
            </p>
          </div>
        )}
        {exercise.completed_at && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">{t('exercise.fields.completedAt')}</span>
            </div>
            <p className="font-semibold">
              {new Date(exercise.completed_at).toLocaleDateString()}
            </p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">{t('exercise.teamMembers')}</span>
          </div>
          <p className="font-semibold">{members?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{t('technique.title')}</span>
          </div>
          <p className="font-semibold">{techniques?.length || 0}</p>
        </div>
      </div>

      {/* Description */}
      {exercise.description && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-2">{t('common.description')}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{exercise.description}</p>
        </div>
      )}

      {/* Detection Rate Charts */}
      {exercise.status !== 'draft' && detectionStats.totalTechniques > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 overflow-hidden">
          <h3 className="font-semibold text-gray-900 mb-4">{t('detection.detectionRates')}</h3>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left side: Tool & SIEM Detection */}
            <div className="flex-1 flex flex-wrap justify-center gap-8 md:gap-12">
              {/* Tool Detection Chart */}
              <DonutChart
                title={t('detection.toolLabel')}
                size={140}
                centerValue={`${detectionStats.totalTechniques > 0 ? Math.round((detectionStats.toolDetected / detectionStats.totalTechniques) * 100) : 0}%`}
                centerLabel={t('detection.detected')}
                segments={[
                  {
                    label: t('detection.detected'),
                    value: detectionStats.toolDetected,
                    color: '#22c55e', // green-500
                  },
                  {
                    label: t('detection.notDetected'),
                    value: detectionStats.toolNotDetected + detectionStats.finalPending + detectionStats.finalNotExecuted,
                    color: '#ef4444', // red-500
                  },
                  {
                    label: t('detection.status.not_applicable'),
                    value: detectionStats.toolNotApplicable,
                    color: '#4b5563', // gray-600
                  },
                ] as ChartSegment[]}
              />

              {/* SIEM Detection Chart */}
              <DonutChart
                title={t('detection.siemLabel')}
                size={140}
                centerValue={`${detectionStats.totalTechniques > 0 ? Math.round((detectionStats.siemDetected / detectionStats.totalTechniques) * 100) : 0}%`}
                centerLabel={t('detection.detected')}
                segments={[
                  {
                    label: t('detection.detected'),
                    value: detectionStats.siemDetected,
                    color: '#22c55e', // green-500
                  },
                  {
                    label: t('detection.notDetected'),
                    value: detectionStats.siemNotDetected + detectionStats.finalPending + detectionStats.finalNotExecuted,
                    color: '#ef4444', // red-500
                  },
                  {
                    label: t('detection.status.not_applicable'),
                    value: detectionStats.siemNotApplicable,
                    color: '#4b5563', // gray-600
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
                centerValue={`${detectionStats.totalTechniques > 0 ? Math.round((detectionStats.finalDetected / detectionStats.totalTechniques) * 100) : 0}%`}
                centerLabel={t('detection.detected')}
                segments={[
                  {
                    label: t('detection.status.detected'),
                    value: detectionStats.finalDetected,
                    color: '#22c55e', // green-500
                  },
                  {
                    label: t('detection.status.partial'),
                    value: detectionStats.finalPartial,
                    color: '#f59e0b', // amber-500
                  },
                  {
                    label: t('detection.status.not_detected'),
                    value: detectionStats.finalNotDetected + detectionStats.finalPending,
                    color: '#ef4444', // red-500
                  },
                  {
                    label: t('detection.status.not_applicable'),
                    value: detectionStats.finalNotApplicable,
                    color: '#4b5563', // gray-600
                  },
                  {
                    label: t('detection.notExecuted'),
                    value: detectionStats.finalNotExecuted,
                    color: '#9ca3af', // gray-400
                  },
                ] as ChartSegment[]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tactic Coverage Section */}
      {exercise.status !== 'draft' && tacticStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <button
            onClick={() => setTacticSectionExpanded(!tacticSectionExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">{t('detection.tacticCoverage.title')}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {tacticStats.filter(s => s.total > 0).length}/{tacticStats.length} {tacticStats.length === 1 ? 'tática' : 'táticas'}
              </span>
              {tacticSectionExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>
          {tacticSectionExpanded && (
            <div className="px-4 pb-4 border-t border-gray-100">
              {/* Legend */}
              <div className="py-3 border-b border-gray-100 mb-4">
                {/* Explanation */}
                <p className="text-xs text-gray-500 text-center mb-3">
                  {t('detection.tacticCoverage.legendExplanation')}
                </p>
                {/* Color legend */}
                <div className="flex flex-wrap justify-center gap-4">
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
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
                    <span className="text-gray-600">{t('detection.notExecuted')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-3 h-3 rounded bg-gray-50 border border-gray-200"
                      style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(156, 163, 175, 0.3) 2px, rgba(156, 163, 175, 0.3) 4px)' }}
                    />
                    <span className="text-gray-600">{t('detection.tacticCoverage.noScenarios')}</span>
                  </div>
                </div>
              </div>
              {/* Tactic cards grid */}
              <div className="flex flex-wrap justify-center gap-3">
                {tacticStats.map((stat) => (
                  <TacticCard key={stat.tactic} stat={stat} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('exercise.teamMembers')}</h3>
          {canManageMembers && (
            <Button size="sm" onClick={() => setShowAddMember(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('exercise.addMember')}
            </Button>
          )}
        </div>

        {!members?.length ? (
          <p className="text-gray-500 text-center py-8">
            {t('exercise.noMembersYet')}
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.user?.full_name || member.user?.username || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.role_in_exercise === 'lead' ? 'purple' : 'default'}>
                    {member.role_in_exercise.replace('_', ' ')}
                  </Badge>
                  {canManageMembers && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Techniques */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('technique.title')}</h3>
              {viewMode === 'list' && displayTechniques.length > 1 && canReorder && (
                <p className="text-sm text-gray-500">{t('technique.dragToReorder')}</p>
              )}
            </div>
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4" />
                {t('calendar.listView')}
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                {t('calendar.calendarView')}
              </button>
            </div>
          </div>
          {canManageTechniques && (
            <Button size="sm" onClick={() => setShowAddTechnique(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('technique.add')}
            </Button>
          )}
        </div>

        {viewMode === 'list' ? (
          // List View
          !displayTechniques.length ? (
            <p className="text-gray-500 text-center py-8">
              {t('technique.noTechniquesYet')}
            </p>
          ) : (
            <DndContext
              sensors={canReorder ? sensors : []}
              collisionDetection={closestCenter}
              onDragStart={canReorder ? handleDragStart : undefined}
              onDragEnd={canReorder ? handleDragEnd : undefined}
              onDragCancel={canReorder ? handleDragCancel : undefined}
            >
              <SortableContext
                items={displayTechniques.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {displayTechniques.map((tech, index) => (
                    <SortableTechniqueItem
                      key={tech.id}
                      technique={tech}
                      index={index}
                      onEdit={setEditingTechnique}
                      onRemove={handleRemoveTechnique}
                      onOpenExecution={setExecutionTechnique}
                      exerciseActive={exercise.status === 'active'}
                      exerciseId={exercise.id}
                      canReorder={canReorder}
                      refreshKey={detectionRefreshKey}
                      t={t}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )
        ) : (
          // Calendar View
          <CalendarView
            techniques={displayTechniques}
            scheduledStart={exercise.scheduled_start}
            scheduledEnd={exercise.scheduled_end}
            onScheduleTechnique={(techniqueId, startTime, endTime) => {
              console.log('[ExerciseDetailPage] onScheduleTechnique called:', {
                exerciseId: exercise.id,
                techniqueId,
                startTime,
                endTime,
              })
              scheduleTechnique.mutate({
                exerciseId: exercise.id,
                techniqueId,
                data: {
                  scheduled_start_time: startTime,
                  scheduled_end_time: endTime,
                },
              })
            }}
            onUnscheduleTechnique={(techniqueId) => {
              console.log('[ExerciseDetailPage] onUnscheduleTechnique called:', {
                exerciseId: exercise.id,
                techniqueId,
              })
              scheduleTechnique.mutate({
                exerciseId: exercise.id,
                techniqueId,
                data: {
                  scheduled_start_time: '',
                  scheduled_end_time: '',
                },
              })
            }}
            onClearAllSchedules={async () => {
              const scheduledTechs = displayTechniques.filter(t => t.scheduled_start_time)
              if (scheduledTechs.length === 0) return

              setIsClearingSchedules(true)
              try {
                // Clear all schedules by setting times to empty string
                // (backend requires "" not null to clear the value)
                await Promise.all(
                  scheduledTechs.map(tech =>
                    scheduleTechnique.mutateAsync({
                      exerciseId: exercise.id,
                      techniqueId: tech.id,
                      data: {
                        scheduled_start_time: '',
                        scheduled_end_time: '',
                      },
                    })
                  )
                )
              } finally {
                setIsClearingSchedules(false)
              }
            }}
            onTechniqueClick={setExecutionTechnique}
            canEdit={canReorder}
            isClearingSchedules={isClearingSchedules}
          />
        )}
      </div>

      {/* Modals */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('exercise.edit')}
      >
        <ExerciseForm
          exercise={exercise}
          onSuccess={() => setShowEditModal(false)}
          onCancel={() => setShowEditModal(false)}
        />
      </Modal>

      <AddMemberModal
        exerciseId={exercise.id}
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
      />

      <AddTechniqueModal
        exerciseId={exercise.id}
        isOpen={showAddTechnique}
        onClose={() => setShowAddTechnique(false)}
      />

      {/* Edit Technique Modal */}
      <Modal
        isOpen={!!editingTechnique}
        onClose={() => setEditingTechnique(null)}
        title={t('technique.edit')}
      >
        {editingTechnique && (
          <EditExerciseTechniqueForm
            exerciseId={exercise.id}
            technique={editingTechnique}
            onSuccess={() => setEditingTechnique(null)}
            onCancel={() => setEditingTechnique(null)}
            updateMutation={updateExerciseTechnique}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmStart}
        onClose={() => setConfirmStart(false)}
        onConfirm={handleStart}
        title={t('exercise.start')}
        message={t('exercise.confirm.start')}
        confirmText={t('controls.start')}
        isLoading={startExercise.isPending}
      />

      <ConfirmDialog
        isOpen={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        title={t('exercise.complete')}
        message={t('exercise.confirm.complete')}
        confirmText={t('controls.complete')}
        isLoading={completeExercise.isPending}
      />

      <ConfirmDialog
        isOpen={confirmReopen}
        onClose={() => setConfirmReopen(false)}
        onConfirm={handleReopen}
        title={t('exercise.reopen')}
        message={t('exercise.confirm.reopen')}
        confirmText={t('exercise.reopen')}
        isLoading={reopenExercise.isPending}
      />

      {/* Technique Execution Modal */}
      <TechniqueExecutionModal
        exerciseId={exercise.id}
        technique={executionTechnique}
        isOpen={!!executionTechnique}
        onClose={() => setExecutionTechnique(null)}
        onDetectionChange={() => setDetectionRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}
