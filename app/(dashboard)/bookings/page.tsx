// app/(dashboard)/bookings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow, addMinutes, differenceInMinutes } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookingList } from "@/components/bookings/booking-list"
import { BookingDetails } from "@/components/bookings/booking-details"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { TableAvailabilityService } from "@/lib/table-availability"
import { toast } from "react-hot-toast"
import { 
  Search, 
  Calendar as CalendarIcon, 
  Download, 
  Plus,
  Table2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  RefreshCw,
  Users,
  Phone,
  Mail,
  MapPin,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  BarChart3,
  Timer
} from "lucide-react"
import type { Booking } from "@/types"

// Add statistics card component
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend 
}: { 
  title: string
  value: string | number
  description?: string
  icon: any
  trend?: { value: number; isPositive: boolean }
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm tablet:text-base font-medium leading-tight">{title}</CardTitle>
        <Icon className="h-5 w-5 tablet:h-6 tablet:w-6 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-xl tablet:text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs tablet:text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
            )}
            <span className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}% from last week
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function BookingsPage() {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState<Date>(now)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("upcoming")
  const [viewMode, setViewMode] = useState<"upcoming" | "list" | "calendar" | "tables">("upcoming")
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>("all") // all, lunch, dinner
  const [dateRange, setDateRange] = useState<string>("today") // today, tomorrow, week
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "expiring">("all")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      switch (e.key) {
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleRefresh()
          }
          break
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowManualBooking(true)
          }
          break
        case '1':
          setViewMode("upcoming")
          break
        case '2':
          setViewMode("list")
          break
        case '3':
          setViewMode("calendar")
          break
        case '4':
          setViewMode("tables")
          break
        case 'Escape':
          setSelectedBookings([])
          setSelectedBooking(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-refresh data every 30 seconds for real-time updates
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, queryClient])

  // Get restaurant ID
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch bookings with proper joins and table information
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", restaurantId, selectedDate, statusFilter, timeFilter, dateRange, viewMode],
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

      // Apply date range filters
      if (viewMode === "upcoming" || (dateRange !== "all" && viewMode !== "calendar")) {
        const today = startOfDay(now)
        let startDate = today
        let endDate = endOfDay(now)

        if (dateRange === "today") {
          startDate = today
          endDate = endOfDay(now)
        } else if (dateRange === "tomorrow") {
          startDate = startOfDay(addDays(now, 1))
          endDate = endOfDay(addDays(now, 1))
        } else if (dateRange === "week") {
          startDate = today
          endDate = endOfDay(addDays(now, 7))
        }

        // Only apply date filters if not "all"
        if (dateRange !== "all") {
          query = query
            .gte("booking_time", startDate.toISOString())
            .lte("booking_time", endDate.toISOString())
        }

        // For upcoming view, only show bookings that haven't passed yet
        if (viewMode === "upcoming") {
          query = query.gte("booking_time", now.toISOString())
        }
      }

      // Date filter for calendar view
      if (viewMode === "calendar" && selectedDate) {
        const dayStart = startOfDay(selectedDate)
        const dayEnd = endOfDay(selectedDate)
        query = query
          .gte("booking_time", dayStart.toISOString())
          .lte("booking_time", dayEnd.toISOString())
      }

      // Status filter
      if (statusFilter === "upcoming") {
        query = query.in("status", ["pending", "confirmed"])
      } else if (statusFilter === "cancelled_by_user") {
        query = query.in("status", ["cancelled_by_user", "declined_by_restaurant"])
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching bookings:", error)
        throw error
      }

      // Transform data and apply time filter
      let transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]

      // Apply time filter
      if (timeFilter !== "all" && transformedData) {
        transformedData = transformedData.filter(booking => {
          const hour = new Date(booking.booking_time).getHours()
          if (timeFilter === "lunch") return hour >= 11 && hour < 15
          if (timeFilter === "dinner") return hour >= 17 && hour < 23
          return true
        })
      }

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Fetch table utilization stats
  const { data: tableStats } = useQuery({
    queryKey: ["table-stats", restaurantId, selectedDate],
    queryFn: async () => {
      if (!restaurantId) return null

      const dayStart = startOfDay(selectedDate)
      const dayEnd = endOfDay(selectedDate)

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

      // Calculate utilization
      const totalTables = tables?.length || 0
      const totalSlots = totalTables * 12 // Assuming 12 hours of operation
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

  // Fetch tables for table view
  const { data: tables } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data
    },
    enabled: !!restaurantId && viewMode === "tables"
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

  // Update booking status
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: Partial<Booking> }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ 
          ...updates,
          updated_at: new Date().toISOString() 
        })
        .eq("id", bookingId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking updated")
    },
    onError: (error) => {
      console.error("Update error:", error)
      toast.error("Failed to update booking")
    },
  })

  // Bulk actions for selected bookings
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ bookingIds, updates }: { bookingIds: string[]; updates: Partial<Booking> }) => {
      const promises = bookingIds.map(id => 
        supabase
          .from("bookings")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id)
      )
      
      const results = await Promise.all(promises)
      const errors = results.filter(r => r.error)
      
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} booking(s)`)
      }
    },
    onSuccess: (_, { bookingIds }) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success(`Updated ${bookingIds.length} booking(s)`)
      setSelectedBookings([])
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update bookings")
    },
  })

  // Quick confirm booking
  const quickConfirmMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ 
          status: "confirmed",
          updated_at: new Date().toISOString() 
        })
        .eq("id", bookingId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking confirmed")
    },
    onError: () => {
      toast.error("Failed to confirm booking")
    },
  })

  // Manual refresh function
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] })
    queryClient.invalidateQueries({ queryKey: ["table-stats"] })
    queryClient.invalidateQueries({ queryKey: ["tables"] })
    toast.success("Data refreshed")
  }
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Validate table availability one more time before creating
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const availability = await tableService.checkTableAvailability(
          restaurantId,
          bookingData.table_ids,
          new Date(bookingData.booking_time),
          bookingData.turn_time_minutes || 120
        )

        if (!availability.available) {
          throw new Error("Selected tables are no longer available")
        }
      }

      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create booking
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: user.id,
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone,
          booking_time: bookingData.booking_time,
          party_size: bookingData.party_size,
          turn_time_minutes: bookingData.turn_time_minutes || 120,
          status: bookingData.status || "confirmed",
          special_requests: bookingData.special_requests,
          occasion: bookingData.occasion,
          confirmation_code: confirmationCode,
        })
        .select()
        .single()

      if (error) throw error

      // Assign tables if provided
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
        }))

        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          // Rollback booking if table assignment fails
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      }

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  // Filter bookings based on search
  const filteredBookings = bookings?.filter((booking) => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || booking.user?.phone_number?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => t.table_number.toLowerCase()).join(" ") || ""
    
    const matchesSearch = (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower) ||
      tableNumbers.includes(searchLower)
    )

    if (!matchesSearch) return false

    // Apply request filter
    if (requestFilter === "pending") {
      return booking.status === "pending"
    } else if (requestFilter === "expiring") {
      if (booking.status !== "pending" || !(booking as any).request_expires_at) return false
      const hoursLeft = differenceInMinutes(new Date((booking as any).request_expires_at), now) / 60
      return hoursLeft < 2
    }
    
    return true
  })

  // Get booking counts and statistics with enhanced analytics
  const bookingStats = {
    all: bookings?.length || 0,
    pending: bookings?.filter(b => b.status === "pending").length || 0,
    confirmed: bookings?.filter(b => b.status === "confirmed").length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => 
      b.status === "cancelled_by_user" || b.status === "declined_by_restaurant"
    ).length || 0,
    no_show: bookings?.filter(b => b.status === "no_show").length || 0,
    withoutTables: bookings?.filter(b => 
      b.status === "confirmed" && (!b.tables || b.tables.length === 0)
    ).length || 0,
    upcoming: bookings?.filter(b => 
      (b.status === "pending" || b.status === "confirmed") && 
      new Date(b.booking_time) > now
    ).length || 0,
    // New analytics
    avgPartySize: bookings?.length ? 
      Math.round((bookings.reduce((acc, b) => acc + b.party_size, 0) / bookings.length) * 10) / 10 : 0,
    totalGuests: bookings?.filter(b => b.status === "confirmed" || b.status === "completed")
      .reduce((acc, b) => acc + b.party_size, 0) || 0,
    revenue: (bookings?.filter(b => b.status === "completed").length || 0) * 45, // Estimated revenue
    needingAttention: bookings?.filter(b => {
      const isUrgentPending = b.status === "pending" && new Date(b.booking_time).getTime() - now.getTime() < 3600000
      const isConfirmedWithoutTable = b.status === "confirmed" && (!b.tables || b.tables.length === 0)
      return b.status === "pending" || isConfirmedWithoutTable || isUrgentPending
    }).length || 0,
  }

  return (
    <div className="space-y-6">
      {/* Page Header - Optimized for tablet */}
      <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl tablet:text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm tablet:text-base text-muted-foreground">
            Manage your restaurant bookings and table assignments
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Auto-refresh toggle */}

          {/* Manual refresh - Larger touch target */}
          <Button variant="outline" size="default" onClick={handleRefresh} className="min-h-touch-lg">
            <RefreshCw className="mr-2 h-5 w-5" />
            Refresh
          </Button>

          {/* Analytics toggle - Larger touch target */}
          <Button
            variant={showAnalytics ? "default" : "outline"}
            size="default"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="min-h-touch-lg"
          >
            <BarChart3 className="mr-2 h-5 w-5" />
            Analytics
          </Button>

          {/* Bulk actions */}
          {selectedBookings.length > 0 && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="default"
                onClick={() => bulkUpdateMutation.mutate({ 
                  bookingIds: selectedBookings, 
                  updates: { status: "confirmed" }
                })}
                className="min-h-touch-lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                <span className="hidden tablet:inline">Confirm</span> ({selectedBookings.length})
              </Button>
              <Button
                variant="destructive"
                size="default"
                onClick={() => bulkUpdateMutation.mutate({ 
                  bookingIds: selectedBookings, 
                  updates: { status: "cancelled_by_user" }
                })}
                className="min-h-touch-lg"
              >
                <XCircle className="mr-2 h-5 w-5" />
                <span className="hidden tablet:inline">Cancel</span> ({selectedBookings.length})
              </Button>
            </div>
          )}

          <Button variant="outline" size="default" className="min-h-touch-lg">
            <Download className="mr-2 h-5 w-5" />
            <span className="hidden tablet:inline">Export</span>
          </Button>
          <Button onClick={() => setShowManualBooking(true)} size="default" className="min-h-touch-lg bg-primary">
            <Plus className="mr-2 h-5 w-5" />
            <span className="font-medium">Add Booking</span>
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Cards - Optimized for tablet */}
      <div className="grid gap-4 grid-cols-2 tablet:grid-cols-4 xl:grid-cols-4">
        <StatCard
          title="Upcoming Today"
          value={bookingStats.upcoming}
          description={`${bookingStats.pending} pending confirmation`}
          icon={CalendarIcon}
        />
        <StatCard
          title="Table Utilization"
          value={`${tableStats?.utilization || 0}%`}
          description={`${tableStats?.totalTables || 0} tables total`}
          icon={Table2}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Needs Attention"
          value={bookingStats.needingAttention}
          description="Requires immediate action"
          icon={AlertTriangle}
        />
        <StatCard
          title="Total Guests"
          value={bookingStats.totalGuests}
          description={`Avg party: ${bookingStats.avgPartySize}`}
          icon={Users}
        />
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced View Toggle with Live Indicator */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
          <TabsList className="grid w-full tablet:w-[480px] grid-cols-2 tablet:grid-cols-4 h-auto">
            <TabsTrigger value="upcoming" className="relative min-h-touch-lg px-4 py-3">
              <span className="flex items-center gap-2">
                <span>Upcoming</span>
                {bookingStats.upcoming > 0 && (
                  <Badge variant="default" className="px-2 py-0.5 text-xs font-medium">
                    {bookingStats.upcoming}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="list" className="relative min-h-touch-lg px-4 py-3">
              <span className="flex items-center gap-2">
                <span>All</span>
                {bookingStats.needingAttention > 0 && (
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="min-h-touch-lg px-4 py-3">Calendar</TabsTrigger>
            <TabsTrigger value="tables" className="relative min-h-touch-lg px-4 py-3">
              <span className="flex items-center gap-2">
                <span>Tables</span>
                {tableStats?.utilization && tableStats.utilization > 80 && (
                  <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
                )}
              </span>
            </TabsTrigger>
          </TabsList>
          
          {/* Live status indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span>{autoRefresh ? 'Live' : 'Paused'}</span>
            <span>•</span>
         
          </div>
        </div>

        {/* Upcoming Bookings View */}
        <TabsContent value="upcoming" className="space-y-4">
          {/* Quick Date Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                {/* Date Range Buttons - Optimized for touch */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={dateRange === "today" ? "default" : "outline"}
                    size="default"
                    onClick={() => setDateRange("today")}
                    className="min-h-touch-lg font-medium"
                  >
                    Today ({format(now, "MMM d")})
                  </Button>
                  <Button
                    variant={dateRange === "tomorrow" ? "default" : "outline"}
                    size="default"
                    onClick={() => setDateRange("tomorrow")}
                    className="min-h-touch-lg font-medium"
                  >
                    Tomorrow ({format(addDays(now, 1), "MMM d")})
                  </Button>
                  <Button
                    variant={dateRange === "week" ? "default" : "outline"}
                    size="default"
                    onClick={() => setDateRange("week")}
                    className="min-h-touch-lg font-medium"
                  >
                    This Week
                  </Button>
                </div>

                {/* Request Filter Buttons - Optimized for touch */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={requestFilter === "all" ? "default" : "outline"}
                    size="default"
                    onClick={() => setRequestFilter("all")}
                    className="min-h-touch-lg"
                  >
                    All
                  </Button>
                  <Button
                    variant={requestFilter === "pending" ? "default" : "outline"}
                    size="default"
                    onClick={() => setRequestFilter("pending")}
                    className="min-h-touch-lg"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Pending ({bookingStats.pending})
                  </Button>
                  <Button
                    variant={requestFilter === "expiring" ? "default" : "outline"}
                    size="default"
                    onClick={() => setRequestFilter("expiring")}
                    className="min-h-touch-lg"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Expiring Soon
                  </Button>
                </div>

                {/* Search and Filters - Tablet optimized */}
                <div className="flex flex-col tablet:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, code, phone, email, or table..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 text-base"
                    />
                  </div>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger className="w-full tablet:w-[160px] h-12 text-base">
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="py-3">All Times</SelectItem>
                      <SelectItem value="lunch" className="py-3">Lunch (11-3)</SelectItem>
                      <SelectItem value="dinner" className="py-3">Dinner (5-11)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick alerts and actions */}
              <div className="space-y-3">
                {bookingStats.withoutTables > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        {bookingStats.withoutTables} confirmed booking{bookingStats.withoutTables > 1 ? 's' : ''} 
                        {bookingStats.withoutTables > 1 ? ' need' : ' needs'} table assignment
                      </span>
                      <Button 
                        size="default" 
                        onClick={() => {
                          setViewMode("tables")
                          setStatusFilter("confirmed")
                        }}
                        className="min-h-touch-lg font-medium"
                      >
                        Assign Tables
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {bookingStats.pending > 0 && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <Timer className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-yellow-800">
                        {bookingStats.pending} booking{bookingStats.pending > 1 ? 's' : ''} pending confirmation
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          size="default" 
                          variant="outline"
                          onClick={() => {
                            const pendingBookings = filteredBookings?.filter(b => b.status === "pending").map(b => b.id) || []
                            setSelectedBookings(pendingBookings)
                          }}
                          className="min-h-touch-lg"
                        >
                          Select All
                        </Button>
                        <Button 
                          size="default"
                          onClick={() => {
                            const pendingBookings = filteredBookings?.filter(b => b.status === "pending").map(b => b.id) || []
                            bulkUpdateMutation.mutate({ 
                              bookingIds: pendingBookings, 
                              updates: { status: "confirmed" }
                            })
                          }}
                          className="min-h-touch-lg font-medium"
                        >
                          Confirm All
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Urgent bookings (within 1 hour) */}
                {(() => {
                  const urgentBookings = filteredBookings?.filter(b => 
                    b.status === "confirmed" && 
                    new Date(b.booking_time).getTime() - now.getTime() < 3600000 && 
                    new Date(b.booking_time).getTime() > now.getTime()
                  ) || []
                  
                  return urgentBookings.length > 0 && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        🔥 {urgentBookings.length} URGENT booking{urgentBookings.length > 1 ? 's' : ''} starting within the next hour
                        <div className="mt-3 text-sm tablet:text-base space-y-2">
                          {urgentBookings.slice(0, 3).map(booking => (
                            <div key={booking.id} className="flex items-center gap-3 p-2 bg-red-50 rounded font-medium">
                              <span className="font-bold text-red-700">{format(new Date(booking.booking_time), "HH:mm")}</span>
                              <span className="font-semibold">{booking.user?.full_name || booking.guest_name}</span>
                              <span>Party of {booking.party_size}</span>
                              {!booking.tables?.length && (
                                <Badge variant="destructive" className="px-2 py-1 text-xs font-bold animate-pulse">NO TABLE</Badge>
                              )}
                            </div>
                          ))}
                          {urgentBookings.length > 3 && (
                            <div className="text-sm tablet:text-base text-muted-foreground mt-2 font-medium">
                              +{urgentBookings.length - 3} more urgent bookings...
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Bookings List */}
          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId: any, status: any) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
          />
        </TabsContent>

        {/* All Bookings List View */}
        <TabsContent value="list" className="space-y-4">
          {/* Enhanced Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Status Quick Filters - Optimized for tablet */}
                <div className="grid grid-cols-2 tablet:grid-cols-4 lg:grid-cols-7 gap-3">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("all")}
                    className="min-h-touch-lg font-medium"
                  >
                    All ({bookingStats.all})
                  </Button>
                  <Button
                    variant={statusFilter === "upcoming" ? "default" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("upcoming")}
                    className="min-h-touch-lg font-medium"
                  >
                    Upcoming ({bookingStats.upcoming})
                  </Button>
                  <Button
                    variant={statusFilter === "pending" ? "default" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("pending")}
                    className="min-h-touch-lg font-medium"
                  >
                    Pending ({bookingStats.pending})
                  </Button>
                  <Button
                    variant={statusFilter === "confirmed" ? "default" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("confirmed")}
                    className="min-h-touch-lg font-medium"
                  >
                    Confirmed ({bookingStats.confirmed})
                  </Button>
                  <Button
                    variant={statusFilter === "no_show" ? "destructive" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("no_show")}
                    className="min-h-touch-lg font-medium"
                  >
                    No Shows ({bookingStats.no_show})
                  </Button>
                  <Button
                    variant={statusFilter === "cancelled_by_user" ? "destructive" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("cancelled_by_user")}
                    className="min-h-touch-lg font-medium"
                  >
                    Cancelled ({bookingStats.cancelled})
                  </Button>
                  <Button
                    variant={statusFilter === "completed" ? "default" : "outline"}
                    size="default"
                    onClick={() => setStatusFilter("completed")}
                    className="min-h-touch-lg font-medium"
                  >
                    Completed ({bookingStats.completed})
                  </Button>
                </div>

                {/* Search and Detailed Filters - Tablet optimized */}
                <div className="flex flex-col tablet:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, code, phone, email, or table..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 text-base"
                    />
                  </div>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger className="w-full tablet:w-[160px] h-12 text-base">
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="py-3">All Times</SelectItem>
                      <SelectItem value="lunch" className="py-3">Lunch (11-3)</SelectItem>
                      <SelectItem value="dinner" className="py-3">Dinner (5-11)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full tablet:w-[160px] h-12 text-base">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today" className="py-3">Today</SelectItem>
                      <SelectItem value="tomorrow" className="py-3">Tomorrow</SelectItem>
                      <SelectItem value="week" className="py-3">This Week</SelectItem>
                      <SelectItem value="all" className="py-3">All Dates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking List */}
          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            restaurantId={restaurantId}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId: any, status: any) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
          />
        </TabsContent>

        {/* Calendar View - Optimized for tablet */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid gap-4 tablet:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tablet:text-xl">Select Date</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md scale-110 tablet:scale-125 origin-top-left"
                />
              </CardContent>
            </Card>

            {/* Day's Bookings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tablet:text-xl">
                  Bookings for {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
                <CardDescription className="text-base">
                  {filteredBookings?.length || 0} bookings scheduled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BookingList
                  bookings={filteredBookings || []}
                  isLoading={isLoading}
                  restaurantId={restaurantId}
                  onSelectBooking={setSelectedBooking}
                  onUpdateStatus={(bookingId: any, status: any) => 
                    updateBookingMutation.mutate({ bookingId, updates: { status } })
                  }
                  compact
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Table View */}
        <TabsContent value="tables" className="space-y-4">
          {/* Table View Filters - Optimized for tablet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg tablet:text-xl">Table Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={dateRange === "today" ? "default" : "outline"}
                    size="default"
                    onClick={() => setDateRange("today")}
                    className="min-h-touch-lg font-medium"
                  >
                    Today ({format(selectedDate, "MMM d")})
                  </Button>
                  <Button
                    variant={dateRange === "tomorrow" ? "default" : "outline"}
                    size="default"
                    onClick={() => {
                      setDateRange("tomorrow")
                      setSelectedDate(addDays(now, 1))
                    }}
                    className="min-h-touch-lg font-medium"
                  >
                    Tomorrow ({format(addDays(now, 1), "MMM d")})
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="destructive" className="px-4 py-2 text-sm font-medium">
                    🔴 Currently Occupied
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                    🟡 Has Upcoming Bookings
                  </Badge>
                  <Badge variant="default" className="px-4 py-2 text-sm font-medium">
                    🟢 Available
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg tablet:text-xl">Table Status Overview</CardTitle>
              <CardDescription className="text-base">
                Real-time table availability and booking assignments for {format(selectedDate, "MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tables && tables.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 tablet:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {tables.map((table) => {
                    const tableBookings = bookings?.filter(booking =>
                      booking.tables?.some(t => t.id === table.id) &&
                      format(new Date(booking.booking_time), "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                    ) || []

                    const currentBooking = tableBookings.find(booking => {
                      const bookingTime = new Date(booking.booking_time)
                      const endTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)
                      return now >= bookingTime && now <= endTime && booking.status === "confirmed"
                    })

                    const isCurrentlyOccupied = !!currentBooking

                    const upcomingBookings = tableBookings
                      .filter(b => new Date(b.booking_time) > now && (b.status === "confirmed" || b.status === "pending"))
                      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

                    const nextBooking = upcomingBookings[0]
                    const hasUpcomingBookings = upcomingBookings.length > 0

                    // Determine card style based on status
                    let cardStyle = 'bg-green-50 border-green-200' // Available
                    let statusIcon = '🟢'
                    
                    if (isCurrentlyOccupied) {
                      cardStyle = 'bg-red-50 border-red-200'
                      statusIcon = '🔴'
                    } else if (hasUpcomingBookings) {
                      cardStyle = 'bg-yellow-50 border-yellow-200'
                      statusIcon = '🟡'
                    }

                    return (
                      <Card key={table.id} className={`p-4 tablet:p-6 ${cardStyle} hover:shadow-lg transition-all cursor-pointer min-h-[200px] tablet:min-h-[240px]`}>
                        <div className="text-center space-y-3">
                          {/* Table Header */}
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xl tablet:text-2xl">{statusIcon}</span>
                            <div className="text-lg tablet:text-xl font-semibold">
                              Table {table.table_number}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <Badge 
                            variant={isCurrentlyOccupied ? "destructive" : hasUpcomingBookings ? "secondary" : "default"} 
                            className="mb-3 px-3 py-1 text-sm font-medium"
                          >
                            {isCurrentlyOccupied ? "Occupied" : hasUpcomingBookings ? "Has Bookings" : "Available"}
                          </Badge>

                          {/* Table Info */}
                          <div className="text-sm tablet:text-base text-muted-foreground font-medium">
                            {table.capacity} seats • {table.table_type}
                          </div>

                          {/* Current Booking Info */}
                          {currentBooking && (
                            <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                              <div className="font-medium text-red-800">Currently Occupied</div>
                              <div className="text-red-700">
                                {format(new Date(currentBooking.booking_time), "HH:mm")} - {format(addMinutes(new Date(currentBooking.booking_time), currentBooking.turn_time_minutes || 120), "HH:mm")}
                              </div>
                              <div className="text-red-600">
                                {currentBooking.user?.full_name || currentBooking.guest_name}
                              </div>
                              <div className="text-red-600">
                                Party of {currentBooking.party_size}
                              </div>
                            </div>
                          )}

                          {/* Next Booking Info */}
                          {!isCurrentlyOccupied && nextBooking && (
                            <div className="mt-2 p-2 bg-yellow-100 rounded text-xs">
                              <div className="font-medium text-yellow-800">Next Booking</div>
                              <div className="text-yellow-700">
                                {format(new Date(nextBooking.booking_time), "HH:mm")}
                              </div>
                              <div className="text-yellow-600">
                                {nextBooking.user?.full_name || nextBooking.guest_name}
                              </div>
                              <div className="text-yellow-600">
                                Party of {nextBooking.party_size}
                              </div>
                              {nextBooking.status === "pending" && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* All Bookings Summary */}
                          <div className="mt-2 text-xs border-t pt-2">
                            <div className="text-muted-foreground">
                              {tableBookings.length} booking{tableBookings.length !== 1 ? 's' : ''} today
                            </div>
                            {upcomingBookings.length > 1 && (
                              <div className="text-muted-foreground">
                                +{upcomingBookings.length - 1} more upcoming
                              </div>
                            )}
                          </div>

                          {/* Quick Actions - Tablet optimized */}
                          <div className="mt-4 space-y-2">
                            {!isCurrentlyOccupied && !hasUpcomingBookings && (
                              <Button 
                                size="default" 
                                variant="outline" 
                                className="w-full text-sm min-h-touch font-medium"
                                onClick={() => setShowManualBooking(true)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Book Now
                              </Button>
                            )}
                            
                            {nextBooking && nextBooking.status === "pending" && (
                              <Button 
                                size="default" 
                                variant="default" 
                                className="w-full text-sm min-h-touch font-medium"
                                onClick={() => quickConfirmMutation.mutate(nextBooking.id)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Quick Confirm
                              </Button>
                            )}

                            {isCurrentlyOccupied && (
                              <Button 
                                size="default" 
                                variant="outline" 
                                className="w-full text-sm min-h-touch font-medium"
                                onClick={() => setSelectedBooking(currentBooking)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Button>
                            )}

                            {upcomingBookings.length > 0 && (
                              <div className="text-sm text-center text-muted-foreground pt-2">
                                <button 
                                  className="hover:underline font-medium min-h-touch inline-block py-2 px-4"
                                  onClick={() => {
                                    setViewMode("list")
                                    setSearchQuery(`table ${table.table_number}`)
                                  }}
                                >
                                  View all bookings →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Table2 className="mx-auto h-16 w-16 mb-6 opacity-50" />
                  <div className="text-xl font-medium mb-3">No tables configured</div>
                  <p className="text-base">Set up your restaurant tables to see real-time availability</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <BookingDetails
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={(updates) => {
            updateBookingMutation.mutate({ 
              bookingId: selectedBooking.id, 
              updates 
            })
          }}
        />
      )}

     

      {/* Manual Booking Modal - Tablet optimized */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] tablet:h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-4 tablet:px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg tablet:text-xl">Add Manual Booking</DialogTitle>
              <DialogDescription className="text-sm tablet:text-base">
                Create a new booking manually for walk-ins or phone reservations
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 tablet:px-6 py-4">
            <ManualBookingForm
              restaurantId={restaurantId}
              onSubmit={(data) => createManualBookingMutation.mutate(data)}
              onCancel={() => setShowManualBooking(false)}
              isLoading={createManualBookingMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}