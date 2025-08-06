// app/(dashboard)/dashboard/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes, differenceInMinutes, addDays } from "date-fns"
import { UnifiedFloorPlan } from "@/components/dashboard/unified-floor-plan"
import { CheckInQueue } from "@/components/dashboard/checkin-queue"
import { PendingRequestsPanel } from "@/components/dashboard/pending-requests-panel"
import { CriticalAlerts } from "@/components/dashboard/critical-alerts"
import { TodaysTimeline } from "@/components/dashboard/todays-timeline"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { BookingDetails } from "@/components/bookings/booking-details"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { BookingRequestService } from "@/lib/booking-request-service"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "react-hot-toast"
import { 
  RefreshCw, 
  Clock, 
  AlertCircle,
  Activity,
  UserPlus,
  Search,
  Menu,
  X,
  Timer,
  UserCheck,
  Table2,
  Info,
  Calendar,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [showCheckInDialog, setShowCheckInDialog] = useState(false)
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quickFilter, setQuickFilter] = useState<"all" | "needs-table" | "dining" | "arriving">("all")
  const [showTimeline, setShowTimeline] = useState(false)
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()
  const requestService = new BookingRequestService()

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Update every second for live clock
    return () => clearInterval(interval)
  }, [])

  // Touch-optimized clear handlers
  useEffect(() => {
    const handleEscape = () => {
      setSearchQuery("")
      setSelectedBooking(null)
      setShowManualBooking(false)
    }
    
    // Only keep essential escape functionality for modals
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleEscape()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Get restaurant and user ID
  useEffect(() => {
    async function getIds() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
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
    getIds()
  }, [supabase])

  // Fetch today's bookings
  const { data: todaysBookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ["todays-bookings", restaurantId, format(currentTime, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const todayStart = startOfDay(currentTime)
      const todayEnd = endOfDay(currentTime)
      
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
          booking_status_history(
            new_status,
            changed_at,
            metadata
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", todayStart.toISOString())
        .lte("booking_time", todayEnd.toISOString())
        .order("booking_time", { ascending: true })

      if (error) {
        console.error('Error fetching bookings:', error)
        throw error
      }

      const transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table).filter(Boolean) || []
      })) || []

      return transformedData
    },
    enabled: !!restaurantId,
    refetchInterval: 30000,
  })

  // Fetch all tables
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Fetch customer data
  const { data: customersData = {} } = useQuery({
    queryKey: ["dashboard-customers", restaurantId, todaysBookings.map(b => b.user?.id).filter(Boolean)],
    queryFn: async () => {
      if (!restaurantId || todaysBookings.length === 0) return {}
      
      const userIds = todaysBookings
        .map(booking => booking.user?.id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index)
      
      if (userIds.length === 0) return {}

      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          user_id,
          vip_status,
          blacklisted,
          blacklist_reason,
          total_bookings,
          no_show_count
        `)
        .eq("restaurant_id", restaurantId)
        .in("user_id", userIds)

      if (error) {
        console.error('Error fetching customer data:', error)
        return {}
      }

      const customerMap: Record<string, any> = {}
      data?.forEach(customer => {
        customerMap[customer.user_id] = customer
      })

      return customerMap
    },
    enabled: !!restaurantId && todaysBookings.length > 0,
  })

  // Update booking status
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: any }) => {
      if (updates.status === 'confirmed') {
        const booking = todaysBookings.find(b => b.id === bookingId)
        if (booking?.status === 'pending') {
          const result = await requestService.acceptRequest(
            bookingId,
            userId,
            updates.tableIds || [],
            { 
              suggestAlternatives: true,
              skipTableAssignment: !updates.tableIds 
            }
          )
          
          if (!result.success) {
            if (result.alternatives) {
              const alternativeTables = result.alternatives.tables?.length || 0
              const alternativeTimes = result.alternatives.times?.length || 0
              
              toast.error(
                <div>
                  <p className="font-medium">{result.error}</p>
                  {(alternativeTables > 0 || alternativeTimes > 0) && (
                    <p className="text-sm mt-1">
                      Found {alternativeTables} alternative table{alternativeTables !== 1 ? 's' : ''} and {alternativeTimes} time slot{alternativeTimes !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>,
                { duration: 5000 }
              )
            } else {
              toast.error(result.error || "Failed to accept request")
            }
            
            throw new Error(result.error || "Failed to accept request")
          }
          
          return
        }
      }
      
      if (updates.status === 'declined_by_restaurant') {
        const booking = todaysBookings.find(b => b.id === bookingId)
        if (booking?.status === 'pending') {
          const result = await requestService.declineRequest(
            bookingId,
            userId,
            "Restaurant declined",
            true
          )
          
          if (!result.success) {
            throw new Error(result.error || "Failed to decline request")
          }
          
          if (result.alternatives) {
            toast.success("Request declined. Alternative suggestions sent to customer.")
          }
          
          return
        }
      }
      
      if (updates.status) {
        await statusService.updateBookingStatus(
          bookingId,
          updates.status as DiningStatus,
          userId,
          updates.metadata
        )
      } else {
        const { error } = await supabase
          .from("bookings")
          .update({ 
            ...updates,
            updated_at: new Date().toISOString() 
          })
          .eq("id", bookingId)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      toast.success("Booking updated")
    },
    onError: (error: any) => {
      console.error("Update error:", error)
    },
  })

  // Handle check-in
  const handleCheckIn = async (bookingId: string, tableIds?: string[]) => {
    try {
      const booking = todaysBookings.find(b => b.id === bookingId)
      if (!booking) return

      const finalTableIds = tableIds || booking.tables?.map((t: any) => t.id) || []
      
      if (finalTableIds.length === 0) {
        setCheckInBookingId(bookingId)
        setShowCheckInDialog(true)
        return
      }

      await statusService.checkInBooking(bookingId, finalTableIds, userId)
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
     
      toast.success("Guest checked in successfully")
    } catch (error) {
  
      toast.error("Failed to check in guest")
    }
  }

  // Handle table switch
  const handleTableSwitch = async (bookingId: string, newTableIds: string[]) => {
    try {
      const booking = todaysBookings.find(b => b.id === bookingId)
      if (!booking) return

      const availability = await tableService.checkTableAvailability(
        restaurantId,
        newTableIds,
        new Date(booking.booking_time),
        booking.turn_time_minutes || 120,
        bookingId
      )

      if (!availability.available) {
        toast.error("Selected tables are not available")
        return
      }

      await statusService.switchTables(bookingId, newTableIds, userId, "Table switch requested")
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      toast.success("Table switched successfully")
    } catch (error) {
      toast.error("Failed to switch tables")
    }
  }

  // Create manual booking
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      const bookingTime = new Date(bookingData.booking_time)
      const isWalkIn = bookingData.status === 'arrived' || bookingTime <= new Date()
      
      const result = await requestService.createBookingRequest({
        restaurantId,
        userId: user.id,
        bookingTime,
        partySize: bookingData.party_size,
        turnTimeMinutes: bookingData.turn_time_minutes || 120,
        specialRequests: bookingData.special_requests,
        occasion: bookingData.occasion,
        guestName: bookingData.guest_name,
        guestEmail: bookingData.guest_email,
        guestPhone: bookingData.guest_phone,
        preApproved: bookingData.status === 'confirmed' || bookingData.status === 'arrived',
        isWalkIn
      })

      const booking = result.booking

      if (bookingData.table_ids && bookingData.table_ids.length > 0 && booking.status !== 'pending') {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
        }))

        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      }

      if (bookingData.status === 'arrived') {
        await statusService.updateBookingStatus(booking.id, 'seated', userId)
      }

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  const handleQuickSeat = (guestData: any, tableIds: string[]) => {
    const bookingData = {
      ...guestData,
      booking_time: new Date().toISOString(),
      status: 'arrived',
      table_ids: tableIds
    }
    createManualBookingMutation.mutate(bookingData)
  }

  // Filter bookings
  const activeBookings = todaysBookings.filter(b => 
    !['completed', 'no_show', 'cancelled_by_user', 'declined_by_restaurant', 'auto_declined'].includes(b.status)
  )
  
  const currentlyDining = activeBookings.filter(booking => {
    const diningStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
    return diningStatuses.includes(booking.status)
  })

  // Calculate comprehensive stats
  const stats = {
    pendingCount: activeBookings.filter(b => b.status === 'pending').length,
    arrivingSoonCount: activeBookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && minutesUntil > -15 && minutesUntil <= 30
    }).length,
    awaitingCheckIn: activeBookings.filter(b => b.status === 'arrived').length,
    currentGuests: currentlyDining.reduce((sum, b) => sum + b.party_size, 0),
    availableTables: tables.filter(t => {
      const isOccupied = currentlyDining.some(booking => 
        booking.tables?.some((bt: any) => bt.id === t.id)
      )
      return t.is_active && !isOccupied
    }).length,
    totalCompleted: todaysBookings.filter(b => b.status === 'completed').length,
    tablesInUse: currentlyDining.reduce((count, booking) => count + (booking.tables?.length || 0), 0),
    occupancyRate: Math.round((tables.filter(t => t.is_active).length - tables.filter(t => {
      const isOccupied = currentlyDining.some(booking => 
        booking.tables?.some((bt: any) => bt.id === t.id)
      )
      return t.is_active && !isOccupied
    }).length) / tables.filter(t => t.is_active).length * 100),
    vipCount: activeBookings.filter(b => {
      const customerData = b.user?.id ? customersData[b.user.id] : null
      return customerData?.vip_status
    }).length,
    needingTables: activeBookings.filter(b => !b.tables || b.tables.length === 0).length
  }

  // Filtered bookings based on search and quick filter
  const filteredBookings = activeBookings.filter(booking => {
    // Apply quick filter first
    switch(quickFilter) {
      case "needs-table":
        if (booking.tables && booking.tables.length > 0) return false
        break
      case "dining":
        const diningStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        if (!diningStatuses.includes(booking.status)) return false
        break
      case "arriving":
        const bookingTime = new Date(booking.booking_time)
        const minutesUntil = differenceInMinutes(bookingTime, currentTime)
        if (booking.status !== 'confirmed' || minutesUntil < -15 || minutesUntil > 30) return false
        break
    }
    
    // Then apply search query
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    const guestName = (booking.user?.full_name || booking.guest_name || '').toLowerCase()
    const phone = (booking.user?.phone_number || booking.guest_phone || '').toLowerCase()
    const tableNumbers = booking.tables?.map((t: any) => `t${t.table_number}`).join(' ').toLowerCase() || ''
    const confirmationCode = (booking.confirmation_code || '').toLowerCase()
    const status = booking.status.toLowerCase()
    const partySize = booking.party_size.toString()
    const specialRequests = (booking.special_requests || '').toLowerCase()
    
    return guestName.includes(query) || 
           phone.includes(query) || 
           tableNumbers.includes(query) ||
           confirmationCode.includes(query) ||
           status.includes(query) ||
           partySize.includes(query) ||
           specialRequests.includes(query)
  })

  if (!restaurantId || !userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto mb-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading restaurant data...</p>
          <p className="text-sm text-gray-500 mt-1">Preparing your dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Streamlined Header */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg px-4 py-3 flex-shrink-0 border-b border-slate-700/50">
        <div className="flex items-center justify-between gap-4">
          {/* Left Side - Brand & Menu */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="lg:hidden hover:bg-slate-700/60 p-2 rounded-lg transition-all"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">RH</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Restaurant Hub
              </h1>
            </div>
          </div>

          {/* Center - Premium Search Bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-blue-600/30 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-all duration-500 animate-pulse" />
              
              {/* Main Search Container */}
              <div className="relative bg-gradient-to-r from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl rounded-2xl border border-slate-600/50 shadow-xl overflow-hidden group-focus-within:border-blue-400/60 transition-all duration-300">
                {/* Search Icon */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                  <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                </div>
                
                {/* Input Field */}
                <Input
                  placeholder="Search guests, tables, confirmations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-20 bg-transparent border-0 text-white placeholder:text-slate-400 focus:ring-0 focus:outline-none text-sm font-medium"
                />
                
                {/* Results Counter */}
                {searchQuery && (
                  <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                    <div className="flex items-center gap-1.5 bg-blue-600/90 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg border border-blue-400/30">
                      <div className="h-1.5 w-1.5 bg-blue-200 rounded-full animate-pulse" />
                      {filteredBookings.length}
                    </div>
                  </div>
                )}
                
                {/* Clear Button */}
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 hover:bg-slate-600/60 rounded-lg transition-all duration-200 group/clear"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3.5 w-3.5 text-slate-400 group-hover/clear:text-white transition-colors" />
                  </Button>
                )}
              </div>
              
              {/* Search Suggestions */}
              {!searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 opacity-0 group-focus-within:opacity-100 transition-all duration-300 pointer-events-none z-50">
                  <div className="bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl p-3 shadow-2xl">
                    <div className="text-xs text-slate-300 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-blue-400 rounded-full" />
                        <span>Guest name, phone number</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-blue-400 rounded-full" />
                        <span>Table number (T1, T2...)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-blue-400 rounded-full" />
                        <span>Confirmation code, party size</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Controls */}
          <div className="flex items-center gap-3">
            {/* Compact Quick Filters */}
            <div className="flex items-center gap-1 bg-slate-800/60 backdrop-blur-xl rounded-xl p-1 border border-slate-600/40">
              <Button
                variant={quickFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "px-3 py-2 h-8 text-xs font-semibold rounded-lg transition-all duration-300",
                  quickFilter === "all" 
                    ? "bg-white text-slate-900 shadow-md" 
                    : "text-slate-300 hover:text-white hover:bg-slate-600/60"
                )}
                onClick={() => setQuickFilter("all")}
              >
                All
              </Button>
              
              <Button
                variant={quickFilter === "dining" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "px-3 py-2 h-8 text-xs font-semibold rounded-lg transition-all duration-300",
                  quickFilter === "dining" 
                    ? "bg-emerald-500 text-white shadow-md" 
                    : "text-slate-300 hover:text-white hover:bg-slate-600/60"
                )}
                onClick={() => setQuickFilter("dining")}
              >
                Dining
                {stats.currentGuests > 0 && (
                  <span className="ml-1 bg-white/25 text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {stats.currentGuests}
                  </span>
                )}
              </Button>
              
              <Button
                variant={quickFilter === "arriving" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "px-3 py-2 h-8 text-xs font-semibold rounded-lg transition-all duration-300",
                  quickFilter === "arriving" 
                    ? "bg-blue-500 text-white shadow-md" 
                    : "text-slate-300 hover:text-white hover:bg-slate-600/60"
                )}
                onClick={() => setQuickFilter("arriving")}
              >
                Arriving
                {stats.arrivingSoonCount > 0 && (
                  <span className="ml-1 bg-white/25 text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {stats.arrivingSoonCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Live Stats */}
            <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur-xl rounded-xl px-3 py-2 border border-slate-600/40">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-emerald-400">{stats.currentGuests}</span>
                <span className="text-xs text-slate-400">dining</span>
              </div>
              
              <div className="w-px h-4 bg-slate-600" />
              
              <div className="flex items-center gap-1.5">
                <Table2 className="h-3 w-3 text-blue-400" />
                <span className="text-sm font-bold text-blue-400">{stats.availableTables}</span>
                <span className="text-xs text-slate-400">free</span>
              </div>
              
              <div className="w-px h-4 bg-slate-600" />
              
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  stats.occupancyRate > 80 ? "bg-red-400" : stats.occupancyRate > 60 ? "bg-yellow-400" : "bg-green-400"
                )} />
                <span className={cn(
                  "text-sm font-bold",
                  stats.occupancyRate > 80 ? "text-red-400" : stats.occupancyRate > 60 ? "text-yellow-400" : "text-green-400"
                )}>{stats.occupancyRate}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowTimeline(!showTimeline)}
                size="sm"
                className={cn(
                  "px-4 py-2 h-9 text-sm font-semibold rounded-xl transition-all duration-300",
                  showTimeline 
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                    : "bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600/50"
                )}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Timeline
              </Button>
              
              <Button
                onClick={() => setShowManualBooking(true)}
                size="sm"
                className="px-4 py-2 h-9 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg rounded-xl transition-all duration-300 hover:scale-105"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                New Guest
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Critical Alerts */}
      <CriticalAlerts 
        pendingCount={stats.pendingCount}
        awaitingCheckIn={stats.awaitingCheckIn}
        bookings={todaysBookings}
        currentTime={currentTime}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area - Floor Plan */}
        <main className="flex-1 p-4 overflow-auto">
          <UnifiedFloorPlan
            tables={tables}
            bookings={filteredBookings}
            currentTime={currentTime}
            restaurantId={restaurantId}
            userId={userId}
            onTableClick={(table, statusInfo) => {
              if (statusInfo.current) {
                setSelectedBooking(todaysBookings.find(b => b.id === statusInfo.current.id))
              } else if (statusInfo.upcoming) {
                setSelectedBooking(todaysBookings.find(b => b.id === statusInfo.upcoming.id))
              }
            }}
            onStatusUpdate={(bookingId, status) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
            onTableSwitch={handleTableSwitch}
            onCheckIn={handleCheckIn}
            searchQuery={searchQuery}
          />
        </main>

        {/* Optimized Sidebar - Cleaner Layout */}
        <aside className={cn(
          "bg-gradient-to-br from-white via-gray-50 to-blue-50/30 border-l border-gray-200 shadow-xl flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-96",
          "absolute lg:relative inset-y-0 right-0 z-40"
        )}>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            onClick={() => setSidebarCollapsed(true)}
            className="lg:hidden absolute top-3 right-3 z-50 hover:bg-gray-100 p-2 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Compact Operations Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={cn(
                "text-center p-2.5 rounded-lg border transition-all",
                stats.pendingCount > 0 ? "bg-red-50 border-red-200 shadow-sm animate-pulse" : "bg-gray-50 border-gray-200"
              )}>
                <p className="text-lg font-bold text-red-600">{stats.pendingCount}</p>
                <p className="text-xs text-red-500 font-medium">Pending</p>
              </div>
              <div className={cn(
                "text-center p-2.5 rounded-lg border transition-all",
                stats.awaitingCheckIn > 0 ? "bg-orange-50 border-orange-200 shadow-sm animate-pulse" : "bg-gray-50 border-gray-200"
              )}>
                <p className="text-lg font-bold text-orange-600">{stats.awaitingCheckIn}</p>
                <p className="text-xs text-orange-500 font-medium">Check-in</p>
              </div>
            </div>
            
            {/* Secondary Stats */}
            <div className="flex gap-2 text-xs">
              <div className="flex-1 text-center p-2 bg-green-50 rounded border border-green-200">
                <p className="font-bold text-green-700">{stats.totalCompleted}</p>
                <p className="text-green-600">Completed</p>
              </div>
              <div className="flex-1 text-center p-2 bg-blue-50 rounded border border-blue-200">
                <p className="font-bold text-blue-700">{stats.tablesInUse}</p>
                <p className="text-blue-600">In Use</p>
              </div>
              {stats.vipCount > 0 && (
                <div className="flex-1 text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="font-bold text-yellow-700">{stats.vipCount}</p>
                  <p className="text-yellow-600">VIP</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Priority Sections */}
            {stats.pendingCount > 0 && (
              <div className="pending-requests">
                <PendingRequestsPanel
                  bookings={todaysBookings}
                  restaurantId={restaurantId}
                  userId={userId}
                  onUpdate={() => queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })}
                />
              </div>
            )}

            {/* Check-in Queue */}
            <div className="border-t border-gray-200">
              <CheckInQueue
                bookings={activeBookings}
                tables={tables}
                currentTime={currentTime}
                onCheckIn={handleCheckIn}
                onQuickSeat={handleQuickSeat}
                customersData={customersData}
                onSelectBooking={setSelectedBooking}
                restaurantId={restaurantId}
              />
            </div>
          </div>
          
          {/* Minimal Footer */}
          <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{format(currentTime, "h:mm a")}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchBookings()}
                className="h-7 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Refined Floating Action Hub */}
      {(stats.awaitingCheckIn > 0 || stats.pendingCount > 0) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex flex-col gap-3">
            {stats.pendingCount > 0 && (
              <div className="relative group">
                <div className="absolute inset-0 bg-red-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity animate-pulse" />
                <Button
                  size="lg"
                  className="relative rounded-2xl shadow-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white px-6 py-3 h-14 text-sm font-bold border border-red-400/50 transition-all duration-300 hover:scale-105"
                  onClick={() => {
                    document.querySelector('.pending-requests')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Timer className="h-5 w-5 mr-2" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs opacity-90">Pending</span>
                    <span className="text-lg font-black">{stats.pendingCount}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-yellow-400 text-red-900 rounded-full flex items-center justify-center text-xs font-black animate-bounce">
                    !
                  </div>
                </Button>
              </div>
            )}
            
            {stats.awaitingCheckIn > 0 && (
              <div className="relative group">
                <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                <Button
                  size="lg"
                  className="relative rounded-2xl shadow-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-6 py-3 h-14 text-sm font-bold border border-orange-400/50 transition-all duration-300 hover:scale-105"
                  onClick={() => {
                    const awaitingBooking = todaysBookings.find(b => b.status === 'arrived')
                    if (awaitingBooking) {
                      handleCheckIn(awaitingBooking.id)
                    }
                  }}
                >
                  <UserCheck className="h-5 w-5 mr-2" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs opacity-90">Check-in</span>
                    <span className="text-lg font-black">{stats.awaitingCheckIn}</span>
                  </div>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals - Streamlined */}
      {/* Timeline View Modal */}
      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Timeline View
              </DialogTitle>
              <DialogDescription>
                Complete overview of today's reservations and activity
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TodaysTimeline
              bookings={todaysBookings}
              currentTime={currentTime}
              onSelectBooking={setSelectedBooking}
              onUpdateStatus={(bookingId, status) => 
                updateBookingMutation.mutate({ bookingId, updates: { status } })
              }
              customersData={customersData}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-3xl w-full h-[90vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Add New Booking
              </DialogTitle>
              <DialogDescription>
                Create reservation for walk-ins or phone bookings
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <ManualBookingForm
              restaurantId={restaurantId}
              onSubmit={(data) => createManualBookingMutation.mutate(data)}
              onCancel={() => setShowManualBooking(false)}
              isLoading={createManualBookingMutation.isPending}
              currentBookings={todaysBookings}
            />
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Check-in Table Selection Dialog */}
      <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-blue-600" />
              Select Table
            </DialogTitle>
            <DialogDescription>
              Choose an available table for check-in
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">
            {tables
              .filter(table => {
                const isOccupied = currentlyDining.some(booking => 
                  booking.tables?.some((t: any) => t.id === table.id)
                )
                return !isOccupied && table.is_active
              })
              .map(table => (
                <Button
                  key={table.id}
                  variant="outline"
                  size="sm"
                  className="h-12 flex flex-col gap-1"
                  onClick={() => {
                    if (checkInBookingId) {
                      handleCheckIn(checkInBookingId, [table.id])
                      setShowCheckInDialog(false)
                      setCheckInBookingId(null)
                    }
                  }}
                >
                  <span className="font-bold">T{table.table_number}</span>
                  <span className="text-xs text-gray-500">{table.capacity} seats</span>
                </Button>
              ))}
          </div>
          {tables.filter(table => {
            const isOccupied = currentlyDining.some(booking => 
              booking.tables?.some((t: any) => t.id === table.id)
            )
            return !isOccupied && table.is_active
          }).length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tables available. All tables are occupied or reserved.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}