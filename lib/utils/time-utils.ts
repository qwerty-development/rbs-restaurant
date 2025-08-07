// lib/utils/time-utils.ts

import { format, parseISO } from 'date-fns'

/**
 * Parse PostgreSQL tstzrange format and return formatted time range
 * Format: ["2024-08-07 18:00:00+00","2024-08-07 20:00:00+00")
 */
export function formatTimeRange(timeRange: string): string {
  try {
    // Try to match PostgreSQL tstzrange format
    const match = timeRange.match(/\["([^"]+)","([^"]+)"\)/)
    if (match) {
      const startTime = format(parseISO(match[1]), 'HH:mm')
      const endTime = format(parseISO(match[2]), 'HH:mm')
      return `${startTime} - ${endTime}`
    }

    // If no match, try to parse as JSON array
    try {
      const parsed = JSON.parse(timeRange)
      if (Array.isArray(parsed) && parsed.length === 2) {
        const startTime = format(parseISO(parsed[0]), 'HH:mm')
        const endTime = format(parseISO(parsed[1]), 'HH:mm')
        return `${startTime} - ${endTime}`
      }
    } catch {
      // If JSON parsing fails, fall through to return original
    }

    return timeRange
  } catch (error) {
    console.warn('Error parsing time range:', error)
    return timeRange
  }
}

/**
 * Get display name for table type
 */
export function getTableTypeDisplay(tableType: string): string {
  switch (tableType) {
    case 'any':
      return 'Any Table'
    case 'booth':
      return 'Booth'
    case 'window':
      return 'Window'
    case 'patio':
      return 'Patio'
    case 'standard':
      return 'Standard'
    case 'bar':
      return 'Bar'
    case 'private':
      return 'Private Room'
    default:
      return tableType.charAt(0).toUpperCase() + tableType.slice(1)
  }
}

/**
 * Get status badge color classes
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'notified':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'booked':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'expired':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
