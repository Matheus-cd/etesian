import { AlertTriangle, XCircle, Info } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface AlertDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  buttonText?: string
  variant?: 'error' | 'warning' | 'info'
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'error',
}: AlertDialogProps) {
  const iconConfig = {
    error: {
      bg: 'bg-red-100',
      color: 'text-red-600',
      Icon: XCircle,
    },
    warning: {
      bg: 'bg-yellow-100',
      color: 'text-yellow-600',
      Icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-100',
      color: 'text-blue-600',
      Icon: Info,
    },
  }

  const { bg, color, Icon } = iconConfig[variant]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 rounded-full mb-4 ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <Button variant="primary" onClick={onClose} className="w-full">
          {buttonText}
        </Button>
      </div>
    </Modal>
  )
}
