import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Pause,
  CheckCircle,
  Clock,
  Plus,
  Upload,
  Image as ImageIcon,
  X,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Pencil,
  Trash2,
  RotateCcw,
  Ban,
  MinusCircle,
  ShieldCheck,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { AlertDialog } from '@/components/ui/AlertDialog'
import {
  useExerciseTechnique,
  useStartTechnique,
  usePauseTechnique,
  useResumeTechnique,
  useCompleteTechnique,
  useReopenTechnique,
  useTechniqueExecutions,
  useCreateExecution,
  useUpdateExecution,
  useDeleteExecution,
  useUploadEvidence,
  useDeleteEvidence,
  useUpdateEvidenceCaption,
  useCreateDetection,
  useUpdateDetection,
  useDeleteDetection,
  useUploadDetectionEvidence,
  useDeleteDetectionEvidence,
  useUpdateDetectionEvidenceCaption,
  useVoidDetection,
  useScenarioRequirements,
  useFulfillRequirement,
} from '../hooks/useExercises'
import { exercisesApi } from '../api/exercisesApi'
import type { ExerciseTechnique, Execution, Evidence, TechniqueStatus, Detection, DetectionStatus } from '../api/exercisesApi'
import { useAuthStore } from '@/features/auth/store/authStore'

// Allowed image MIME types (matches backend OWASP validation)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

function isAllowedImageType(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type)
}

function isFileSizeValid(file: File): boolean {
  return file.size <= MAX_IMAGE_SIZE
}

interface TechniqueExecutionModalProps {
  exerciseId: string
  technique: ExerciseTechnique | null
  isOpen: boolean
  onClose: () => void
  onDetectionChange?: () => void
}

interface PendingEvidence {
  id: string
  file: File
  caption: string
  preview?: string
}

const statusConfig: Record<TechniqueStatus, { labelKey: string; color: string; icon: typeof Clock }> = {
  pending: { labelKey: 'technique.status.pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { labelKey: 'technique.status.in_progress', color: 'bg-blue-100 text-blue-700', icon: Play },
  paused: { labelKey: 'technique.status.paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  completed: { labelKey: 'technique.status.completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

const detectionStatusConfig: Record<DetectionStatus, { labelKey: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { labelKey: 'detection.status.pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  detected: { labelKey: 'detection.status.detected', color: 'bg-green-100 text-green-700', icon: Eye },
  blocked: { labelKey: 'detection.status.blocked', color: 'bg-blue-100 text-blue-700', icon: ShieldCheck },
  partial: { labelKey: 'detection.status.partial', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  not_detected: { labelKey: 'detection.status.not_detected', color: 'bg-red-100 text-red-700', icon: EyeOff },
  not_applicable: { labelKey: 'detection.status.not_applicable', color: 'bg-gray-200 text-gray-600', icon: MinusCircle },
  voided: { labelKey: 'detection.status.voided', color: 'bg-gray-100 text-gray-500', icon: AlertTriangle },
}

// Calculate detection status based on detection priority
// Priority: voided > not_applicable > blocked > detected > partial > not_detected
function calculateDetectionStatus(detection: Detection): DetectionStatus {
  if (detection.detection_status === 'voided') {
    return 'voided'
  }

  if (detection.tool_not_applicable && detection.siem_not_applicable) {
    return 'not_applicable'
  }

  if (detection.tool_blocked) {
    return 'blocked'
  }

  if (detection.siem_detected) {
    return 'detected'
  } else if (detection.tool_detected) {
    return 'partial'
  }
  return 'not_detected'
}

// Roles that can control technique status (start/pause/complete)
const STATUS_CONTROL_ROLES = ['admin', 'purple_team_lead', 'red_team_operator']

// Roles that can register detections
const DETECTION_ROLES = ['admin', 'purple_team_lead', 'blue_team_analyst']

// Helper function to format date for datetime-local input (preserving local timezone)
const formatDateTimeLocal = (date: Date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Default fields for execution form - keys map to i18n translation keys
const defaultFieldKeys = [
  { key: 'source_ip', labelKey: 'execution.fields.sourceIp', placeholderKey: 'execution.fields.sourceIpPlaceholder' },
  { key: 'hostname', labelKey: 'execution.fields.hostname', placeholderKey: 'execution.fields.hostnamePlaceholder' },
  { key: 'username', labelKey: 'execution.fields.username', placeholderKey: 'execution.fields.usernamePlaceholder' },
  { key: 'target_system', labelKey: 'execution.fields.targetSystem', placeholderKey: 'execution.fields.targetSystemPlaceholder' },
  { key: 'references', labelKey: 'execution.fields.references', placeholderKey: 'execution.fields.referencesPlaceholder' },
]

// Map of field keys to their translation keys (for parsing stored notes)
const fieldKeyToLabelKey: Record<string, string> = {
  source_ip: 'execution.fields.sourceIp',
  hostname: 'execution.fields.hostname',
  username: 'execution.fields.username',
  target_system: 'execution.fields.targetSystem',
  references: 'execution.fields.references',
  notes: 'execution.fields.notes',
}

// Parse execution notes into structured fields
// Notes are stored as: "[field_key]: value" format for known fields
// or "[Custom Label]: value" for custom fields
// Returns an object with known fields, custom fields array, and free-form notes
interface ParsedNotes {
  source_ip?: string
  hostname?: string
  username?: string
  target_system?: string
  references?: string
  customFields: { label: string; value: string }[]
  freeFormNotes: string
}

function parseExecutionNotes(notes: string): ParsedNotes {
  const result: ParsedNotes = {
    customFields: [],
    freeFormNotes: '',
  }

  if (!notes) return result

  const lines = notes.split('\n')
  const freeFormLines: string[] = []
  let inNotesSection = false

  for (const line of lines) {
    // Check if we're entering the free-form notes section
    if (line.trim() === '[notes]:') {
      inNotesSection = true
      continue
    }

    if (inNotesSection) {
      freeFormLines.push(line)
      continue
    }

    // Check if line matches the pattern "[field_key]: value"
    const keyMatch = line.match(/^\[([^\]]+)\]:\s*(.*)$/)
    if (keyMatch) {
      const [, fieldKey, value] = keyMatch
      // Check if it's a known field
      if (fieldKey in fieldKeyToLabelKey) {
        (result as unknown as Record<string, string>)[fieldKey] = value
      } else {
        // Custom field
        result.customFields.push({ label: fieldKey, value })
      }
    } else if (line.trim()) {
      // Legacy format or unstructured line - add to free-form notes
      freeFormLines.push(line)
    }
  }

  result.freeFormNotes = freeFormLines.join('\n').trim()
  return result
}

export function TechniqueExecutionModal({
  exerciseId,
  technique: initialTechnique,
  isOpen,
  onClose,
  onDetectionChange,
}: TechniqueExecutionModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Get current user from auth store
  const { user } = useAuthStore()
  const userRole = user?.role || ''
  const canControlStatus = STATUS_CONTROL_ROLES.includes(userRole)
  const canRegisterDetection = DETECTION_ROLES.includes(userRole)

  const [showAddExecution, setShowAddExecution] = useState(false)
  const [executionNotes, setExecutionNotes] = useState('')
  const [commandUsed, setCommandUsed] = useState('')
  const [executedAt, setExecutedAt] = useState('')

  // Dynamic fields state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [enabledFields, setEnabledFields] = useState<string[]>(['target_system'])
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [showFieldSelector, setShowFieldSelector] = useState(false)

  // Pending evidences for new execution (before save)
  const [pendingEvidences, setPendingEvidences] = useState<PendingEvidence[]>([])
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const newExecutionFileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Evidence upload state for existing executions
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Execution deletion confirmation state
  const [executionToDelete, setExecutionToDelete] = useState<string | null>(null)

  // Technique reopen confirmation state
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  // Execution edit state - stores the execution being edited (null = creating new)
  const [executionToEdit, setExecutionToEdit] = useState<Execution | null>(null)
  const [evidencesToDelete, setEvidencesToDelete] = useState<string[]>([])
  const [editedCaptions, setEditedCaptions] = useState<Record<string, string>>({})
  const updateExecution = useUpdateExecution()

  // Detection form state
  const [showDetectionForm, setShowDetectionForm] = useState<string | null>(null) // executionId
  const [detectionForm, setDetectionForm] = useState({
    toolDetected: false,
    toolName: '',
    toolDetectedAt: '',
    toolAlertId: '',
    toolNotes: '',
    toolNotApplicable: false,
    toolNAReason: '',
    toolBlocked: false,
    siemDetected: false,
    siemName: '',
    siemDetectedAt: '',
    siemAlertId: '',
    siemNotes: '',
    siemNotApplicable: false,
    siemNAReason: '',
    analystNotes: '',
  })
  const [detectionEvidences, setDetectionEvidences] = useState<{ type: 'tool' | 'siem'; file: File; caption: string; preview?: string }[]>([])
  const [detectionIsDragging, setDetectionIsDragging] = useState(false)
  const detectionFileInputRef = useRef<HTMLInputElement>(null)
  const [detectionEvidenceType, setDetectionEvidenceType] = useState<'tool' | 'siem'>('tool')

  // Key to force refresh of ExecutionCards after detection changes
  const [detectionRefreshKey, setDetectionRefreshKey] = useState(0)

  // Alert dialog state for styled validation messages
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'error' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'error',
  })

  // Helper function to show styled alerts
  const showAlert = useCallback((message: string, variant: 'error' | 'warning' | 'info' = 'error') => {
    setAlertDialog({
      isOpen: true,
      title: variant === 'error' ? t('common.validationError') : t('common.error'),
      message,
      variant,
    })
  }, [t])

  // Fetch fresh technique data
  const { data: fetchedTechnique } = useExerciseTechnique(
    exerciseId,
    initialTechnique?.id || ''
  )

  // Use fetched data if available, otherwise use initial data
  const technique = fetchedTechnique || initialTechnique

  const startTechnique = useStartTechnique()
  const pauseTechnique = usePauseTechnique()
  const resumeTechnique = useResumeTechnique()
  const completeTechnique = useCompleteTechnique()
  const reopenTechnique = useReopenTechnique()
  const createExecution = useCreateExecution()
  const deleteExecution = useDeleteExecution()
  const uploadEvidence = useUploadEvidence()
  const deleteEvidence = useDeleteEvidence()
  const createDetection = useCreateDetection()
  const uploadDetectionEvidence = useUploadDetectionEvidence()
  const updateEvidenceCaption = useUpdateEvidenceCaption()

  const { data: executions = [], isLoading: loadingExecutions } = useTechniqueExecutions(
    exerciseId,
    technique?.id || ''
  )

  // Fetch scenario requirements for this technique
  const { data: scenarioRequirements = [] } = useScenarioRequirements(
    exerciseId,
    technique?.id || ''
  )
  const fulfillRequirement = useFulfillRequirement()

  // Set default executed_at when opening form
  useEffect(() => {
    if (showAddExecution && !executedAt) {
      setExecutedAt(formatDateTimeLocal())
    }
  }, [showAddExecution, executedAt])

  // Handle paste from clipboard
  useEffect(() => {
    if (!showAddExecution) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            addPendingEvidence(file)
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [showAddExecution])

  // Handle paste from clipboard for detection form
  useEffect(() => {
    if (!showDetectionForm) return

    const handleDetectionPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            // Validate file type
            if (!isAllowedImageType(file)) {
              showAlert(t('execution.evidence.invalidType', { name: file.name }))
              return
            }
            // Validate file size
            if (!isFileSizeValid(file)) {
              showAlert(t('execution.evidence.tooLarge', { name: file.name }))
              return
            }
            e.preventDefault()
            addDetectionEvidence(file, detectionEvidenceType)
          }
        }
      }
    }

    document.addEventListener('paste', handleDetectionPaste)
    return () => document.removeEventListener('paste', handleDetectionPaste)
  }, [showDetectionForm, detectionEvidenceType])

  // Add a file to pending evidences
  const addPendingEvidence = useCallback((file: File) => {
    const id = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const evidence: PendingEvidence = {
      id,
      file,
      caption: '',
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPendingEvidences(prev =>
          prev.map(ev => ev.id === id ? { ...ev, preview: e.target?.result as string } : ev)
        )
      }
      reader.readAsDataURL(file)
    }

    setPendingEvidences(prev => [...prev, evidence])
    setEditingCaptionId(id) // Auto-focus caption input
  }, [])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      if (!isAllowedImageType(file)) {
        showAlert(t('execution.evidence.invalidType', { name: file.name }))
        return
      }
      if (!isFileSizeValid(file)) {
        showAlert(t('execution.evidence.tooLarge', { name: file.name }))
        return
      }
      addPendingEvidence(file)
    })
  }, [addPendingEvidence])

  const handleNewExecutionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!isAllowedImageType(file)) {
        showAlert(t('execution.evidence.invalidType', { name: file.name }))
        return
      }
      if (!isFileSizeValid(file)) {
        showAlert(t('execution.evidence.tooLarge', { name: file.name }))
        return
      }
      addPendingEvidence(file)
    })

    if (newExecutionFileInputRef.current) {
      newExecutionFileInputRef.current.value = ''
    }
  }

  const removePendingEvidence = (id: string) => {
    setPendingEvidences(prev => prev.filter(ev => ev.id !== id))
    if (editingCaptionId === id) {
      setEditingCaptionId(null)
    }
  }

  const updatePendingEvidenceCaption = (id: string, newCaption: string) => {
    setPendingEvidences(prev =>
      prev.map(ev => ev.id === id ? { ...ev, caption: newCaption } : ev)
    )
  }

  // IMPORTANT: These functions and useCallback hooks MUST be before any conditional return
  // to maintain consistent hook ordering across renders
  const addDetectionEvidence = (file: File, type: 'tool' | 'siem') => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setDetectionEvidences(prev => [...prev, {
        type,
        file,
        caption: '',
        preview: e.target?.result as string,
      }])
    }
    reader.readAsDataURL(file)
  }

  const handleDetectionDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDetectionIsDragging(true)
  }, [])

  const handleDetectionDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDetectionIsDragging(false)
  }, [])

  const handleDetectionDrop = useCallback((e: React.DragEvent, type: 'tool' | 'siem') => {
    e.preventDefault()
    e.stopPropagation()
    setDetectionIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      if (!isAllowedImageType(file)) {
        showAlert(t('execution.evidence.invalidType', { name: file.name }))
        return
      }
      if (!isFileSizeValid(file)) {
        showAlert(t('execution.evidence.tooLarge', { name: file.name }))
        return
      }
      addDetectionEvidence(file, type)
    })
  }, [])

  if (!technique) {
    return null
  }

  const status = (technique.status || 'pending') as TechniqueStatus
  const StatusIcon = statusConfig[status]?.icon || Clock

  const handleStart = () => {
    startTechnique.mutate({ exerciseId, techniqueId: technique.id })
  }

  const handlePause = () => {
    pauseTechnique.mutate({ exerciseId, techniqueId: technique.id })
  }

  const handleResume = () => {
    resumeTechnique.mutate({ exerciseId, techniqueId: technique.id })
  }

  const handleComplete = () => {
    completeTechnique.mutate({ exerciseId, techniqueId: technique.id })
  }

  const handleReopen = () => {
    setShowReopenConfirm(true)
  }

  const handleConfirmReopen = () => {
    reopenTechnique.mutate(
      { exerciseId, techniqueId: technique.id },
      {
        onSuccess: () => {
          setShowReopenConfirm(false)
        },
      }
    )
  }

  const handleAddExecution = async () => {
    // Build notes with all field values using key-based format for translation
    const allFieldValues: string[] = []

    // Add enabled default fields using [key]: value format for dynamic translation
    for (const field of defaultFieldKeys) {
      if (enabledFields.includes(field.key) && fieldValues[field.key]) {
        allFieldValues.push(`[${field.key}]: ${fieldValues[field.key]}`)
      }
    }

    // Add custom fields (these keep their label since they're user-defined)
    for (const field of customFields) {
      if (fieldValues[field.key]) {
        allFieldValues.push(`[${field.label}]: ${fieldValues[field.key]}`)
      }
    }

    // Build full notes
    const fullNotes = [
      ...allFieldValues,
      executionNotes ? `\n[notes]:\n${executionNotes}` : '',
    ].filter(Boolean).join('\n')

    const executionData = {
      executed_at: executedAt ? new Date(executedAt).toISOString() : new Date().toISOString(),
      target_system: fieldValues['target_system'] || undefined,
      command_used: commandUsed || undefined,
      notes: fullNotes || undefined,
    }

    // If editing, update the existing execution
    if (executionToEdit) {
      updateExecution.mutate(
        {
          executionId: executionToEdit.id,
          data: executionData,
        },
        {
          onSuccess: async () => {
            // Delete evidences marked for removal
            for (const evidenceId of evidencesToDelete) {
              try {
                await deleteEvidence.mutateAsync({
                  executionId: executionToEdit.id,
                  evidenceId,
                })
              } catch (error) {
                console.error('Failed to delete evidence:', error)
              }
            }

            // Update edited captions
            for (const [evidenceId, newCaption] of Object.entries(editedCaptions)) {
              const originalEvidence = executionToEdit.evidences?.find(e => e.id === evidenceId)
              // Only update if caption actually changed
              if (originalEvidence && (originalEvidence.caption || '') !== newCaption) {
                try {
                  await updateEvidenceCaption.mutateAsync({
                    executionId: executionToEdit.id,
                    evidenceId,
                    caption: newCaption,
                  })
                } catch (error) {
                  console.error('Failed to update evidence caption:', error)
                }
              }
            }

            // Upload any new pending evidences
            for (const evidence of pendingEvidences) {
              await uploadEvidence.mutateAsync({
                executionId: executionToEdit.id,
                file: evidence.file,
                caption: evidence.caption || undefined,
              })
            }

            // Reset form and close
            setShowAddExecution(false)
            setExecutionToEdit(null)
            setEvidencesToDelete([])
            setEditedCaptions({})
            setExecutionNotes('')
            setCommandUsed('')
            setExecutedAt('')
            setFieldValues({})
            setCustomFields([])
            setEnabledFields(['target_system'])
            setPendingEvidences([])
            setEditingCaptionId(null)

            // Notify parent to refresh detection status
            onDetectionChange?.()
          },
        }
      )
      return
    }

    // Creating new execution
    createExecution.mutate(
      {
        exerciseId,
        data: {
          exercise_technique_id: technique.id,
          ...executionData,
        },
      },
      {
        onSuccess: async (newExecution) => {
          // Upload pending evidences
          for (const evidence of pendingEvidences) {
            await uploadEvidence.mutateAsync({
              executionId: newExecution.id,
              file: evidence.file,
              caption: evidence.caption || undefined,
            })
          }

          // Reset form
          setShowAddExecution(false)
          setExecutionNotes('')
          setCommandUsed('')
          setExecutedAt('')
          setFieldValues({})
          setCustomFields([])
          setEnabledFields(['target_system'])
          setPendingEvidences([])
          setEditingCaptionId(null)

          // Notify parent to refresh detection status (new execution created)
          onDetectionChange?.()
        },
      }
    )
  }

  const handleToggleField = (fieldKey: string) => {
    setEnabledFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    )
  }

  const handleAddCustomField = () => {
    if (newFieldLabel.trim()) {
      const key = `custom_${Date.now()}`
      setCustomFields(prev => [...prev, { key, label: newFieldLabel.trim() }])
      setEnabledFields(prev => [...prev, key])
      setNewFieldLabel('')
    }
  }

  const handleRemoveCustomField = (key: string) => {
    setCustomFields(prev => prev.filter(f => f.key !== key))
    setEnabledFields(prev => prev.filter(k => k !== key))
    setFieldValues(prev => {
      const newValues = { ...prev }
      delete newValues[key]
      return newValues
    })
  }

  const handleFileSelect = (executionId: string) => {
    setUploadingFor(executionId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingFor) return

    uploadEvidence.mutate(
      {
        executionId: uploadingFor,
        file,
        caption: caption || undefined,
      },
      {
        onSuccess: () => {
          setUploadingFor(null)
          setCaption('')
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        },
      }
    )
  }

  const handleDeleteEvidence = (executionId: string, evidenceId: string) => {
    if (confirm(t('execution.evidence.confirmDelete'))) {
      deleteEvidence.mutate({ executionId, evidenceId })
    }
  }

  const handleConfirmDeleteExecution = () => {
    if (executionToDelete) {
      deleteExecution.mutate(
        { executionId: executionToDelete },
        {
          onSuccess: () => {
            setExecutionToDelete(null)
            // Notify parent to refresh detection status (execution was deleted)
            onDetectionChange?.()
          },
        }
      )
    }
  }

  // Parse notes to extract field values for editing
  const parseNotesForEdit = (notes: string): { fieldValues: Record<string, string>; enabledFields: string[]; customFields: { key: string; label: string }[]; freeFormNotes: string } => {
    const result = {
      fieldValues: {} as Record<string, string>,
      enabledFields: [] as string[],
      customFields: [] as { key: string; label: string }[],
      freeFormNotes: '',
    }

    if (!notes) return result

    const parsedNotes = parseExecutionNotes(notes)

    // Extract known fields
    const knownFieldKeys = ['source_ip', 'hostname', 'username', 'target_system', 'references']
    for (const key of knownFieldKeys) {
      const value = (parsedNotes as unknown as Record<string, string | undefined>)[key]
      if (value) {
        result.fieldValues[key] = value
        result.enabledFields.push(key)
      }
    }

    // Extract custom fields
    for (const customField of parsedNotes.customFields) {
      const key = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      result.customFields.push({ key, label: customField.label })
      result.fieldValues[key] = customField.value
    }

    result.freeFormNotes = parsedNotes.freeFormNotes
    return result
  }

  const handleOpenEditExecution = (execution: Execution) => {
    // Parse existing notes to extract field values
    const parsed = parseNotesForEdit(execution.notes || '')

    // Set the execution being edited
    setExecutionToEdit(execution)

    // Fill the creation form with existing data
    setExecutedAt(execution.executed_at ? formatDateTimeLocal(new Date(execution.executed_at)) : '')
    setCommandUsed(execution.command_used || '')
    setExecutionNotes(parsed.freeFormNotes)

    // Set field values - include target_system from the dedicated field if not in notes
    const fieldVals = { ...parsed.fieldValues }
    if (execution.target_system && !fieldVals.target_system) {
      fieldVals.target_system = execution.target_system
    }
    setFieldValues(fieldVals)

    // Set enabled fields - ensure target_system is enabled if it has a value
    const enabledFieldsList = [...parsed.enabledFields]
    if ((execution.target_system || fieldVals.target_system) && !enabledFieldsList.includes('target_system')) {
      enabledFieldsList.push('target_system')
    }
    // If no fields are enabled, default to target_system
    if (enabledFieldsList.length === 0) {
      enabledFieldsList.push('target_system')
    }
    setEnabledFields(enabledFieldsList)

    // Set custom fields
    setCustomFields(parsed.customFields)

    // Clear pending evidences and evidence deletion tracking
    setPendingEvidences([])
    setEvidencesToDelete([])
    setEditedCaptions({})

    // Open the form
    setShowAddExecution(true)
  }

  const handleCancelEditExecution = () => {
    setExecutionToEdit(null)
    // Reset form to defaults
    setExecutionNotes('')
    setCommandUsed('')
    setExecutedAt('')
    setFieldValues({})
    setCustomFields([])
    setEnabledFields(['target_system'])
    setPendingEvidences([])
    setEvidencesToDelete([])
    setEditedCaptions({})
    setEditingCaptionId(null)
    setShowAddExecution(false)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const resetForm = () => {
    setShowAddExecution(false)
    setExecutionToEdit(null)
    setEvidencesToDelete([])
    setEditedCaptions({})
    setExecutionNotes('')
    setCommandUsed('')
    setExecutedAt('')
    setFieldValues({})
    setCustomFields([])
    setEnabledFields(['target_system'])
    setPendingEvidences([])
    setEditingCaptionId(null)
    setShowFieldSelector(false)
  }

  // Detection handlers
  const resetDetectionForm = () => {
    setShowDetectionForm(null)
    setDetectionForm({
      toolDetected: false,
      toolName: '',
      toolDetectedAt: '',
      toolAlertId: '',
      toolNotes: '',
      toolNotApplicable: false,
      toolNAReason: '',
      siemDetected: false,
      siemName: '',
      siemDetectedAt: '',
      siemAlertId: '',
      siemNotes: '',
      siemNotApplicable: false,
      siemNAReason: '',
      analystNotes: '',
    })
    setDetectionEvidences([])
    setDetectionIsDragging(false)
  }

  const removeDetectionEvidence = (index: number) => {
    setDetectionEvidences(prev => prev.filter((_, i) => i !== index))
  }

  const updateDetectionEvidenceCaption = (index: number, caption: string) => {
    setDetectionEvidences(prev => prev.map((ev, i) => i === index ? { ...ev, caption } : ev))
  }

  const handleDetectionFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'tool' | 'siem') => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!isAllowedImageType(file)) {
        showAlert(t('execution.evidence.invalidType', { name: file.name }))
        return
      }
      if (!isFileSizeValid(file)) {
        showAlert(t('execution.evidence.tooLarge', { name: file.name }))
        return
      }
      addDetectionEvidence(file, type)
    })

    if (detectionFileInputRef.current) {
      detectionFileInputRef.current.value = ''
    }
  }

  const handleSaveDetection = async () => {
    if (!showDetectionForm) return

    // Validate: must have at least one option selected (detected, N/A, or not detected)
    const hasToolEvidence = detectionEvidences.some(e => e.type === 'tool')
    const hasSiemEvidence = detectionEvidences.some(e => e.type === 'siem')

    // Tool validation: if detected, need evidence
    if (detectionForm.toolDetected && !detectionForm.toolNotApplicable && !hasToolEvidence) {
      showAlert(t('detection.toolEvidenceRequired'))
      return
    }

    // SIEM validation: if detected, need evidence
    if (detectionForm.siemDetected && !detectionForm.siemNotApplicable && !hasSiemEvidence) {
      showAlert(t('detection.siemEvidenceRequired'))
      return
    }

    // N/A validation: if N/A, need a reason
    if (detectionForm.toolNotApplicable && !detectionForm.toolNAReason.trim()) {
      showAlert(t('detection.naReasonRequired'))
      return
    }
    if (detectionForm.siemNotApplicable && !detectionForm.siemNAReason.trim()) {
      showAlert(t('detection.naReasonRequired'))
      return
    }

    // Must have at least one selection per type (detected, N/A, or implicitly not detected)
    // This is now more flexible - we don't require both to be answered

    // Determine detection status
    // Priority: not_applicable > blocked > detected > partial > not_detected
    let detectionStatus: DetectionStatus = 'not_detected'
    if (detectionForm.toolNotApplicable && detectionForm.siemNotApplicable) {
      detectionStatus = 'not_applicable'
    } else if (detectionForm.toolBlocked) {
      detectionStatus = 'blocked'
    } else if (detectionForm.siemDetected) {
      detectionStatus = 'detected'
    } else if (detectionForm.toolDetected) {
      detectionStatus = 'partial'
    }

    try {
      const detection = await createDetection.mutateAsync({
        exerciseId,
        data: {
          execution_id: showDetectionForm,
          tool_detected: detectionForm.toolDetected,
          tool_name: detectionForm.toolName || undefined,
          tool_detected_at: detectionForm.toolDetectedAt ? new Date(detectionForm.toolDetectedAt).toISOString() : undefined,
          tool_alert_id: detectionForm.toolAlertId || undefined,
          tool_notes: detectionForm.toolNotes || undefined,
          tool_not_applicable: detectionForm.toolNotApplicable,
          tool_na_reason: detectionForm.toolNAReason || undefined,
          tool_blocked: detectionForm.toolBlocked,
          siem_detected: detectionForm.siemDetected,
          siem_name: detectionForm.siemName || undefined,
          siem_detected_at: detectionForm.siemDetectedAt ? new Date(detectionForm.siemDetectedAt).toISOString() : undefined,
          siem_alert_id: detectionForm.siemAlertId || undefined,
          siem_notes: detectionForm.siemNotes || undefined,
          siem_not_applicable: detectionForm.siemNotApplicable,
          siem_na_reason: detectionForm.siemNAReason || undefined,
          detection_status: detectionStatus,
          analyst_notes: detectionForm.analystNotes || undefined,
        },
      })

      // Upload evidences in parallel and wait for all to complete
      if (detectionEvidences.length > 0) {
        await Promise.all(
          detectionEvidences.map(evidence =>
            uploadDetectionEvidence.mutateAsync({
              detectionId: detection.id,
              file: evidence.file,
              evidenceType: evidence.type,
              caption: evidence.caption || undefined,
            })
          )
        )
      }

      // Invalidate queries to force refetch with updated data
      await queryClient.invalidateQueries({ queryKey: ['exercises'] })

      // Small delay to ensure data is fully propagated in database
      await new Promise(resolve => setTimeout(resolve, 200))

      // Force refresh detection data in ExecutionCards by incrementing key twice
      // (this ensures React detects the state change and triggers re-render)
      setDetectionRefreshKey(prev => prev + 1)

      // Notify parent about detection change
      onDetectionChange?.()
      resetDetectionForm()
    } catch (error) {
      console.error('Error creating detection:', error)
      showAlert(t('detection.error.save'))
    }
  }

  const openDetectionForm = (executionId: string) => {
    const now = formatDateTimeLocal()
    setShowDetectionForm(executionId)
    setDetectionForm(prev => ({
      ...prev,
      toolDetectedAt: now,
      siemDetectedAt: now,
    }))
  }

  const handleClose = () => {
    // Reset form state when closing modal
    resetForm()
    onClose()
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title={t('modal.techniqueExecution')} size="full">
      <div className="space-y-6">
        {/* Technique Header */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                {technique.technique?.mitre_id && (
                  <span className="text-lg font-mono text-primary-600 font-semibold">
                    {technique.technique.mitre_id}
                  </span>
                )}
                <h3 className="text-xl font-semibold text-gray-900">
                  {technique.technique?.name}
                </h3>
              </div>
              {technique.technique?.tactic && (
                <Badge variant="default" className="mt-2">
                  {technique.technique.tactic}
                </Badge>
              )}
              {technique.technique?.description && (
                <p className="text-gray-600 mt-3 text-sm max-w-3xl">
                  {technique.technique.description}
                </p>
              )}
              {technique.notes && (
                <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                  <p className="text-sm text-gray-500 font-medium mb-1">{t('technique.fields.notes')}:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{technique.notes}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig[status]?.color}`}
              >
                <StatusIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{t(statusConfig[status]?.labelKey)}</span>
              </div>
              {technique.started_at && (
                <p className="text-xs text-gray-500">
                  {t('exercise.fields.startedAt')}: {formatDateShort(technique.started_at)}
                </p>
              )}
              {technique.completed_at && (
                <p className="text-xs text-gray-500">
                  {t('exercise.fields.completedAt')}: {formatDateShort(technique.completed_at)}
                </p>
              )}
            </div>
          </div>

          {/* Status Control Buttons - Only for Red Team, Lead, Admin */}
          {canControlStatus && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              {status === 'pending' && (
                <Button
                  onClick={handleStart}
                  disabled={startTechnique.isPending}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {startTechnique.isPending ? `${t('controls.start')}...` : t('controls.start')}
                </Button>
              )}
              {status === 'in_progress' && (
                <>
                  <Button
                    onClick={handlePause}
                    variant="secondary"
                    disabled={pauseTechnique.isPending}
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    {pauseTechnique.isPending ? `${t('controls.pause')}...` : t('controls.pause')}
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={completeTechnique.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {completeTechnique.isPending ? `${t('controls.complete')}...` : t('controls.complete')}
                  </Button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <Button
                    onClick={handleResume}
                    disabled={resumeTechnique.isPending}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {resumeTechnique.isPending ? `${t('controls.resume')}...` : t('controls.resume')}
                  </Button>
                  <Button
                    onClick={handleComplete}
                    variant="secondary"
                    disabled={completeTechnique.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {completeTechnique.isPending ? `${t('controls.complete')}...` : t('controls.complete')}
                  </Button>
                </>
              )}
              {status === 'completed' && (
                <>
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {t('technique.status.completed')}
                  </p>
                  <Button
                    onClick={handleReopen}
                    variant="secondary"
                    disabled={reopenTechnique.isPending}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {reopenTechnique.isPending ? `${t('technique.reopen')}...` : t('technique.reopen')}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Blue Team Info - When user cannot control status */}
          {!canControlStatus && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t('roles.blue_team_analyst')} - {t('detection.registerDetection')}
              </p>
            </div>
          )}
        </div>

        {/* Scenario Requirements */}
        {scenarioRequirements.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('requirement.scenarioRequirements')}</h4>
            <div className="flex flex-wrap gap-2">
              {scenarioRequirements.map((req) => (
                <div
                  key={req.id}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
                    req.fulfilled
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}
                >
                  {req.fulfilled ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  <span>{req.title}</span>
                  {!req.fulfilled && canRegisterDetection && (
                    <button
                      onClick={() => fulfillRequirement.mutate({ exerciseId, requirementId: req.id, fulfilled: true })}
                      className="ml-1 text-green-600 hover:text-green-800 font-medium"
                      title={t('requirement.actions.fulfill')}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Executions Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">{t('execution.title')}</h4>
            {canControlStatus && (status === 'in_progress' || status === 'paused') && !showAddExecution && (
              <Button
                onClick={() => setShowAddExecution(true)}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('execution.add')}
              </Button>
            )}
          </div>

          {/* Add/Edit Execution Form */}
          {showAddExecution && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h5 className="font-medium text-gray-900 mb-3">
                {executionToEdit ? t('execution.edit') : t('execution.new')}
              </h5>

              {/* Field selector */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowFieldSelector(!showFieldSelector)}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  {showFieldSelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {t('execution.customField.selectFields')}
                </button>

                {showFieldSelector && (
                  <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">{t('execution.customField.add')}:</p>
                    <div className="flex flex-wrap gap-2">
                      {defaultFieldKeys.map(field => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => handleToggleField(field.key)}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            enabledFields.includes(field.key)
                              ? 'bg-primary-100 border-primary-300 text-primary-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {t(field.labelKey)}
                        </button>
                      ))}
                    </div>

                    {/* Custom fields */}
                    {customFields.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">{t('execution.customField.addCustom')}:</p>
                        <div className="flex flex-wrap gap-2">
                          {customFields.map(field => (
                            <span
                              key={field.key}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 border border-green-300 text-green-700"
                            >
                              {field.label}
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomField(field.key)}
                                className="hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add custom field */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder={t('execution.customField.placeholder')}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomField()}
                      />
                      <Button size="sm" variant="secondary" onClick={handleAddCustomField}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {/* Date/Time field - always shown */}
                <DateTimePicker
                  label={t('execution.fields.executedAt')}
                  value={executedAt}
                  onChange={setExecutedAt}
                />

                {/* Dynamic fields based on selection */}
                {defaultFieldKeys.map(field => (
                  enabledFields.includes(field.key) && (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t(field.labelKey)}
                      </label>
                      <input
                        type="text"
                        value={fieldValues[field.key] || ''}
                        onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={t(field.placeholderKey)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  )
                ))}

                {/* Custom fields */}
                {customFields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={fieldValues[field.key] || ''}
                      onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.label}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('execution.fields.command')}
                  </label>
                  <textarea
                    value={commandUsed}
                    onChange={(e) => setCommandUsed(e.target.value)}
                    placeholder={t('execution.fields.commandPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('execution.fields.notes')}
                  </label>
                  <textarea
                    value={executionNotes}
                    onChange={(e) => setExecutionNotes(e.target.value)}
                    placeholder={t('execution.fields.notesPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Evidence Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('execution.evidence.title')}
                  </label>

                  {/* Drop zone */}
                  <div
                    ref={dropZoneRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      isDragging
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-4">
                        <Upload className="h-6 w-6 text-gray-400" />
                        <Clipboard className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600">
                        {t('execution.evidence.dragDrop')}{' '}
                        <button
                          type="button"
                          onClick={() => newExecutionFileInputRef.current?.click()}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {t('execution.evidence.selectFiles')}
                        </button>
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('execution.evidence.allowedTypes')} - {t('execution.evidence.maxSize')}
                      </p>
                    </div>
                  </div>

                  {/* Existing evidences (when editing) */}
                  {executionToEdit && executionToEdit.evidences && executionToEdit.evidences.filter(e => !evidencesToDelete.includes(e.id)).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        {t('execution.evidence.title')} ({executionToEdit.evidences.filter(e => !evidencesToDelete.includes(e.id)).length})
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {executionToEdit.evidences
                          .filter((evidence: Evidence) => !evidencesToDelete.includes(evidence.id))
                          .map((evidence: Evidence) => (
                          <EditableEvidenceCard
                            key={evidence.id}
                            evidence={evidence}
                            caption={editedCaptions[evidence.id] ?? evidence.caption ?? ''}
                            onCaptionChange={(newCaption) => setEditedCaptions(prev => ({ ...prev, [evidence.id]: newCaption }))}
                            onDelete={() => setEvidencesToDelete(prev => [...prev, evidence.id])}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending evidences list (new evidences to be uploaded) */}
                  {pendingEvidences.length > 0 && (
                    <div className="mt-3">
                      {executionToEdit && <p className="text-xs font-medium text-gray-600 mb-2">{t('execution.evidence.add')}</p>}
                      <div className="space-y-3">
                        {pendingEvidences.map(evidence => (
                          <div
                            key={evidence.id}
                            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm relative"
                          >
                            <button
                              type="button"
                              onClick={() => removePendingEvidence(evidence.id)}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                              title={t('common.remove')}
                            >
                              <X className="h-3 w-3" />
                            </button>

                            <div className="flex gap-3 p-3">
                              {/* Preview */}
                              <div className="w-24 h-24 bg-gray-100 flex items-center justify-center overflow-hidden rounded-lg flex-shrink-0">
                                {evidence.preview ? (
                                  <img
                                    src={evidence.preview}
                                    alt={evidence.file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-8 w-8 text-gray-400" />
                                )}
                              </div>

                              {/* Info and caption */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 truncate mb-1" title={evidence.file.name}>
                                  {evidence.file.name}
                                </p>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {t('execution.evidence.caption')} <span className="text-amber-600">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={evidence.caption}
                                  onChange={(e) => updatePendingEvidenceCaption(evidence.id, e.target.value)}
                                  placeholder={t('execution.evidence.captionPlaceholder')}
                                  className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                    !evidence.caption ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                  }`}
                                  autoFocus={editingCaptionId === evidence.id}
                                  onFocus={() => setEditingCaptionId(evidence.id)}
                                />
                                {!evidence.caption && (
                                  <p className="mt-1 text-xs text-amber-600">
                                    {t('execution.evidence.captionRequired')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <input
                    ref={newExecutionFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleNewExecutionFileSelect}
                    className="hidden"
                    multiple
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleAddExecution}
                    disabled={createExecution.isPending || updateExecution.isPending || uploadEvidence.isPending || deleteEvidence.isPending}
                  >
                    {createExecution.isPending || updateExecution.isPending || uploadEvidence.isPending
                      ? (executionToEdit ? t('execution.updating') : t('execution.saving'))
                      : executionToEdit
                        ? t('execution.update')
                        : pendingEvidences.length > 0
                          ? t(pendingEvidences.length > 1 ? 'execution.saveExecutionWithEvidences' : 'execution.saveExecutionWithEvidence', { count: pendingEvidences.length })
                          : t('execution.saveExecution')}
                  </Button>
                  <Button variant="secondary" onClick={executionToEdit ? handleCancelEditExecution : resetForm}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Executions List */}
          {loadingExecutions ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : executions.length === 0 && !showAddExecution ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              {t('execution.noExecutions')}
              {canControlStatus && (status === 'in_progress' || status === 'paused') && (
                <p className="text-sm mt-1">{t('execution.noExecutionsMessage')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {executions
                .filter((execution: Execution) => executionToEdit?.id !== execution.id)
                .map((execution: Execution, index: number) => (
                <ExecutionCard
                  key={`${execution.id}-${detectionRefreshKey}`}
                  execution={execution}
                  index={index + 1}
                  onUploadEvidence={() => handleFileSelect(execution.id)}
                  onEditExecution={() => handleOpenEditExecution(execution)}
                  onDeleteExecution={() => setExecutionToDelete(execution.id)}
                  onDeleteEvidence={(evidenceId) =>
                    handleDeleteEvidence(execution.id, evidenceId)
                  }
                  formatDate={formatDate}
                  canRegisterDetection={canRegisterDetection}
                  canControlStatus={canControlStatus}
                  onRegisterDetection={() => openDetectionForm(execution.id)}
                  refreshKey={detectionRefreshKey}
                  onDetectionChange={onDetectionChange}
                  t={t}
                  showAlert={showAlert}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hidden file input for existing executions */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Caption input modal for existing executions */}
        {uploadingFor && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h5 className="font-medium text-gray-900 mb-3">{t('execution.evidence.captionTitle')}</h5>
              <p className="text-sm text-gray-500 mb-3">
                {t('execution.evidence.captionDescription')}
              </p>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('execution.evidence.captionPlaceholderExample')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadEvidence.isPending}
                >
                  {uploadEvidence.isPending ? t('execution.uploading') : t('execution.selectFile')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUploadingFor(null)
                    setCaption('')
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm reopen technique modal */}
        {showReopenConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-blue-600" />
                </div>
                <h5 className="font-medium text-gray-900">{t('technique.reopen')}</h5>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('technique.confirm.reopen')}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmReopen}
                  disabled={reopenTechnique.isPending}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {reopenTechnique.isPending ? `${t('technique.reopen')}...` : t('technique.reopen')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowReopenConfirm(false)}
                  disabled={reopenTechnique.isPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm delete execution modal */}
        {executionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h5 className="font-medium text-gray-900 mb-3">{t('execution.confirm.deleteTitle')}</h5>
              <p className="text-sm text-gray-600 mb-4">
                {t('execution.confirm.deleteMessage')}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={handleConfirmDeleteExecution}
                  disabled={deleteExecution.isPending}
                >
                  {deleteExecution.isPending ? t('execution.deleting') : t('common.delete')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setExecutionToDelete(null)}
                  disabled={deleteExecution.isPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Detection Form Modal */}
        {showDetectionForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 overflow-y-auto py-8">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-gray-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  {t('detection.registerBlueTeam')}
                </h5>
                <button onClick={resetDetectionForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Tool Detection Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-3">{t('detection.toolSection')} (EDR/AV)</p>

                  <div className="flex flex-wrap gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detectionForm.toolDetected}
                        onChange={(e) => setDetectionForm(prev => ({
                          ...prev,
                          toolDetected: e.target.checked,
                          toolNotApplicable: e.target.checked ? false : prev.toolNotApplicable,
                          toolBlocked: e.target.checked ? prev.toolBlocked : false,
                        }))}
                        disabled={detectionForm.toolNotApplicable}
                        className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${detectionForm.toolNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                        {t('detection.detectedByTool')}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detectionForm.toolBlocked}
                        onChange={(e) => setDetectionForm(prev => ({
                          ...prev,
                          toolBlocked: e.target.checked,
                          toolDetected: e.target.checked ? true : prev.toolDetected,
                          toolNotApplicable: e.target.checked ? false : prev.toolNotApplicable,
                        }))}
                        disabled={detectionForm.toolNotApplicable}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${detectionForm.toolNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                        {t('detection.toolBlocked')}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detectionForm.toolNotApplicable}
                        onChange={(e) => setDetectionForm(prev => ({
                          ...prev,
                          toolNotApplicable: e.target.checked,
                          toolDetected: e.target.checked ? false : prev.toolDetected,
                          toolBlocked: e.target.checked ? false : prev.toolBlocked,
                        }))}
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{t('detection.notApplicable')}</span>
                    </label>
                  </div>

                  {/* N/A Reason */}
                  {detectionForm.toolNotApplicable && (
                    <div className="mb-4 pl-2 border-l-4 border-purple-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('detection.naReason')} *
                      </label>
                      <textarea
                        value={detectionForm.toolNAReason}
                        onChange={(e) => setDetectionForm(prev => ({ ...prev, toolNAReason: e.target.value }))}
                        placeholder={t('detection.naReasonPlaceholder')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  {detectionForm.toolDetected && !detectionForm.toolNotApplicable && (
                    <div className="space-y-3 pl-7">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('detection.form.toolName')} *
                          </label>
                          <input
                            type="text"
                            value={detectionForm.toolName}
                            onChange={(e) => setDetectionForm(prev => ({ ...prev, toolName: e.target.value }))}
                            placeholder={t('detection.form.toolNamePlaceholder')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <DateTimePicker
                          label={`${t('detection.form.toolDetectedAt')} *`}
                          value={detectionForm.toolDetectedAt}
                          onChange={(value) => setDetectionForm(prev => ({ ...prev, toolDetectedAt: value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.toolAlertId')}
                        </label>
                        <input
                          type="text"
                          value={detectionForm.toolAlertId}
                          onChange={(e) => setDetectionForm(prev => ({ ...prev, toolAlertId: e.target.value }))}
                          placeholder={t('detection.form.toolAlertIdPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.toolNotes')}
                        </label>
                        <textarea
                          value={detectionForm.toolNotes}
                          onChange={(e) => setDetectionForm(prev => ({ ...prev, toolNotes: e.target.value }))}
                          placeholder={t('detection.form.toolNotesPlaceholder')}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      {/* Tool Evidence Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('detection.form.toolEvidenceRequired')}
                        </label>
                        <div
                          onDragOver={handleDetectionDragOver}
                          onDragLeave={handleDetectionDragLeave}
                          onDrop={(e) => handleDetectionDrop(e, 'tool')}
                          onFocus={() => setDetectionEvidenceType('tool')}
                          onClick={() => setDetectionEvidenceType('tool')}
                          tabIndex={0}
                          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                            detectionIsDragging
                              ? 'border-primary-500 bg-primary-50'
                              : detectionEvidenceType === 'tool'
                                ? 'border-primary-400 bg-primary-50/50'
                                : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-3">
                              <Upload className="h-5 w-5 text-gray-400" />
                              <Clipboard className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">
                              {t('execution.evidence.dragDropShort')}{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetectionEvidenceType('tool')
                                  detectionFileInputRef.current?.click()
                                }}
                                className="text-primary-600 hover:text-primary-700 font-medium"
                              >
                                {t('execution.evidence.selectFiles')}
                              </button>
                            </p>
                            <p className="text-xs text-gray-500">
                              {t('execution.evidence.pasteHint') || 'ou cole com Ctrl+V'}
                            </p>
                          </div>
                        </div>

                        {/* Tool evidences list */}
                        {detectionEvidences.filter(e => e.type === 'tool').length > 0 && (
                          <div className="mt-3 space-y-3">
                            {detectionEvidences.map((ev, idx) => ev.type === 'tool' && (
                              <div key={idx} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => removeDetectionEvidence(idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                                  title={t('common.remove')}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                <div className="flex gap-3 p-3">
                                  {ev.preview && (
                                    <img src={ev.preview} alt="" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 truncate mb-1">{ev.file.name}</p>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      {t('execution.evidence.caption')} <span className="text-amber-600">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={ev.caption}
                                      onChange={(e) => updateDetectionEvidenceCaption(idx, e.target.value)}
                                      placeholder={t('execution.evidence.captionPlaceholder')}
                                      className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                        !ev.caption ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                      }`}
                                    />
                                    {!ev.caption && (
                                      <p className="mt-1 text-xs text-amber-600">
                                        {t('execution.evidence.captionRequired')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* SIEM Detection Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-3">{t('detection.siemSection')}</p>

                  <div className="flex flex-wrap gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detectionForm.siemDetected}
                        onChange={(e) => setDetectionForm(prev => ({
                          ...prev,
                          siemDetected: e.target.checked,
                          siemNotApplicable: e.target.checked ? false : prev.siemNotApplicable
                        }))}
                        disabled={detectionForm.siemNotApplicable}
                        className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${detectionForm.siemNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                        {t('detection.detectedBySiem')}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detectionForm.siemNotApplicable}
                        onChange={(e) => setDetectionForm(prev => ({
                          ...prev,
                          siemNotApplicable: e.target.checked,
                          siemDetected: e.target.checked ? false : prev.siemDetected
                        }))}
                        className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{t('detection.notApplicable')}</span>
                    </label>
                  </div>

                  {/* N/A Reason */}
                  {detectionForm.siemNotApplicable && (
                    <div className="mb-4 pl-2 border-l-4 border-purple-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('detection.naReason')} *
                      </label>
                      <textarea
                        value={detectionForm.siemNAReason}
                        onChange={(e) => setDetectionForm(prev => ({ ...prev, siemNAReason: e.target.value }))}
                        placeholder={t('detection.naReasonPlaceholder')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  {detectionForm.siemDetected && !detectionForm.siemNotApplicable && (
                    <div className="space-y-3 pl-7">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('detection.form.siemName')} *
                          </label>
                          <input
                            type="text"
                            value={detectionForm.siemName}
                            onChange={(e) => setDetectionForm(prev => ({ ...prev, siemName: e.target.value }))}
                            placeholder={t('detection.form.siemNamePlaceholder')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <DateTimePicker
                          label={`${t('detection.form.siemDetectedAt')} *`}
                          value={detectionForm.siemDetectedAt}
                          onChange={(value) => setDetectionForm(prev => ({ ...prev, siemDetectedAt: value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.siemAlertId')}
                        </label>
                        <input
                          type="text"
                          value={detectionForm.siemAlertId}
                          onChange={(e) => setDetectionForm(prev => ({ ...prev, siemAlertId: e.target.value }))}
                          placeholder={t('detection.form.siemAlertIdPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.siemNotes')}
                        </label>
                        <textarea
                          value={detectionForm.siemNotes}
                          onChange={(e) => setDetectionForm(prev => ({ ...prev, siemNotes: e.target.value }))}
                          placeholder={t('detection.form.siemNotesPlaceholder')}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      {/* SIEM Evidence Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('detection.form.siemEvidenceRequired')}
                        </label>
                        <div
                          onDragOver={handleDetectionDragOver}
                          onDragLeave={handleDetectionDragLeave}
                          onDrop={(e) => handleDetectionDrop(e, 'siem')}
                          onFocus={() => setDetectionEvidenceType('siem')}
                          onClick={() => setDetectionEvidenceType('siem')}
                          tabIndex={0}
                          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                            detectionIsDragging
                              ? 'border-primary-500 bg-primary-50'
                              : detectionEvidenceType === 'siem'
                                ? 'border-primary-400 bg-primary-50/50'
                                : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-3">
                              <Upload className="h-5 w-5 text-gray-400" />
                              <Clipboard className="h-5 w-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600">
                              {t('execution.evidence.dragDropShort')}{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetectionEvidenceType('siem')
                                  detectionFileInputRef.current?.click()
                                }}
                                className="text-primary-600 hover:text-primary-700 font-medium"
                              >
                                {t('execution.evidence.selectFiles')}
                              </button>
                            </p>
                            <p className="text-xs text-gray-500">
                              {t('execution.evidence.pasteHint') || 'ou cole com Ctrl+V'}
                            </p>
                          </div>
                        </div>

                        {/* SIEM evidences list */}
                        {detectionEvidences.filter(e => e.type === 'siem').length > 0 && (
                          <div className="mt-3 space-y-3">
                            {detectionEvidences.map((ev, idx) => ev.type === 'siem' && (
                              <div key={idx} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => removeDetectionEvidence(idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                                  title={t('common.remove')}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                <div className="flex gap-3 p-3">
                                  {ev.preview && (
                                    <img src={ev.preview} alt="" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 truncate mb-1">{ev.file.name}</p>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      {t('execution.evidence.caption')} <span className="text-amber-600">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={ev.caption}
                                      onChange={(e) => updateDetectionEvidenceCaption(idx, e.target.value)}
                                      placeholder={t('execution.evidence.captionPlaceholder')}
                                      className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                        !ev.caption ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                      }`}
                                    />
                                    {!ev.caption && (
                                      <p className="mt-1 text-xs text-amber-600">
                                        {t('execution.evidence.captionRequired')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* General Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('detection.form.analystNotes')}
                  </label>
                  <textarea
                    value={detectionForm.analystNotes}
                    onChange={(e) => setDetectionForm(prev => ({ ...prev, analystNotes: e.target.value }))}
                    placeholder={t('detection.form.analystNotesPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Button
                    onClick={handleSaveDetection}
                    disabled={createDetection.isPending || uploadDetectionEvidence.isPending}
                  >
                    {createDetection.isPending || uploadDetectionEvidence.isPending
                      ? t('detection.saving')
                      : t('detection.saveDetection')}
                  </Button>
                  <Button variant="secondary" onClick={resetDetectionForm}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>

              <input
                ref={detectionFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => handleDetectionFileSelect(e, detectionEvidenceType)}
                className="hidden"
                multiple
              />
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Alert Dialog for validation messages */}
    <AlertDialog
      isOpen={alertDialog.isOpen}
      onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
      title={alertDialog.title}
      message={alertDialog.message}
      variant={alertDialog.variant}
      buttonText={t('common.close')}
    />
    </>
  )
}

// Execution Card Component
function ExecutionCard({
  execution,
  index,
  onUploadEvidence,
  onEditExecution,
  onDeleteExecution,
  onDeleteEvidence,
  formatDate,
  canRegisterDetection,
  canControlStatus,
  onRegisterDetection,
  refreshKey,
  onDetectionChange,
  t,
  showAlert,
}: {
  execution: Execution
  index: number
  onUploadEvidence: () => void
  onEditExecution: () => void
  onDeleteExecution: () => void
  onDeleteEvidence: (evidenceId: string) => void
  formatDate: (date: string) => string
  canRegisterDetection: boolean
  canControlStatus: boolean
  onRegisterDetection: () => void
  refreshKey?: number
  onDetectionChange?: () => void
  t: (key: string) => string
  showAlert: (message: string, variant?: 'error' | 'warning' | 'info') => void
}) {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loadingDetections, setLoadingDetections] = useState(false)
  const [isEditingDetection, setIsEditingDetection] = useState(false)
  const [editForm, setEditForm] = useState({
    toolDetected: false,
    toolName: '',
    toolDetectedAt: '',
    toolAlertId: '',
    toolNotes: '',
    toolNotApplicable: false,
    toolNAReason: '',
    toolBlocked: false,
    siemDetected: false,
    siemName: '',
    siemDetectedAt: '',
    siemAlertId: '',
    siemNotes: '',
    siemNotApplicable: false,
    siemNAReason: '',
    analystNotes: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Detection evidence editing state
  const [toolEvidencesToDelete, setToolEvidencesToDelete] = useState<string[]>([])
  const [siemEvidencesToDelete, setSiemEvidencesToDelete] = useState<string[]>([])
  const [editedToolCaptions, setEditedToolCaptions] = useState<Record<string, string>>({})
  const [editedSiemCaptions, setEditedSiemCaptions] = useState<Record<string, string>>({})

  const updateDetection = useUpdateDetection()
  const deleteDetection = useDeleteDetection()
  const deleteDetectionEvidence = useDeleteDetectionEvidence()
  const updateDetectionEvidenceCaption = useUpdateDetectionEvidenceCaption()
  const voidDetection = useVoidDetection()

  // Void detection state (Red Team can void Blue Team detections)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isVoiding, setIsVoiding] = useState(false)

  // Handle void detection
  const handleVoidDetection = async () => {
    if (!latestDetection || !voidReason.trim()) return

    setIsVoiding(true)
    try {
      await voidDetection.mutateAsync({
        detectionId: latestDetection.id,
        voidReason: voidReason.trim(),
      })
      // Refresh detections
      const data = await exercisesApi.getDetectionsByExecution(execution.id)
      setDetections(Array.isArray(data) ? data : [])
      setShowVoidConfirm(false)
      setVoidReason('')
      onDetectionChange?.()
    } catch (error) {
      console.error('Error voiding detection:', error)
    } finally {
      setIsVoiding(false)
    }
  }

  // Fetch detections for this execution (refreshKey triggers refetch)
  useEffect(() => {
    if (!execution?.id) {
      return
    }

    let isMounted = true
    setLoadingDetections(true)

    const fetchDetections = async () => {
      try {
        const data = await exercisesApi.getDetectionsByExecution(execution.id)
        if (isMounted) {
          setDetections(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('[ExecutionCard] Error fetching detections:', error)
        if (isMounted) {
          setDetections([])
        }
      } finally {
        if (isMounted) {
          setLoadingDetections(false)
        }
      }
    }

    fetchDetections()

    return () => {
      isMounted = false
    }
  }, [execution?.id, refreshKey])

  const hasDetection = detections.length > 0
  const latestDetection = hasDetection ? detections[detections.length - 1] : null
  // Calculate the real detection status based on tool/siem detection values
  const calculatedStatus = latestDetection ? calculateDetectionStatus(latestDetection) : null

  // Open edit form with current detection data
  const handleOpenEdit = () => {
    if (!latestDetection) return

    setEditForm({
      toolDetected: latestDetection.tool_detected || false,
      toolName: latestDetection.tool_name || '',
      toolDetectedAt: latestDetection.tool_detected_at
        ? formatDateTimeLocal(new Date(latestDetection.tool_detected_at))
        : '',
      toolAlertId: latestDetection.tool_alert_id || '',
      toolNotes: latestDetection.tool_notes || '',
      toolNotApplicable: latestDetection.tool_not_applicable || false,
      toolNAReason: latestDetection.tool_na_reason || '',
      toolBlocked: latestDetection.tool_blocked || false,
      siemDetected: latestDetection.siem_detected || false,
      siemName: latestDetection.siem_name || '',
      siemDetectedAt: latestDetection.siem_detected_at
        ? formatDateTimeLocal(new Date(latestDetection.siem_detected_at))
        : '',
      siemAlertId: latestDetection.siem_alert_id || '',
      siemNotes: latestDetection.siem_notes || '',
      siemNotApplicable: latestDetection.siem_not_applicable || false,
      siemNAReason: latestDetection.siem_na_reason || '',
      analystNotes: latestDetection.analyst_notes || '',
    })

    // Initialize captions from existing evidences
    const toolCaptions: Record<string, string> = {}
    const siemCaptions: Record<string, string> = {}
    latestDetection.tool_evidences?.forEach(ev => {
      toolCaptions[ev.id] = ev.caption || ''
    })
    latestDetection.siem_evidences?.forEach(ev => {
      siemCaptions[ev.id] = ev.caption || ''
    })
    setEditedToolCaptions(toolCaptions)
    setEditedSiemCaptions(siemCaptions)
    setToolEvidencesToDelete([])
    setSiemEvidencesToDelete([])

    setIsEditingDetection(true)
  }

  // Save detection changes
  const handleSaveEdit = async () => {
    if (!latestDetection) return

    setIsUpdating(true)
    try {
      // Delete tool evidences marked for removal
      for (const evidenceId of toolEvidencesToDelete) {
        try {
          await deleteDetectionEvidence.mutateAsync({
            detectionId: latestDetection.id,
            evidenceId,
          })
        } catch (error) {
          console.error('Failed to delete tool evidence:', error)
        }
      }

      // Delete SIEM evidences marked for removal
      for (const evidenceId of siemEvidencesToDelete) {
        try {
          await deleteDetectionEvidence.mutateAsync({
            detectionId: latestDetection.id,
            evidenceId,
          })
        } catch (error) {
          console.error('Failed to delete SIEM evidence:', error)
        }
      }

      // Update tool evidence captions
      for (const [evidenceId, newCaption] of Object.entries(editedToolCaptions)) {
        const originalEvidence = latestDetection.tool_evidences?.find(e => e.id === evidenceId)
        if (originalEvidence && (originalEvidence.caption || '') !== newCaption && !toolEvidencesToDelete.includes(evidenceId)) {
          try {
            await updateDetectionEvidenceCaption.mutateAsync({
              detectionId: latestDetection.id,
              evidenceId,
              caption: newCaption,
            })
          } catch (error) {
            console.error('Failed to update tool evidence caption:', error)
          }
        }
      }

      // Update SIEM evidence captions
      for (const [evidenceId, newCaption] of Object.entries(editedSiemCaptions)) {
        const originalEvidence = latestDetection.siem_evidences?.find(e => e.id === evidenceId)
        if (originalEvidence && (originalEvidence.caption || '') !== newCaption && !siemEvidencesToDelete.includes(evidenceId)) {
          try {
            await updateDetectionEvidenceCaption.mutateAsync({
              detectionId: latestDetection.id,
              evidenceId,
              caption: newCaption,
            })
          } catch (error) {
            console.error('Failed to update SIEM evidence caption:', error)
          }
        }
      }

      await updateDetection.mutateAsync({
        detectionId: latestDetection.id,
        data: {
          tool_detected: editForm.toolDetected,
          tool_name: editForm.toolDetected ? editForm.toolName : undefined,
          tool_detected_at: editForm.toolDetected && editForm.toolDetectedAt
            ? new Date(editForm.toolDetectedAt).toISOString()
            : undefined,
          tool_alert_id: editForm.toolDetected ? editForm.toolAlertId : undefined,
          tool_notes: editForm.toolDetected ? editForm.toolNotes : undefined,
          tool_not_applicable: editForm.toolNotApplicable,
          tool_na_reason: editForm.toolNotApplicable ? editForm.toolNAReason : undefined,
          tool_blocked: editForm.toolBlocked,
          siem_detected: editForm.siemDetected,
          siem_name: editForm.siemDetected ? editForm.siemName : undefined,
          siem_detected_at: editForm.siemDetected && editForm.siemDetectedAt
            ? new Date(editForm.siemDetectedAt).toISOString()
            : undefined,
          siem_alert_id: editForm.siemDetected ? editForm.siemAlertId : undefined,
          siem_notes: editForm.siemDetected ? editForm.siemNotes : undefined,
          siem_not_applicable: editForm.siemNotApplicable,
          siem_na_reason: editForm.siemNotApplicable ? editForm.siemNAReason : undefined,
          analyst_notes: editForm.analystNotes || undefined,
        },
      })

      // Reset evidence editing state
      setToolEvidencesToDelete([])
      setSiemEvidencesToDelete([])
      setEditedToolCaptions({})
      setEditedSiemCaptions({})

      // Small delay to ensure data is fully propagated in database
      await new Promise(resolve => setTimeout(resolve, 100))

      // Refresh detections and notify parent
      const data = await exercisesApi.getDetectionsByExecution(execution.id)
      setDetections(Array.isArray(data) ? data : [])
      setIsEditingDetection(false)
      onDetectionChange?.()
    } catch (error) {
      console.error('Error updating detection:', error)
      showAlert(t('detection.error.update'))
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete detection
  const handleDeleteDetection = async () => {
    if (!latestDetection) return

    setIsDeleting(true)
    try {
      await deleteDetection.mutateAsync(latestDetection.id)
      setDetections([])
      setShowDeleteConfirm(false)
      onDetectionChange?.()
    } catch (error) {
      console.error('Error deleting detection:', error)
      showAlert(t('detection.error.delete'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-medium">
            #{index}
          </span>
          <span className="text-sm text-gray-600">
            {formatDate(execution.executed_at)}
          </span>
          {/* Detection status badge */}
          {latestDetection && calculatedStatus && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                detectionStatusConfig[calculatedStatus]?.color || 'bg-gray-100 text-gray-700'
              }`}
            >
              {calculatedStatus === 'detected' && <Eye className="h-3 w-3" />}
              {calculatedStatus === 'partial' && <AlertTriangle className="h-3 w-3" />}
              {calculatedStatus === 'not_detected' && <EyeOff className="h-3 w-3" />}
              {calculatedStatus === 'voided' && <AlertTriangle className="h-3 w-3" />}
              {detectionStatusConfig[calculatedStatus]?.labelKey ? t(detectionStatusConfig[calculatedStatus].labelKey) : calculatedStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Blue Team: Register Detection button */}
          {canRegisterDetection && !hasDetection && (
            <Button variant="secondary" size="sm" onClick={onRegisterDetection}>
              <Shield className="h-4 w-4 mr-1" />
              {t('detection.registerDetection')}
            </Button>
          )}
          {/* Red Team: Edit, Add Evidence and Delete */}
          {canControlStatus && (
            <>
              <Button variant="secondary" size="sm" onClick={onEditExecution}>
                <Pencil className="h-4 w-4 mr-1" />
                {t('common.edit')}
              </Button>
              <Button variant="secondary" size="sm" onClick={onUploadEvidence}>
                <Upload className="h-4 w-4 mr-1" />
                {t('execution.evidence.add')}
              </Button>
              <Button variant="danger" size="sm" onClick={onDeleteExecution}>
                <X className="h-4 w-4 mr-1" />
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Parse notes to extract structured fields */}
        {(() => {
          const parsedNotes = parseExecutionNotes(execution.notes || '')
          return (
            <>
              {/* Target System - from execution.target_system or parsed notes */}
              {(execution.target_system || parsedNotes.target_system) && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.targetSystem')}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {execution.target_system || parsedNotes.target_system}
                  </p>
                </div>
              )}

              {/* Command Used */}
              {execution.command_used && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.command')}</p>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
                    {execution.command_used}
                  </pre>
                </div>
              )}

              {/* Source IP */}
              {parsedNotes.source_ip && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.sourceIp')}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {parsedNotes.source_ip}
                  </p>
                </div>
              )}

              {/* Hostname */}
              {parsedNotes.hostname && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.hostname')}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {parsedNotes.hostname}
                  </p>
                </div>
              )}

              {/* Username */}
              {parsedNotes.username && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.username')}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {parsedNotes.username}
                  </p>
                </div>
              )}

              {/* References */}
              {parsedNotes.references && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.references')}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {parsedNotes.references}
                  </p>
                </div>
              )}

              {/* Custom Fields */}
              {parsedNotes.customFields.map((field, index) => (
                <div key={`custom-${index}`}>
                  <p className="text-sm font-medium text-gray-500 mb-1">{field.label}</p>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {field.value}
                  </p>
                </div>
              ))}

              {/* Free-form Notes (observations) */}
              {parsedNotes.freeFormNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t('execution.fields.notes')}</p>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {parsedNotes.freeFormNotes}
                  </p>
                </div>
              )}
            </>
          )
        })()}

        {/* Evidences */}
        {execution.evidences && execution.evidences.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">{t('detection.executionEvidence')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {execution.evidences.map((evidence: Evidence) => (
                <EvidenceCard
                  key={evidence.id}
                  evidence={evidence}
                  onDelete={canControlStatus ? () => onDeleteEvidence(evidence.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Detection Details - visible to all */}
        {latestDetection && !isEditingDetection && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-medium text-gray-900">{t('detection.blueTeam')}</p>
              </div>
              {/* Blue Team: Edit and Delete buttons */}
              <div className="flex items-center gap-2">
                {canRegisterDetection && (
                  <>
                    <button
                      onClick={handleOpenEdit}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('detection.editDetection')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('detection.deleteDetection')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                {/* Red Team: Contest/Void button - more prominent */}
                {canControlStatus && calculatedStatus !== 'voided' && (
                  <button
                    onClick={() => setShowVoidConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 rounded-lg transition-colors"
                  >
                    <Ban className="h-4 w-4" />
                    {t('detection.contestButton')}
                  </button>
                )}
              </div>
            </div>

            {/* Voided Detection Banner */}
            {calculatedStatus === 'voided' && latestDetection.void && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Ban className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800">{t('detection.voided.title')}</p>
                    <p className="text-sm text-orange-700 mt-1">
                      <span className="font-medium">{t('detection.voided.reason')}:</span> {latestDetection.void.void_reason}
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      {new Date(latestDetection.void.voided_at).toLocaleString()}
                    </p>
                    {canRegisterDetection && (
                      <button
                        onClick={handleOpenEdit}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                      >
                        <Pencil className="h-4 w-4" />
                        {t('detection.voided.editAndResubmit')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Void Confirmation */}
            {showVoidConfirm && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-800 mb-2">
                  {t('detection.void.confirmTitle')}
                </p>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t('detection.void.reasonPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleVoidDetection}
                    disabled={isVoiding || !voidReason.trim()}
                  >
                    {isVoiding ? t('detection.void.voiding') : t('detection.void.confirm')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowVoidConfirm(false)
                      setVoidReason('')
                    }}
                    disabled={isVoiding}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-3">
                  {t('detection.confirm.delete')}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteDetection}
                    disabled={isDeleting}
                  >
                    {isDeleting ? t('detection.deleting') : t('detection.yesDelete')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {/* Tool Detection */}
              <div className={`p-3 rounded-lg ${
                latestDetection.tool_not_applicable
                  ? 'bg-gray-100 border border-gray-300'
                  : latestDetection.tool_detected
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {latestDetection.tool_not_applicable ? (
                    <MinusCircle className="h-4 w-4 text-gray-500" />
                  ) : latestDetection.tool_detected ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">
                    {t('detection.toolPrefix')}: {
                      latestDetection.tool_not_applicable
                        ? t('detection.notApplicable')
                        : latestDetection.tool_detected
                          ? t('detection.toolDetected')
                          : t('detection.toolNotDetected')
                    }
                  </span>
                </div>
                {latestDetection.tool_not_applicable && latestDetection.tool_na_reason && (
                  <div className="text-xs text-gray-600 italic">
                    {latestDetection.tool_na_reason}
                  </div>
                )}
                {latestDetection.tool_detected && !latestDetection.tool_not_applicable && (
                  <div className="text-xs text-gray-600 space-y-1">
                    {latestDetection.tool_name && <p>{t('detection.toolPrefix')}: {latestDetection.tool_name}</p>}
                    {latestDetection.tool_detected_at && (
                      <p>{t('detection.detectionTime')}: {new Date(latestDetection.tool_detected_at).toLocaleString()}</p>
                    )}
                    {latestDetection.tool_alert_id && <p>{t('detection.alertId')}: {latestDetection.tool_alert_id}</p>}
                    {latestDetection.tool_response_seconds !== undefined && (
                      <p className="font-medium text-green-700">
                        {t('detection.responseTime')}: {formatResponseTime(latestDetection.tool_response_seconds)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* SIEM Detection */}
              <div className={`p-3 rounded-lg ${
                latestDetection.siem_not_applicable
                  ? 'bg-gray-100 border border-gray-300'
                  : latestDetection.siem_detected
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {latestDetection.siem_not_applicable ? (
                    <MinusCircle className="h-4 w-4 text-gray-500" />
                  ) : latestDetection.siem_detected ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">
                    {t('detection.siemPrefix')}: {
                      latestDetection.siem_not_applicable
                        ? t('detection.notApplicable')
                        : latestDetection.siem_detected
                          ? t('detection.toolDetected')
                          : t('detection.toolNotDetected')
                    }
                  </span>
                </div>
                {latestDetection.siem_not_applicable && latestDetection.siem_na_reason && (
                  <div className="text-xs text-gray-600 italic">
                    {latestDetection.siem_na_reason}
                  </div>
                )}
                {latestDetection.siem_detected && !latestDetection.siem_not_applicable && (
                  <div className="text-xs text-gray-600 space-y-1">
                    {latestDetection.siem_name && <p>{t('detection.siemPrefix')}: {latestDetection.siem_name}</p>}
                    {latestDetection.siem_detected_at && (
                      <p>{t('detection.detectionTime')}: {new Date(latestDetection.siem_detected_at).toLocaleString()}</p>
                    )}
                    {latestDetection.siem_alert_id && <p>{t('detection.alertId')}: {latestDetection.siem_alert_id}</p>}
                    {latestDetection.siem_response_seconds !== undefined && (
                      <p className="font-medium text-green-700">
                        {t('detection.responseTime')}: {formatResponseTime(latestDetection.siem_response_seconds)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {latestDetection.analyst_notes && (
              <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-gray-700">
                <p className="font-medium text-xs text-gray-500 mb-1">{t('detection.form.analystNotes')}:</p>
                {latestDetection.analyst_notes}
              </div>
            )}

            {/* Detection Evidences */}
            {((latestDetection.tool_evidences && latestDetection.tool_evidences.length > 0) ||
              (latestDetection.siem_evidences && latestDetection.siem_evidences.length > 0)) && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-500 mb-2">{t('detection.detectionEvidence')}</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {latestDetection.tool_evidences?.map((evidence: Evidence) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} label={t('detection.toolLabel')} />
                  ))}
                  {latestDetection.siem_evidences?.map((evidence: Evidence) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} label={t('detection.siemLabel')} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Detection Form */}
        {isEditingDetection && latestDetection && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-medium text-gray-900">{t('detection.editDetection')}</p>
              </div>
              <button
                onClick={() => setIsEditingDetection(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tool Detection */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-3">{t('detection.toolSection')}</p>

                <div className="flex flex-wrap gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.toolDetected}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        toolDetected: e.target.checked,
                        toolNotApplicable: e.target.checked ? false : prev.toolNotApplicable,
                        toolBlocked: e.target.checked ? prev.toolBlocked : false,
                      }))}
                      disabled={editForm.toolNotApplicable}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                    />
                    <span className={`text-sm ${editForm.toolNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                      {t('detection.detectedByTool')}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.toolBlocked}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        toolBlocked: e.target.checked,
                        toolDetected: e.target.checked ? true : prev.toolDetected,
                        toolNotApplicable: e.target.checked ? false : prev.toolNotApplicable,
                      }))}
                      disabled={editForm.toolNotApplicable}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className={`text-sm ${editForm.toolNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                      {t('detection.toolBlocked')}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.toolNotApplicable}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        toolNotApplicable: e.target.checked,
                        toolDetected: e.target.checked ? false : prev.toolDetected,
                        toolBlocked: e.target.checked ? false : prev.toolBlocked,
                      }))}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{t('detection.notApplicable')}</span>
                  </label>
                </div>

                {/* N/A Reason */}
                {editForm.toolNotApplicable && (
                  <div className="mb-3 pl-2 border-l-4 border-purple-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('detection.naReason')} *
                    </label>
                    <textarea
                      value={editForm.toolNAReason}
                      onChange={(e) => setEditForm(prev => ({ ...prev, toolNAReason: e.target.value }))}
                      placeholder={t('detection.naReasonPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>
                )}

                {editForm.toolDetected && !editForm.toolNotApplicable && (
                  <div className="space-y-3 ml-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.toolName')}
                        </label>
                        <input
                          type="text"
                          value={editForm.toolName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, toolName: e.target.value }))}
                          placeholder={t('detection.form.toolNamePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.toolAlertId')}
                        </label>
                        <input
                          type="text"
                          value={editForm.toolAlertId}
                          onChange={(e) => setEditForm(prev => ({ ...prev, toolAlertId: e.target.value }))}
                          placeholder={t('detection.form.toolAlertIdPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                    </div>
                    <DateTimePicker
                      label={t('detection.form.toolDetectedAt')}
                      value={editForm.toolDetectedAt}
                      onChange={(value) => setEditForm(prev => ({ ...prev, toolDetectedAt: value }))}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('detection.form.toolNotes')}
                      </label>
                      <textarea
                        value={editForm.toolNotes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, toolNotes: e.target.value }))}
                        placeholder={t('detection.form.toolNotesPlaceholder')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>

                    {/* Existing Tool Evidences */}
                    {latestDetection?.tool_evidences && latestDetection.tool_evidences.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('detection.form.existingEvidences')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {latestDetection.tool_evidences
                            .filter(ev => !toolEvidencesToDelete.includes(ev.id))
                            .map(evidence => (
                              <EditableDetectionEvidenceCard
                                key={evidence.id}
                                evidence={evidence}
                                caption={editedToolCaptions[evidence.id] ?? evidence.caption ?? ''}
                                onCaptionChange={(caption) => setEditedToolCaptions(prev => ({ ...prev, [evidence.id]: caption }))}
                                onDelete={() => setToolEvidencesToDelete(prev => [...prev, evidence.id])}
                                t={t}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SIEM Detection */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-3">{t('detection.siemSection')}</p>

                <div className="flex flex-wrap gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.siemDetected}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        siemDetected: e.target.checked,
                        siemNotApplicable: e.target.checked ? false : prev.siemNotApplicable
                      }))}
                      disabled={editForm.siemNotApplicable}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                    />
                    <span className={`text-sm ${editForm.siemNotApplicable ? 'text-gray-400' : 'text-gray-700'}`}>
                      {t('detection.detectedBySiem')}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.siemNotApplicable}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        siemNotApplicable: e.target.checked,
                        siemDetected: e.target.checked ? false : prev.siemDetected
                      }))}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{t('detection.notApplicable')}</span>
                  </label>
                </div>

                {/* N/A Reason */}
                {editForm.siemNotApplicable && (
                  <div className="mb-3 pl-2 border-l-4 border-purple-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('detection.naReason')} *
                    </label>
                    <textarea
                      value={editForm.siemNAReason}
                      onChange={(e) => setEditForm(prev => ({ ...prev, siemNAReason: e.target.value }))}
                      placeholder={t('detection.naReasonPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>
                )}

                {editForm.siemDetected && !editForm.siemNotApplicable && (
                  <div className="space-y-3 ml-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.siemName')}
                        </label>
                        <input
                          type="text"
                          value={editForm.siemName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, siemName: e.target.value }))}
                          placeholder={t('detection.form.siemNamePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('detection.form.siemAlertId')}
                        </label>
                        <input
                          type="text"
                          value={editForm.siemAlertId}
                          onChange={(e) => setEditForm(prev => ({ ...prev, siemAlertId: e.target.value }))}
                          placeholder={t('detection.form.siemAlertIdPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                    </div>
                    <DateTimePicker
                      label={t('detection.form.siemDetectedAt')}
                      value={editForm.siemDetectedAt}
                      onChange={(value) => setEditForm(prev => ({ ...prev, siemDetectedAt: value }))}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('detection.form.siemNotes')}
                      </label>
                      <textarea
                        value={editForm.siemNotes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, siemNotes: e.target.value }))}
                        placeholder={t('detection.form.siemNotesPlaceholder')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>

                    {/* Existing SIEM Evidences */}
                    {latestDetection?.siem_evidences && latestDetection.siem_evidences.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('detection.form.existingEvidences')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {latestDetection.siem_evidences
                            .filter(ev => !siemEvidencesToDelete.includes(ev.id))
                            .map(evidence => (
                              <EditableDetectionEvidenceCard
                                key={evidence.id}
                                evidence={evidence}
                                caption={editedSiemCaptions[evidence.id] ?? evidence.caption ?? ''}
                                onCaptionChange={(caption) => setEditedSiemCaptions(prev => ({ ...prev, [evidence.id]: caption }))}
                                onDelete={() => setSiemEvidencesToDelete(prev => [...prev, evidence.id])}
                                t={t}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Analyst Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('detection.form.analystNotes')}
                </label>
                <textarea
                  value={editForm.analystNotes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, analystNotes: e.target.value }))}
                  placeholder={t('detection.form.analystNotesPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingDetection(false)}
                  disabled={isUpdating}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isUpdating}
                >
                  {isUpdating ? t('detection.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading detections */}
        {loadingDetections && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format response time
function formatResponseTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}min ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}min`
  }
}

// Evidence Card Component with image loading
function EvidenceCard({
  evidence,
  onDelete,
  label,
}: {
  evidence: Evidence
  onDelete?: () => void
  label?: string
}) {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const url = await exercisesApi.fetchEvidenceBlob(evidence.id)
        if (isMounted) {
          blobUrlRef.current = url
          setImageUrl(url)
        } else {
          // If component unmounted during fetch, revoke immediately
          URL.revokeObjectURL(url)
        }
      } catch {
        if (isMounted) {
          setHasError(true)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      isMounted = false
      // Revoke the blob URL to prevent memory leaks
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [evidence.id])

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden group relative">
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title={t('execution.evidence.deleteEvidence')}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {label && (
        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded z-10">
          {label}
        </span>
      )}

      <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        ) : hasError || !imageUrl ? (
          <ImageIcon className="h-8 w-8 text-gray-400" />
        ) : (
          <img
            src={imageUrl}
            alt={evidence.file_name}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(imageUrl, '_blank')}
          />
        )}
      </div>

      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-gray-900 truncate" title={evidence.file_name}>
          {evidence.file_name}
        </p>
        {evidence.caption ? (
          <p className="text-xs text-gray-600 line-clamp-2" title={evidence.caption}>
            {evidence.caption}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">
            {t('execution.evidence.noCaption')}
          </p>
        )}
      </div>
    </div>
  )
}

// Editable Evidence Card Component for editing execution
function EditableEvidenceCard({
  evidence,
  caption,
  onCaptionChange,
  onDelete,
}: {
  evidence: Evidence
  caption: string
  onCaptionChange: (caption: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const url = await exercisesApi.fetchEvidenceBlob(evidence.id)
        if (isMounted) {
          blobUrlRef.current = url
          setImageUrl(url)
        } else {
          URL.revokeObjectURL(url)
        }
      } catch {
        if (isMounted) {
          setHasError(true)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      isMounted = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [evidence.id])

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white group relative">
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title={t('common.remove')}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Preview */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        ) : hasError || !imageUrl ? (
          <ImageIcon className="h-8 w-8 text-gray-400" />
        ) : (
          <img
            src={imageUrl}
            alt={evidence.file_name}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(imageUrl, '_blank')}
          />
        )}
      </div>

      {/* Info and editable caption */}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 truncate" title={evidence.file_name}>
          {evidence.file_name}
        </p>
        <input
          type="text"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder={t('execution.evidence.captionPlaceholder')}
          className="mt-1 w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  )
}

// Editable Detection Evidence Card Component for editing detection
function EditableDetectionEvidenceCard({
  evidence,
  caption,
  onCaptionChange,
  onDelete,
  t,
}: {
  evidence: Evidence
  caption: string
  onCaptionChange: (caption: string) => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const url = await exercisesApi.fetchEvidenceBlob(evidence.id)
        if (isMounted) {
          blobUrlRef.current = url
          setImageUrl(url)
        } else {
          URL.revokeObjectURL(url)
        }
      } catch {
        if (isMounted) {
          setHasError(true)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadImage()

    return () => {
      isMounted = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [evidence.id])

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white group relative">
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title={t('common.remove')}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Preview */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        ) : hasError || !imageUrl ? (
          <ImageIcon className="h-8 w-8 text-gray-400" />
        ) : (
          <img
            src={imageUrl}
            alt={evidence.file_name}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(imageUrl, '_blank')}
          />
        )}
      </div>

      {/* Info and editable caption */}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 truncate" title={evidence.file_name}>
          {evidence.file_name}
        </p>
        <input
          type="text"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder={t('execution.evidence.captionPlaceholder')}
          className="mt-1 w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  )
}
