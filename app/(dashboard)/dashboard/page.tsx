// app/(dashboard)/dashboard/page.tsx - UPDATED WITH WAITLIST
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes, differenceInMinutes, addDays } from "date-fns"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { UnifiedFloorPlan } from "@/components/dashboard/unified-floor-plan"
import { CheckInQueue } from "@/components/dashboard/checkin-queue"
import { WaitlistPanel } from "@/components/dashboard/waitlist-panel"
import { PendingRequestsPanel } from "@/components/dashboard/pending-requests-panel"
import { CriticalAlerts } from "@/components/dashboard/critical-alerts"
import { TodaysTimeline } from "@/components/dashboard/todays-timeline"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { BookingDetails } from "@/components/bookings/booking-details"
import { BookingConflictAlerts } from "@/components/dashboard/booking-conflict-alerts"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { BookingRequestService } from "@/lib/booking-request-service"
import { useSharedTablesSummary } from "@/hooks/use-shared-tables"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  BarChart3,
  AlertTriangle,
  List,
  Badge,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export default function DashboardPage() {
  const router = useRouter()
  const { currentRestaurant, tier, isLoading: contextLoading } = useRestaurantContext()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [showCheckInDialog, setShowCheckInDialog] = useState(false)
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [quickFilter, setQuickFilter] = useState<"all" | "needs-table" | "dining" | "arriving">("all")
  const [showTimeline, setShowTimeline] = useState(false)
  const [sidebarView, setSidebarView] = useState<"queue" | "waitlist">("queue")
  const [confirmationDialog, setConfirmationDialog] = useState<{
    show: boolean
    booking?: any
    tableIds?: string[]
    warnings: string[]
    onConfirm: () => void
  }>({ show: false, warnings: [], onConfirm: () => {} })
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()
  const requestService = new BookingRequestService()

  // Redirect Basic tier users to their dedicated dashboard - MUST be before any conditional returns
  useEffect(() => {
    if (tier === 'basic') {
      router.replace('/basic-dashboard')
    }
  }, [tier, router])

  // Comprehensive table availability validation
  const validateTableAvailability = (tableIds: string[], bookingId: string, partySize: number): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!tableIds || tableIds.length === 0) {
      errors.push("No tables selected")
      return { valid: false, errors, warnings }
    }

    for (const tableId of tableIds) {
      const table = tables.find(t => t.id === tableId)
      if (!table) {
        errors.push(`Table not found`)
        continue
      }

      if (!table.is_active) {
        errors.push(`Table ${table.table_number} is not active`)
        continue
      }

      const isOccupied = todaysBookings.some(booking => {
        if (booking.id === bookingId) return false
        const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return occupiedStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === tableId)
      })

      if (isOccupied) {
        const occupyingBooking = todaysBookings.find(booking => 
          booking.id !== bookingId &&
          ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status) && 
          booking.tables?.some((t: any) => t.id === tableId)
        )
        const guestName = occupyingBooking?.user?.full_name || occupyingBooking?.guest_name || 'Unknown'
        errors.push(`Table ${table.table_number} is occupied by ${guestName}`)
        continue
      }

      const upcomingBooking = todaysBookings.find(booking => {
        if (booking.id === bookingId) return false
        const bookingTime = new Date(booking.booking_time)
        const timeDiff = differenceInMinutes(bookingTime, currentTime)
        return booking.status === 'confirmed' && 
               timeDiff > 0 && timeDiff <= 120 &&
               booking.tables?.some((t: any) => t.id === tableId)
      })

      if (upcomingBooking) {
        const bookingTime = format(new Date(upcomingBooking.booking_time), 'h:mm a')
        const guestName = upcomingBooking.user?.full_name || upcomingBooking.guest_name || 'Unknown'
        warnings.push(`Table ${table.table_number} has reservation at ${bookingTime} for ${guestName}`)
      }
    }

    const totalCapacity = tableIds
      .map(id => tables.find(t => t.id === id))
      .filter(Boolean)
      .reduce((sum, table) => sum + (table?.max_capacity || 0), 0)

    if (totalCapacity < partySize) {
      errors.push(`Selected tables can seat ${totalCapacity} but party size is ${partySize}`)
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleEscape = () => {
      setSearchQuery("")
      setSelectedBooking(null)
      setShowManualBooking(false)
    }
    
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
        
        // Get restaurant ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search)
        const restaurantParam = urlParams.get('restaurant')
        
        if (restaurantParam) {
          // Verify user has access to this restaurant
          const { data: staffData } = await supabase
            .from("restaurant_staff")
            .select("restaurant_id")
            .eq("user_id", user.id)
            .eq("restaurant_id", restaurantParam)
            .eq("is_active", true)
            .single()
          
          if (staffData) {
            setRestaurantId(staffData.restaurant_id)
          }
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
          user:profiles!bookings_user_id_fkey(
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
        // user is already correctly mapped from the query
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table).filter(Boolean) || []
      })) || []

      return transformedData
    },
    enabled: !!restaurantId,
    refetchInterval: 30000,
  })

  // Fetch waitlist count
  const { data: waitlistStats = { active: 0, notified: 0, total: 0 } } = useQuery({
    queryKey: ["waitlist-stats", restaurantId, format(currentTime, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!restaurantId) return { active: 0, notified: 0, total: 0 }
      
      const { data, error } = await supabase
        .from('waitlist')
        .select('status')
        .eq('restaurant_id', restaurantId)
        .eq('desired_date', format(currentTime, 'yyyy-MM-dd'))
      
      if (error) {
        console.error('Error fetching waitlist stats:', error)
        return { active: 0, notified: 0, total: 0 }
      }
      
      const stats = {
        active: data?.filter(e => e.status === 'active').length || 0,
        notified: data?.filter(e => e.status === 'notified').length || 0,
        total: data?.length || 0
      }
      
      return stats
    },
    enabled: !!restaurantId,
    refetchInterval: 30000,
  })

  // Fetch all tables with section information
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["restaurant-tables-with-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          *,
          section:restaurant_sections(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Fetch shared tables summary
  const { data: sharedTablesSummary } = useSharedTablesSummary(restaurantId, currentTime)

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
      queryClient.invalidateQueries({ queryKey: ["shared-tables-summary", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["shared-table-availability"] })
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
      if (!booking) {
        toast.error("Booking not found")
        return
      }

      const finalTableIds = tableIds || booking.tables?.map((t: any) => t.id) || []
      
      if (finalTableIds.length === 0) {
        setCheckInBookingId(bookingId)
        setShowCheckInDialog(true)
        return
      }

      const validation = validateTableAvailability(finalTableIds, bookingId, booking.party_size)
      
      if (!validation.valid) {
        validation.errors.forEach(error => toast.error(error))
        return
      }

      if (validation.warnings.length > 0) {
        setConfirmationDialog({
          show: true,
          booking,
          tableIds: finalTableIds,
          warnings: validation.warnings,
          onConfirm: async () => {
            setConfirmationDialog({ show: false, warnings: [], onConfirm: () => {} })
            await proceedWithCheckIn(booking, finalTableIds)
          }
        })
        return
      }

      await proceedWithCheckIn(booking, finalTableIds)
    } catch (error) {
      console.error("Check-in error:", error)
      toast.error("Failed to check in guest")
    }
  }

  const proceedWithCheckIn = async (booking: any, finalTableIds: string[]) => {
    try {
      if (booking.status === 'arrived') {
        if (finalTableIds.length > 0 && (!booking.tables || booking.tables.length === 0)) {
          const tableAssignments = finalTableIds.map((tableId: string) => ({
            booking_id: booking.id,
            table_id: tableId
          }))
          
          const { error: tableError } = await supabase
            .from("booking_tables")
            .insert(tableAssignments)
            
          if (tableError) {
            console.error("Table assignment error:", tableError)
            toast.error("Failed to assign tables")
            return
          }
        }
        
        await statusService.updateBookingStatus(booking.id, 'seated', userId)
        
        const tableNumbers = finalTableIds
          .map((id: string) => tables.find(t => t.id === id)?.table_number)
          .filter(Boolean)
          .join(', ')
        toast.success(`Guest seated at Table ${tableNumbers}`)
      } else {
        await statusService.checkInBooking(booking.id, finalTableIds, userId)
        toast.success("Guest checked in successfully")
      }

      await queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["shared-tables-summary", restaurantId] })
      await queryClient.invalidateQueries({ queryKey: ["shared-table-availability"] })
      await refetchBookings()
    } catch (error) {
      console.error("Proceed check-in error:", error)
      toast.error("Failed to complete check-in")
    }
  }

  // Handle waitlist conversion to booking
  const handleWaitlistToBooking = async (entry: any, tableIds?: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in")
      
      // Parse time range
      const [startTime] = entry.desired_time_range.split('-')
      const bookingTime = new Date(`${entry.desired_date}T${startTime}:00`)
      
      // Create booking from waitlist
      const { data, error } = await supabase
        .rpc('convert_waitlist_to_booking', {
          p_waitlist_id: entry.id,
          p_staff_user_id: user.id
        })
      
      if (error) throw error
      
      toast.success("Waitlist entry converted to booking")
      
      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["waitlist-stats"] })
      
    } catch (error) {
      console.error("Waitlist conversion error:", error)
      toast.error("Failed to convert waitlist entry")
    }
  }

  // Handle table switch
  const handleTableSwitch = async (bookingId: string, newTableIds: string[]) => {
    try {
      const booking = todaysBookings.find(b => b.id === bookingId)
      if (!booking) {
        toast.error("Booking not found")
        return
      }

      const validation = validateTableAvailability(newTableIds, bookingId, booking.party_size)
      
      if (!validation.valid) {
        validation.errors.forEach(error => toast.error(error))
        return
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast.error(warning, { 
          duration: 4000,
          style: { backgroundColor: '#7A2E4A', color: 'white' } 
        }))
      }

      await statusService.switchTables(bookingId, newTableIds, userId, "Table switch requested")
      await queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["shared-tables-summary", restaurantId] })
      await queryClient.invalidateQueries({ queryKey: ["shared-table-availability"] })
      
      const tableNumbers = newTableIds
        .map((id: string) => tables.find(t => t.id === id)?.table_number)
        .filter(Boolean)
        .join(', ')
      toast.success(`Table switched to ${tableNumbers}`)
    } catch (error) {
      console.error("Table switch error:", error)
      toast.error("Failed to switch tables")
    }
  }

  // Table position update mutation
  const updateTablePositionMutation = useMutation({
    mutationFn: async ({ tableId, position }: { tableId: string; position: { x: number; y: number } }) => {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({
          x_position: position.x,
          y_position: position.y,
        })
        .eq('id', tableId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables', restaurantId] })
      toast.success('Table position updated')
    },
    onError: (error) => {
      console.error('Table position update error:', error)
      toast.error('Failed to update table position')
    }
  })

  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      const bookingTime = new Date(bookingData.booking_time)
      const isWalkIn = bookingData.status === 'arrived' || bookingTime <= new Date()
      
      let finalUserId = user.id
      
      if (bookingData.customer_id && bookingData.user_id) {
        finalUserId = bookingData.user_id
      }
      
      const result = await requestService.createBookingRequest({
        restaurantId,
        userId: finalUserId,
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

      if (bookingData.customer_id) {
        const { error: updateError } = await supabase
          .rpc('increment_customer_bookings', {
            customer_id: bookingData.customer_id,
            visit_time: bookingTime.toISOString()
          })
        
        if (updateError) {
          const { data: currentCustomer } = await supabase
            .from("restaurant_customers")
            .select("total_bookings")
            .eq("id", bookingData.customer_id)
            .single()
          
          if (currentCustomer) {
            await supabase
              .from("restaurant_customers")
              .update({
                total_bookings: (currentCustomer.total_bookings || 0) + 1,
                last_visit: bookingTime.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq("id", bookingData.customer_id)
          }
        }
      }

      // Handle shared table booking
      if (bookingData.is_shared_booking && bookingData.table_ids && bookingData.table_ids.length > 0) {
        const { error: sharedTableError } = await supabase
          .from("bookings")
          .update({
            is_shared_booking: true
          })
          .eq("id", booking.id)

        if (sharedTableError) {
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw sharedTableError
        }

        // Insert into booking_tables with proper seats_occupied for shared table
        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert({
            booking_id: booking.id,
            table_id: bookingData.table_ids[0], // Shared tables use the first (and only) table ID
            seats_occupied: bookingData.party_size // Use party_size for seats_occupied
          })

        if (tableError) {
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      } else if (bookingData.table_ids && bookingData.table_ids.length > 0 && booking.status !== 'pending') {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
          seats_occupied: 1 // Default for regular tables
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
      queryClient.invalidateQueries({ queryKey: ["shared-tables-summary", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["shared-table-availability"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  const handleQuickSeat = (guestData: any, tableIds: string[]) => {
    // Skip regular table validation for shared table bookings
    if (!guestData.is_shared_booking) {
      const validation = validateTableAvailability(tableIds, '', guestData.party_size)
      
      if (!validation.valid) {
        validation.errors.forEach(error => toast.error(error))
        return
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast.error(warning, { 
          duration: 4000,
          style: { backgroundColor: '#7A2E4A', color: 'white' }
        }))
      }
    } else if (guestData.is_shared_booking) {
      // Basic validation for shared tables - check if there are enough available seats
      const sharedTableId = tableIds && tableIds[0] // Use the tableIds parameter instead
      const sharedTable = tables.find(t => t.id === sharedTableId)
      
      console.log("Shared table validation:", { sharedTableId, sharedTable, tablesCount: tables.length })
      
      if (!sharedTable) {
        console.error("Shared table not found:", { sharedTableId, availableTables: tables.map(t => ({ id: t.id, table_number: t.table_number })) })
        toast.error("Selected shared table not found")
        return
      }

      // Note: Capacity checking is now handled by the UI with user confirmation
      // This allows exceeding capacity when explicitly confirmed by staff
    }

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

  // Calculate comprehensive stats including waitlist
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
    needingTables: activeBookings.filter(b => !b.tables || b.tables.length === 0).length,
    // Waitlist stats
    waitlistActive: waitlistStats.active,
    waitlistNotified: waitlistStats.notified,
    waitlistTotal: waitlistStats.total,
    // Shared tables stats
    sharedTablesOccupancy: sharedTablesSummary?.reduce((sum, table) => sum + table.current_occupancy, 0) || 0,
    sharedTablesCapacity: sharedTablesSummary?.reduce((sum, table) => sum + table.capacity, 0) || 0,
    sharedTablesCount: sharedTablesSummary?.length || 0
  }

  // Filtered bookings based on search and quick filter
  const filteredBookings = activeBookings.filter(booking => {
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
    
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    const guestName = (booking.guest_name || booking.user?.full_name || '').toLowerCase()
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

  // Loading state for context and initial data
  if (contextLoading || !restaurantId || !userId || tier === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background to-card" suppressHydrationWarning>
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-foreground">Loading restaurant data...</p>
          <p className="text-sm text-muted-foreground mt-1">Preparing your dashboard</p>
        </div>
      </div>
    )
  }

  // Basic tier users are redirected via useEffect at the top
  if (tier === 'basic') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Redirecting to Basic dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background to-card overflow-hidden">
      {/* Ultra-Compact Header with Waitlist Stats */}
      <header className="bg-gradient-to-br from-primary via-primary/90 to-primary text-primary-foreground shadow-lg px-2 py-1 flex-shrink-0 border-b border-primary/30">
        <div className="flex items-center justify-between gap-2">
          {/* Left Side - Brand & Live Stats */}
          <div className="flex items-center gap-2">
            {/* Enhanced Live Stats including Waitlist */}
            <div className="hidden sm:flex items-center gap-2 bg-primary/20 backdrop-blur-xl rounded-md px-2 py-0.5 border border-primary/30">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-emerald-400">{stats.currentGuests}</span>
                <span className="text-xs text-slate-400">Dining</span>
              </div>
              <div className="w-px h-3.5 bg-slate-600" />
              <div className="flex items-center gap-1">
                <Table2 className="h-3 w-3 text-blue-400" />
                <span className="text-xs font-bold text-blue-400">{stats.availableTables}</span>
                <span className="text-xs text-slate-400">Free</span>
              </div>
              {stats.waitlistActive > 0 && (
                <>
                  <div className="w-px h-3.5 bg-slate-600" />
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3 text-orange-400" />
                    <span className="text-xs font-bold text-orange-400">{stats.waitlistActive}</span>
                    <span className="text-xs text-slate-400">waiting</span>
                  </div>
                </>
              )}
              {stats.sharedTablesCount > 0 && (
                <>
                  <div className="w-px h-3.5 bg-slate-600" />
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-purple-400" />
                    <span className="text-xs font-bold text-purple-400">{stats.sharedTablesOccupancy}/{stats.sharedTablesCapacity}</span>
                    <span className="text-xs text-slate-400">Shared</span>
                  </div>
                </>
              )}
              <div className="w-px h-3.5 bg-slate-600" />
              <div className="flex items-center gap-1">
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  stats.occupancyRate > 80 ? "bg-red-400" : stats.occupancyRate > 60 ? "bg-yellow-400" : "bg-green-400"
                )} />
                <span className={cn(
                  "text-xs font-bold",
                  stats.occupancyRate > 80 ? "text-red-400" : stats.occupancyRate > 60 ? "text-yellow-400" : "text-green-400"
                )}>{stats.occupancyRate}%</span>
                <span className="text-xs text-slate-400">Full</span>
              </div>
            </div>
          </div>

          {/* Center - Ultra-Compact Search */}
          <div className="flex-1 max-w-xs mx-2">
            <div className="relative">
              <div className="relative bg-slate-800/90 backdrop-blur-xl rounded-md border border-slate-600/50 overflow-hidden">
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                  <Search className="h-3 w-3 text-slate-400" />
                </div>
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-7 pl-7 pr-8 bg-transparent border-0 text-white placeholder:text-slate-400 focus:ring-0 focus:outline-none text-xs"
                />
                {searchQuery && (
                  <div className="absolute right-1.5 top-1/2 transform -translate-y-1/2">
                    <div className="flex items-center gap-1 bg-blue-600/90 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                      {filteredBookings.length}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Compact Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setShowTimeline(!showTimeline)}
              size="sm"
              className={cn(
                "px-2 py-1 h-6 text-xs font-medium rounded-md transition-all duration-300",
                showTimeline 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                  : "bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600/50"
              )}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Timeline</span>
            </Button>
            
            <Button
              onClick={() => setShowManualBooking(true)}
              size="sm"
              className="px-2 py-1 h-6 text-xs font-medium bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg rounded-md transition-all duration-300"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">New</span>
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

      {/* PWA Install Prompt */}
      <div className="px-4">
        <InstallPrompt />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Floor Plan */}
        <div className="flex-1 min-w-0 overflow-hidden">
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
            onTableUpdate={(tableId, position) => 
              updateTablePositionMutation.mutate({ tableId, position })
            }
            searchQuery={searchQuery}
            defaultSectionId="all"
          />
        </div>

        {/* Right Sidebar with Tabs for Queue and Waitlist */}
        <div className="w-[380px] border-l border-border bg-card flex flex-col flex-shrink-0 overflow-hidden">
          {/* Pending Requests Section */}
          {stats.pendingCount > 0 && (
            <div className="border-b border-border flex-shrink-0">
              <div className="p-3">
                <PendingRequestsPanel
                  bookings={todaysBookings}
                  restaurantId={restaurantId}
                  userId={userId}
                  onUpdate={() => queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })}
                />
              </div>
            </div>
          )}

          {/* Booking Conflict Alerts */}
          <div className="px-2 py-1 flex-shrink-0">
            <BookingConflictAlerts
              bookings={activeBookings}
              tables={tables}
              currentTime={currentTime}
              onSelectBooking={setSelectedBooking}
              onOpenTableSwitch={(bookingId) => {
                const booking = activeBookings.find(b => b.id === bookingId)
                if (booking) {
                  setSelectedBooking(booking)
                }
              }}
            />
          </div>
          
          {/* Tabs for Queue and Waitlist */}
          <Tabs value={sidebarView} onValueChange={(v) => setSidebarView(v as "queue" | "waitlist")} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 px-2 pt-1">
              <TabsTrigger value="queue" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Queue
                {(stats.awaitingCheckIn > 0 || stats.arrivingSoonCount > 0) && (
                  <Badge className="ml-1 h-4 px-1 text-xs">
                    {stats.awaitingCheckIn + stats.arrivingSoonCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Waitlist
                {stats.waitlistActive > 0 && (
                  <Badge className="ml-1 h-4 px-1 text-xs bg-orange-100 text-orange-800">
                    {stats.waitlistActive}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="queue" className="flex-1 overflow-hidden m-0 p-0">
              <CheckInQueue
                bookings={activeBookings}
                tables={tables}
                currentTime={currentTime}
                onCheckIn={handleCheckIn}
                onQuickSeat={handleQuickSeat}
                onTableSwitch={handleTableSwitch}
                onStatusUpdate={(bookingId, status) =>
                  updateBookingMutation.mutate({ bookingId, updates: { status } })
                }
                customersData={customersData}
                onSelectBooking={setSelectedBooking}
                restaurantId={restaurantId}
              />
            </TabsContent>
            
            <TabsContent value="waitlist" className="flex-1 overflow-hidden m-0 p-0">
              <WaitlistPanel
                restaurantId={restaurantId}
                currentTime={currentTime}
                tables={tables}
                bookings={activeBookings}
                onConvertToBooking={handleWaitlistToBooking}
                onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ["waitlist-stats"] })
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* All modals remain the same */}
      {/* Confirmation Dialog for Warnings */}
      <Dialog open={confirmationDialog.show} onOpenChange={(open) => 
        !open && setConfirmationDialog({ show: false, warnings: [], onConfirm: () => {} })
      }>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Seating
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please review these concerns before seating the guest:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {confirmationDialog.warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800 leading-relaxed">{warning}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmationDialog({ show: false, warnings: [], onConfirm: () => {} })}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmationDialog.onConfirm}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              Seat Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <span className="text-xs text-muted-foreground">{table.max_capacity} seats</span>
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