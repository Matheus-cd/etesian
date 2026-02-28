import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Check, ClipboardList } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAddTechnique, useExerciseRequirements, useSetScenarioRequirements } from '../hooks/useExercises'
import apiClient from '@/lib/api-client'

interface Technique {
  id: string
  name: string
  mitre_id: string | null
  tactic: string | null
  description: string | null
}

interface AddTechniqueModalProps {
  exerciseId: string
  isOpen: boolean
  onClose: () => void
}

export function AddTechniqueModal({
  exerciseId,
  isOpen,
  onClose,
}: AddTechniqueModalProps) {
  const [techniques, setTechniques] = useState<Technique[]>([])
  const [tactics, setTactics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedTactic, setSelectedTactic] = useState<string>('')
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { t } = useTranslation()
  const addTechnique = useAddTechnique()
  const { data: requirements = [] } = useExerciseRequirements(exerciseId)
  const setScenarioRequirements = useSetScenarioRequirements()

  useEffect(() => {
    if (isOpen) {
      loadData()
      // Reset state when modal opens
      setSearchQuery('')
      setSelectedTechnique(null)
      setNotes('')
      setSelectedTactic('')
      setSelectedRequirementIds([])
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all techniques and tactics in parallel
      const [techniquesRes, tacticsRes] = await Promise.all([
        apiClient.get('/techniques', {
          params: { per_page: 2000 }, // Load all techniques
        }),
        apiClient.get('/techniques/tactics'),
      ])
      setTechniques(techniquesRes.data?.data || [])
      setTactics(tacticsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter techniques based on search query and selected tactic
  const filteredTechniques = useMemo(() => {
    return techniques.filter((tech) => {
      // Filter by tactic
      if (selectedTactic && tech.tactic !== selectedTactic) {
        return false
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()

        // Check if query looks like a MITRE ID (e.g., T1566, T1566.001)
        const isMitreIdSearch = /^t\d+/i.test(query)

        if (isMitreIdSearch) {
          // For MITRE ID searches, only match against mitre_id using startsWith
          // This prevents matching techniques that mention the ID in their description
          return tech.mitre_id?.toLowerCase().startsWith(query) || false
        } else {
          // For other searches, match name, mitre_id, description, tactic
          const matchesName = tech.name.toLowerCase().includes(query)
          const matchesMitreId = tech.mitre_id?.toLowerCase().includes(query)
          const matchesDescription = tech.description?.toLowerCase().includes(query)
          const matchesTactic = tech.tactic?.toLowerCase().includes(query)
          return matchesName || matchesMitreId || matchesDescription || matchesTactic
        }
      }

      return true
    })
  }, [techniques, searchQuery, selectedTactic])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTechnique) return

    addTechnique.mutate(
      {
        exerciseId,
        data: {
          technique_id: selectedTechnique.id,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: (newTechnique) => {
          // Set scenario requirements if any were selected
          if (selectedRequirementIds.length > 0 && newTechnique?.id) {
            setScenarioRequirements.mutate({
              exerciseId,
              techniqueId: newTechnique.id,
              requirementIds: selectedRequirementIds,
            })
          }
          setSelectedTechnique(null)
          setNotes('')
          setSearchQuery('')
          setSelectedRequirementIds([])
          onClose()
        },
      }
    )
  }

  const toggleRequirement = (reqId: string) => {
    setSelectedRequirementIds((prev) =>
      prev.includes(reqId) ? prev.filter((id) => id !== reqId) : [...prev, reqId]
    )
  }

  const handleSelectTechnique = (tech: Technique) => {
    if (selectedTechnique?.id === tech.id) {
      setSelectedTechnique(null)
    } else {
      setSelectedTechnique(tech)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Technique">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, MITRE ID, or description..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tactic Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTactic('')}
              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                selectedTactic === ''
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Tactics
            </button>
            {tactics.map((tactic) => (
              <button
                key={tactic}
                type="button"
                onClick={() => setSelectedTactic(selectedTactic === tactic ? '' : tactic)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  selectedTactic === tactic
                    ? 'bg-primary-100 border-primary-300 text-primary-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tactic}
              </button>
            ))}
          </div>
        </div>

        {/* Techniques List */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : filteredTechniques.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || selectedTactic
                ? 'No techniques found matching your search'
                : 'No techniques available'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {filteredTechniques.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => handleSelectTechnique(tech)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                    selectedTechnique?.id === tech.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {tech.mitre_id && (
                          <span className="text-sm font-mono text-primary-600 flex-shrink-0">
                            {tech.mitre_id}
                          </span>
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {tech.name}
                        </span>
                      </div>
                      {tech.tactic && (
                        <Badge variant="default" className="text-xs mt-1">
                          {tech.tactic}
                        </Badge>
                      )}
                      {tech.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {tech.description}
                        </p>
                      )}
                    </div>
                    {selectedTechnique?.id === tech.id && (
                      <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500">
          {filteredTechniques.length} technique{filteredTechniques.length !== 1 ? 's' : ''} found
          {selectedTechnique && (
            <span className="text-primary-600 ml-2">
              • 1 selected
            </span>
          )}
        </p>

        {/* Selected Technique Preview */}
        {selectedTechnique && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {selectedTechnique.mitre_id && (
                    <span className="text-primary-600 mr-2">{selectedTechnique.mitre_id}</span>
                  )}
                  {selectedTechnique.name}
                </p>
                {selectedTechnique.tactic && (
                  <p className="text-sm text-gray-600">{selectedTechnique.tactic}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTechnique(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Requirements */}
        {requirements.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ClipboardList className="inline h-3.5 w-3.5 mr-1" />
              {t('requirement.scenarioRequirements')}
            </label>
            <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
              {requirements.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => toggleRequirement(req.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 hover:bg-gray-50 flex items-center gap-2 ${
                    selectedRequirementIds.includes(req.id) ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    selectedRequirementIds.includes(req.id)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300'
                  }`}>
                    {selectedRequirementIds.includes(req.id) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="truncate">{req.title}</span>
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                    {t(`requirement.categories.${req.category}`)}
                  </span>
                </button>
              ))}
            </div>
            {selectedRequirementIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedRequirementIds.length} {t('requirement.selectedRequirements').toLowerCase()}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Additional notes for this technique in the exercise..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedTechnique || addTechnique.isPending}
          >
            {addTechnique.isPending ? 'Adding...' : 'Add Technique'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
