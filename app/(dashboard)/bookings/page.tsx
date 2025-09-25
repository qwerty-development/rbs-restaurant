"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addDays, addMinutes, differenceInMinutes } from "date-fns"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BookingList } from "@/components/bookings/booking-list"
import { BookingDetails } from "@/components/bookings/booking-details"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { MinimumCapacityWarningDialog } from "@/components/bookings/minimum-capacity-warning-dialog"
import { SharedTablesOverview } from "@/components/shared-tables"
import { TableAvailabilityService } from "@/lib/table-availability"
import { BookingRequestService } from "@/lib/booking-request-service"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import {
  CalendarIcon,
  Table2,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Timer,
  Zap,
  TrendingUp,
  Clock
} from "lucide-react"
import type { Booking } from "@/types"

// Import our new components
import { useBookingsState } from "./hooks/useBookingsState"
import { useBookingsActions } from "./hooks/useBookingsActions"
import { BookingsHeader } from "./components/BookingsHeader"
import { AlertCenter } from "./components/AlertCenter"
import { QuickStats } from "./components/QuickStats"
import { BookingsFilter } from "./components/BookingsFilter"

export default function BookingsPage() {
  const router = useRouter()
  const { currentRestaurant, tier, isLoading: contextLoading } = useRestaurantContext()
  const now = useMemo(() => new Date(), [])

  // State management using our custom hooks
  const { state, actions, dateHelpers, hasFiltersApplied, hasSelections } = useBookingsState()

  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = useMemo(() => new TableAvailabilityService(), [])
  const requestService = useMemo(() => new BookingRequestService(), [])

  // Get restaurant and user IDs
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [lastExpiredCheck, setLastExpiredCheck] = useState<Date>(new Date())

  // Minimum capacity warning dialog state
  const [showMinimumCapacityWarning, setShowMinimumCapacityWarning] = useState(false)
  const [pendingAssignment, setPendingAssignment] = useState<{
    bookingId: string
    tableIds: string[]
    booking: any
    violatingTables: any[]
  } | null>(null)

  // Table assignment states
  const [availableTablesForAssignment, setAvailableTablesForAssignment] = useState<any[]>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  // Initialize booking actions hook
  const bookingActions = useBookingsActions({ restaurantId, userId })

  // Get user ID on mount
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserId()
  }, [supabase])

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch all bookings
  const { data: allBookings, isLoading: allBookingsLoading } = useQuery({
    queryKey: ["all-bookings", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          special_offers!bookings_applied_offer_id_fkey(
            id,
            title,
            description,
            discount_percentage
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("booking_time", { ascending: true })

      if (error) {
        console.error("Error fetching all bookings:", error)
        throw error
      }

      const transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Real-time subscription for bookings
  useEffect(() => {
    if (!restaurantId) return

    console.log('🔗 Setting up real-time subscription for bookings')

    const channel = supabase
      .channel(`bookings:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('📥 Booking change received:', payload)
          queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
          queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
        }
      )
      .subscribe()

    return () => {
      console.log('🔌 Cleaning up bookings subscription')
      supabase.removeChannel(channel)
    }
  }, [restaurantId, queryClient, supabase])

  // Fetch displayed bookings based on current view and filters
  const { data: displayedBookings, isLoading } = useQuery({
    queryKey: ["displayed-bookings", restaurantId, state.viewMode, state.selectedDate, state.statusFilter, state.timeFilter, state.dateRange],
    queryFn: async () => {
      if (!restaurantId) return []

      let query = supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number
          ),
          booking_tables(
            table:restaurant_tables(*)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("booking_time", { ascending: true })

      // Apply filters based on view mode
      if (state.viewMode === "today") {
        const today = startOfDay(now)
        const endToday = endOfDay(now)
        query = query
          .gte("booking_time", today.toISOString())
          .lte("booking_time", endToday.toISOString())
          .gte("booking_time", now.toISOString()) // Only future bookings for today view
      } else if (state.viewMode === "management") {
        // Apply date range filters for management view
        if (state.dateRange !== "all") {
          let startDate: Date, endDate: Date

          if (state.dateRange === "today") {
            startDate = startOfDay(now)
            endDate = endOfDay(now)
          } else if (state.dateRange === "tomorrow") {
            startDate = startOfDay(addDays(now, 1))
            endDate = endOfDay(addDays(now, 1))
          } else if (state.dateRange === "week") {
            startDate = startOfDay(now)
            endDate = endOfDay(addDays(now, 7))
          } else if (state.dateRange === "custom") {
            startDate = startOfDay(state.selectedDate)
            endDate = endOfDay(state.selectedDate)
          } else {
            startDate = startOfDay(now)
            endDate = endOfDay(now)
          }

          query = query
            .gte("booking_time", startDate.toISOString())
            .lte("booking_time", endDate.toISOString())
        }
      } else if (state.viewMode === "tables") {
        // Tables view shows selected date
        const dayStart = startOfDay(state.selectedDate)
        const dayEnd = endOfDay(state.selectedDate)
        query = query
          .gte("booking_time", dayStart.toISOString())
          .lte("booking_time", dayEnd.toISOString())
      }

      // Apply status filter
      if (state.statusFilter === "upcoming") {
        query = query.in("status", ["pending", "confirmed"])
      } else if (state.statusFilter === "cancelled_by_user") {
        query = query.in("status", ["cancelled_by_user", "declined_by_restaurant"])
      } else if (state.statusFilter !== "all") {
        query = query.eq("status", state.statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching displayed bookings:", error)
        throw error
      }

      // Transform and filter data
      let transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]

      // Apply time filter
      if (state.timeFilter !== "all" && transformedData) {
        transformedData = transformedData.filter(booking => {
          const hour = new Date(booking.booking_time).getHours()
          if (state.timeFilter === "lunch") return hour >= 11 && hour < 15
          if (state.timeFilter === "dinner") return hour >= 17 && hour < 23
          return true
        })
      }

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Fetch table stats
  const { data: tableStats } = useQuery({
    queryKey: ["table-stats", restaurantId, state.selectedDate],
    queryFn: async () => {
      if (!restaurantId) return null

      const dayStart = startOfDay(state.selectedDate)
      const dayEnd = endOfDay(state.selectedDate)

      // Get total tables
      const { data: tables } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      // Get occupied table slots for the day
      const { data: occupiedSlots } = await supabase
        .from("bookings")
        .select(`
          booking_time,
          turn_time_minutes,
          booking_tables(table_id)
        `)
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", dayStart.toISOString())
        .lte("booking_time", dayEnd.toISOString())
        .neq("status", "cancelled_by_user")
        .neq("status", "declined_by_restaurant")

      const totalTables = tables?.length || 0
      const totalSlots = totalTables * 12 // 12 hours of operation
      const occupiedCount = occupiedSlots?.reduce((acc, booking) => {
        const slots = Math.ceil((booking.turn_time_minutes || 120) / 60)
        return acc + (booking.booking_tables?.length || 0) * slots
      }, 0) || 0

      const utilization = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0

      return {
        totalTables,
        utilization,
        peakHour: getPeakHour(occupiedSlots || [])
      }
    },
    enabled: !!restaurantId
  })

  // Helper function to get peak hour
  function getPeakHour(bookings: any[]): string {
    const hourCounts: Record<number, number> = {}

    bookings.forEach(booking => {
      const hour = new Date(booking.booking_time).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) =>
      count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 0, count: 0 }
    )

    return peakHour.count > 0 ? `${peakHour.hour}:00` : "N/A"
  }

  // Auto-refresh with expired request cleanup
  useEffect(() => {
    if (!state.autoRefresh) return

    const interval = setInterval(async () => {
      // Check for expired requests periodically
      const now = new Date()
      const timeSinceLastExpiredCheck = now.getTime() - lastExpiredCheck.getTime()

      if (timeSinceLastExpiredCheck > 60000) { // Every minute
        await bookingActions.handleExpiredRequests()
        setLastExpiredCheck(new Date())
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      actions.updateLastRefresh()
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [state.autoRefresh, queryClient, bookingActions, lastExpiredCheck, actions])

  // Initial expired request check
  useEffect(() => {
    if (restaurantId && userId) {
      bookingActions.handleExpiredRequests()
    }
  }, [restaurantId, userId, bookingActions])

  // Filter bookings based on search
  const filteredBookings = displayedBookings?.filter((booking) => {
    if (!state.searchQuery) return true

    const searchLower = state.searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || booking.user?.phone_number?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => `${t.table_number.toLowerCase()} t${t.table_number.toLowerCase()}`).join(" ") || ""

    return (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower) ||
      tableNumbers.includes(searchLower)
    )
  })

  // Calculate booking statistics
  const bookingStats = useMemo(() => {
    if (!allBookings) return {
      all: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0,
      withoutTables: 0, upcoming: 0, avgPartySize: 0, totalGuests: 0, revenue: 0, needingAttention: 0
    }

    return {
      all: allBookings.length,
      pending: allBookings.filter((b: any) => b.status === "pending").length,
      confirmed: allBookings.filter((b: any) => b.status === "confirmed").length,
      completed: allBookings.filter((b: any) => b.status === "completed").length,
      cancelled: allBookings.filter((b: any) =>
        b.status === "cancelled_by_user" || b.status === "declined_by_restaurant"
      ).length,
      no_show: allBookings.filter((b: any) => b.status === "no_show").length,
      withoutTables: allBookings.filter((b: any) =>
        b.status === "confirmed" && (!b.tables || b.tables.length === 0)
      ).length,
      upcoming: allBookings.filter((b: any) =>
        (b.status === "pending" || b.status === "confirmed") &&
        new Date(b.booking_time) > now
      ).length,
      avgPartySize: allBookings.length ?
        Math.round((allBookings.reduce((acc: number, b: any) => acc + b.party_size, 0) / allBookings.length) * 10) / 10 : 0,
      totalGuests: allBookings.filter((b: any) => b.status === "confirmed" || b.status === "completed")
        .reduce((acc: number, b: any) => acc + b.party_size, 0),
      revenue: (allBookings.filter((b: any) => b.status === "completed").length) * 45,
      needingAttention: allBookings.filter((b: any) => {
        const isUrgentPending = b.status === "pending" && new Date(b.booking_time).getTime() - now.getTime() < 3600000
        const isConfirmedWithoutTable = b.status === "confirmed" && (!b.tables || b.tables.length === 0)
        return b.status === "pending" || isConfirmedWithoutTable || isUrgentPending
      }).length
    }
  }, [allBookings, now])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            bookingActions.handleRefresh()
            actions.updateLastRefresh()
          }
          break
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            actions.toggleManualBooking()
          }
          break
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            actions.toggleAnalytics()
          }
          break
        case '1':
          e.preventDefault()
          actions.setViewMode("today")
          break
        case '2':
          e.preventDefault()
          actions.setViewMode("management")
          break
        case '3':
          e.preventDefault()
          actions.setViewMode("tables")
          break
        case 'Escape':
          actions.clearSelections()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, bookingActions])

  // Handle stat clicks for navigation
  const handleStatClick = useCallback((statType: string) => {
    switch (statType) {
      case "today":
        actions.setViewMode("today")
        break
      case "attention":
        actions.setViewMode("management")
        actions.setStatusFilter("pending")
        break
      case "tables":
        actions.setViewMode("tables")
        break
      case "performance":
        actions.toggleAnalytics()
        break
      default:
        break
    }
  }, [actions])

  // Redirect Basic tier users
  useEffect(() => {
    if (tier === 'basic') {
      router.replace('/basic-dashboard')
    }
  }, [tier, router])

  if (tier === 'basic') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Page Not Available</h1>
          <p className="text-muted-foreground mb-6">
            This page is not available for your current plan. All booking management is handled through your dashboard.
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (contextLoading || tier === null || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
          <p className="text-lg font-medium">Loading bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 tablet:space-y-8 animate-in fade-in-0 duration-500">
      {/* Header */}
      <BookingsHeader
        bookingStats={bookingStats}
        autoRefresh={state.autoRefresh}
        lastRefresh={state.lastRefresh}
        showAnalytics={state.showAnalytics}
        onRefresh={() => {
          bookingActions.handleRefresh()
          actions.updateLastRefresh()
        }}
        onToggleAnalytics={actions.toggleAnalytics}
        onAddBooking={actions.toggleManualBooking}
      />

      {/* Alert Center */}
      <AlertCenter
        bookings={filteredBookings || []}
        bookingStats={bookingStats}
        onBulkConfirm={(bookingIds) => bookingActions.bulkUpdateMutation.mutate({
          bookingIds,
          updates: { status: "confirmed" }
        })}
        onSelectBookings={(bookingIds) => actions.setSelectedBookings(bookingIds)}
        onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
      />

      {/* Quick Stats */}
      <QuickStats
        stats={bookingStats}
        tableStats={tableStats}
        onStatClick={handleStatClick}
      />

      {/* Analytics Panel */}
      {state.showAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Today's Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Peak Hour</div>
                <div className="text-2xl font-bold">{tableStats?.peakHour || "N/A"}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Completion Rate</div>
                <div className="text-2xl font-bold">
                  {bookingStats.all > 0 ? Math.round((bookingStats.completed / bookingStats.all) * 100) : 0}%
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">No-Show Rate</div>
                <div className="text-2xl font-bold text-red-600">
                  {bookingStats.all > 0 ? Math.round((bookingStats.no_show / bookingStats.all) * 100) : 0}%
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Average Party Size</div>
                <div className="text-2xl font-bold">{bookingStats.avgPartySize}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - 3 View System */}
      <Tabs value={state.viewMode} onValueChange={(v) => actions.setViewMode(v as any)}>
        <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
          <TabsList className="grid w-full tablet:w-[400px] grid-cols-3 h-auto">
            <TabsTrigger value="today" className="min-h-touch-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>Today</span>
                {bookingStats.upcoming > 0 && (
                  <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs">
                    {bookingStats.upcoming}
                  </span>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="management" className="min-h-touch-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Management</span>
                {bookingStats.needingAttention > 0 && (
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="tables" className="min-h-touch-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                <span>Tables</span>
                {tableStats?.utilization && tableStats.utilization > 80 && (
                  <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
                )}
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-3 text-sm tablet:text-base text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${
                state.autoRefresh ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'
              }`} />
              <span className="font-medium">{state.autoRefresh ? '🟢 Live' : '⏸️ Paused'}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="font-mono text-xs tablet:text-sm bg-background px-2 py-1 rounded border">
              {format(new Date(), 'HH:mm:ss')}
            </span>
          </div>
        </div>

        {/* Today View */}
        <TabsContent value="today" className="space-y-4">
          <BookingsFilter
            viewMode={state.viewMode}
            searchQuery={state.searchQuery}
            statusFilter={state.statusFilter}
            timeFilter={state.timeFilter}
            dateRange={state.dateRange}
            selectedDate={state.selectedDate}
            bookingStats={bookingStats}
            onSearchChange={actions.setSearchQuery}
            onStatusFilterChange={actions.setStatusFilter}
            onTimeFilterChange={actions.setTimeFilter}
            onDateRangeChange={actions.setDateRange}
            onDatePickerOpen={actions.toggleDatePicker}
            onResetFilters={actions.resetFilters}
          />

          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={actions.setSelectedBooking}
            onUpdateStatus={(bookingId: any, status: any) =>
              bookingActions.updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
            onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
            onSwitchTable={(bookingId, fromTableId, toTableId) =>
              bookingActions.switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) =>
              bookingActions.removeTableAssignmentMutation.mutate({ bookingId, tableId })
            }
          />
        </TabsContent>

        {/* Management View */}
        <TabsContent value="management" className="space-y-4">
          <BookingsFilter
            viewMode={state.viewMode}
            searchQuery={state.searchQuery}
            statusFilter={state.statusFilter}
            timeFilter={state.timeFilter}
            dateRange={state.dateRange}
            selectedDate={state.selectedDate}
            bookingStats={bookingStats}
            onSearchChange={actions.setSearchQuery}
            onStatusFilterChange={actions.setStatusFilter}
            onTimeFilterChange={actions.setTimeFilter}
            onDateRangeChange={actions.setDateRange}
            onDatePickerOpen={actions.toggleDatePicker}
            onResetFilters={actions.resetFilters}
          />

          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={actions.setSelectedBooking}
            onUpdateStatus={(bookingId: any, status: any) =>
              bookingActions.updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
            onAssignTable={(bookingId) => actions.setTableAssignment(true, bookingId)}
            onSwitchTable={(bookingId, fromTableId, toTableId) =>
              bookingActions.switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) =>
              bookingActions.removeTableAssignmentMutation.mutate({ bookingId, tableId })
            }
          />
        </TabsContent>

        {/* Tables View */}
        <TabsContent value="tables" className="space-y-4">
          <BookingsFilter
            viewMode={state.viewMode}
            searchQuery={state.searchQuery}
            statusFilter={state.statusFilter}
            timeFilter={state.timeFilter}
            dateRange={state.dateRange}
            selectedDate={state.selectedDate}
            bookingStats={bookingStats}
            onSearchChange={actions.setSearchQuery}
            onStatusFilterChange={actions.setStatusFilter}
            onTimeFilterChange={actions.setTimeFilter}
            onDateRangeChange={actions.setDateRange}
            onDatePickerOpen={actions.toggleDatePicker}
            onResetFilters={actions.resetFilters}
          />

          <Card>
            <CardHeader>
              <CardTitle>Table Status Overview</CardTitle>
              <CardDescription>
                Real-time table availability for {format(state.selectedDate, "MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Table2 className="mx-auto h-16 w-16 mb-6 opacity-50" />
                <div className="text-xl font-medium mb-3">Table view coming soon</div>
                <p className="text-base text-muted-foreground">
                  Advanced table management features will be available here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals and Dialogs */}

      {/* Date picker dialog */}
      <Dialog open={state.showDatePicker} onOpenChange={actions.toggleDatePicker}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Select a date</DialogTitle>
            <DialogDescription>Choose a date to view bookings.</DialogDescription>
          </DialogHeader>
          <div className="p-2">
            <Calendar
              mode="single"
              selected={state.selectedDate}
              onSelect={(date) => {
                if (!date) return
                actions.setSelectedDate(date)
                actions.toggleDatePicker()
                actions.setDateRange("custom")
              }}
              className="rounded-md"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Details Modal */}
      {state.selectedBooking && (
        <BookingDetails
          booking={state.selectedBooking}
          onClose={() => actions.setSelectedBooking(null)}
          onUpdate={(updates) => {
            bookingActions.updateBookingMutation.mutate({
              bookingId: state.selectedBooking!.id,
              updates
            })
          }}
        />
      )}

      {/* Manual Booking Modal */}
      <Dialog open={state.showManualBooking} onOpenChange={actions.toggleManualBooking}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] tablet:h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-4 tablet:px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Manual Booking</DialogTitle>
              <DialogDescription>
                Create a new booking manually for walk-ins or phone reservations
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 tablet:px-6 py-4">
            <ManualBookingForm
              restaurantId={restaurantId}
              onSubmit={(data) => bookingActions.createManualBookingMutation.mutate(data)}
              onCancel={actions.toggleManualBooking}
              isLoading={bookingActions.createManualBookingMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}