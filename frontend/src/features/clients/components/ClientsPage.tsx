import { useState } from 'react'
import { Plus, Search, Loader2, Building2, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ClientForm } from './ClientForm'
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from '../hooks/useClients'
import type { Client, CreateClientRequest, UpdateClientRequest } from '../api/clientsApi'
import type { ApiError } from '@/types/api'
import type { AxiosError } from 'axios'

function getApiErrorMessage(error: unknown, t: (key: string) => string): string {
  const axiosError = error as AxiosError<ApiError>
  if (axiosError?.response?.data?.message) {
    const msg = axiosError.response.data.message
    if (msg.includes('associated exercises')) {
      return t('client.error.hasExercises')
    }
    return msg
  }
  return t('common.error')
}

type ModalType = 'create' | 'edit' | 'delete' | null

export function ClientsPage() {
  const { t } = useTranslation()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // Queries
  const { data: clients, isLoading, error } = useClients()

  // Mutations
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const closeModal = () => {
    setModalType(null)
    setSelectedClient(null)
    createClient.reset()
    updateClient.reset()
    deleteClient.reset()
  }

  const handleCreateClient = (clientData: CreateClientRequest | UpdateClientRequest) => {
    createClient.mutate(clientData as CreateClientRequest, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  const handleUpdateClient = (clientData: CreateClientRequest | UpdateClientRequest) => {
    if (!selectedClient) return
    updateClient.mutate(
      { id: selectedClient.id, data: clientData as UpdateClientRequest },
      {
        onSuccess: () => {
          closeModal()
        },
      }
    )
  }

  const handleDeleteClient = () => {
    if (!selectedClient) return
    deleteClient.mutate(selectedClient.id, {
      onSuccess: () => {
        closeModal()
      },
    })
  }

  // Filter clients by search term
  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="h-7 w-7 text-purple-600" />
              {t('client.title')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('client.subtitle')}
            </p>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setModalType('create')}
          >
            {t('client.new')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">{t('client.totalClients')}</div>
          <div className="text-2xl font-semibold text-gray-900">{clients?.length || 0}</div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {t('common.error')}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {searchTerm ? t('common.noResults') : t('client.noClients')}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('client.fields.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('client.fields.description')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.created')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-md truncate">
                      {client.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedClient(client)
                          setModalType('edit')
                        }}
                        className="text-purple-600 hover:text-purple-900 p-1"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClient(client)
                          setModalType('delete')
                        }}
                        className="text-red-600 hover:text-red-900 p-1"
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
        </div>
      )}

      {/* Create Client Modal */}
      <Modal
        isOpen={modalType === 'create'}
        onClose={closeModal}
        title={t('client.new')}
        size="md"
      >
        <ClientForm
          mode="create"
          onSubmit={handleCreateClient}
          onCancel={closeModal}
          isLoading={createClient.isPending}
          apiError={createClient.isError ? getApiErrorMessage(createClient.error, t) : null}
        />
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={modalType === 'edit'}
        onClose={closeModal}
        title={t('client.edit')}
        size="md"
      >
        <ClientForm
          mode="edit"
          client={selectedClient}
          onSubmit={handleUpdateClient}
          onCancel={closeModal}
          isLoading={updateClient.isPending}
          apiError={updateClient.isError ? getApiErrorMessage(updateClient.error, t) : null}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={modalType === 'delete'}
        onClose={closeModal}
        onConfirm={handleDeleteClient}
        title={t('client.delete')}
        message={t('client.confirm.delete')}
        confirmText={t('common.delete')}
        variant="danger"
        isLoading={deleteClient.isPending}
        error={deleteClient.isError ? getApiErrorMessage(deleteClient.error, t) : undefined}
      />
    </div>
  )
}
