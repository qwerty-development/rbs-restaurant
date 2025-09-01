// app/(dashboard)/bookings/page.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { BookingList } from "@/components/bookings/booking-list"
import { BookingDetails } from "@/components/bookings/booking-details"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { TableAvailabilityService } from "@/lib/table-availability"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
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
  Timer,
  Volume2,
  VolumeX,
  Sparkles,
  Target,
  TrendingUp as TrendUp
} from "lucide-react"
import type { Booking } from "@/types"

// Add statistics card component
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  priority = "normal",
  onClick,
  pulse = false
}: { 
  title: string
  value: string | number
  description?: string
  icon: any
  trend?: { value: number; isPositive: boolean }
  priority?: "normal" | "high" | "critical"
  onClick?: () => void
  pulse?: boolean
}) {
  const getPriorityStyles = () => {
    switch (priority) {
      case "critical":
        return "border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 hover:from-red-100 hover:to-red-200/50 shadow-red-100/50"
      case "high":
        return "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/50 hover:from-yellow-100 hover:to-yellow-200/50 shadow-yellow-100/50"
      default:
        return "border-border bg-gradient-to-br from-card to-card/50 hover:from-card hover:to-muted/50"
    }
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm",
        getPriorityStyles(),
        pulse && "animate-pulse"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm tablet:text-base font-semibold leading-tight mb-1">{title}</CardTitle>
          {priority === "critical" && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-red-600">URGENT</span>
            </div>
          )}
        </div>
        <div className="relative">
          <Icon className={cn(
            "h-6 w-6 tablet:h-8 tablet:w-8 transition-colors",
            priority === "critical" ? "text-red-600" :
            priority === "high" ? "text-yellow-600" :
            "text-muted-foreground hover:text-primary"
          )} />
          {pulse && (
            <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl tablet:text-3xl font-bold mb-1",
          priority === "critical" ? "text-red-700" :
          priority === "high" ? "text-yellow-700" :
          "text-foreground"
        )}>
          {value}
        </div>
        {description && (
          <p className="text-xs tablet:text-sm text-muted-foreground font-medium">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-3 p-2 bg-background/50 rounded-lg">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
            )}
            <span className={cn(
              "text-xs tablet:text-sm font-semibold",
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.value}% from last week
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function BookingsPage() {
  const now = useMemo(() => new Date(), [])
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
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [draggedBooking, setDraggedBooking] = useState<string | null>(null)
  const [showQuickStats, setShowQuickStats] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showTableAssignment, setShowTableAssignment] = useState(false)
  const [assignmentBookingId, setAssignmentBookingId] = useState<string | null>(null)
  const [availableTablesForAssignment, setAvailableTablesForAssignment] = useState<any[]>([])
  const [selectedTablesForAssignment, setSelectedTablesForAssignment] = useState<string[]>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = useMemo(() => new TableAvailabilityService(), [])

  // Enhanced Auto-refresh with Smart Performance
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      setLastRefresh(new Date())
    }, 15000) // 15 seconds for more responsive updates

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

  // Fetch all bookings (for accurate statistics)
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
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("booking_time", { ascending: true })

      if (error) {
        console.error("Error fetching all bookings:", error)
        throw error
      }

      // Transform data
      const transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]

      return transformedData
    },
    enabled: !!restaurantId,
  })

  // Fetch displayed bookings (filtered for current view)
  const { data: displayedBookings, isLoading } = useQuery({
    queryKey: ["displayed-bookings", restaurantId, selectedDate, statusFilter, timeFilter, dateRange, viewMode],
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
        console.error("Error fetching displayed bookings:", error)
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
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
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
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
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
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success("Booking confirmed")
    },
    onError: () => {
      toast.error("Failed to confirm booking")
    },
  })

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
    queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
    queryClient.invalidateQueries({ queryKey: ["table-stats"] })
    queryClient.invalidateQueries({ queryKey: ["tables"] })
    toast.success("Data refreshed")
  }, [queryClient])

  // Enhanced Keyboard Shortcuts & Gestures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      switch (e.key) {
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleRefresh()
            setLastRefresh(new Date())
            if (soundEnabled) {
              // Play refresh sound (would need audio implementation)
              toast.success('Data refreshed! 🔄')
            }
          }
          break
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowManualBooking(true)
            toast.success('Quick booking mode activated! ⚡')
          }
          break
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowAnalytics(!showAnalytics)
            toast.success('Analytics toggled! 📊')
          }
          break
        case 't':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setViewMode("tables")
            toast.success('Table view activated! 🏓')
          }
          break
        case '1':
          e.preventDefault()
          setViewMode("upcoming")
          toast.success('Upcoming view! 📅')
          break
        case '2':
          e.preventDefault()
          setViewMode("list")
          toast.success('List view! 📋')
          break
        case '3':
          e.preventDefault()
          setViewMode("calendar")
          toast.success('Calendar view! 📆')
          break
        case '4':
          e.preventDefault()
          setViewMode("tables")
          toast.success('Table view! 🏓')
          break
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setRequestFilter("pending")
            toast.success('Showing pending bookings! ⏳')
          }
          break
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Focus search input
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            searchInput?.focus()
            toast.success('Search activated! 🔍')
          }
          break
        case 'Escape':
          setSelectedBookings([])
          setSelectedBooking(null)
          setShowManualBooking(false)
          setShowAnalytics(false)
          toast.success('Cleared selections! ✨')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [soundEnabled, showAnalytics, handleRefresh])

  // Table assignment functions
  const openTableAssignment = useCallback(async (bookingId: string) => {
    setAssignmentBookingId(bookingId)
    setIsCheckingAvailability(true)
    
    const booking = allBookings?.find(b => b.id === bookingId)
    if (!booking) return
    
    try {
      // Get all available tables for the booking time
      const { data: allTables } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")
      
      if (!allTables) return
      
      // Check availability for each table
      const availabilityPromises = allTables.map(async (table) => {
        const availability = await tableService.checkTableAvailability(
          restaurantId,
          [table.id],
          new Date(booking.booking_time),
          booking.turn_time_minutes || 120
        )
        return {
          ...table,
          isAvailable: availability.available,
          conflictReason: availability.conflicts?.[0]?.reason || (availability.available ? null : "Table unavailable")
        }
      })
      
      const tablesWithAvailability = await Promise.all(availabilityPromises)
      setAvailableTablesForAssignment(tablesWithAvailability)
      
      // Pre-select currently assigned tables
      const currentTableIds = booking.tables?.map(t => t.id) || []
      setSelectedTablesForAssignment(currentTableIds)
      
      setShowTableAssignment(true)
    } catch (error) {
      console.error("Error checking table availability:", error)
      toast.error("Failed to check table availability")
    } finally {
      setIsCheckingAvailability(false)
    }
  }, [allBookings, restaurantId, supabase, tableService])

  // Assign tables to booking
  const assignTablesMutation = useMutation({
    mutationFn: async ({ bookingId, tableIds }: { bookingId: string; tableIds: string[] }) => {
      // First, remove existing table assignments
      await supabase
        .from("booking_tables")
        .delete()
        .eq("booking_id", bookingId)
      
      // Then add new table assignments if any
      if (tableIds.length > 0) {
        const assignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))
        
        const { error } = await supabase
          .from("booking_tables")
          .insert(assignments)
        
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table assignment updated successfully")
      setShowTableAssignment(false)
      setAssignmentBookingId(null)
      setSelectedTablesForAssignment([])
    },
    onError: (error) => {
      console.error("Table assignment error:", error)
      toast.error("Failed to update table assignment")
    }
  })

  // Switch table for booking (move from one table to another)
  const switchTableMutation = useMutation({
    mutationFn: async ({ bookingId, fromTableId, toTableId }: { 
      bookingId: string; 
      fromTableId: string; 
      toTableId: string 
    }) => {
      const booking = allBookings?.find(b => b.id === bookingId)
      if (!booking) throw new Error("Booking not found")
      
      // Check if target table is available
      const availability = await tableService.checkTableAvailability(
        restaurantId,
        [toTableId],
        new Date(booking.booking_time),
        booking.turn_time_minutes || 120
      )
      
      if (!availability.available) {
        const reason = availability.conflicts?.[0]?.reason || "Table is not available"
        throw new Error(`Table is not available: ${reason}`)
      }
      
      // Update the table assignment
      const { error } = await supabase
        .from("booking_tables")
        .update({ table_id: toTableId })
        .eq("booking_id", bookingId)
        .eq("table_id", fromTableId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table switched successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to switch table")
    }
  })

  // Remove table assignment
  const removeTableAssignmentMutation = useMutation({
    mutationFn: async ({ bookingId, tableId }: { bookingId: string; tableId?: string }) => {
      let query = supabase
        .from("booking_tables")
        .delete()
        .eq("booking_id", bookingId)
      
      if (tableId) {
        query = query.eq("table_id", tableId)
      }
      
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table assignment removed")
    },
    onError: () => {
      toast.error("Failed to remove table assignment")
    }
  })
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
          user_id: bookingData.user_id || user.id,
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
          source:'manual'
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
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  // Filter bookings based on search
  const filteredBookings = displayedBookings?.filter((booking) => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || booking.user?.phone_number?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => `${t.table_number.toLowerCase()} t${t.table_number.toLowerCase()}`).join(" ") || ""
    
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

  // Performance optimization - Memoized booking statistics
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

  return (
    <div className="space-y-6 tablet:space-y-8 animate-in fade-in-0 duration-500">
      {/* Enhanced Header with Live Status */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 rounded-2xl" />
        <div className="relative backdrop-blur-sm border border-border/50 rounded-2xl p-4 tablet:p-6">
          <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CalendarIcon className="h-6 w-6 tablet:h-8 tablet:w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl tablet:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Bookings Control
                  </h1>
                  <p className="text-sm tablet:text-lg text-muted-foreground font-medium">
                    Live restaurant operations • {format(now, 'EEEE, MMMM do')}
                  </p>
                </div>
              </div>
              
              {/* Quick Status Bar with Keyboard Shortcuts */}
              <div className="flex items-center gap-4 tablet:gap-6 text-xs tablet:text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 tablet:h-3 tablet:w-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'}`} />
                  <span className="font-medium">{autoRefresh ? 'LIVE' : 'PAUSED'}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{format(lastRefresh, 'HH:mm:ss')}</span>
                <div className="h-4 w-px bg-border" />
                <span className="font-medium">{bookingStats.upcoming || 0} upcoming today</span>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1 text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">Ctrl+R</kbd>
                  <span className="text-xs">Refresh</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 tablet:gap-4">
          {/* Auto-refresh toggle */}

              <Button 
                variant="outline" 
                size="default" 
                onClick={() => {
                  handleRefresh()
                  setLastRefresh(new Date())
                }} 
                className="min-h-touch-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                <span className="hidden tablet:inline">Refresh</span>
              </Button>

              <Button
                variant={showAnalytics ? "default" : "outline"}
                size="default"
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="min-h-touch-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                <span className="hidden tablet:inline">Analytics</span>
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
              
              {/* Bulk Table Assignment */}
              {(() => {
                const bookingsWithoutTables = selectedBookings.filter(id => {
                  const booking = allBookings?.find(b => b.id === id)
                  return booking && (!booking.tables || booking.tables.length === 0) && 
                         ['confirmed', 'pending', 'arrived'].includes(booking.status)
                })
                return bookingsWithoutTables.length > 0 && (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => {
                      // Open table assignment for first booking without tables
                      // Future enhancement: could open a bulk assignment modal
                      const firstBookingId = bookingsWithoutTables[0]
                      openTableAssignment(firstBookingId)
                      toast.success(`Opening table assignment for ${bookingsWithoutTables.length} booking(s)`)
                    }}
                    className="min-h-touch-lg border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <Table2 className="mr-2 h-5 w-5" />
                    <span className="hidden tablet:inline">Assign Tables</span> ({bookingsWithoutTables.length})
                  </Button>
                )
              })()}
            </div>
          )}

          <Button variant="outline" size="default" className="min-h-touch-lg">
            <Download className="mr-2 h-5 w-5" />
            <span className="hidden tablet:inline">Export</span>
          </Button>
              <Button 
                onClick={() => setShowManualBooking(true)} 
                size="default" 
                className="min-h-touch-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-semibold"
              >
                <Plus className="mr-2 h-5 w-5" />
                <span>Add Booking</span>
                <Zap className="ml-2 h-4 w-4 opacity-80" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Ultimate Statistics Dashboard */}
      <div className="grid gap-4 tablet:gap-6 grid-cols-2 tablet:grid-cols-4 xl:grid-cols-4">
        <StatCard
          title="Upcoming Today"
          value={bookingStats.upcoming}
          description={`${bookingStats.pending} pending confirmation`}
          icon={CalendarIcon}
          priority={bookingStats.pending > 0 ? "high" : "normal"}
          onClick={() => setRequestFilter("pending")}
        />
        <StatCard
          title="Table Utilization"
          value={`${tableStats?.utilization || 0}%`}
          description={`${tableStats?.totalTables || 0} tables total`}
          icon={Table2}
          trend={{ value: 12, isPositive: true }}
          priority={tableStats?.utilization && tableStats.utilization > 85 ? "high" : "normal"}
          onClick={() => setViewMode("tables")}
        />
        <StatCard
          title="Needs Attention"
          value={bookingStats.needingAttention}
          description="Requires immediate action"
          icon={AlertTriangle}
          priority={bookingStats.needingAttention > 0 ? "critical" : "normal"}
          onClick={() => setStatusFilter("pending")}
          pulse={bookingStats.needingAttention > 0}
        />
        <StatCard
          title="Total Guests"
          value={bookingStats.totalGuests}
          description={`Avg party: ${bookingStats.avgPartySize}`}
          icon={Users}
          onClick={() => setShowAnalytics(true)}
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
          
          {/* Enhanced Live Status & Performance Metrics */}
          <div className="flex items-center gap-3 text-sm tablet:text-base text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'}`} />
              <span className="font-medium">{autoRefresh ? '🟢 Live' : '⏸️ Paused'}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="font-mono text-xs tablet:text-sm bg-background px-2 py-1 rounded border">
              {format(new Date(), 'HH:mm:ss')}
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-xs font-medium">
                {Math.round((bookingStats.confirmed / Math.max(bookingStats.all, 1)) * 100)}% confirmed
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <button 
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1 hover:bg-background/50 px-2 py-1 rounded transition-colors"
            >
              <kbd className="px-1 py-0.5 text-xs bg-background border rounded font-mono">?</kbd>
              <span className="text-xs font-medium">shortcuts</span>
            </button>
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
                  <Alert className="border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 shadow-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 animate-bounce" />
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                    <AlertDescription className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-red-800">
                          🏓 URGENT: {bookingStats.withoutTables} confirmed booking{bookingStats.withoutTables > 1 ? 's' : ''} 
                          {bookingStats.withoutTables > 1 ? ' need' : ' needs'} table assignment
                        </div>
                        <div className="text-xs text-red-600 font-medium">
                          Guests may arrive without tables ready!
                        </div>
                      </div>
                      <Button 
                        size="default" 
                        onClick={() => {
                          setViewMode("tables")
                          setStatusFilter("confirmed")
                          toast.success('Switching to table assignment mode! 🏓')
                        }}
                        className="min-h-touch-lg font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 animate-pulse"
                      >
                        ⚡ Assign Tables Now
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {bookingStats.pending > 0 && (
                  <Alert className="border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 shadow-lg">
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-yellow-600 animate-spin" />
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" />
                        <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}} />
                        <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}} />
                      </div>
                    </div>
                    <AlertDescription className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-yellow-800">
                          ⏰ {bookingStats.pending} booking{bookingStats.pending > 1 ? 's' : ''} awaiting confirmation
                        </div>
                        <div className="text-xs text-yellow-700 font-medium">
                          Quick action: Accept or decline before they expire
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          size="default" 
                          variant="outline"
                          onClick={() => {
                            const pendingBookings = filteredBookings?.filter(b => b.status === "pending").map(b => b.id) || []
                            setSelectedBookings(pendingBookings)
                            toast.success(`Selected ${pendingBookings.length} pending bookings! ✅`)
                          }}
                          className="min-h-touch-lg border-yellow-300 hover:bg-yellow-100 font-medium"
                        >
                          🎦 Select All
                        </Button>
                        <Button 
                          size="default"
                          onClick={() => {
                            const pendingBookings = filteredBookings?.filter(b => b.status === "pending").map(b => b.id) || []
                            bulkUpdateMutation.mutate({ 
                              bookingIds: pendingBookings, 
                              updates: { status: "confirmed" }
                            })
                            toast.success(`Confirming ${pendingBookings.length} bookings! 🎉`)
                          }}
                          className="min-h-touch-lg bg-yellow-600 hover:bg-yellow-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                        >
                          ⚡ Confirm All
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
                              <span className="font-semibold">{booking.guest_name || booking.user?.full_name}</span>
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
            onAssignTable={openTableAssignment}
            onSwitchTable={(bookingId, fromTableId, toTableId) => 
              switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) => 
              removeTableAssignmentMutation.mutate({ bookingId, tableId })
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
            onAssignTable={openTableAssignment}
            onSwitchTable={(bookingId, fromTableId, toTableId) => 
              switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
            }
            onRemoveTable={(bookingId, tableId) => 
              removeTableAssignmentMutation.mutate({ bookingId, tableId })
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
                  onAssignTable={openTableAssignment}
                  onSwitchTable={(bookingId, fromTableId, toTableId) => 
                    switchTableMutation.mutate({ bookingId, fromTableId, toTableId })
                  }
                  onRemoveTable={(bookingId, tableId) => 
                    removeTableAssignmentMutation.mutate({ bookingId, tableId })
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
                    const tableBookings = allBookings?.filter(booking =>
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
                      <Card 
                        key={table.id} 
                        className={`p-4 tablet:p-6 ${cardStyle} hover:shadow-lg transition-all cursor-pointer min-h-[200px] tablet:min-h-[240px]`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (draggedBooking && !isCurrentlyOccupied) {
                            e.currentTarget.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
                          
                          if (draggedBooking && !isCurrentlyOccupied) {
                            const draggedBookingData = allBookings?.find(b => b.id === draggedBooking)
                            if (draggedBookingData?.tables?.[0]?.id) {
                              switchTableMutation.mutate({
                                bookingId: draggedBooking,
                                fromTableId: draggedBookingData.tables[0].id,
                                toTableId: table.id
                              })
                            } else {
                              // Assign table if no current assignment
                              assignTablesMutation.mutate({
                                bookingId: draggedBooking,
                                tableIds: [table.id]
                              })
                            }
                            setDraggedBooking(null)
                          }
                        }}
                      >
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
                            <div 
                              className="mt-2 p-2 bg-red-100 rounded text-xs cursor-move hover:bg-red-200 transition-colors"
                              draggable
                              onDragStart={(e) => {
                                setDraggedBooking(currentBooking.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', currentBooking.id)
                                // Add visual feedback
                                e.currentTarget.classList.add('opacity-50')
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.classList.remove('opacity-50')
                                setDraggedBooking(null)
                              }}
                            >
                              <div className="font-medium text-red-800 flex items-center gap-1">
                                <span>Currently Occupied</span>
                                <span className="text-xs">🔄</span>
                              </div>
                              <div className="text-red-700">
                                {format(new Date(currentBooking.booking_time), "HH:mm")} - {format(addMinutes(new Date(currentBooking.booking_time), currentBooking.turn_time_minutes || 120), "HH:mm")}
                              </div>
                              <div className="text-red-600">
                                {currentBooking.guest_name || currentBooking.user?.full_name}
                              </div>
                              <div className="text-red-600">
                                Party of {currentBooking.party_size}
                              </div>
                            </div>
                          )}

                          {/* Next Booking Info */}
                          {!isCurrentlyOccupied && nextBooking && (
                            <div 
                              className="mt-2 p-2 bg-yellow-100 rounded text-xs cursor-move hover:bg-yellow-200 transition-colors"
                              draggable
                              onDragStart={(e) => {
                                setDraggedBooking(nextBooking.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', nextBooking.id)
                                // Add visual feedback
                                e.currentTarget.classList.add('opacity-50')
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.classList.remove('opacity-50')
                                setDraggedBooking(null)
                              }}
                            >
                              <div className="font-medium text-yellow-800 flex items-center gap-1">
                                <span>Next Booking</span>
                                <span className="text-xs">🔄</span>
                              </div>
                              <div className="text-yellow-700">
                                {format(new Date(nextBooking.booking_time), "HH:mm")}
                              </div>
                              <div className="text-yellow-600">
                                {nextBooking.guest_name || nextBooking.user?.full_name}
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
                                    setSearchQuery(`t${table.table_number}`)
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
      
      {/* Keyboard Shortcuts Help Modal */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Master these shortcuts to work faster on tablets and keyboards
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Navigation</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Upcoming View</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">1</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">List View</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">2</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Calendar View</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">3</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Table View</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">4</kbd>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Actions</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Refresh Data</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+R</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Booking</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+N</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Toggle Analytics</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+A</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Search Focus</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+F</kbd>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Filters</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pending Only</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+P</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Table Management</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Ctrl+T</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Clear Selection</span>
                  <kbd className="px-2 py-1 text-xs bg-muted border rounded font-mono">Esc</kbd>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pro Tips</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Use number keys (1-4) for quick view switching</p>
                <p>• Ctrl combinations work on tablets with keyboards</p>
                <p>• Long press cards for context menus</p>
                <p>• Swipe gestures work on touch devices</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Assignment Modal */}
      <Dialog open={showTableAssignment} onOpenChange={setShowTableAssignment}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] tablet:h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-4 tablet:px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg tablet:text-xl flex items-center gap-2">
                <Table2 className="h-6 w-6" />
                Assign Tables
              </DialogTitle>
              <DialogDescription className="text-sm tablet:text-base">
                {assignmentBookingId && (() => {
                  const booking = allBookings?.find(b => b.id === assignmentBookingId)
                  return booking ? (
                    <span>
                      Assigning tables for <strong>{booking.guest_name || booking.user?.full_name}</strong> 
                      {' '}({format(new Date(booking.booking_time), "MMM d, HH:mm")} • Party of {booking.party_size})
                    </span>
                  ) : null
                })()}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 tablet:px-6 py-4">
            {isCheckingAvailability ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Checking table availability...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected Tables Summary */}
                {selectedTablesForAssignment.length > 0 && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-800">
                          Selected Tables ({selectedTablesForAssignment.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTablesForAssignment.map(tableId => {
                          const table = availableTablesForAssignment.find(t => t.id === tableId)
                          return table ? (
                            <Badge key={tableId} variant="default" className="px-3 py-1">
                              Table {table.table_number} ({table.capacity} seats)
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Available Tables Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Available Tables</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-green-500 rounded-full" />
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-red-500 rounded-full" />
                        <span>Unavailable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-blue-500 rounded-full" />
                        <span>Currently Assigned</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-4 grid-cols-2 tablet:grid-cols-3 lg:grid-cols-4">
                    {availableTablesForAssignment.map((table) => {
                      const isSelected = selectedTablesForAssignment.includes(table.id)
                      const isCurrentlyAssigned = assignmentBookingId && 
                        allBookings?.find(b => b.id === assignmentBookingId)?.tables?.some(t => t.id === table.id)
                      
                      return (
                        <Card 
                          key={table.id} 
                          className={cn(
                            "cursor-pointer transition-all duration-200 hover:shadow-lg",
                            isSelected 
                              ? "border-primary bg-primary/5 shadow-md" 
                              : table.isAvailable 
                                ? "border-green-200 bg-green-50 hover:bg-green-100" 
                                : "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                          )}
                          onClick={() => {
                            if (!table.isAvailable) return
                            
                            setSelectedTablesForAssignment(prev => 
                              prev.includes(table.id)
                                ? prev.filter(id => id !== table.id)
                                : [...prev, table.id]
                            )
                          }}
                        >
                          <CardContent className="p-4 text-center">
                            <div className="space-y-3">
                              {/* Table Status Indicator */}
                              <div className="flex items-center justify-center gap-2">
                                <div className={cn(
                                  "h-3 w-3 rounded-full",
                                  isCurrentlyAssigned 
                                    ? "bg-blue-500" 
                                    : table.isAvailable 
                                      ? "bg-green-500" 
                                      : "bg-red-500"
                                )} />
                                {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                              </div>

                              {/* Table Info */}
                              <div>
                                <div className="text-lg font-semibold">
                                  Table {table.table_number}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {table.capacity} seats • {table.table_type}
                                </div>
                              </div>

                              {/* Status */}
                              <div className="text-xs">
                                {isCurrentlyAssigned ? (
                                  <Badge variant="default" className="text-xs">
                                    Currently Assigned
                                  </Badge>
                                ) : table.isAvailable ? (
                                  <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                                    Available
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">
                                    Unavailable
                                  </Badge>
                                )}
                              </div>

                              {/* Conflict Reason */}
                              {!table.isAvailable && table.conflictReason && (
                                <div className="text-xs text-red-600 mt-2">
                                  {table.conflictReason}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>

                {/* No Tables Available */}
                {availableTablesForAssignment.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Table2 className="mx-auto h-16 w-16 mb-6 opacity-50" />
                    <div className="text-xl font-medium mb-3">No tables available</div>
                    <p className="text-base">All tables are occupied during this time slot</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex-shrink-0 px-4 tablet:px-6 py-4 border-t bg-muted/30">
            <div className="flex justify-between items-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTableAssignment(false)
                  setAssignmentBookingId(null)
                  setSelectedTablesForAssignment([])
                }}
                className="min-h-touch-lg"
              >
                Cancel
              </Button>
              
              <div className="flex gap-3">
                {/* Remove All Tables */}
                {assignmentBookingId && (() => {
                  const booking = allBookings?.find(b => b.id === assignmentBookingId)
                  return booking?.tables && booking.tables.length > 0
                })() && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (assignmentBookingId) {
                        assignTablesMutation.mutate({ 
                          bookingId: assignmentBookingId, 
                          tableIds: [] 
                        })
                      }
                    }}
                    disabled={assignTablesMutation.isPending}
                    className="min-h-touch-lg"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Remove All Tables
                  </Button>
                )}
                
                {/* Save Assignment */}
                <Button
                  onClick={() => {
                    if (assignmentBookingId) {
                      assignTablesMutation.mutate({ 
                        bookingId: assignmentBookingId, 
                        tableIds: selectedTablesForAssignment 
                      })
                    }
                  }}
                  disabled={assignTablesMutation.isPending || !assignmentBookingId}
                  className="min-h-touch-lg bg-primary hover:bg-primary/90"
                >
                  {assignTablesMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Save Assignment ({selectedTablesForAssignment.length} tables)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}