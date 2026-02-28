import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exercisesApi } from '../api/exercisesApi'
import type {
  ExerciseFilters,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  AddMemberRequest,
  AddTechniqueRequest,
  UpdateExerciseTechniqueRequest,
  CreateExecutionRequest,
  CreateDetectionRequest,
  CreateRequirementRequest,
  UpdateRequirementRequest,
} from '../api/exercisesApi'

export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: (params?: ExerciseFilters) => [...exerciseKeys.lists(), params] as const,
  details: () => [...exerciseKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciseKeys.details(), id] as const,
  members: (id: string) => [...exerciseKeys.all, 'members', id] as const,
  techniques: (id: string) => [...exerciseKeys.all, 'techniques', id] as const,
  technique: (exerciseId: string, techniqueId: string) =>
    [...exerciseKeys.all, 'technique', exerciseId, techniqueId] as const,
  techniqueExecutions: (exerciseId: string, techniqueId: string) =>
    [...exerciseKeys.all, 'technique-executions', exerciseId, techniqueId] as const,
  state: (id: string) => [...exerciseKeys.all, 'state', id] as const,
  requirements: (exerciseId: string) => [...exerciseKeys.all, 'requirements', exerciseId] as const,
  requirementAlerts: (exerciseId: string) => [...exerciseKeys.all, 'requirement-alerts', exerciseId] as const,
  scenarioRequirements: (exerciseId: string, techniqueId: string) =>
    [...exerciseKeys.all, 'scenario-requirements', exerciseId, techniqueId] as const,
}

// Exercises
export function useExercises(params?: ExerciseFilters) {
  return useQuery({
    queryKey: exerciseKeys.list(params),
    queryFn: () => exercisesApi.list(params),
  })
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => exercisesApi.getById(id),
    enabled: !!id,
  })
}

export function useCreateExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateExerciseRequest) => exercisesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
    },
  })
}

export function useUpdateExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExerciseRequest }) =>
      exercisesApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}

export function useDeleteExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => exercisesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
    },
  })
}

export function useStartExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => exercisesApi.start(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}

export function useCompleteExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => exercisesApi.complete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}

export function useReopenExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => exercisesApi.reopen(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}

// Members
export function useExerciseMembers(exerciseId: string) {
  return useQuery({
    queryKey: exerciseKeys.members(exerciseId),
    queryFn: () => exercisesApi.getMembers(exerciseId),
    enabled: !!exerciseId,
  })
}

export function useAddMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: AddMemberRequest }) =>
      exercisesApi.addMember(exerciseId, data),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.members(exerciseId) })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, userId }: { exerciseId: string; userId: string }) =>
      exercisesApi.removeMember(exerciseId, userId),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.members(exerciseId) })
    },
  })
}

// Techniques
export function useExerciseTechniques(exerciseId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: exerciseKeys.techniques(exerciseId),
    queryFn: () => exercisesApi.getTechniques(exerciseId),
    enabled: !!exerciseId,
    refetchInterval: options?.refetchInterval,
  })
}

// Unified exercise state (replaces multiple polling queries)
export function useExerciseState(exerciseId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: exerciseKeys.state(exerciseId),
    queryFn: () => exercisesApi.getExerciseState(exerciseId),
    enabled: !!exerciseId,
    refetchInterval: options?.refetchInterval,
  })
}

export function useAddTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: AddTechniqueRequest }) =>
      exercisesApi.addTechnique(exerciseId, data),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useUpdateExerciseTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      exerciseId,
      techniqueId,
      data,
    }: {
      exerciseId: string
      techniqueId: string
      data: UpdateExerciseTechniqueRequest
    }) => exercisesApi.updateExerciseTechnique(exerciseId, techniqueId, data),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useScheduleTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      exerciseId,
      techniqueId,
      data,
    }: {
      exerciseId: string
      techniqueId: string
      data: { scheduled_start_time: string | null; scheduled_end_time: string | null }
    }) => {
      console.log('[useScheduleTechnique] Calling API:', { exerciseId, techniqueId, data })
      return exercisesApi.scheduleTechnique(exerciseId, techniqueId, data)
    },
    onSuccess: (result, { exerciseId }) => {
      console.log('[useScheduleTechnique] Success! Result:', result)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
    onError: (error, variables) => {
      console.error('[useScheduleTechnique] Error:', error)
      console.error('[useScheduleTechnique] Variables:', variables)
    },
  })
}

export function useRemoveTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.removeTechnique(exerciseId, techniqueId),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useReorderTechniques() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      exerciseId,
      techniqueIds,
    }: {
      exerciseId: string
      techniqueIds: string[]
    }) => exercisesApi.reorderTechniques(exerciseId, techniqueIds),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

// Technique status management
export function useExerciseTechnique(exerciseId: string, techniqueId: string) {
  return useQuery({
    queryKey: exerciseKeys.technique(exerciseId, techniqueId),
    queryFn: () => exercisesApi.getTechnique(exerciseId, techniqueId),
    enabled: !!exerciseId && !!techniqueId,
  })
}

export function useStartTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.startTechnique(exerciseId, techniqueId),
    onSuccess: (data, { exerciseId, techniqueId }) => {
      queryClient.setQueryData(exerciseKeys.technique(exerciseId, techniqueId), data)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function usePauseTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.pauseTechnique(exerciseId, techniqueId),
    onSuccess: (data, { exerciseId, techniqueId }) => {
      queryClient.setQueryData(exerciseKeys.technique(exerciseId, techniqueId), data)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useResumeTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.resumeTechnique(exerciseId, techniqueId),
    onSuccess: (data, { exerciseId, techniqueId }) => {
      queryClient.setQueryData(exerciseKeys.technique(exerciseId, techniqueId), data)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useCompleteTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.completeTechnique(exerciseId, techniqueId),
    onSuccess: (data, { exerciseId, techniqueId }) => {
      queryClient.setQueryData(exerciseKeys.technique(exerciseId, techniqueId), data)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useReopenTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId }: { exerciseId: string; techniqueId: string }) =>
      exercisesApi.reopenTechnique(exerciseId, techniqueId),
    onSuccess: (data, { exerciseId, techniqueId }) => {
      queryClient.setQueryData(exerciseKeys.technique(exerciseId, techniqueId), data)
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

// Executions
export function useTechniqueExecutions(exerciseId: string, techniqueId: string) {
  return useQuery({
    queryKey: exerciseKeys.techniqueExecutions(exerciseId, techniqueId),
    queryFn: () => exercisesApi.getTechniqueExecutions(exerciseId, techniqueId),
    enabled: !!exerciseId && !!techniqueId,
  })
}

export function useCreateExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: CreateExecutionRequest }) =>
      exercisesApi.createExecution(exerciseId, data),
    onSuccess: (_, { exerciseId, data }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.techniques(exerciseId) })
      queryClient.invalidateQueries({
        queryKey: exerciseKeys.techniqueExecutions(exerciseId, data.exercise_technique_id),
      })
    },
  })
}

export function useUpdateExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionId, data }: { executionId: string; data: Partial<CreateExecutionRequest> }) =>
      exercisesApi.updateExecution(executionId, data),
    onSuccess: () => {
      // Invalidate all queries since we don't have the exact technique ID
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useDeleteExecution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionId }: { executionId: string }) =>
      exercisesApi.deleteExecution(executionId),
    onSuccess: () => {
      // Invalidate all queries since we don't have the exact technique ID
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useUploadEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      executionId,
      file,
      caption,
      description,
    }: {
      executionId: string
      file: File
      caption?: string
      description?: string
    }) => exercisesApi.uploadEvidence(executionId, file, caption, description),
    onSuccess: () => {
      // Invalidate all technique queries since we don't know the exact technique
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useDeleteEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionId, evidenceId }: { executionId: string; evidenceId: string }) =>
      exercisesApi.deleteEvidence(executionId, evidenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useUpdateEvidenceCaption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionId, evidenceId, caption }: { executionId: string; evidenceId: string; caption: string }) =>
      exercisesApi.updateEvidenceCaption(executionId, evidenceId, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

// Detections
export function useCreateDetection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: CreateDetectionRequest }) =>
      exercisesApi.createDetection(exerciseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useUpdateDetection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ detectionId, data }: { detectionId: string; data: Partial<CreateDetectionRequest> }) =>
      exercisesApi.updateDetection(detectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useDeleteDetection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (detectionId: string) => exercisesApi.deleteDetection(detectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useUploadDetectionEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      detectionId,
      file,
      evidenceType,
      caption,
    }: {
      detectionId: string
      file: File
      evidenceType: 'tool' | 'siem'
      caption?: string
    }) => exercisesApi.uploadDetectionEvidence(detectionId, file, evidenceType, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useDeleteDetectionEvidence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ detectionId, evidenceId }: { detectionId: string; evidenceId: string }) =>
      exercisesApi.deleteDetectionEvidence(detectionId, evidenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

export function useUpdateDetectionEvidenceCaption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ detectionId, evidenceId, caption }: { detectionId: string; evidenceId: string; caption: string }) =>
      exercisesApi.updateDetectionEvidenceCaption(detectionId, evidenceId, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

// Void a detection (Red Team can void invalid detections)
export function useVoidDetection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ detectionId, voidReason }: { detectionId: string; voidReason: string }) =>
      exercisesApi.voidDetection(detectionId, voidReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all })
    },
  })
}

// Requirements
export function useExerciseRequirements(exerciseId: string) {
  return useQuery({
    queryKey: exerciseKeys.requirements(exerciseId),
    queryFn: () => exercisesApi.getRequirements(exerciseId),
    enabled: !!exerciseId,
  })
}

export function useRequirementAlerts(exerciseId: string) {
  return useQuery({
    queryKey: exerciseKeys.requirementAlerts(exerciseId),
    queryFn: () => exercisesApi.getRequirementAlerts(exerciseId),
    enabled: !!exerciseId,
    refetchInterval: 30000,
  })
}

export function useScenarioRequirements(exerciseId: string, techniqueId: string) {
  return useQuery({
    queryKey: exerciseKeys.scenarioRequirements(exerciseId, techniqueId),
    queryFn: () => exercisesApi.getScenarioRequirements(exerciseId, techniqueId),
    enabled: !!exerciseId && !!techniqueId,
  })
}

export function useCreateRequirement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: string; data: CreateRequirementRequest }) =>
      exercisesApi.createRequirement(exerciseId, data),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirements(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirementAlerts(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, requirementId, data }: { exerciseId: string; requirementId: string; data: UpdateRequirementRequest }) =>
      exercisesApi.updateRequirement(exerciseId, requirementId, data),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirements(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirementAlerts(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, requirementId }: { exerciseId: string; requirementId: string }) =>
      exercisesApi.deleteRequirement(exerciseId, requirementId),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirements(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirementAlerts(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useFulfillRequirement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, requirementId, fulfilled }: { exerciseId: string; requirementId: string; fulfilled: boolean }) =>
      exercisesApi.fulfillRequirement(exerciseId, requirementId, fulfilled),
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirements(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirementAlerts(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}

export function useSetScenarioRequirements() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ exerciseId, techniqueId, requirementIds }: { exerciseId: string; techniqueId: string; requirementIds: string[] }) =>
      exercisesApi.setScenarioRequirements(exerciseId, techniqueId, requirementIds),
    onSuccess: (_, { exerciseId, techniqueId }) => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.scenarioRequirements(exerciseId, techniqueId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirements(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.requirementAlerts(exerciseId) })
      queryClient.invalidateQueries({ queryKey: exerciseKeys.state(exerciseId) })
    },
  })
}
