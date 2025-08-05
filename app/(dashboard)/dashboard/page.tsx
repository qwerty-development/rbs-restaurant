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
  Keyboard,
  Volume2,
  VolumeX,
  Info
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
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') return
      
      switch(e.key.toLowerCase()) {
        case 'w':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setShowManualBooking(true)
          }
          break
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            refetchBookings()
          }
          break
        case '/':
          e.preventDefault()
          const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
          searchInput?.focus()
          break
        case 'escape':
          setSearchQuery("")
          setSelectedBooking(null)
          setShowManualBooking(false)
          break
        case '?':
          if (e.shiftKey) {
            e.preventDefault()
            setShowKeyboardShortcuts(!showKeyboardShortcuts)
          }
          break
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setSoundEnabled(!soundEnabled)
            toast(soundEnabled ? "Sound notifications disabled" : "Sound notifications enabled")
          }
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showKeyboardShortcuts, soundEnabled])

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
                  {/* Keyboard Shortcuts Modal */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Quick keyboard commands to navigate the dashboard efficiently
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 py-4">
            <div>
              <h4 className="font-semibold mb-3 text-sm text-gray-700">Navigation</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Search</span>
                  <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">/</kbd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Clear search/Close dialogs</span>
                  <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">Esc</kbd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Show shortcuts</span>
                  <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">?</kbd>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm text-gray-700">Actions</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Add walk-in</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">⌘</kbd>
                    <span className="text-xs">+</span>
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">W</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Refresh data</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">⌘</kbd>
                    <span className="text-xs">+</span>
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">R</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Toggle sound</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">⌘</kbd>
                    <span className="text-xs">+</span>
                    <kbd className="px-2 py-1 bg-gray-400 border border-gray-300 rounded text-xs font-mono">S</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Use <kbd className="px-1.5 py-0.5 bg-gray-400 border border-gray-300 rounded text-xs font-mono">Ctrl</kbd> instead of <kbd className="px-1.5 py-0.5 bg-gray-400 border border-gray-300 rounded text-xs font-mono">⌘</kbd> on Windows/Linux
            </p>
          </div>
        </DialogContent>
      </Dialog>
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

  // Calculate stats
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
    
    return guestName.includes(query) || 
           phone.includes(query) || 
           tableNumbers.includes(query) ||
           confirmationCode.includes(query)
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
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="lg:hidden hover:bg-slate-700"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                Restaurant Dashboard
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span>{format(currentTime, "EEEE, MMMM d")}</span>
                <span className="text-gray-500">•</span>
                <span className="font-mono tracking-wider text-gray-200">{format(currentTime, "h:mm:ss a")}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Quick Filters */}
            <div className="hidden md:flex items-center gap-1 bg-slate-700/50 backdrop-blur rounded-lg p-1">
              <Button
                size="sm"
                variant={quickFilter === "all" ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2 text-xs transition-all",
                  quickFilter === "all" 
                    ? "bg-white text-slate-900 hover:bg-gray-400" 
                    : "text-gray-300 hover:text-white hover:bg-slate-600"
                )}
                onClick={() => setQuickFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={quickFilter === "needs-table" ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2 text-xs transition-all",
                  quickFilter === "needs-table" 
                    ? "bg-red-500 text-white hover:bg-red-600" 
                    : "text-gray-300 hover:text-white hover:bg-slate-600"
                )}
                onClick={() => setQuickFilter("needs-table")}
              >
                <Table2 className="h-3 w-3 mr-1" />
                Needs Table
              </Button>
              <Button
                size="sm"
                variant={quickFilter === "dining" ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2 text-xs transition-all",
                  quickFilter === "dining" 
                    ? "bg-green-500 text-white hover:bg-green-600" 
                    : "text-gray-300 hover:text-white hover:bg-slate-600"
                )}
                onClick={() => setQuickFilter("dining")}
              >
                <Clock className="h-3 w-3 mr-1" />
                Dining
              </Button>
              <Button
                size="sm"
                variant={quickFilter === "arriving" ? "secondary" : "ghost"}
                className={cn(
                  "h-7 px-2 text-xs transition-all",
                  quickFilter === "arriving" 
                    ? "bg-blue-500 text-white hover:bg-blue-600" 
                    : "text-gray-300 hover:text-white hover:bg-slate-600"
                )}
                onClick={() => setQuickFilter("arriving")}
              >
                <UserCheck className="h-3 w-3 mr-1" />
                Arriving
              </Button>
            </div>

            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search guests, tables... (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-slate-700/50 border-slate-600 text-white placeholder:text-gray-400 focus:bg-slate-700 focus:border-slate-500"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 hover:bg-slate-600"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Quick stats */}
            <div className="hidden lg:flex items-center gap-4 px-4 border-l border-slate-600">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.currentGuests}</p>
                <p className="text-xs text-gray-300">Guests</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{stats.availableTables}</p>
                <p className="text-xs text-gray-300">Free Tables</p>
              </div>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-gray-300 hover:bg-slate-700 hover:text-white"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                className="text-gray-300 hover:bg-slate-700 hover:text-white"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              onClick={() => setShowManualBooking(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Walk-in
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchBookings()}
              className="border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
        
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

        {/* Sidebar */}
        <aside className={cn(
          "bg-gradient-to-b from-white to-gray-500 border-l shadow-xl flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-96",
          "absolute lg:relative inset-y-0 right-0 z-40"
        )}>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(true)}
            className="lg:hidden absolute top-2 right-2 z-50 hover:bg-gray-400"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex-1 overflow-y-auto">
            {/* Pending Requests - Priority */}
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
            <div className="border-t">
              <CheckInQueue
                bookings={activeBookings}
                tables={tables}
                currentTime={currentTime}
                onCheckIn={handleCheckIn}
                onQuickSeat={handleQuickSeat}
                customersData={customersData}
                onSelectBooking={setSelectedBooking}
              />
            </div>
          </div>
          
          {/* Quick Stats Footer */}
          <div className="p-4 border-t bg-gradient-to-b from-gray-50 to-white">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Today's Performance</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="text-2xl font-bold text-green-700">{stats.currentGuests}</p>
                <p className="text-xs text-green-600 font-medium">Current Guests</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">{todaysBookings.filter(b => b.status === 'completed').length}</p>
                <p className="text-xs text-blue-600 font-medium">Completed Today</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <p className="text-2xl font-bold text-orange-700">
                  {Math.round((tables.filter(t => t.is_active).length - stats.availableTables) / tables.filter(t => t.is_active).length * 100)}%
                </p>
                <p className="text-xs text-orange-600 font-medium">Occupancy Rate</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <p className="text-2xl font-bold text-purple-700">
                  {activeBookings.filter(b => !b.tables || b.tables.length === 0).length}
                </p>
                <p className="text-xs text-purple-600 font-medium">Need Tables</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Action Buttons for Critical Actions */}
      {(stats.awaitingCheckIn > 0 || stats.pendingCount > 0) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex flex-col gap-3">
            {stats.pendingCount > 0 && (
              <Button
                size="lg"
                className="rounded-full shadow-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white animate-bounce px-6"
                onClick={() => {
                  // Scroll to pending requests
                  document.querySelector('.pending-requests')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <Timer className="h-5 w-5 mr-2" />
                {stats.pendingCount} Pending
              </Button>
            )}
            
            {stats.awaitingCheckIn > 0 && (
              <Button
                size="lg"
                className="rounded-full shadow-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-6"
                onClick={() => {
                  const awaitingBooking = todaysBookings.find(b => b.status === 'arrived')
                  if (awaitingBooking) {
                    handleCheckIn(awaitingBooking.id)
                  }
                }}
              >
                <UserCheck className="h-5 w-5 mr-2" />
                Check-in ({stats.awaitingCheckIn})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Booking</DialogTitle>
              <DialogDescription>
                Create a booking for walk-in guests or phone reservations
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Table for Check-in</DialogTitle>
            <DialogDescription>
              Choose an available table for this guest
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
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
                  onClick={() => {
                    if (checkInBookingId) {
                      handleCheckIn(checkInBookingId, [table.id])
                      setShowCheckInDialog(false)
                      setCheckInBookingId(null)
                    }
                  }}
                >
                  T{table.table_number} ({table.capacity})
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
                No tables are currently available. All tables are either occupied or reserved.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}