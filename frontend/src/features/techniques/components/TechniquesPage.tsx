import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Plus,
  Upload,
  Filter,
  FileText,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useTechniques,
  useTactics,
  useDeleteTechnique,
  useImportSTIX,
} from '../hooks/useTechniques'
import { TechniqueForm } from './TechniqueForm'
import type { Technique, TechniqueFilters } from '../api/techniquesApi'

export function TechniquesPage() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<TechniqueFilters>({
    page: 1,
    per_page: 20,
  })
  const [search, setSearch] = useState('')
  const [selectedTactic, setSelectedTactic] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTechnique, setEditingTechnique] = useState<Technique | null>(null)
  const [deletingTechnique, setDeletingTechnique] = useState<Technique | null>(null)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    details?: { inserted: number; updated: number; skipped: number }
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useTechniques({
    ...filters,
    search: search || undefined,
    tactic: selectedTactic || undefined,
  })
  const { data: tactics } = useTactics()
  const deleteTechnique = useDeleteTechnique()
  const importSTIX = useImportSTIX()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters((prev) => ({ ...prev, page: 1 }))
  }

  const handleDelete = () => {
    if (!deletingTechnique) return
    deleteTechnique.mutate(deletingTechnique.id, {
      onSuccess: () => setDeletingTechnique(null),
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input
    e.target.value = ''

    if (!file.name.endsWith('.json')) {
      setImportResult({
        success: false,
        message: t('technique.import.invalidJson'),
      })
      return
    }

    try {
      const text = await file.text()
      const stixBundle = JSON.parse(text)

      importSTIX.mutate(stixBundle, {
        onSuccess: (result) => {
          setImportResult({
            success: true,
            message: result.message,
            details: {
              inserted: result.inserted,
              updated: result.updated,
              skipped: result.skipped,
            },
          })
        },
        onError: (error: Error) => {
          setImportResult({
            success: false,
            message: error.message || t('technique.import.failed'),
          })
        },
      })
    } catch {
      setImportResult({
        success: false,
        message: t('technique.import.invalidJson'),
      })
    }
  }

  const techniques = data?.data || []
  const totalPages = data?.total_pages || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('technique.title')}</h1>
          <p className="text-gray-500">{t('technique.description')}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importSTIX.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importSTIX.isPending ? t('technique.import.importing') : t('technique.import.button')}
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('technique.add')}
          </Button>
        </div>
      </div>

      {/* Import Result Alert */}
      {importResult && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            importResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {importResult.success ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                importResult.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {importResult.message}
            </p>
            {importResult.details && (
              <p className="text-sm text-green-700 mt-1">
                {t('technique.import.results', {
                  inserted: importResult.details.inserted,
                  updated: importResult.details.updated,
                  skipped: importResult.details.skipped,
                })}
              </p>
            )}
          </div>
          <button
            onClick={() => setImportResult(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('technique.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedTactic}
              onChange={(e) => {
                setSelectedTactic(e.target.value)
                setFilters((prev) => ({ ...prev, page: 1 }))
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('technique.allTactics')}</option>
              {tactics?.map((tactic) => (
                <option key={tactic} value={tactic}>
                  {tactic}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Techniques Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : techniques.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('technique.noTechniques')}</h3>
            <p className="text-gray-500 mb-4">
              {search || selectedTactic
                ? t('technique.adjustFilters')
                : t('technique.importOrAdd')}
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {t('technique.import.button')}
            </Button>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('technique.fields.mitreId')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('technique.fields.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('technique.fields.tactic')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('technique.fields.description')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {techniques.map((technique) => (
                  <tr key={technique.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-primary-600">
                        {technique.mitre_id || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{technique.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {technique.tactic ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {technique.tactic}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500 line-clamp-2 max-w-md">
                        {technique.description || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingTechnique(technique)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title={t('common.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingTechnique(technique)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t">
                <p className="text-sm text-gray-500">
                  {t('common.pagination', { page: filters.page, totalPages, total: data?.total || 0 })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filters.page === 1}
                    onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filters.page === totalPages}
                    onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('technique.add')}
      >
        <TechniqueForm
          onSuccess={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTechnique}
        onClose={() => setEditingTechnique(null)}
        title={t('technique.edit')}
      >
        {editingTechnique && (
          <TechniqueForm
            technique={editingTechnique}
            onSuccess={() => setEditingTechnique(null)}
            onCancel={() => setEditingTechnique(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTechnique}
        onClose={() => setDeletingTechnique(null)}
        onConfirm={handleDelete}
        title={t('technique.delete')}
        message={t('technique.confirm.delete', { name: deletingTechnique?.name })}
        confirmText={t('common.delete')}
        variant="danger"
        isLoading={deleteTechnique.isPending}
      />
    </div>
  )
}
