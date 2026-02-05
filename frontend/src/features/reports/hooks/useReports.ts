import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reportsApi'

export function useClientsWithExercises() {
  return useQuery({
    queryKey: ['reports', 'clients'],
    queryFn: () => reportsApi.getClientsWithExercises(),
  })
}

export function useClientExercises(clientId: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'clients', clientId, 'exercises'],
    queryFn: () => reportsApi.getClientExercises(clientId!),
    enabled: !!clientId,
  })
}

export function useExerciseReport(exerciseId: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'exercises', exerciseId],
    queryFn: () => reportsApi.getExerciseReport(exerciseId!),
    enabled: !!exerciseId,
  })
}
