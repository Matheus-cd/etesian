import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone'

const TIMEZONE_STORAGE_KEY = 'etesian-timezone'

interface TimezoneContextType {
  timezone: string
  setTimezone: (timezone: string) => void
  isAutoDetected: boolean
  resetToAutoDetect: () => void
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined)

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
    if (stored && isValidTimezone(stored)) {
      return stored
    }
    // Fall back to browser timezone
    return getBrowserTimezone()
  })

  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(() => {
    return !localStorage.getItem(TIMEZONE_STORAGE_KEY)
  })

  const setTimezone = useCallback((newTimezone: string) => {
    if (isValidTimezone(newTimezone)) {
      setTimezoneState(newTimezone)
      localStorage.setItem(TIMEZONE_STORAGE_KEY, newTimezone)
      setIsAutoDetected(false)
    }
  }, [])

  const resetToAutoDetect = useCallback(() => {
    const browserTimezone = getBrowserTimezone()
    setTimezoneState(browserTimezone)
    localStorage.removeItem(TIMEZONE_STORAGE_KEY)
    setIsAutoDetected(true)
  }, [])

  // Update timezone if browser timezone changes (e.g., user travels)
  useEffect(() => {
    if (isAutoDetected) {
      const browserTimezone = getBrowserTimezone()
      if (browserTimezone !== timezone) {
        setTimezoneState(browserTimezone)
      }
    }
  }, [isAutoDetected, timezone])

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, isAutoDetected, resetToAutoDetect }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const context = useContext(TimezoneContext)
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider')
  }
  return context
}
