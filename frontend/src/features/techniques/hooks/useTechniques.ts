import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { techniquesApi } from '../api/techniquesApi'
import type {
  TechniqueFilters,
  CreateTechniqueRequest,
  UpdateTechniqueRequest,
} from '../api/techniquesApi'

export const techniqueKeys = {
  all: ['techniques'] as const,
  lists: () => [...techniqueKeys.all, 'list'] as const,
  list: (params?: TechniqueFilters) => [...techniqueKeys.lists(), params] as const,
  details: () => [...techniqueKeys.all, 'detail'] as const,
  detail: (id: string) => [...techniqueKeys.details(), id] as const,
  tactics: () => [...techniqueKeys.all, 'tactics'] as const,
}

export function useTechniques(params?: TechniqueFilters) {
  return useQuery({
    queryKey: techniqueKeys.list(params),
    queryFn: () => techniquesApi.list(params),
  })
}

export function useTechnique(id: string) {
  return useQuery({
    queryKey: techniqueKeys.detail(id),
    queryFn: () => techniquesApi.getById(id),
    enabled: !!id,
  })
}

export function useTactics() {
  return useQuery({
    queryKey: techniqueKeys.tactics(),
    queryFn: () => techniquesApi.getTactics(),
  })
}

export function useCreateTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTechniqueRequest) => techniquesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techniqueKeys.lists() })
    },
  })
}

export function useUpdateTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTechniqueRequest }) =>
      techniquesApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: techniqueKeys.lists() })
      queryClient.invalidateQueries({ queryKey: techniqueKeys.detail(id) })
    },
  })
}

export function useDeleteTechnique() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => techniquesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techniqueKeys.lists() })
    },
  })
}

export function useImportSTIX() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stixBundle: object) => techniquesApi.importSTIX(stixBundle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techniqueKeys.lists() })
    },
  })
}
