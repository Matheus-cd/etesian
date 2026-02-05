// Timezone utilities for converting between UTC and user's selected timezone

// Common timezones grouped by region
export const TIMEZONE_GROUPS = {
  'America': [
    { value: 'America/New_York', label: 'New York (EST/EDT)', offset: -5 },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)', offset: -6 },
    { value: 'America/Denver', label: 'Denver (MST/MDT)', offset: -7 },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: -8 },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: -3 },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', offset: -3 },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: -6 },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)', offset: -5 },
    { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)', offset: -8 },
  ],
  'Europe': [
    { value: 'Europe/London', label: 'London (GMT/BST)', offset: 0 },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 1 },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: 1 },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', offset: 1 },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)', offset: 1 },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', offset: 1 },
    { value: 'Europe/Lisbon', label: 'Lisbon (WET/WEST)', offset: 0 },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 3 },
  ],
  'Asia': [
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9 },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 8 },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 8 },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 8 },
    { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 9 },
    { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4 },
    { value: 'Asia/Kolkata', label: 'Kolkata (IST)', offset: 5.5 },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 7 },
  ],
  'Pacific': [
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', offset: 12 },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: 10 },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', offset: 10 },
    { value: 'Australia/Perth', label: 'Perth (AWST)', offset: 8 },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HST)', offset: -10 },
  ],
  'Other': [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 0 },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 2 },
    { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 2 },
  ],
} as const

export type TimezoneValue = typeof TIMEZONE_GROUPS[keyof typeof TIMEZONE_GROUPS][number]['value']

// Flat list of all timezones for searching
export const ALL_TIMEZONES = Object.entries(TIMEZONE_GROUPS).flatMap(([region, timezones]) =>
  timezones.map(tz => ({ ...tz, region }))
)

// Get the user's browser timezone
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// Check if a timezone is valid
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

// Format a UTC date string to the user's timezone
// Input: "2026-01-26T11:00" (UTC)
// Output: Date object in the specified timezone
export function parseUTCToTimezone(utcDateString: string, _timezone: string): Date {
  // Add 'Z' to indicate UTC
  // Note: _timezone is available for future use if needed for timezone-specific Date operations
  const utcDate = new Date(utcDateString + 'Z')
  return utcDate
}

// Get the hour in a specific timezone from a UTC date
export function getHourInTimezone(utcDateString: string, timezone: string): number {
  const date = new Date(utcDateString + 'Z')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })
  const hourStr = formatter.format(date)
  return parseInt(hourStr, 10)
}

// Get the date key (YYYY-MM-DD) in a specific timezone from a UTC date
export function getDateKeyInTimezone(utcDateString: string, timezone: string): string {
  const date = new Date(utcDateString + 'Z')
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date) // Returns YYYY-MM-DD format
}

// Format time in a specific timezone
export function formatTimeInTimezone(utcDateString: string, timezone: string): string {
  const date = new Date(utcDateString + 'Z')
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Convert a local date/time in a timezone to UTC string
// When user drops at slot "2026-01-26" hour 11 in "America/Sao_Paulo",
// we need to convert that to UTC (11:00 BRT = 14:00 UTC)
export function localToUTC(dateKey: string, hour: number, timezone: string): string {
  // Create a reference UTC date to get the timezone offset
  // We use the same date at noon UTC to get the correct offset for that day
  const refDate = new Date(`${dateKey}T12:00:00Z`)

  // Get the offset in minutes for the target timezone
  const targetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })

  // Parse the offset from the formatted string
  const parts = targetFormatter.formatToParts(refDate)
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0'

  // Parse offset like "GMT-3" or "GMT+5:30"
  const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  let offsetMinutes = 0
  if (offsetMatch) {
    const sign = offsetMatch[1] === '+' ? 1 : -1
    const hours = parseInt(offsetMatch[2], 10)
    const minutes = parseInt(offsetMatch[3] || '0', 10)
    offsetMinutes = sign * (hours * 60 + minutes)
  }

  // Create the local time as if it were UTC, then adjust by the offset
  // Example: 11:00 in UTC-3 -> we need 14:00 UTC
  // localAsUTC = 11:00 UTC (wrong, but we'll adjust)
  // UTC = localAsUTC - offset = 11:00 - (-180min) = 11:00 + 3h = 14:00 UTC ✓
  const localAsUTC = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00Z`)
  const utcMs = localAsUTC.getTime() - offsetMinutes * 60 * 1000
  const utcDate = new Date(utcMs)

  // Format as YYYY-MM-DDTHH:mm
  const year = utcDate.getUTCFullYear()
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utcDate.getUTCDate()).padStart(2, '0')
  const hours = String(utcDate.getUTCHours()).padStart(2, '0')
  const mins = String(utcDate.getUTCMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${mins}`
}

// Get current time formatted in a timezone
export function getCurrentTimeInTimezone(timezone: string): string {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Get the timezone display name with current offset
export function getTimezoneDisplayName(timezone: string): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(now)
  const offset = parts.find(p => p.type === 'timeZoneName')?.value || ''

  // Find the label from our list
  const tz = ALL_TIMEZONES.find(t => t.value === timezone)
  if (tz) {
    return `${tz.label} (${offset})`
  }

  return `${timezone} (${offset})`
}
