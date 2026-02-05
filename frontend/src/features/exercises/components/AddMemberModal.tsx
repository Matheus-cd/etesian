import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAddMember } from '../hooks/useExercises'
import { useUsers } from '@/features/users/hooks/useUsers'

interface AddMemberModalProps {
  exerciseId: string
  isOpen: boolean
  onClose: () => void
}

const roles = [
  { value: 'lead', label: 'Lead' },
  { value: 'red_team', label: 'Red Team' },
  { value: 'blue_team', label: 'Blue Team' },
  { value: 'viewer', label: 'Viewer' },
]

export function AddMemberModal({ exerciseId, isOpen, onClose }: AddMemberModalProps) {
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('red_team')

  const { data: usersData, isLoading: loadingUsers } = useUsers({ per_page: 100 })
  const addMember = useAddMember()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    addMember.mutate(
      {
        exerciseId,
        data: {
          user_id: selectedUser,
          role_in_exercise: selectedRole as 'red_team' | 'blue_team' | 'lead' | 'viewer',
        },
      },
      {
        onSuccess: () => {
          setSelectedUser('')
          setSelectedRole('red_team')
          onClose()
        },
      }
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select User
          </label>
          {loadingUsers ? (
            <p className="text-gray-500">Loading users...</p>
          ) : (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a user...</option>
              {usersData?.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.username})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role in Exercise
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedUser || addMember.isPending}
          >
            {addMember.isPending ? 'Adding...' : 'Add Member'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
