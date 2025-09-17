
// app/(basic)/basic-dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, parseISO } from "date-fns"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
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
  Bell
} from "lucide-react"

export default function BasicDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [userId, setUserId] = useState<string>("")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  const notificationContext = useNotifications()
  const { addNotification, requestPushPermission, isPushEnabled } = notificationContext || {}
  
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
    queryKey: ['basic-bookings', restaurantId, selectedDate],
    queryFn: async () => {
      if (!restaurantId) return []
      
      console.log('🔍 Fetching bookings for:', { restaurantId, selectedDate })
      
      const startOfSelectedDay = startOfDay(selectedDate)
      const endOfSelectedDay = endOfDay(selectedDate)

      // First, get ALL pending bookings for this restaurant (regardless of date)
      const { data: pendingBookings, error: pendingError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
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
            email
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pendingError) {
        console.error('❌ Error fetching pending bookings:', pendingError)
      }

      console.log('⏳ Found pending bookings:', pendingBookings?.length || 0)
      
      // Then get date-specific bookings (non-pending)
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
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
            email
          )
        `)
        .eq('restaurant_id', restaurantId)
        .gte('booking_time', startOfSelectedDay.toISOString())
        .lte('booking_time', endOfSelectedDay.toISOString())
        .neq('status', 'pending') // Exclude pending since we already got them
        .order('created_at', { ascending: false })
      
      console.log('📊 Date-specific bookings result:', { data, error, count: data?.length })
      
      if (error) {
        console.error('❌ Error fetching date-specific bookings:', error)
        throw error
      }
      
      // Combine pending bookings with date-specific bookings
      const allBookings = [
        ...(pendingBookings || []),
        ...(data || [])
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
          const guestName = newBooking.guest_name || newBooking.user?.full_name || 'Guest'
        
          addNotification({
            type: 'booking',
            title: 'New Booking Request',
            message: `New booking request from ${guestName} for ${newBooking.party_size} guests`,
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
                  email
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
              ['basic-bookings', restaurantId, selectedDate],
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
            const guestName = updatedBooking.guest_name || updatedBooking.user?.full_name || 'Guest'
          
            
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
                  email
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
              ['basic-bookings', restaurantId, selectedDate],
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
  }, [restaurantId, selectedDate, queryClient, supabase])

  // Analytics query - today's data
  const { data: analytics } = useQuery({
    queryKey: ['basic-analytics', restaurantId, selectedDate],
    queryFn: async () => {
      if (!restaurantId) return null
      
      console.log('📈 Fetching analytics for:', { restaurantId, date: format(selectedDate, 'yyyy-MM-dd') })
      
      const { data, error } = await supabase
        .from('bookings')
        .select('status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startOfDay(selectedDate).toISOString())
        .lte('created_at', endOfDay(selectedDate).toISOString())
      
      if (error) throw error
      
      const total = data.length
      const pending = data.filter(b => b.status === 'pending').length
      const cancelled = data.filter(b => b.status === 'cancelled_by_user').length
      const confirmed = data.filter(b => b.status === 'confirmed').length
      const declined = data.filter(b => b.status === 'declined_by_restaurant').length
      const completed = data.filter(b => b.status === 'completed').length
      
      console.log('📊 Analytics data:', { total, pending, cancelled, confirmed, declined, completed })
      
      return {
        total,
        pending,
        cancelled,
        confirmed,
        declined,
        completed,
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
      toast.success(`Booking ${status === 'confirmed' ? 'accepted' : 'declined'} successfully`)
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
      case 'cancelled_by_user': return 'secondary'
      case 'confirmed': return 'default'
      case 'declined_by_restaurant': return 'destructive'
      case 'completed': return 'default'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="h-4 w-4" />
      case 'cancelled_by_user': return <XCircle className="h-4 w-4 text-gray-500" />
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'declined_by_restaurant': return <XCircle className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'cancelled_by_user': return 'Cancelled by User'
      case 'confirmed': return 'Accepted'
      case 'declined_by_restaurant': return 'Declined'
      case 'completed': return 'Completed'
      default: return status
    }
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
          <p className="text-muted-foreground">
            {(() => {
              const pendingCount = bookings.filter(b => b.status === 'pending').length
              if (pendingCount === 0) return "All caught up! No pending requests."
              if (pendingCount === 1) return "1 request needs your attention"
              return `${pendingCount} requests need your attention`
            })()}
          </p>
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

        {/* Right side container for Date Picker and Status */}
        <div className="flex gap-4 sm:flex-[2]">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-[240px] justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
              />
            </PopoverContent>
          </Popover>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled_by_user">Cancelled by User</SelectItem>
              <SelectItem value="confirmed">Accepted</SelectItem>
              <SelectItem value="declined_by_restaurant">Declined</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
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
                  : `No booking requests for ${format(selectedDate, "MMMM d, yyyy")}`}
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
                        {format(parseISO(booking.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        {(() => {
                          const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
                          const guestName = booking.guest_name || customer?.full_name
                          const guestEmail = booking.guest_email || customer?.email
                          return (
                            <>
                              <h3 className="font-semibold text-lg mb-1">
                                {guestName || 'Unknown Customer'}
                              </h3>
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

                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {booking.status === 'pending' && (
                    <div className="flex flex-col gap-2 ml-6">
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
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}