
// app/(basic)/basic-dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, parseISO, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MultiDayCalendar } from "@/components/ui/multi-day-calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getFirstName } from "@/lib/utils"
import { useNotifications } from "@/lib/contexts/notification-context"
import { PushNotificationPermission } from "@/components/notifications/push-notification-permission"
import {
  Calendar as CalendarIcon,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Users,
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Bell,
  Star,
  MoreHorizontal,
  Gift
} from "lucide-react"

export default function BasicDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()])
  const [dateViewMode, setDateViewMode] = useState<"today" | "select" | "week" | "month" | "all">("today")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [userId, setUserId] = useState<string>("")

  // Debug logging for date changes
  useEffect(() => {
    console.log('📅 Date mode changed:', {
      dateViewMode,
      selectedDate: format(selectedDate, 'yyyy-MM-dd'),
      selectedDates: selectedDates.map(d => format(d, 'yyyy-MM-dd'))
    })
  }, [dateViewMode, selectedDate, selectedDates])

  // Get date range based on view mode
  const getEffectiveDates = () => {
    switch (dateViewMode) {
      case 'today':
        return [new Date()]
      case 'select':
        return selectedDates
      case 'week': {
        const today = new Date()
        const startOfWeek = startOfDay(today)
        startOfWeek.setDate(today.getDate() - today.getDay()) // Start from Sunday
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6) // End on Saturday

        const weekDates = []
        for (let date = new Date(startOfWeek); date <= endOfWeek; date.setDate(date.getDate() + 1)) {
          weekDates.push(new Date(date))
        }
        return weekDates
      }
      case 'month': {
        const today = new Date()
        const monthStart = startOfMonth(today)
        const monthEnd = endOfMonth(today)

        const monthDates = []
        for (let date = new Date(monthStart); date <= monthEnd; date.setDate(date.getDate() + 1)) {
          monthDates.push(new Date(date))
        }
        return monthDates
      }
      case 'all':
        return null // null means all dates from today onward
      default:
        return [new Date()]
    }
  }
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  const notificationContext = useNotifications()
  const { addNotification, requestPushPermission, isPushEnabled } = notificationContext || {}
  
  // Resolve guest first name: prefer explicit guest_name, else lookup profile by user_id
  const resolveGuestFirstName = async (booking: any): Promise<string> => {
    const explicit = booking?.guest_name?.trim()
    if (explicit) return getFirstName(explicit)
    const userId = booking?.user_id
    if (userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single()
        if (!error && data?.full_name) {
          return getFirstName(data.full_name)
        }
      } catch {}
    }
    return 'Guest'
  }
  
  // Debug logging
 
  // Get user info
  useEffect(() => {
    async function getUserInfo() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserInfo()
  }, [supabase])

  // Fetch bookings - combines date-specific bookings with ALL pending requests
  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ['basic-bookings', restaurantId, dateViewMode, selectedDates],
    queryFn: async () => {
      if (!restaurantId) return []

      // Get effective dates based on current mode
      const effectiveDates = getEffectiveDates()

      console.log('🔍 Fetching bookings for:', { restaurantId, effectiveDates, mode: dateViewMode })

      // Always get ALL pending bookings first (regardless of dates)
      const { data: pendingBookings, error: pendingError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
          preferred_section,
          occasion,
          dietary_notes,
          guest_name,
          guest_email,
          created_at,
          user_id,
          applied_offer_id,
          special_offers!bookings_applied_offer_id_fkey (
            id,
            title,
            description,
            discount_percentage
          ),
          profiles!bookings_user_id_fkey (
            id,
            full_name,
            phone_number,
            email,
            user_rating
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pendingError) {
        console.error('❌ Error fetching pending bookings:', pendingError)
      }

      console.log('⏳ Found pending bookings:', pendingBookings?.length || 0)

      // Then get date-specific bookings
      const dateBookings = []

      if (dateViewMode === 'all') {
        // For "all dates" mode, get all bookings from today onward
        const today = startOfDay(new Date())

        const { data: allBookings, error } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_time,
            party_size,
            status,
            special_requests,
            preferred_section,
            occasion,
            dietary_notes,
            guest_name,
            guest_email,
            created_at,
            user_id,
            applied_offer_id,
            special_offers!bookings_applied_offer_id_fkey (
              id,
              title,
              description,
              discount_percentage
            ),
            profiles!bookings_user_id_fkey (
              id,
              full_name,
              phone_number,
              email,
              user_rating
            )
          `)
          .eq('restaurant_id', restaurantId)
          .gte('booking_time', today.toISOString())
          .neq('status', 'pending') // Exclude pending since we already got them
          .order('booking_time', { ascending: true }) // Sort by booking time for all dates view

        if (error) {
          console.error('❌ Error fetching all bookings from today onward:', error)
        } else {
          dateBookings.push(...(allBookings || []))
        }

        console.log('📊 All dates bookings result:', { count: dateBookings.length, fromDate: today.toISOString() })
      } else if (effectiveDates) {
        // For specific date modes (today, select, week, month)
        for (const date of (effectiveDates || [])) {
          const startOfSelectedDay = startOfDay(date)
          const endOfSelectedDay = endOfDay(date)

          const { data: dayBookings, error } = await supabase
            .from('bookings')
            .select(`
              id,
              booking_time,
              party_size,
              status,
              special_requests,
              preferred_section,
              occasion,
              dietary_notes,
              guest_name,
              guest_email,
              created_at,
              user_id,
              applied_offer_id,
              special_offers!bookings_applied_offer_id_fkey (
                id,
                title,
                description,
                discount_percentage
              ),
              profiles!bookings_user_id_fkey (
                id,
                full_name,
                phone_number,
                email,
                user_rating
              )
            `)
            .eq('restaurant_id', restaurantId)
            .gte('booking_time', startOfSelectedDay.toISOString())
            .lte('booking_time', endOfSelectedDay.toISOString())
            .neq('status', 'pending') // Exclude pending since we already got them
            .order('created_at', { ascending: false })

          if (error) {
            console.error('❌ Error fetching date-specific bookings for', date, ':', error)
          } else {
            dateBookings.push(...(dayBookings || []))
          }
        }

        console.log('📊 Date-specific bookings result:', { count: dateBookings.length, dates: effectiveDates.length, mode: dateViewMode })
      }

      // Combine pending bookings with date-specific bookings
      const allBookings = [
        ...(pendingBookings || []),
        ...dateBookings
      ]
      
      // Remove duplicates (in case a pending booking is also in the date range)
      const uniqueBookings = allBookings.filter((booking, index, self) => 
        index === self.findIndex(b => b.id === booking.id)
      )
      
      // Sort: pending first, then by creation date (newest first)
      uniqueBookings.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      console.log('📋 Final bookings list:', {
        total: uniqueBookings.length,
        pending: uniqueBookings.filter(b => b.status === 'pending').length,
        confirmed: uniqueBookings.filter(b => b.status === 'confirmed').length,
        declined: uniqueBookings.filter(b => b.status === 'declined_by_restaurant').length
      })
      
      return uniqueBookings
    },
    enabled: !!restaurantId,
  })

  // Real-time subscription for immediate updates
  useEffect(() => {
    if (!restaurantId) return

    console.log('🔗 Setting up real-time subscription for basic dashboard')
    
    const channel = supabase
      .channel(`basic-dashboard-bookings:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          console.log('📥 New booking INSERT received in basic dashboard:', payload)
          const newBooking = payload.new
          if (!newBooking) return
          
          // Trigger notification for new booking
          const guestName = await resolveGuestFirstName(newBooking)
        
          addNotification({
            type: 'booking',
            title: 'New Booking Request',
            message: `New booking from ${guestName} for ${newBooking.party_size} guests`,
            data: newBooking
          })
          
          // Fetch the complete booking data with profiles
          try {
            const { data: completeBooking, error } = await supabase
              .from('bookings')
              .select(`
                id,
                booking_time,
                party_size,
                status,
                special_requests,
                preferred_section,
                occasion,
                dietary_notes,
                      guest_name,
                guest_email,
                created_at,
                user_id,
                profiles!bookings_user_id_fkey (
                  id,
                  full_name,
                  phone_number,
                  email,
                  user_rating
                )
              `)
              .eq('id', newBooking.id)
              .single()
            
            if (error) {
              console.error('Error fetching complete booking data:', error)
              return
            }
            
            // Update query cache with complete data
            queryClient.setQueryData(
              ['basic-bookings', restaurantId, dateViewMode, selectedDates],
              (oldData: any[] | undefined) => {
                if (!oldData) return [completeBooking]
                
                // Check if booking already exists (avoid duplicates)
                const exists = oldData.some(b => b.id === completeBooking.id)
                if (exists) return oldData
                
                // Add new booking at the beginning and sort
                const updated = [completeBooking, ...oldData]
                return updated.sort((a, b) => {
                  if (a.status === 'pending' && b.status !== 'pending') return -1
                  if (a.status !== 'pending' && b.status === 'pending') return 1
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
              }
            )
          } catch (error) {
            console.error('Error processing new booking:', error)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          console.log('📝 Booking UPDATE received in basic dashboard:', payload)
          const updatedBooking = payload.new
          const previousBooking = payload.old
          if (!updatedBooking) return
          
          // Trigger notification for status changes
          if (previousBooking && previousBooking.status !== updatedBooking.status) {
            const guestName = await resolveGuestFirstName(updatedBooking)
          
            
            const statusMap: Record<string, { title: string; message: string; variant?: 'success' | 'error' }> = {
              confirmed: { title: 'Booking Confirmed', message: `Booking for ${guestName} confirmed`, variant: 'success' },
              declined_by_restaurant: { title: 'Booking Declined', message: `Booking for ${guestName} declined`, variant: 'error' },
              cancelled_by_user: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by customer`, variant: 'error' },
              cancelled_by_restaurant: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by restaurant`, variant: 'error' },
              arrived: { title: 'Guest Arrived', message: `${guestName} has checked in` },
              seated: { title: 'Guest Seated', message: `${guestName} has been seated` },
              completed: { title: 'Booking Completed', message: `${guestName}'s booking completed` },
              no_show: { title: 'No-show', message: `${guestName} marked as no-show` }
            }

            const statusInfo = statusMap[updatedBooking.status as string]
            if (statusInfo) {
              addNotification({
                type: 'booking',
                title: statusInfo.title,
                message: statusInfo.message,
                data: updatedBooking,
                variant: statusInfo.variant
              })
            }
          }
          
          // Fetch the complete booking data with profiles
          try {
            const { data: completeBooking, error } = await supabase
              .from('bookings')
              .select(`
                id,
                booking_time,
                party_size,
                status,
                special_requests,
                preferred_section,
                occasion,
                dietary_notes,
                      guest_name,
                guest_email,
                created_at,
                user_id,
                profiles!bookings_user_id_fkey (
                  id,
                  full_name,
                  phone_number,
                  email,
                  user_rating
                )
              `)
              .eq('id', updatedBooking.id)
              .single()
            
            if (error) {
              console.error('Error fetching complete booking data for update:', error)
              return
            }
            
            // Update query cache with complete data
            queryClient.setQueryData(
              ['basic-bookings', restaurantId, dateViewMode, selectedDates],
              (oldData: any[] | undefined) => {
                if (!oldData) return [completeBooking]
                
                return oldData.map(booking =>
                  booking.id === completeBooking.id ? completeBooking : booking
                ).sort((a, b) => {
                  if (a.status === 'pending' && b.status !== 'pending') return -1
                  if (a.status !== 'pending' && b.status === 'pending') return 1
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
              }
            )
          } catch (error) {
            console.error('Error processing booking update:', error)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('🔌 Cleaning up basic dashboard subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, selectedDate, selectedDates, dateViewMode, queryClient, supabase])

  // Analytics query - for selected date(s)
  const { data: analytics } = useQuery({
    queryKey: ['basic-analytics', restaurantId, dateViewMode, selectedDates],
    queryFn: async () => {
      if (!restaurantId) return null

      const effectiveDates = getEffectiveDates()

      console.log('📈 Fetching analytics for:', { restaurantId, effectiveDates, mode: dateViewMode })

      // Get analytics data
      const allAnalyticsData = []

      if (dateViewMode === 'all') {
        // For "all dates" mode, get all bookings from today onward
        const today = startOfDay(new Date())

        const { data, error } = await supabase
          .from('bookings')
          .select('status, created_at, booking_time')
          .eq('restaurant_id', restaurantId)
          .gte('booking_time', today.toISOString())

        if (error) {
          console.error('❌ Error fetching analytics for all dates:', error)
        } else {
          allAnalyticsData.push(...(data || []))
        }
      } else if (effectiveDates) {
        // For specific date modes (today, select, week, month)
        for (const date of effectiveDates) {
          const { data, error } = await supabase
            .from('bookings')
            .select('status, created_at, booking_time')
            .eq('restaurant_id', restaurantId)
            .gte('booking_time', startOfDay(date).toISOString())
            .lte('booking_time', endOfDay(date).toISOString())

          if (error) {
            console.error('❌ Error fetching analytics for', date, ':', error)
          } else {
            allAnalyticsData.push(...(data || []))
          }
        }
      }

      // Also get all pending bookings for the analytics (they don't have specific dates)
      const { data: pendingData, error: pendingError } = await supabase
        .from('bookings')
        .select('status, created_at, booking_time')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')

      if (!pendingError && pendingData) {
        allAnalyticsData.push(...pendingData)
      }

      const total = allAnalyticsData.length
      const pending = allAnalyticsData.filter(b => b.status === 'pending').length
      const cancelled = allAnalyticsData.filter(b => b.status === 'cancelled_by_user').length
      const confirmed = allAnalyticsData.filter(b => b.status === 'confirmed').length
      const declined = allAnalyticsData.filter(b => b.status === 'declined_by_restaurant').length
      const completed = allAnalyticsData.filter(b => b.status === 'completed').length
      const noShow = allAnalyticsData.filter(b => b.status === 'no_show').length
      const cancelledByRestaurant = allAnalyticsData.filter(b => b.status === 'cancelled_by_restaurant').length

        console.log('📊 Analytics data:', {
        total, pending, cancelled, confirmed, declined, completed, noShow, cancelledByRestaurant,
        dateCount: (effectiveDates || []).length
      })

      return {
        total,
        pending,
        cancelled,
        confirmed,
        declined,
        completed,
        noShow,
        cancelledByRestaurant,
        acceptanceRate: (confirmed + declined) > 0 ? Math.round((confirmed / (confirmed + declined)) * 100) : 0,
        rejectionRate: (confirmed + declined) > 0 ? Math.round((declined / (confirmed + declined)) * 100) : 0
      }
    },
    enabled: !!restaurantId
  })

  // Update booking status using Basic tier API
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string, status: string }) => {
      console.log('🔄 Updating booking:', { bookingId, status })
      
      const response = await fetch('/api/basic-booking-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, status })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update booking')
      }

      return response.json()
    },
    onSuccess: (data, { status }) => {
      console.log('✅ Booking updated successfully:', data)
      toast.success(`Booking ${status === 'confirmed' ? 'accepted' : formatStatus(status)} successfully`)
      queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['basic-analytics'] })
    },
    onError: (error: any) => {
      console.error('❌ Error updating booking:', error)
      toast.error(`Failed to update booking: ${error.message}`)
    }
  })

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    // Handle profiles field which might be an object or array
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    const matchesSearch = searchQuery === "" || 
      customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.phone_number?.includes(searchQuery)
    
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'outline'
      case 'cancelled_by_user':
      case 'cancelled_by_restaurant':
      case 'no_show': return 'destructive'
      case 'confirmed': return 'default'
      case 'declined_by_restaurant': return 'destructive'
      case 'completed': return 'default'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="h-4 w-4" />
      case 'cancelled_by_user':
      case 'cancelled_by_restaurant': return <XCircle className="h-4 w-4 text-gray-500" />
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'declined_by_restaurant': return <XCircle className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'no_show': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'cancelled_by_user': return 'Cancelled by Customer'
      case 'cancelled_by_restaurant': return 'Cancelled by Restaurant'
      case 'confirmed': return 'Accepted'
      case 'declined_by_restaurant': return 'Declined'
      case 'completed': return 'Completed'
      case 'no_show': return 'No Show'
      default: return status
    }
  }
  // Global ticking timestamp to compute elapsed times without per-item hooks
  const [nowTs, setNowTs] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const formatElapsed = (isoDate?: string, nowMillis?: number) => {
    if (!isoDate) return ''
    const start = new Date(isoDate).getTime()
    const reference = nowMillis ?? Date.now()
    const diffMs = Math.max(0, reference - start)
    const totalSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const handleAccept = (booking: any) => {
    updateBookingMutation.mutate({
      bookingId: booking.id,
      status: 'confirmed'
    })
  }

  const handleDecline = (booking: any) => {
    updateBookingMutation.mutate({
      bookingId: booking.id,
      status: 'declined_by_restaurant'
    })
  }

  const handleStatusChange = (booking: any, newStatus: string) => {
    updateBookingMutation.mutate({
      bookingId: booking.id,
      status: newStatus
    })
  }

  // Rating display component
  const CustomerRating = ({ rating }: { rating?: number }) => {
    if (!rating || rating === 5.0) return null

    return (
      <div className="flex items-center gap-1 text-xs">
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        <span className={cn(
          "font-medium",
          rating < 3 ? "text-red-600" : rating < 4 ? "text-yellow-600" : "text-gray-600"
        )}>
          {rating.toFixed(1)}
        </span>
      </div>
    )
  }

  // Show loading while context is loading or no restaurant selected
  if (contextLoading || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Booking Requests</h1>
          <div className="space-y-1">
            <p className="text-muted-foreground">
              {(() => {
                const pendingCount = bookings.filter(b => b.status === 'pending').length
                if (pendingCount === 0) return "All caught up! No pending requests."
                if (pendingCount === 1) return "1 request needs your attention"
                return `${pendingCount} requests need your attention`
              })()}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateViewMode === 'today'
                ? `Viewing today (${format(new Date(), "MMMM d, yyyy")})`
                : dateViewMode === 'select'
                  ? `Viewing ${selectedDates.length} selected dates`
                  : dateViewMode === 'week'
                    ? `Viewing this week (${format(new Date(), "MMM d")} - ${format(new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000), "MMM d")})`
                    : dateViewMode === 'month'
                      ? `Viewing this month (${format(new Date(), "MMMM yyyy")})`
                      : `Viewing all bookings from ${format(new Date(), "MMMM d, yyyy")} onward`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          
        </div>
      </div>

      {/* Push Notification Permission */}
      <PushNotificationPermission />

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className={cn(
            "transition-all duration-300",
            analytics.pending > 0 && "ring-2 ring-orange-200 bg-orange-50/30"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className={cn(
                    "text-2xl font-bold text-orange-600",
                    analytics.pending > 0 && "animate-pulse"
                  )}>
                    {analytics.pending}
                  </p>
                </div>
                <AlertCircle className={cn(
                  "h-8 w-8 text-orange-600",
                  analytics.pending > 0 && "animate-pulse"
                )} />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold text-gray-600">{analytics.cancelled}</p>
                </div>
                <XCircle className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.confirmed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Declined</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.declined}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-blue-600">{analytics.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search - takes 1/2 width */}
        <div className="relative flex-1 sm:flex-[2]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateViewMode === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateViewMode('today')}
          >
            Today
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateViewMode === 'select' ? 'default' : 'outline'}
                size="sm"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Select Dates
                {dateViewMode === 'select' && selectedDates.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5">
                    {selectedDates.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3">
                <div className="mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateViewMode('select')
                      if (selectedDates.length === 0) {
                        setSelectedDates([new Date()])
                      }
                    }}
                    className="w-full mb-2"
                  >
                    Use Selected Dates
                  </Button>
                </div>
                <MultiDayCalendar
                  selectedDates={selectedDates}
                  onDatesChange={setSelectedDates}
                  placeholder="Select multiple dates"
                  className="w-[280px]"
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={dateViewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateViewMode('week')}
          >
            This Week
          </Button>

          <Button
            variant={dateViewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateViewMode('month')}
          >
            This Month
          </Button>

          <Button
            variant={dateViewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateViewMode('all')}
          >
            All Dates
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Status:</span>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Accepted</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled_by_user">Cancelled by Customer</SelectItem>
              <SelectItem value="cancelled_by_restaurant">Cancelled by Restaurant</SelectItem>
              <SelectItem value="declined_by_restaurant">Declined</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading bookings...</span>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : dateViewMode === 'today'
                    ? `No booking requests for today`
                    : dateViewMode === 'select'
                      ? `No booking requests for the selected ${selectedDates.length} dates`
                      : dateViewMode === 'week'
                        ? `No booking requests for this week`
                        : dateViewMode === 'month'
                          ? `No booking requests for this month`
                          : `No booking requests from ${format(new Date(), "MMMM d, yyyy")} onward`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBookings.map((booking) => (
            <Card 
              key={booking.id} 
              className={cn(
                "hover:shadow-md transition-shadow",
                booking.status === 'pending' && "border-orange-200 bg-orange-50/50"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant={getStatusBadgeVariant(booking.status)} className="gap-1">
                        {getStatusIcon(booking.status)}
                        {formatStatus(booking.status)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {(dateViewMode === 'all' || dateViewMode === 'week' || dateViewMode === 'month')
                          ? `Created: ${format(parseISO(booking.created_at), "MMM d, h:mm a")}`
                          : format(parseISO(booking.created_at), "MMM d, h:mm a")}
                      </span>
                      {booking.status === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          {`Elapsed: ${formatElapsed(booking.created_at, nowTs)}`}
                        </Badge>
                      )}
                      {(dateViewMode === 'all' || dateViewMode === 'week' || dateViewMode === 'month' || dateViewMode === 'select') && (
                        <Badge variant="secondary" className="text-xs">
                          For {format(parseISO(booking.booking_time), "MMM d")}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        {(() => {
                          const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
                          const guestName = booking.guest_name || customer?.full_name
                          const guestEmail = booking.guest_email || customer?.email
                          return (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">
                                  {guestName || 'Unknown Customer'}
                                </h3>
                                <CustomerRating rating={customer?.user_rating} />
                              </div>
                              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                {customer?.phone_number && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {customer.phone_number}
                                  </div>
                                )}
                                {guestEmail && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {guestEmail}
                                  </div>
                                )}
                              </div>
                            </>
                          )
                        })()}
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Booking Details</p>
                        <p className="font-medium">
                          {format(parseISO(booking.booking_time), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {booking.party_size} guests
                        </div>
                        {booking.preferred_section && (
                          <div className="flex items-center gap-1 text-sm mt-1">
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                              style={{
                                backgroundColor: '#f1f5f9',
                                color: '#1e293b'
                              }}
                            >
                              {booking.preferred_section}
                            </Badge>
                          </div>
                        )}
                        {booking.occasion && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Occasion</p>
                            <p className="text-sm font-medium">{booking.occasion}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        {booking.special_requests && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Special Requests</p>
                            <div className="flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                              <p className="text-sm line-clamp-2">{booking.special_requests}</p>
                            </div>
                          </div>
                        )}

                        {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Dietary Notes</p>
                            <div className="flex flex-wrap gap-1">
                              {booking.dietary_notes.map((note: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {note}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {booking.special_offers && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Applied Offer</p>
                            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <Gift className="h-4 w-4 mt-0.5 text-green-600" />
                              <div>
                                <p className="text-sm font-medium text-green-800">{booking.special_offers.title}</p>
                                {booking.special_offers.description && (
                                  <p className="text-xs text-green-700 mt-1">{booking.special_offers.description}</p>
                                )}
                                {booking.special_offers.discount_percentage && (
                                  <Badge variant="secondary" className="mt-1 bg-green-100 text-green-800 text-xs">
                                    {booking.special_offers.discount_percentage}% OFF
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 ml-6">
                    {booking.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(booking)}
                          disabled={updateBookingMutation.isPending}
                          className="min-w-[80px]"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDecline(booking)}
                          disabled={updateBookingMutation.isPending}
                          className="min-w-[80px]"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </>
                    )}

                    {booking.status === 'confirmed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(booking, 'completed')}
                          disabled={updateBookingMutation.isPending}
                          className="min-w-[80px]"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Complete
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateBookingMutation.isPending}
                              className="min-w-[80px]"
                            >
                              <MoreHorizontal className="h-4 w-4 mr-1" />
                              More
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking, 'no_show')}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Mark No Show
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(booking, 'cancelled_by_restaurant')}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}