import { useRef } from 'react'

interface MFACodeInputProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  autoFocus?: boolean
}

export function MFACodeInput({ value, onChange, disabled, autoFocus }: MFACodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, inputValue: string) => {
    if (!/^\d*$/.test(inputValue)) return

    const newCode = [...value]
    newCode[index] = inputValue.slice(-1)
    onChange(newCode)

    // Auto-focus next input
    if (inputValue && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...value]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    onChange(newCode)
    if (pasted.length > 0) {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:bg-gray-100"
          autoFocus={autoFocus && index === 0}
        />
      ))}
    </div>
  )
}
