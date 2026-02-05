import { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value: string // Format: "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void
  label?: string
  className?: string
  error?: string
}

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Generate years range (current year - 10 to current year + 5)
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 16 }, (_, i) => currentYear - 10 + i)

export function DateTimePicker({ value, onChange, label, className, error }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'date' | 'time' | 'month' | 'year'>('date')
  const containerRef = useRef<HTMLDivElement>(null)
  const hoursRef = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLDivElement>(null)

  // Local state for manual input fields (allows free typing)
  const [dayInput, setDayInput] = useState('')
  const [monthInput, setMonthInput] = useState('')
  const [yearInput, setYearInput] = useState('')
  const [hoursInput, setHoursInput] = useState('')
  const [minutesInput, setMinutesInput] = useState('')

  // Parse the current value
  const parseValue = (val: string) => {
    if (!val) {
      const now = new Date()
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes()
      }
    }
    const date = new Date(val)
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes()
    }
  }

  const parsed = parseValue(value)
  const [viewMonth, setViewMonth] = useState(parsed.month)
  const [viewYear, setViewYear] = useState(parsed.year)

  // Sync local input state when value changes or modal opens
  useEffect(() => {
    const p = parseValue(value)
    setDayInput(String(p.day).padStart(2, '0'))
    setMonthInput(String(p.month + 1).padStart(2, '0'))
    setYearInput(String(p.year))
    setHoursInput(String(p.hours).padStart(2, '0'))
    setMinutesInput(String(p.minutes).padStart(2, '0'))
    setViewMonth(p.month)
    setViewYear(p.year)
  }, [value, isOpen])

  // Scroll to selected time when opening time view
  useEffect(() => {
    if (view === 'time') {
      setTimeout(() => {
        if (hoursRef.current) {
          const selectedHour = hoursRef.current.querySelector('[data-selected="true"]')
          if (selectedHour) {
            selectedHour.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
        if (minutesRef.current) {
          const selectedMinute = minutesRef.current.querySelector('[data-selected="true"]')
          if (selectedMinute) {
            selectedMinute.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
      }, 50)
    }
  }, [view])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setView('date')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatDisplayValue = () => {
    if (!value) return 'Selecionar data e hora'
    const date = new Date(value)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} às ${hours}:${minutes}`
  }

  const buildValue = (year: number, month: number, day: number, hours: number, minutes: number) => {
    const y = String(year)
    const m = String(month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const h = String(hours).padStart(2, '0')
    const min = String(minutes).padStart(2, '0')
    return `${y}-${m}-${d}T${h}:${min}`
  }

  const handleDateSelect = (day: number) => {
    onChange(buildValue(viewYear, viewMonth, day, parsed.hours, parsed.minutes))
    setView('time')
  }

  const handleTimeChange = (hours: number, minutes: number) => {
    onChange(buildValue(parsed.year, parsed.month, parsed.day, hours, minutes))
  }

  const handleMonthSelect = (month: number) => {
    setViewMonth(month)
    setView('date')
  }

  const handleYearSelect = (year: number) => {
    setViewYear(year)
    setView('date')
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleSetNow = () => {
    const now = new Date()
    onChange(buildValue(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    ))
    setViewMonth(now.getMonth())
    setViewYear(now.getFullYear())
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const days: { day: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = []

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }

    // Current month days
    const today = new Date()
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday: today.getDate() === i && today.getMonth() === viewMonth && today.getFullYear() === viewYear,
        isSelected: parsed.day === i && parsed.month === viewMonth && parsed.year === viewYear
      })
    }

    // Next month days
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      })
    }

    return days
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-3 py-2.5 text-left bg-white border rounded-lg shadow-sm',
          'flex items-center gap-3 transition-all duration-200',
          'hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          error ? 'border-red-300' : 'border-gray-300',
          isOpen && 'ring-2 ring-primary-500 border-transparent'
        )}
      >
        <div className="flex items-center gap-2 text-primary-600">
          <Calendar className="w-4 h-4" />
          <Clock className="w-4 h-4" />
        </div>
        <span className={cn(
          'flex-1 text-sm',
          value ? 'text-gray-900' : 'text-gray-400'
        )}>
          {formatDisplayValue()}
        </span>
      </button>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-[320px]">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setView('date')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                view === 'date' || view === 'month' || view === 'year'
                  ? 'text-primary-600 bg-primary-50 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Calendar className="w-4 h-4" />
              Data
            </button>
            <button
              type="button"
              onClick={() => setView('time')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                view === 'time'
                  ? 'text-primary-600 bg-primary-50 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Clock className="w-4 h-4" />
              Hora
            </button>
          </div>

          {/* Date View */}
          {view === 'date' && (
            <div className="p-4">
              {/* Manual date input */}
              <div className="mb-4 flex items-center justify-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => {
                    const num = parseInt(dayInput, 10)
                    const maxDay = new Date(parsed.year, parsed.month + 1, 0).getDate()
                    if (!isNaN(num) && num >= 1 && num <= maxDay) {
                      onChange(buildValue(parsed.year, parsed.month, num, parsed.hours, parsed.minutes))
                    } else {
                      setDayInput(String(parsed.day).padStart(2, '0'))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-12 h-10 text-center text-lg font-semibold text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="DD"
                />
                <span className="text-lg font-semibold text-gray-400">/</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => {
                    const num = parseInt(monthInput, 10)
                    if (!isNaN(num) && num >= 1 && num <= 12) {
                      const newMonth = num - 1
                      const maxDay = new Date(parsed.year, newMonth + 1, 0).getDate()
                      const day = Math.min(parsed.day, maxDay)
                      onChange(buildValue(parsed.year, newMonth, day, parsed.hours, parsed.minutes))
                      setViewMonth(newMonth)
                    } else {
                      setMonthInput(String(parsed.month + 1).padStart(2, '0'))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-12 h-10 text-center text-lg font-semibold text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="MM"
                />
                <span className="text-lg font-semibold text-gray-400">/</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onBlur={() => {
                    const num = parseInt(yearInput, 10)
                    if (!isNaN(num) && num >= 1900 && num <= 2100) {
                      const maxDay = new Date(num, parsed.month + 1, 0).getDate()
                      const day = Math.min(parsed.day, maxDay)
                      onChange(buildValue(num, parsed.month, day, parsed.hours, parsed.minutes))
                      setViewYear(num)
                    } else {
                      setYearInput(String(parsed.year))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-16 h-10 text-center text-lg font-semibold text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="AAAA"
                />
              </div>

              <div className="text-xs text-gray-400 text-center mb-3">
                Digite acima ou selecione abaixo
              </div>

              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>

                <div className="flex items-center gap-1">
                  {/* Month Selector */}
                  <button
                    type="button"
                    onClick={() => setView('month')}
                    className="px-2 py-1 text-sm font-semibold text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {MONTHS_SHORT[viewMonth]}
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {/* Year Selector */}
                  <button
                    type="button"
                    onClick={() => setView('year')}
                    className="px-2 py-1 text-sm font-semibold text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {viewYear}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => item.isCurrentMonth && handleDateSelect(item.day)}
                    disabled={!item.isCurrentMonth}
                    className={cn(
                      'w-9 h-9 text-sm rounded-lg transition-all duration-150',
                      'flex items-center justify-center',
                      item.isCurrentMonth
                        ? 'hover:bg-primary-100 text-gray-700'
                        : 'text-gray-300 cursor-default',
                      item.isToday && !item.isSelected && 'ring-1 ring-primary-400',
                      item.isSelected && 'bg-primary-600 text-white hover:bg-primary-700'
                    )}
                  >
                    {item.day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Month Selector View */}
          {view === 'month' && (
            <div className="p-4">
              <div className="text-center text-sm font-semibold text-gray-700 mb-3">
                Selecionar Mês
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      'py-2 px-3 text-sm rounded-lg transition-colors',
                      viewMonth === index
                        ? 'bg-primary-600 text-white font-medium'
                        : 'hover:bg-primary-50 text-gray-700'
                    )}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Year Selector View */}
          {view === 'year' && (
            <div className="p-4">
              <div className="text-center text-sm font-semibold text-gray-700 mb-3">
                Selecionar Ano
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {YEARS.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearSelect(year)}
                    className={cn(
                      'py-2 px-3 text-sm rounded-lg transition-colors',
                      viewYear === year
                        ? 'bg-primary-600 text-white font-medium'
                        : 'hover:bg-primary-50 text-gray-700'
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time View */}
          {view === 'time' && (
            <div className="p-4">
              {/* Manual time input */}
              <div className="mb-4 flex items-center justify-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => {
                    const num = parseInt(hoursInput, 10)
                    if (!isNaN(num) && num >= 0 && num <= 23) {
                      handleTimeChange(num, parsed.minutes)
                    } else {
                      setHoursInput(String(parsed.hours).padStart(2, '0'))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-14 h-12 text-center text-2xl font-bold text-primary-600 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="00"
                />
                <span className="text-2xl font-bold text-gray-400">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => {
                    const num = parseInt(minutesInput, 10)
                    if (!isNaN(num) && num >= 0 && num <= 59) {
                      handleTimeChange(parsed.hours, num)
                    } else {
                      setMinutesInput(String(parsed.minutes).padStart(2, '0'))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-14 h-12 text-center text-2xl font-bold text-primary-600 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="00"
                />
              </div>

              <div className="text-xs text-gray-400 text-center mb-3">
                Digite acima ou selecione abaixo
              </div>

              <div className="flex gap-4">
                {/* Hours */}
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-500 mb-2 text-center">Hora</div>
                  <div
                    ref={hoursRef}
                    className="h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 rounded-lg border border-gray-200"
                  >
                    {hours.map(h => (
                      <button
                        key={h}
                        type="button"
                        data-selected={parsed.hours === h}
                        onClick={() => handleTimeChange(h, parsed.minutes)}
                        className={cn(
                          'w-full py-2 text-sm transition-colors',
                          parsed.hours === h
                            ? 'bg-primary-600 text-white font-medium'
                            : 'hover:bg-primary-50 text-gray-700'
                        )}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes */}
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-500 mb-2 text-center">Minuto</div>
                  <div
                    ref={minutesRef}
                    className="h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 rounded-lg border border-gray-200"
                  >
                    {minutes.map(m => (
                      <button
                        key={m}
                        type="button"
                        data-selected={parsed.minutes === m}
                        onClick={() => handleTimeChange(parsed.hours, m)}
                        className={cn(
                          'w-full py-2 text-sm transition-colors',
                          parsed.minutes === m
                            ? 'bg-primary-600 text-white font-medium'
                            : 'hover:bg-primary-50 text-gray-700'
                        )}
                      >
                        {String(m).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSetNow}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Agora
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setView('date')
              }}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
