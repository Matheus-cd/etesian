import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Check, ChevronDown, Search, RotateCcw } from 'lucide-react'
import { useTimezone } from '@/contexts/TimezoneContext'
import { TIMEZONE_GROUPS, ALL_TIMEZONES, getCurrentTimeInTimezone } from '@/lib/timezone'

export function TimezoneSelector() {
  const { t } = useTranslation()
  const { timezone, setTimezone, isAutoDetected, resetToAutoDetect } = useTimezone()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openUpward, setOpenUpward] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  type TimezoneItem = { value: string; label: string; offset: number }
  type FilteredTimezones = Record<string, TimezoneItem[]>

  // Filter timezones based on search query
  const filteredTimezones = useMemo((): FilteredTimezones => {
    if (!searchQuery.trim()) {
      return TIMEZONE_GROUPS as unknown as FilteredTimezones
    }
    const query = searchQuery.toLowerCase()
    const filtered: FilteredTimezones = {}

    Object.entries(TIMEZONE_GROUPS).forEach(([region, timezones]) => {
      const matches = (timezones as readonly TimezoneItem[]).filter(
        tz =>
          tz.label.toLowerCase().includes(query) ||
          tz.value.toLowerCase().includes(query) ||
          region.toLowerCase().includes(query)
      )
      if (matches.length > 0) {
        filtered[region] = matches
      }
    })

    return filtered
  }, [searchQuery])

  // Get current timezone info
  const currentTimezoneInfo = useMemo(() => {
    const tz = ALL_TIMEZONES.find(t => t.value === timezone)
    const currentTime = getCurrentTimeInTimezone(timezone)
    return {
      label: tz?.label || timezone,
      currentTime,
    }
  }, [timezone])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Check if dropdown should open upward based on available space
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = 400 // Approximate height of dropdown
      const spaceBelow = window.innerHeight - buttonRect.bottom
      const spaceAbove = buttonRect.top

      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)
    }
  }, [isOpen])

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleResetToAuto = () => {
    resetToAutoDetect()
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        aria-label={t('timezone.select') || 'Select timezone'}
        title={`${currentTimezoneInfo.label} - ${currentTimezoneInfo.currentTime}`}
      >
        <Clock className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-mono">{currentTimezoneInfo.currentTime}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 w-80 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 ${
            openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('timezone.search') || 'Search timezone...'}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Auto-detect option */}
          {!searchQuery && (
            <div className="p-2 border-b border-gray-700">
              <button
                onClick={handleResetToAuto}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="flex-1 text-left">{t('timezone.autoDetect') || 'Auto-detect from browser'}</span>
                {isAutoDetected && <Check className="h-4 w-4 text-primary-500" />}
              </button>
            </div>
          )}

          {/* Timezone list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {Object.entries(filteredTimezones).map(([region, timezones]) => (
              <div key={region}>
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {region}
                </div>
                {timezones.map((tz) => (
                  <button
                    key={tz.value}
                    onClick={() => handleTimezoneChange(tz.value)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <span className="flex-1 text-left truncate">{tz.label}</span>
                    {timezone === tz.value && !isAutoDetected && (
                      <Check className="h-4 w-4 text-primary-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            {Object.keys(filteredTimezones).length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                {t('timezone.noResults') || 'No timezones found'}
              </div>
            )}
          </div>

          {/* Current timezone info */}
          <div className="p-2 border-t border-gray-700 bg-gray-900/50">
            <div className="text-xs text-gray-500 text-center">
              {t('timezone.current') || 'Current'}: {currentTimezoneInfo.label}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
