// app/(dashboard)/dashboard/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes, differenceInMinutes, addDays } from "date-fns"
import { OperationalStatusCards } from "@/components/dashboard/operational-status-cards"
import { TodaysTimeline } from "@/components/dashboard/todays-timeline"
import { TableStatusView } from "@/components/dashboard/table-status-view"
import { EnhancedFloorPlan } from "@/components/dashboard/enhanced-floor-plan"
import { CheckInManager } from "@/components/dashboard/checkin-manager"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentBookings } from "@/components/dashboard/recent-bookings"
import { PendingRequestsWidget } from "@/components/dashboard/pending-request-widget"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { BookingDetails } from "@/components/bookings/booking-details"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { BookingRequestService } from "@/lib/booking-request-service"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "react-hot-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  RefreshCw, 
  Clock, 
  Users, 
  Table2, 
  AlertCircle, 
  Calendar,
  ChefHat,
  TrendingUp,
  Phone,
  CheckCircle,
  XCircle,
  Timer,
  Activity,
  Eye,
  UserCheck,
  Utensils,
  CreditCard,
  Map,
  Cake,
  Coffee,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

// Enhanced Quick view component for arriving guests with check-in actions
function ArrivingGuestsCard({ 
  bookings, 
  currentTime,
  onCheckIn,
  tables,
  customersData
}: { 
  bookings: any[], 
  currentTime: Date,
  onCheckIn: (bookingId: string) => void,
  tables: any[],
  customersData: Record<string, any>
}) {
  const arrivingSoon = bookings
    .filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && minutesUntil > -15 && minutesUntil <= 30
    })
    .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

  return (
    <div className="space-y-3">
      {arrivingSoon.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No arrivals in next 30 min</p>
      ) : (
        arrivingSoon.map((booking) => {
          const bookingTime = new Date(booking.booking_time)
          const minutesUntil = differenceInMinutes(bookingTime, currentTime)
          const isLate = minutesUntil < 0
          const hasTable = booking.tables && booking.tables.length > 0
          const customerData = booking.user?.id ? customersData[booking.user.id] : null
          
          return (
            <div key={booking.id} className={cn(
              "p-3 rounded-lg border transition-all bg-white",
              isLate ? "border-red-200 bg-red-50" : "border-blue-200",
              "hover:shadow-md"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">
                      {booking.user?.full_name || booking.guest_name || 'Guest'}
                    </p>
                    {/* Customer Indicators */}
                    <div className="flex items-center gap-1">
                      {customerData?.vip_status && (
                        <Badge variant="default" className="text-xs px-1.5 py-0.5">
                          ⭐ VIP
                        </Badge>
                      )}
                      {customerData?.blacklisted && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                          🚫 Alert
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(bookingTime, 'h:mm a')}
                      {isLate && <span className="text-red-600 font-medium ml-1">(Late)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {booking.party_size}
                    </span>
                    {hasTable && (
                      <Badge variant="outline" className="text-xs">
                        T{booking.tables[0].table_number}
                      </Badge>
                    )}
                    {!hasTable && (
                      <Badge variant="destructive" className="text-xs">No table</Badge>
                    )}
                  </div>
                  {booking.special_requests && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Note: {booking.special_requests}
                    </p>
                  )}
                  {customerData?.blacklisted && customerData?.blacklist_reason && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ {customerData.blacklist_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCheckIn(booking.id)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1 h-7"
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    {hasTable ? 'Check-in' : 'Assign & Check-in'}
                  </Button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// Enhanced Service metrics component with meal progress
function ServiceMetrics({ bookings, currentTime }: { bookings: any[], currentTime: Date }) {
  const completedToday = bookings.filter(b => b.status === 'completed').length
  const noShowToday = bookings.filter(b => b.status === 'no_show').length
  const cancelledToday = bookings.filter(b => 
    b.status === 'cancelled_by_user' || b.status === 'declined_by_restaurant' || b.status === 'auto_declined'
  ).length
  
  // Calculate dining stages
  const diningStages = {
    arrived: bookings.filter(b => b.status === 'arrived').length,
    seated: bookings.filter(b => b.status === 'seated').length,
    ordered: bookings.filter(b => b.status === 'ordered').length,
    appetizers: bookings.filter(b => b.status === 'appetizers').length,
    mainCourse: bookings.filter(b => b.status === 'main_course').length,
    dessert: bookings.filter(b => b.status === 'dessert').length,
    payment: bookings.filter(b => b.status === 'payment').length,
  }
  
  // Calculate average turn time for completed bookings
  const completedWithTurnTime = bookings.filter(b => 
    b.status === 'completed' && b.actual_end_time
  )
  const avgTurnTime = completedWithTurnTime.length > 0
    ? completedWithTurnTime.reduce((sum, b) => {
        const start = new Date(b.booking_time)
        const end = new Date(b.actual_end_time)
        return sum + differenceInMinutes(end, start)
      }, 0) / completedWithTurnTime.length
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Service Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedToday}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Turn Time</p>
              <p className="text-2xl font-bold">{Math.round(avgTurnTime)}m</p>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <p className="text-sm font-medium mb-2">Current Service Stage</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <UserCheck className="h-3 w-3" />
                  Arrived
                </span>
                <Badge variant="secondary">{diningStages.arrived}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ChefHat className="h-3 w-3" />
                  Seated
                </span>
                <Badge variant="secondary">{diningStages.seated}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Coffee className="h-3 w-3" />
                  Ordered
                </span>
                <Badge variant="secondary">{diningStages.ordered}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Utensils className="h-3 w-3" />
                  Dining
                </span>
                <Badge variant="secondary">
                  {diningStages.appetizers + diningStages.mainCourse + diningStages.dessert}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-3 w-3" />
                  Payment
                </span>
                <Badge variant="secondary">{diningStages.payment}</Badge>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">No Shows</span>
              <Badge variant="outline" className="text-red-600">{noShowToday}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cancelled/Declined</span>
              <Badge variant="outline" className="text-gray-600">{cancelledToday}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("floor-plan")
  const [showCheckInDialog, setShowCheckInDialog] = useState(false)
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null)

    const STATUS_ICONS: any = {
  'pending': Timer,
  'confirmed': CheckCircle,
  'arrived': UserCheck,
  'seated': ChefHat,
  'ordered': Coffee,
  'appetizers': Utensils,
  'main_course': Utensils,
  'dessert': Cake,
  'payment': CreditCard,
  'completed': CheckCircle,
  'no_show': AlertCircle,
  'cancelled': AlertCircle
}
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()
  const requestService = new BookingRequestService()

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
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

  // Fetch today's bookings with enhanced status
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

      // Transform the data
      const transformedData = data?.map((booking: any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table).filter(Boolean) || []
      })) || []

      return transformedData
    },
    enabled: !!restaurantId,
    refetchInterval: 30000, // Refetch every 30 seconds
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

  // Fetch customer data for all bookings
  const { data: customersData = {} } = useQuery({
    queryKey: ["dashboard-customers", restaurantId, todaysBookings.map(b => b.user?.id).filter(Boolean)],
    queryFn: async () => {
      if (!restaurantId || todaysBookings.length === 0) return {}
      
      const userIds = todaysBookings
        .map(booking => booking.user?.id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index) // Remove duplicates
      
      if (userIds.length === 0) return {}

      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          user_id,
          vip_status,
          blacklisted,
          preferred_table_types,
          preferred_time_slots,
          total_bookings,
          total_spent,
          no_show_count,
          blacklist_reason,
          customer_relationships!customer_relationships_customer_id_fkey(
            id,
            related_customer_id,
            relationship_type,
            customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
              user_id
            ),
            related_customer:restaurant_customers!customer_relationships_customer_id_fkey(
              user_id
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .in("user_id", userIds)

      if (error) {
        console.error('Error fetching customer data:', error)
        return {}
      }

      // Transform data into a map keyed by user_id
      const customerMap: Record<string, any> = {}
      data?.forEach(customer => {
        customerMap[customer.user_id] = customer
      })

      return customerMap
    },
    enabled: !!restaurantId && todaysBookings.length > 0,
  })

  // Auto-refresh for expiring requests
  useEffect(() => {
    if (!todaysBookings.length) return

    const checkExpiring = () => {
      const expiringRequests = todaysBookings.filter(b => {
        if (b.status !== 'pending' || !b.request_expires_at) return false
        const minutesLeft = differenceInMinutes(new Date(b.request_expires_at), currentTime)
        return minutesLeft > 0 && minutesLeft < 10 // 10 minutes warning
      })
      
      if (expiringRequests.length > 0) {
        toast.error(
          <div>
            <p className="font-medium">{expiringRequests.length} booking request{expiringRequests.length !== 1 ? 's' : ''} expiring soon!</p>
            <p className="text-sm">Review and respond quickly</p>
          </div>,
          {
            duration: 5000,
            icon: <Timer className="h-4 w-4" />
          }
        )
      }
    }

    // Check immediately and then every minute
    checkExpiring()
    const interval = setInterval(checkExpiring, 60000)
    
    return () => clearInterval(interval)
  }, [todaysBookings, currentTime])

  // Update booking status with new status service
  // Fixed updateBookingMutation with proper request handling
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: any }) => {
      // Special handling for pending to confirmed status
      if (updates.status === 'confirmed') {
        const booking = todaysBookings.find(b => b.id === bookingId)
        if (booking?.status === 'pending') {
          // Use the request service for proper validation
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
            // Show detailed error with alternatives
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
      
      // Handle declining requests
      if (updates.status === 'declined_by_restaurant') {
        const booking = todaysBookings.find(b => b.id === bookingId)
        if (booking?.status === 'pending') {
          const result = await requestService.declineRequest(
            bookingId,
            userId,
            "Restaurant declined",
            true // Suggest alternatives
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
      
      // Regular status updates
      if (updates.status) {
        await statusService.updateBookingStatus(
          bookingId,
          updates.status as DiningStatus,
          userId,
          updates.metadata
        )
      } else {
        // Regular update for other fields
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
      // Error already shown by mutation function
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
      // Validate availability first
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

  // Create manual booking (enhanced with immediate check-in option)
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Get restaurant booking policy
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("booking_policy")
        .eq("id", restaurantId)
        .single()

      // Use the BookingRequestService for consistent handling
      const requestService = new BookingRequestService()
      
      const result = await requestService.createBookingRequest({
        restaurantId,
        userId: user.id,
        bookingTime: new Date(bookingData.booking_time),
        partySize: bookingData.party_size,
        turnTimeMinutes: bookingData.turn_time_minutes || 120,
        specialRequests: bookingData.special_requests,
        occasion: bookingData.occasion,
        guestName: bookingData.guest_name,
        guestEmail: bookingData.guest_email,
        guestPhone: bookingData.guest_phone,
        preApproved: bookingData.status === 'confirmed' || bookingData.status === 'arrived'
      })

      const booking = result.booking

      // Assign tables if provided and not a pending request
      if (bookingData.table_ids && bookingData.table_ids.length > 0 && booking.status !== 'pending') {
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

      // Auto check-in if it's a walk-in
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

  // Filter bookings by status
  const activeBookings = todaysBookings.filter(b => 
    !['completed', 'no_show', 'cancelled_by_user', 'declined_by_restaurant', 'auto_declined'].includes(b.status)
  )
  
  const currentlyDining = activeBookings.filter(booking => {
    const diningStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
    return diningStatuses.includes(booking.status)
  })

  // Calculate enhanced statistics
  const stats = {
    pendingCount: activeBookings.filter(b => b.status === 'pending').length,
    unassignedCount: activeBookings.filter(b => 
      b.status === 'confirmed' && (!b.tables || b.tables.length === 0)
    ).length,
    arrivingSoonCount: activeBookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && minutesUntil > 0 && minutesUntil <= 30
    }).length,
    currentGuests: currentlyDining.reduce((sum, b) => sum + b.party_size, 0),
    awaitingCheckIn: activeBookings.filter(b => b.status === 'arrived').length,
    inService: currentlyDining.length,
    pendingRequests: todaysBookings.filter(b => b.status === 'pending').length,
    expiringRequests: todaysBookings.filter(b => {
      if (b.status !== 'pending' || !b.request_expires_at) return false
      const hoursLeft = differenceInMinutes(new Date(b.request_expires_at), currentTime) / 60
      return hoursLeft > 0 && hoursLeft < 2
    }).length,
    failedAcceptances: todaysBookings.filter(b => 
      b.status === 'pending' && b.acceptance_attempted_at
    ).length,
  }

  const handleTableClick = (table: any, statusInfo: any) => {
    if (statusInfo.current) {
      setSelectedBooking(todaysBookings.find(b => b.id === statusInfo.current.id))
    } else if (statusInfo.upcoming) {
      setSelectedBooking(todaysBookings.find(b => b.id === statusInfo.upcoming.id))
    }
  }

  const handleQuickSeat = (guestData: any, tableIds: string[]) => {
    const bookingData = {
      ...guestData,
      booking_time: new Date().toISOString(),
      status: 'arrived',
      table_ids: tableIds
    }
    createManualBookingMutation.mutate(bookingData)
  }

  if (!restaurantId || !userId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading restaurant data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational Dashboard</h1>
          <p className="text-muted-foreground">
            {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.pendingRequests > 0 && (
            <Badge variant="destructive" className="text-sm animate-pulse">
              <Timer className="h-3 w-3 mr-1" />
              {stats.pendingRequests} pending request{stats.pendingRequests !== 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant={stats.awaitingCheckIn > 0 ? "destructive" : "outline"} className="text-sm">
            <UserCheck className="h-3 w-3 mr-1" />
            {stats.awaitingCheckIn} awaiting check-in
          </Badge>
          <Badge variant="outline" className="text-sm">
            <Activity className="h-3 w-3 mr-1 text-green-500" />
            Live
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchBookings()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Enhanced Status Cards */}
      <OperationalStatusCards 
        bookings={activeBookings}
        tables={tables}
        currentTime={currentTime}
        restaurantId={restaurantId}
      />

      {/* Critical Alerts */}
      {(stats.expiringRequests > 0 || stats.failedAcceptances > 0) && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Immediate Attention Required</AlertTitle>
          <AlertDescription className="text-red-700">
            {stats.expiringRequests > 0 && (
              <span className="block">
                • {stats.expiringRequests} booking request{stats.expiringRequests !== 1 ? 's are' : ' is'} expiring within 2 hours
              </span>
            )}
            {stats.failedAcceptances > 0 && (
              <span className="block">
                • {stats.failedAcceptances} request{stats.failedAcceptances !== 1 ? 's' : ''} failed acceptance due to conflicts
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Requests Widget - Show prominently if there are any */}
      {todaysBookings.some(b => b.status === 'pending') && (
        <PendingRequestsWidget
          bookings={todaysBookings}
          restaurantId={restaurantId}
          userId={userId}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })}
        />
      )}

      {/* Enhanced Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="floor-plan" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Floor Plan
          </TabsTrigger>
          <TabsTrigger value="checkin" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Check-in
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Enhanced Floor Plan Tab */}
        <TabsContent value="floor-plan" className="space-y-4">
          <EnhancedFloorPlan
            tables={tables}
            bookings={activeBookings}
            currentTime={currentTime}
            restaurantId={restaurantId}
            userId={userId}
            onTableClick={handleTableClick}
            onStatusUpdate={(bookingId, status) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
            onTableSwitch={handleTableSwitch}
            onCheckIn={handleCheckIn}
          />
        </TabsContent>

        {/* Check-in Management Tab */}
        <TabsContent value="checkin" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_350px]">
            <CheckInManager
              bookings={todaysBookings}
              tables={tables}
              restaurantId={restaurantId}
              userId={userId}
              currentTime={currentTime}
              onCheckIn={handleCheckIn}
              onStatusUpdate={(bookingId, status) => 
                updateBookingMutation.mutate({ bookingId, updates: { status } })
              }
              onQuickSeat={handleQuickSeat}
              customersData={customersData}
            />
            
            <div className="space-y-4">
              <ArrivingGuestsCard 
                bookings={activeBookings}
                currentTime={currentTime}
                onCheckIn={handleCheckIn}
                tables={tables}
                customersData={customersData}
              />
              
              <ServiceMetrics 
                bookings={todaysBookings}
                currentTime={currentTime}
              />
            </div>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <TodaysTimeline 
            bookings={activeBookings}
            currentTime={currentTime}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId, status) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
            customersData={customersData}
          />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_350px]">
            <div className="space-y-4">
              {/* Guests Awaiting Check-in - Priority Section */}
              {stats.awaitingCheckIn > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-orange-800 flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Guests Awaiting Check-in
                      </CardTitle>
                      <Badge variant="secondary" className="bg-orange-200 text-orange-800">
                        {stats.awaitingCheckIn} waiting
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activeBookings
                        .filter(b => b.status === 'arrived')
                        .map((booking) => {
                          const customerData = booking.user?.id ? customersData[booking.user.id] : null
                          const hasTable = booking.tables && booking.tables.length > 0
                          
                          return (
                            <div
                              key={booking.id}
                              className="p-3 bg-white rounded-lg border border-orange-200 hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium">
                                      {booking.user?.full_name || booking.guest_name || 'Guest'}
                                    </p>
                                    {customerData?.vip_status && (
                                      <Badge variant="default" className="text-xs px-1.5 py-0.5">
                                        ⭐ VIP
                                      </Badge>
                                    )}
                                    {customerData?.blacklisted && (
                                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                        🚫 Alert
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {booking.party_size} guests
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(booking.booking_time), 'h:mm a')}
                                    </span>
                                    {hasTable ? (
                                      <span className="flex items-center gap-1">
                                        <Table2 className="h-3 w-3" />
                                        {booking.tables.map((t: any) => `T${t.table_number}`).join(", ")}
                                      </span>
                                    ) : (
                                      <Badge variant="destructive" className="text-xs">No table assigned</Badge>
                                    )}
                                  </div>
                                  {customerData?.blacklisted && customerData?.blacklist_reason && (
                                    <p className="text-xs text-red-600 mt-1">
                                      ⚠️ {customerData.blacklist_reason}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedBooking(booking)}
                                    variant="outline"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCheckIn(booking.id)}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    {hasTable ? 'Seat Now' : 'Assign Table'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Arriving Soon - Quick Check-in Section */}
              {stats.arrivingSoonCount > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-blue-800 flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Arriving Soon (Next 30min)
                      </CardTitle>
                      <Badge variant="secondary" className="bg-blue-200 text-blue-800">
                        {stats.arrivingSoonCount} expected
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ArrivingGuestsCard 
                      bookings={activeBookings}
                      currentTime={currentTime}
                      onCheckIn={handleCheckIn}
                      tables={tables}
                      customersData={customersData}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Currently Dining</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {stats.currentGuests} guests
                      </Badge>
                      <Badge variant="outline">
                        <Table2 className="h-3 w-3 mr-1" />
                        {stats.inService} tables
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentlyDining.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No guests currently dining</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {currentlyDining.map((booking) => {
                          const StatusIcon = STATUS_ICONS[booking.status as DiningStatus]
                          const progress = TableStatusService.getDiningProgress(booking.status as DiningStatus)
                          const customerData = booking.user?.id ? customersData[booking.user.id] : null
                          
                          return (
                            <div
                              key={booking.id}
                              className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <StatusIcon className="h-4 w-4" />
                                    <p className="font-medium">
                                      {booking.user?.full_name || booking.guest_name || 'Guest'}
                                    </p>
                                    <Badge variant="secondary" className="text-xs">
                                      {booking.status.replace(/_/g, ' ')}
                                    </Badge>
                                    {customerData?.vip_status && (
                                      <Badge variant="default" className="text-xs px-1.5 py-0.5">
                                        ⭐ VIP
                                      </Badge>
                                    )}
                                    {customerData?.blacklisted && (
                                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                        🚫 Alert
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {booking.party_size}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Since {format(new Date(booking.booking_time), 'h:mm a')}
                                    </span>
                                    {booking.tables && booking.tables.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Table2 className="h-3 w-3" />
                                        {booking.tables.map((t: any) => `T${t.table_number}`).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  {customerData?.blacklisted && customerData?.blacklist_reason && (
                                    <p className="text-xs text-red-600 mt-1">
                                      Alert: {customerData.blacklist_reason}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="text-sm font-medium">{progress}%</div>
                                    <div className="text-xs text-muted-foreground">Progress</div>
                                  </div>
                                  {/* Quick Status Update Buttons */}
                                  <div className="flex flex-col gap-1">
                                    {booking.status === 'seated' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateBookingMutation.mutate({ 
                                          bookingId: booking.id, 
                                          updates: { status: 'ordered' } 
                                        })}
                                        className="text-xs px-2 py-1 h-6"
                                      >
                                        <Coffee className="h-3 w-3 mr-1" />
                                        Ordered
                                      </Button>
                                    )}
                                    {booking.status === 'ordered' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateBookingMutation.mutate({ 
                                          bookingId: booking.id, 
                                          updates: { status: 'appetizers' } 
                                        })}
                                        className="text-xs px-2 py-1 h-6"
                                      >
                                        <Utensils className="h-3 w-3 mr-1" />
                                        Served
                                      </Button>
                                    )}
                                    {['appetizers', 'main_course'].includes(booking.status) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateBookingMutation.mutate({ 
                                          bookingId: booking.id, 
                                          updates: { status: 'payment' } 
                                        })}
                                        className="text-xs px-2 py-1 h-6"
                                      >
                                        <CreditCard className="h-3 w-3 mr-1" />
                                        Check
                                      </Button>
                                    )}
                                    {booking.status === 'payment' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateBookingMutation.mutate({ 
                                          bookingId: booking.id, 
                                          updates: { status: 'completed' } 
                                        })}
                                        className="text-xs px-2 py-1 h-6"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Complete
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedBooking(booking)}
                                      className="text-xs px-2 py-1 h-6"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <RecentBookings 
                bookings={todaysBookings.slice(0, 10)} 
                customersData={customersData}
              />
            </div>

            <div className="space-y-4">
              <QuickActions 
                onAddBooking={() => setShowManualBooking(true)}
                stats={stats}
              />

              {/* Quick Action Buttons for Common Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowManualBooking(true)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Add Booking
                  </Button>
                  
                  {stats.awaitingCheckIn > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={() => setActiveTab("checkin")}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Check-in Queue ({stats.awaitingCheckIn})
                    </Button>
                  )}
                  
                  {stats.pendingRequests > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        // Find the first pending booking and open it
                        const pendingBooking = todaysBookings.find(b => b.status === 'pending')
                        if (pendingBooking) setSelectedBooking(pendingBooking)
                      }}
                    >
                      <Timer className="h-4 w-4 mr-2" />
                      Pending Requests ({stats.pendingRequests})
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("floor-plan")}
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Floor Plan View
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tables Available</span>
                      <Badge variant="outline">
                        {tables.filter(t => t.is_active).length - stats.inService} / {tables.filter(t => t.is_active).length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Current Capacity</span>
                      <Badge variant="outline">
                        {Math.round((stats.inService / tables.filter(t => t.is_active).length) * 100)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Avg Wait Time</span>
                      <Badge variant="outline">12 min</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Today's Bookings</span>
                      <Badge variant="outline">{todaysBookings.length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Action Button for Critical Actions */}
      {(stats.awaitingCheckIn > 0 || stats.pendingRequests > 0) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex flex-col gap-2">
            {stats.pendingRequests > 0 && (
              <Button
                size="lg"
                className="rounded-full shadow-lg bg-red-600 hover:bg-red-700 animate-pulse"
                onClick={() => {
                  const pendingBooking = todaysBookings.find(b => b.status === 'pending')
                  if (pendingBooking) setSelectedBooking(pendingBooking)
                }}
              >
                <Timer className="h-5 w-5 mr-2" />
                {stats.pendingRequests} Pending
              </Button>
            )}
            
            {stats.awaitingCheckIn > 0 && (
              <Button
                size="lg"
                className="rounded-full shadow-lg bg-orange-600 hover:bg-orange-700"
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

      {/* Enhanced Booking Details Modal with Status Management */}
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
                // Check if table is currently occupied by any active booking
                const tableBookings = todaysBookings.filter(booking => 
                  booking.tables?.some((t: any) => t.id === table.id)
                )
                
                const isCurrentlyOccupied = tableBookings.some(booking => {
                  // Define all statuses that indicate table occupancy
                  const occupiedStatuses = [
                    'arrived', 'seated', 'ordered', 'appetizers', 
                    'main_course', 'dessert', 'payment'
                  ]
                  
                  // If booking is in an active occupied status, table is occupied immediately
                  if (occupiedStatuses.includes(booking.status)) {
                    return true
                  }
                  
                  // For confirmed bookings, check if they're within their time window
                  if (booking.status === 'confirmed') {
                    const bookingTime = new Date(booking.booking_time)
                    const endTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)
                    const now = currentTime
                    
                    // Table is occupied if booking time is within 15 minutes or has passed but hasn't exceeded turn time
                    const minutesUntil = differenceInMinutes(bookingTime, now)
                    return minutesUntil <= 15 && now <= endTime
                  }
                  
                  return false
                })
                
                return !isCurrentlyOccupied && table.is_active
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
            const tableBookings = todaysBookings.filter(booking => 
              booking.tables?.some((t: any) => t.id === table.id)
            )
            const isOccupied = tableBookings.some(booking => {
              const activeStatuses = [
                'arrived', 'seated', 'ordered', 
                'appetizers', 'main_course', 'dessert', 'payment'
              ]
              // If booking is in an active occupied status, table is occupied immediately
              if (activeStatuses.includes(booking.status)) {
                return true
              }
              // For confirmed bookings, check time window
              if (booking.status === 'confirmed') {
                const bookingTime = new Date(booking.booking_time)
                const endTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)
                const now = currentTime
                const minutesUntil = differenceInMinutes(bookingTime, now)
                return minutesUntil <= 15 && now <= endTime
              }
              return false
            })
            return !isOccupied && table.is_active
          }).length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tables are currently available. All tables are either occupied or reserved for upcoming bookings.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}