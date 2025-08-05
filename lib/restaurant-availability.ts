// lib/restaurant-availability.ts
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export interface RestaurantHours {
  id: string
  restaurant_id: string
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

export interface SpecialHours {
  id: string
  restaurant_id: string
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  reason: string | null
}

export interface Closure {
  id: string
  restaurant_id: string
  start_date: string
  end_date: string
  reason: string
}

export class RestaurantAvailability {
  private supabase = createClient()
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if a restaurant is open at a specific date and time
   */
  async isRestaurantOpen(
    restaurantId: string,
    date: Date,
    time?: string // Format: "HH:mm"
  ): Promise<{
    isOpen: boolean
    reason?: string
    hours?: { open: string; close: string }
  }> {
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayOfWeek = format(date, 'EEEE').toLowerCase()
      const cacheKey = `${restaurantId}-${dateStr}-${time || 'all'}`

      // Check cache
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }

      // Check for closures first
      const { data: closures, error: closureError } = await this.supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .maybeSingle()

      if (closureError && closureError.code !== 'PGRST116') {
        console.error('Error checking closures:', closureError)
        throw new Error('Failed to check restaurant availability')
      }

      if (closures) {
        const result = {
          isOpen: false,
          reason: closures.reason || 'Temporarily closed'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // Check for special hours
      const { data: specialHours, error: specialError } = await this.supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', dateStr)
        .maybeSingle()

      if (specialError && specialError.code !== 'PGRST116') {
        console.error('Error checking special hours:', specialError)
        throw new Error('Failed to check restaurant availability')
      }

      if (specialHours) {
        if (specialHours.is_closed) {
          const result = {
            isOpen: false,
            reason: specialHours.reason || 'Closed for special occasion'
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        // If time is provided, check if it's within special hours
        if (time && specialHours.open_time && specialHours.close_time) {
          const isWithinHours = this.isTimeWithinRange(
            time,
            specialHours.open_time,
            specialHours.close_time
          )
          const result = {
            isOpen: isWithinHours,
            hours: {
              open: specialHours.open_time,
              close: specialHours.close_time
            }
          }
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
          return result
        }

        const result = {
          isOpen: true,
          hours: specialHours.open_time && specialHours.close_time ? {
            open: specialHours.open_time,
            close: specialHours.close_time
          } : undefined
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // Check regular hours
      const { data: regularHours, error: regularError } = await this.supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle()

      if (regularError && regularError.code !== 'PGRST116') {
        console.error('Error checking regular hours:', regularError)
        throw new Error('Failed to check restaurant availability')
      }

      if (!regularHours || !regularHours.is_open) {
        const result = {
          isOpen: false,
          reason: 'Closed today'
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      // If time is provided, check if it's within regular hours
      if (time && regularHours.open_time && regularHours.close_time) {
        const isWithinHours = this.isTimeWithinRange(
          time,
          regularHours.open_time,
          regularHours.close_time
        )
        const result = {
          isOpen: isWithinHours,
          hours: {
            open: regularHours.open_time,
            close: regularHours.close_time
          }
        }
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return result
      }

      const result = {
        isOpen: true,
        hours: regularHours.open_time && regularHours.close_time ? {
          open: regularHours.open_time,
          close: regularHours.close_time
        } : undefined
      }
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (error) {
      console.error('Error in isRestaurantOpen:', error)
      // Fallback to basic availability
      return {
        isOpen: true,
        reason: 'Unable to verify hours'
      }
    }
  }

  /**
   * Clear cache for a specific restaurant
   */
  clearCache(restaurantId?: string) {
    if (restaurantId) {
      // Clear specific restaurant cache
      Array.from(this.cache.keys())
        .filter(key => key.startsWith(restaurantId))
        .forEach(key => this.cache.delete(key))
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  /**
   * Get available time slots for a specific date
   */
  async getAvailableTimeSlots(
    restaurantId: string,
    date: Date,
    partySize: number,
    slotDuration: number = 30 // minutes
  ): Promise<string[]> {
    const availability = await this.isRestaurantOpen(restaurantId, date)
    
    if (!availability.isOpen || !availability.hours) {
      return []
    }

    const slots: string[] = []
    const [openHour, openMin] = availability.hours.open.split(':').map(Number)
    const [closeHour, closeMin] = availability.hours.close.split(':').map(Number)

    const startMinutes = openHour * 60 + openMin
    const endMinutes = closeHour * 60 + closeMin

    // Generate slots
    for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
      const hour = Math.floor(minutes / 60)
      const min = minutes % 60
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      
      // Check if there's enough time before closing for a typical meal
      const mealDuration = 90 // Assume 90 minutes for a meal
      if (minutes + mealDuration <= endMinutes) {
        slots.push(timeStr)
      }
    }

    return slots
  }

  /**
   * Get restaurant hours for a week
   */
  async getWeeklyHours(restaurantId: string): Promise<RestaurantHours[]> {
    const { data, error } = await this.supabase
      .from('restaurant_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week')

    if (error) {
      console.error('Error fetching weekly hours:', error)
      return []
    }

    return data || []
  }

  /**
   * Get upcoming special hours and closures
   */
  async getUpcomingSpecialSchedule(restaurantId: string) {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [specialHours, closures] = await Promise.all([
      this.supabase
        .from('restaurant_special_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', today)
        .order('date', { ascending: true }),
      this.supabase
        .from('restaurant_closures')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
    ])

    return {
      specialHours: specialHours.data || [],
      closures: closures.data || []
    }
  }

  /**
   * Helper function to check if a time is within a range
   */
  private isTimeWithinRange(
    time: string,
    openTime: string,
    closeTime: string
  ): boolean {
    const [hour, minute] = time.split(':').map(Number)
    const [openHour, openMinute] = openTime.split(':').map(Number)
    const [closeHour, closeMinute] = closeTime.split(':').map(Number)

    const currentMinutes = hour * 60 + minute
    const openMinutes = openHour * 60 + openMinute
    const closeMinutes = closeHour * 60 + closeMinute

    // Handle cases where closing time is after midnight
    if (closeMinutes < openMinutes) {
      // Restaurant closes after midnight
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  /**
   * Format hours for display
   */
  formatHoursDisplay(hours: { open: string; close: string }): string {
    const formatTime = (time: string) => {
      const [hour, minute] = time.split(':').map(Number)
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    }

    return `${formatTime(hours.open)} - ${formatTime(hours.close)}`
  }
}