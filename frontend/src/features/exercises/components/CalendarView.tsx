import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Pause,
  CheckCircle,
  GripVertical,
  Calendar as CalendarIcon,
  ChevronDown,
  Trash2,
  X,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTimezone } from '@/contexts/TimezoneContext'
import {
  getHourInTimezone,
  getDateKeyInTimezone,
  formatTimeInTimezone,
  localToUTC,
  getCurrentTimeInTimezone,
  ALL_TIMEZONES,
} from '@/lib/timezone'
import type { ExerciseTechnique, TechniqueStatus } from '../api/exercisesApi'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7:00 to 19:00

const techniqueStatusConfig: Record<TechniqueStatus, { color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { color: 'border-l-gray-400', bgColor: 'bg-gray-50 hover:bg-gray-100', icon: Clock },
  in_progress: { color: 'border-l-blue-500', bgColor: 'bg-blue-50 hover:bg-blue-100', icon: Play },
  paused: { color: 'border-l-yellow-500', bgColor: 'bg-yellow-50 hover:bg-yellow-100', icon: Pause },
  completed: { color: 'border-l-green-500', bgColor: 'bg-green-50 hover:bg-green-100', icon: CheckCircle },
}

// Tactic colors for visual identification
const tacticColors: Record<string, string> = {
  'Reconnaissance': 'border-l-purple-500',
  'Resource Development': 'border-l-indigo-500',
  'Initial Access': 'border-l-red-500',
  'Execution': 'border-l-orange-500',
  'Persistence': 'border-l-amber-500',
  'Privilege Escalation': 'border-l-yellow-500',
  'Defense Evasion': 'border-l-lime-500',
  'Credential Access': 'border-l-green-500',
  'Discovery': 'border-l-emerald-500',
  'Lateral Movement': 'border-l-teal-500',
  'Collection': 'border-l-cyan-500',
  'Command and Control': 'border-l-sky-500',
  'Exfiltration': 'border-l-blue-500',
  'Impact': 'border-l-violet-500',
}

interface CalendarViewProps {
  techniques: ExerciseTechnique[]
  scheduledStart?: string | null
  scheduledEnd?: string | null
  onScheduleTechnique: (techniqueId: string, startTime: string, endTime: string) => void
  onUnscheduleTechnique: (techniqueId: string) => void
  onClearAllSchedules?: () => void
  onTechniqueClick: (technique: ExerciseTechnique) => void
  canEdit: boolean
  isClearingSchedules?: boolean
}

// Droppable area for unscheduled techniques (to allow drag back to unschedule)
const UNSCHEDULED_DROP_ID = 'unscheduled-area'

function DroppableUnscheduledArea({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: UNSCHEDULED_DROP_ID,
    data: { isUnscheduledArea: true },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'p-3 space-y-2 overflow-y-auto flex-1 transition-colors',
        isOver && 'bg-red-50 ring-2 ring-inset ring-red-300'
      )}
    >
      {children}
    </div>
  )
}

// Helper to get date key in YYYY-MM-DD format for local calendar dates
function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface DraggableScenarioCardProps {
  technique: ExerciseTechnique
  onClick: () => void
  compact?: boolean
  timezone?: string
  isScheduled?: boolean
  onUnschedule?: () => void
}

function DraggableScenarioCard({ technique, onClick, compact = false, timezone = 'UTC', isScheduled = false, onUnschedule }: DraggableScenarioCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: technique.id,
    data: { technique },
  })
  const wasDraggingRef = useRef(false)

  // Track when dragging starts to prevent click after drag
  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true
    }
  }, [isDragging])

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const statusConfig = techniqueStatusConfig[technique.status]
  const StatusIcon = statusConfig.icon
  const tacticColor = technique.technique?.tactic
    ? tacticColors[technique.technique.tactic] || 'border-l-gray-400'
    : 'border-l-gray-400'

  const handleClick = (e: React.MouseEvent) => {
    // If we were just dragging, don't trigger click
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick()
  }

  const handleUnschedule = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onUnschedule?.()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative group rounded-lg border-l-4 shadow-sm cursor-grab active:cursor-grabbing transition-all touch-none',
        tacticColor,
        statusConfig.bgColor,
        isDragging && 'shadow-lg ring-2 ring-primary-500',
        compact ? 'p-2' : 'p-3'
      )}
      onClick={handleClick}
    >
      {/* Unschedule button - only show for scheduled items */}
      {isScheduled && onUnschedule && (
        <button
          onClick={handleUnschedule}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Remover do calendário"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="flex items-start gap-2">
        <div className="p-0.5 -ml-1 text-gray-400">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {technique.technique?.mitre_id && (
              <span className="text-xs font-mono text-primary-600 flex-shrink-0">
                {technique.technique.mitre_id}
              </span>
            )}
            <StatusIcon className="w-3 h-3 flex-shrink-0 text-gray-500" />
          </div>
          <p className={cn(
            'font-medium text-gray-900 truncate',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {technique.technique?.name || 'Unknown'}
          </p>
          {!compact && technique.technique?.tactic && (
            <p className="text-xs text-gray-500 truncate">{technique.technique.tactic}</p>
          )}
          {technique.scheduled_start_time && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {formatTimeInTimezone(technique.scheduled_start_time, timezone)}
                {technique.scheduled_end_time && (
                  <> - {formatTimeInTimezone(technique.scheduled_end_time, timezone)}</>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DroppableTimeSlotProps {
  id: string
  dateKey: string // YYYY-MM-DD format for serialization safety
  hour: number
  children?: React.ReactNode
}

function DroppableTimeSlot({ id, dateKey, hour, children }: DroppableTimeSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { dateKey, hour },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[60px] border-b border-r border-gray-100 p-1 transition-colors',
        isOver && 'bg-primary-50 ring-2 ring-inset ring-primary-300'
      )}
    >
      {children}
    </div>
  )
}

// Mini Calendar Component for navigation
interface MiniCalendarProps {
  currentDate: Date
  onSelectDate: (date: Date) => void
  daysWithScenarios: Set<string>
  onClose: () => void
}

function MiniCalendar({ currentDate, onSelectDate, daysWithScenarios, onClose }: MiniCalendarProps) {
  const { t } = useTranslation()
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth())
  const [viewYear, setViewYear] = useState(currentDate.getFullYear())

  const monthNames = useMemo(() => [
    t('calendar.months.january'),
    t('calendar.months.february'),
    t('calendar.months.march'),
    t('calendar.months.april'),
    t('calendar.months.may'),
    t('calendar.months.june'),
    t('calendar.months.july'),
    t('calendar.months.august'),
    t('calendar.months.september'),
    t('calendar.months.october'),
    t('calendar.months.november'),
    t('calendar.months.december'),
  ], [t])

  const weekdayNames = useMemo(() => {
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return keys.map(key => t(`calendar.weekdaysShort.${key}`))
  }, [t])

  // Get days in the current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    const startPadding = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: (Date | null)[] = []

    // Padding for days before the 1st
    for (let i = 0; i < startPadding; i++) {
      const prevMonthDay = new Date(viewYear, viewMonth, -startPadding + i + 1)
      days.push(prevMonthDay)
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(viewYear, viewMonth, i))
    }

    // Padding for days after the last day (complete 6 rows)
    const endPadding = 42 - days.length
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(viewYear, viewMonth + 1, i))
    }

    return days
  }, [viewMonth, viewYear])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(prev => prev - 1)
    } else {
      setViewMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(prev => prev + 1)
    } else {
      setViewMonth(prev => prev + 1)
    }
  }

  const handleSelectDay = (date: Date) => {
    onSelectDate(date)
    onClose()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewMonth
  }

  const hasScenarios = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`
    return daysWithScenarios.has(dateKey)
  }

  return (
    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-80">
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{monthNames[viewMonth]}</span>
          <span className="font-semibold text-gray-900">{viewYear}</span>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayNames.map((name, idx) => (
          <div key={idx} className="text-center text-xs font-medium text-gray-500 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={idx} />

          const dayHasScenarios = hasScenarios(date)
          const isTodayDate = isToday(date)
          const isInCurrentMonth = isCurrentMonth(date)

          return (
            <button
              key={idx}
              onClick={() => handleSelectDay(date)}
              className={cn(
                'relative w-9 h-9 flex items-center justify-center text-sm rounded-lg transition-colors',
                isInCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                isTodayDate && 'bg-primary-100 text-primary-700 font-semibold',
                !isTodayDate && isInCurrentMonth && 'hover:bg-gray-100',
                !isTodayDate && !isInCurrentMonth && 'hover:bg-gray-50'
              )}
            >
              {date.getDate()}
              {dayHasScenarios && (
                <span className={cn(
                  'absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                  isTodayDate ? 'bg-primary-600' : 'bg-primary-500'
                )} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary-500" />
          <span>{t('calendar.hasScenarios') || 'Has scenarios'}</span>
        </div>
      </div>
    </div>
  )
}

// Type for optimistic pending schedule
interface PendingSchedule {
  dateKey: string
  hour: number
}

export function CalendarView({
  techniques,
  scheduledStart: _scheduledStart,
  scheduledEnd: _scheduledEnd,
  onScheduleTechnique,
  onUnscheduleTechnique,
  onClearAllSchedules,
  onTechniqueClick,
  canEdit,
  isClearingSchedules = false,
}: CalendarViewProps) {
  // Note: _scheduledStart and _scheduledEnd are available for future use (e.g., highlighting exercise period)
  const { t } = useTranslation()
  const { timezone } = useTimezone()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const prevClearingRef = useRef(false)

  // State for single technique unschedule confirmation
  const [techniqueToUnschedule, setTechniqueToUnschedule] = useState<ExerciseTechnique | null>(null)

  // Optimistic UI state: track pending drops before API confirms
  const [pendingSchedules, setPendingSchedules] = useState<Map<string, PendingSchedule>>(new Map())
  // Optimistic UI state: track pending unschedules (techniques being removed from calendar)
  const [pendingUnschedules, setPendingUnschedules] = useState<Set<string>>(new Set())

  // Close the dialog when clearing operation completes and clear pending schedules
  useEffect(() => {
    if (prevClearingRef.current && !isClearingSchedules) {
      // Was clearing, now finished - close the dialog and clear all pending schedules
      setShowClearConfirm(false)
      setPendingSchedules(new Map())
      setPendingUnschedules(new Set())
    }
    prevClearingRef.current = isClearingSchedules
  }, [isClearingSchedules])

  // Clear pending schedules when techniques prop updates (API confirmed the change)
  useEffect(() => {
    if (pendingSchedules.size > 0) {
      // Check if any pending schedules can be cleared because the technique now has the scheduled time
      // that matches the pending position
      setPendingSchedules(prev => {
        const newPending = new Map(prev)
        let hasChanges = false

        prev.forEach((pendingSchedule, techId) => {
          const technique = techniques.find(t => t.id === techId)
          if (technique?.scheduled_start_time) {
            // Check if the API-confirmed time matches the pending schedule position
            const confirmedDateKey = getDateKeyInTimezone(technique.scheduled_start_time, timezone)
            const confirmedHour = getHourInTimezone(technique.scheduled_start_time, timezone)

            if (confirmedDateKey === pendingSchedule.dateKey && confirmedHour === pendingSchedule.hour) {
              // The API has confirmed this schedule at the expected position, remove from pending
              newPending.delete(techId)
              hasChanges = true
            }
          }
        })

        return hasChanges ? newPending : prev
      })
    }
  }, [techniques, pendingSchedules.size, timezone])

  // Clear pending unschedules when techniques prop updates (API confirmed the unschedule)
  useEffect(() => {
    if (pendingUnschedules.size > 0) {
      setPendingUnschedules(prev => {
        const newPending = new Set(prev)
        let hasChanges = false

        prev.forEach(techId => {
          const technique = techniques.find(t => t.id === techId)
          // If the technique no longer has scheduled_start_time, API confirmed the unschedule
          if (technique && !technique.scheduled_start_time) {
            newPending.delete(techId)
            hasChanges = true
          }
        })

        return hasChanges ? newPending : prev
      })
    }
  }, [techniques, pendingUnschedules.size])

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)
    return startOfWeek
  })
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [showMiniCalendar, setShowMiniCalendar] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Get the days of the current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      return date
    })
  }, [currentWeekStart])

  // Get week day names
  const weekdayNames = useMemo(() => {
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return keys.map(key => t(`calendar.weekdaysShort.${key}`))
  }, [t])

  // Separate scheduled and unscheduled techniques (with optimistic updates)
  const { scheduledTechniques, unscheduledTechniques } = useMemo(() => {
    const scheduled: ExerciseTechnique[] = []
    const unscheduled: ExerciseTechnique[] = []

    techniques.forEach(tech => {
      // A technique is unscheduled if it's pending unschedule (optimistic)
      const isPendingUnschedule = pendingUnschedules.has(tech.id)
      if (isPendingUnschedule) {
        unscheduled.push(tech)
        return
      }

      // A technique is scheduled if it has scheduled_start_time OR is in pendingSchedules
      const isPendingSchedule = pendingSchedules.has(tech.id)
      if (tech.scheduled_start_time || isPendingSchedule) {
        scheduled.push(tech)
      } else {
        unscheduled.push(tech)
      }
    })

    return { scheduledTechniques: scheduled, unscheduledTechniques: unscheduled }
  }, [techniques, pendingSchedules, pendingUnschedules])

  // Group scheduled techniques by day and hour (converted to user's timezone)
  // Includes optimistic placements from pendingSchedules
  const techniquesBySlot = useMemo(() => {
    const map = new Map<string, ExerciseTechnique[]>()

    scheduledTechniques.forEach(tech => {
      // Check if this technique has a pending (optimistic) schedule
      const pendingSchedule = pendingSchedules.get(tech.id)

      if (pendingSchedule) {
        // Use the pending schedule position (optimistic update)
        const key = `${pendingSchedule.dateKey}-${pendingSchedule.hour}`

        console.log('[CalendarView] Mapping technique to slot (PENDING):', {
          techId: tech.id,
          techName: tech.technique?.name,
          pendingDateKey: pendingSchedule.dateKey,
          pendingHour: pendingSchedule.hour,
          slotKey: key,
        })

        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key)!.push(tech)
      } else if (tech.scheduled_start_time) {
        // Use the confirmed schedule from the backend
        // Convert UTC time from backend to user's timezone
        const dateKey = getDateKeyInTimezone(tech.scheduled_start_time, timezone)
        const hour = getHourInTimezone(tech.scheduled_start_time, timezone)
        const key = `${dateKey}-${hour}`

        console.log('[CalendarView] Mapping technique to slot:', {
          techId: tech.id,
          techName: tech.technique?.name,
          utcTime: tech.scheduled_start_time,
          timezone,
          convertedDateKey: dateKey,
          convertedHour: hour,
          slotKey: key,
        })

        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key)!.push(tech)
      }
    })

    return map
  }, [scheduledTechniques, pendingSchedules, timezone])

  // Get all days that have scheduled scenarios (for mini-calendar)
  // Includes optimistic placements from pendingSchedules
  const daysWithScenarios = useMemo(() => {
    const days = new Set<string>()
    scheduledTechniques.forEach(tech => {
      // Check for pending schedule first
      const pendingSchedule = pendingSchedules.get(tech.id)
      if (pendingSchedule) {
        days.add(pendingSchedule.dateKey)
      } else if (tech.scheduled_start_time) {
        const dateKey = getDateKeyInTimezone(tech.scheduled_start_time, timezone)
        days.add(dateKey)
      }
    })
    return days
  }, [scheduledTechniques, pendingSchedules, timezone])

  const handlePreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() - 7)
      return newDate
    })
  }

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + 7)
      return newDate
    })
  }

  const handleToday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)
    setCurrentWeekStart(startOfWeek)
  }

  const handleGoToDate = (date: Date) => {
    const dayOfWeek = date.getDay()
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)
    setCurrentWeekStart(startOfWeek)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)

    const { active, over } = event
    console.log('[CalendarView] handleDragEnd called', { active: active?.id, over: over?.id, canEdit })

    if (!over || !canEdit) {
      console.log('[CalendarView] Early return - no over or canEdit is false')
      return
    }

    const techniqueId = active.id as string
    const dropData = over.data.current as { dateKey?: string; hour?: number; isUnscheduledArea?: boolean } | undefined
    console.log('[CalendarView] dropData:', dropData)

    // Check if dropped on the unscheduled area (to unschedule)
    if (dropData?.isUnscheduledArea) {
      console.log('[CalendarView] Dropping to unscheduled area - unscheduling technique')
      // Optimistic update: immediately remove from pending schedules and mark as pending unschedule
      setPendingSchedules(prev => {
        const newPending = new Map(prev)
        newPending.delete(techniqueId)
        return newPending
      })
      // Add to pending unschedules for optimistic UI
      setPendingUnschedules(prev => new Set(prev).add(techniqueId))
      onUnscheduleTechnique(techniqueId)
      return
    }

    if (dropData && dropData.dateKey && dropData.hour !== undefined) {
      // Optimistic update: immediately show the technique in the target slot
      setPendingSchedules(prev => {
        const newPending = new Map(prev)
        newPending.set(techniqueId, {
          dateKey: dropData.dateKey!,
          hour: dropData.hour!,
        })
        return newPending
      })

      // Convert from user's local timezone to UTC for backend
      const startTimeStr = localToUTC(dropData.dateKey, dropData.hour, timezone)
      const endTimeStr = localToUTC(dropData.dateKey, dropData.hour + 1, timezone)

      console.log('[CalendarView] Timezone conversion:', {
        timezone,
        dropDateKey: dropData.dateKey,
        dropHour: dropData.hour,
        convertedStartUTC: startTimeStr,
        convertedEndUTC: endTimeStr,
      })

      onScheduleTechnique(techniqueId, startTimeStr, endTimeStr)
    }
  }

  const activeTechnique = activeDragId
    ? techniques.find(t => t.id === activeDragId)
    : null

  // Handler for confirmed unschedule (after user confirms in dialog)
  const handleConfirmedUnschedule = () => {
    if (!techniqueToUnschedule) return

    const techId = techniqueToUnschedule.id
    // Optimistic update: immediately mark as pending unschedule
    setPendingUnschedules(prev => new Set(prev).add(techId))
    onUnscheduleTechnique(techId)
    setTechniqueToUnschedule(null)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const formatWeekRange = () => {
    const start = weekDays[0]
    const end = weekDays[6]
    const startMonth = start.toLocaleDateString(undefined, { month: 'short' })
    const endMonth = end.toLocaleDateString(undefined, { month: 'short' })
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    if (startYear !== endYear) {
      return `${start.getDate()} ${startMonth} ${startYear} - ${end.getDate()} ${endMonth} ${endYear}`
    }
    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth} ${startYear}`
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${startYear}`
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header with navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                title={t('calendar.previousWeek')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextWeek}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                title={t('calendar.nextWeek')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                {t('calendar.today')}
              </button>
              {canEdit && onClearAllSchedules && scheduledTechniques.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                  title={t('calendar.clearAll') || 'Clear all schedules'}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('calendar.clearAll') || 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Week range with mini-calendar dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMiniCalendar(!showMiniCalendar)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {formatWeekRange()}
                </h3>
                <ChevronDown className={cn(
                  'w-5 h-5 text-gray-500 transition-transform',
                  showMiniCalendar && 'rotate-180'
                )} />
              </button>

              {showMiniCalendar && (
                <>
                  {/* Backdrop to close on click outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMiniCalendar(false)}
                  />
                  <MiniCalendar
                    currentDate={currentWeekStart}
                    onSelectDate={handleGoToDate}
                    daysWithScenarios={daysWithScenarios}
                    onClose={() => setShowMiniCalendar(false)}
                  />
                </>
              )}
            </div>

            {/* Timezone indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{getCurrentTimeInTimezone(timezone)}</span>
              <span className="text-xs text-gray-500">
                ({ALL_TIMEZONES.find(tz => tz.value === timezone)?.label || timezone})
              </span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[800px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
                {weekDays.map((date, index) => (
                  <div
                    key={index}
                    className={cn(
                      'px-2 py-3 text-center border-l border-gray-100',
                      isToday(date) && 'bg-primary-50'
                    )}
                  >
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      {weekdayNames[index]}
                    </p>
                    <p className={cn(
                      'text-lg font-semibold',
                      isToday(date)
                        ? 'text-primary-600 bg-primary-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                        : 'text-gray-900'
                    )}>
                      {date.getDate()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time slots */}
              {HOURS.map(hour => (
                <div key={hour} className="grid grid-cols-8">
                  {/* Time label */}
                  <div className="w-16 flex-shrink-0 pr-2 py-2 text-right">
                    <span className="text-xs text-gray-500">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Day slots */}
                  {weekDays.map((date) => {
                    const dateKey = getLocalDateKey(date)
                    const slotKey = `${dateKey}-${hour}`
                    const slotTechniques = techniquesBySlot.get(slotKey) || []

                    return (
                      <DroppableTimeSlot
                        key={slotKey}
                        id={slotKey}
                        dateKey={dateKey}
                        hour={hour}
                      >
                        <div className="space-y-1">
                          {slotTechniques.map(tech => (
                            <DraggableScenarioCard
                              key={tech.id}
                              technique={tech}
                              onClick={() => onTechniqueClick(tech)}
                              compact
                              timezone={timezone}
                              isScheduled
                              onUnschedule={canEdit ? () => setTechniqueToUnschedule(tech) : undefined}
                            />
                          ))}
                        </div>
                      </DroppableTimeSlot>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unscheduled Sidebar */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">
                {t('calendar.unscheduled')}
              </h3>
              <span className="ml-auto text-sm text-gray-500">
                ({unscheduledTechniques.length})
              </span>
            </div>
            {canEdit && unscheduledTechniques.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {t('calendar.dragToSchedule')}
              </p>
            )}
          </div>
          <DroppableUnscheduledArea>
            {unscheduledTechniques.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {t('calendar.noUnscheduled')}
              </p>
            ) : (
              unscheduledTechniques.map(tech => (
                <DraggableScenarioCard
                  key={tech.id}
                  technique={tech}
                  onClick={() => onTechniqueClick(tech)}
                  timezone={timezone}
                />
              ))
            )}
          </DroppableUnscheduledArea>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTechnique && (
          <div className="opacity-90">
            <DraggableScenarioCard
              technique={activeTechnique}
              onClick={() => {}}
              timezone={timezone}
            />
          </div>
        )}
      </DragOverlay>

      {/* Clear Calendar Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => !isClearingSchedules && setShowClearConfirm(false)}
        onConfirm={() => {
          if (onClearAllSchedules) {
            onClearAllSchedules()
          }
          // Don't close here - let the parent close it after the operation completes
        }}
        title={t('calendar.clearConfirmTitle') || 'Clear Calendar'}
        message={t('calendar.clearConfirmMessage', { count: scheduledTechniques.length }) || `This will remove all ${scheduledTechniques.length} scheduled scenarios from the calendar. They will be moved back to the unscheduled list.`}
        confirmText={t('calendar.clearConfirmButton') || 'Clear All'}
        cancelText={t('common.cancel') || 'Cancel'}
        variant="warning"
        isLoading={isClearingSchedules}
      />

      {/* Single Technique Unschedule Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!techniqueToUnschedule}
        onClose={() => setTechniqueToUnschedule(null)}
        onConfirm={handleConfirmedUnschedule}
        title={t('calendar.unscheduleConfirmTitle') || 'Remove from Calendar'}
        message={
          t('calendar.unscheduleConfirmMessage', { name: techniqueToUnschedule?.technique?.name || '' }) ||
          `Are you sure you want to remove "${techniqueToUnschedule?.technique?.name || 'this scenario'}" from the calendar? It will be moved back to the unscheduled list.`
        }
        confirmText={t('calendar.unscheduleConfirmButton') || 'Remove'}
        cancelText={t('common.cancel') || 'Cancel'}
        variant="warning"
      />
    </DndContext>
  )
}
