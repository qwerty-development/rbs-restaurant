// app/(dashboard)/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes, isWithinInterval, isBefore, isAfter, differenceInMinutes } from "date-fns"
import { OperationalStatusCards } from "@/components/dashboard/operational-status-cards"
import { TodaysTimeline } from "@/components/dashboard/todays-timeline"
import { TableStatusView } from "@/components/dashboard/table-status-view"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentBookings } from "@/components/dashboard/recent-bookings"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { BookingDetails } from "@/components/bookings/booking-details"
import { TableAvailabilityService } from "@/lib/table-availability"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"

// Quick view component for arriving guests
function ArrivingGuestsCard({ bookings, currentTime }: { bookings: any[], currentTime: Date }) {
  const arrivingSoon = bookings
    .filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && minutesUntil > -15 && minutesUntil <= 30
    })
    .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Arriving Soon</CardTitle>
          <Badge variant="secondary">{arrivingSoon.length} guests</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {arrivingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No arrivals in next 30 min</p>
            ) : (
              arrivingSoon.map((booking) => {
                const bookingTime = new Date(booking.booking_time)
                const minutesUntil = differenceInMinutes(bookingTime, currentTime)
                const isLate = minutesUntil < 0
                
                return (
                  <div key={booking.id} className={cn(
                    "flex items-center justify-between p-2 rounded-lg border",
                    isLate && "border-red-200 bg-red-50"
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {booking.user?.full_name || booking.guest_name || 'Guest'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(bookingTime, 'h:mm a')}
                          {isLate && <span className="text-red-600 font-medium">(Late)</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {booking.party_size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {booking.user?.phone_number || booking.guest_phone || 'No phone'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {booking.tables && booking.tables.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          T{booking.tables[0].table_number}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">No table</Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Service metrics component
function ServiceMetrics({ bookings, currentTime }: { bookings: any[], currentTime: Date }) {
  const completedToday = bookings.filter(b => b.status === 'completed').length
  const noShowToday = bookings.filter(b => b.status === 'no_show').length
  const cancelledToday = bookings.filter(b => 
    b.status === 'cancelled_by_user' || b.status === 'declined_by_restaurant'
  ).length
  
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
        <CardTitle className="text-base">Today's Service Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{completedToday}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">No Shows</p>
            <p className="text-2xl font-bold text-red-600">{noShowToday}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Cancelled</p>
            <p className="text-2xl font-bold text-orange-600">{cancelledToday}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Turn Time</p>
            <p className="text-2xl font-bold">{Math.round(avgTurnTime)}m</p>
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
  const [activeTab, setActiveTab] = useState("overview")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Get restaurant ID
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

  // Fetch today's bookings with better query
  const { data: todaysBookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ["todays-bookings", restaurantId, format(currentTime, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const todayStart = startOfDay(currentTime)
      const todayEnd = endOfDay(currentTime)
      
      console.log('Fetching bookings for:', {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
        restaurantId
      })
      
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
        .gte("booking_time", todayStart.toISOString())
        .lte("booking_time", todayEnd.toISOString())
        .order("booking_time", { ascending: true })

      if (error) {
        console.error('Error fetching bookings:', error)
        throw error
      }

      console.log('Fetched bookings:', data?.length || 0)

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

  // Update booking status
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: any }) => {
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
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      toast.success("Booking updated")
    },
    onError: (error) => {
      console.error("Update error:", error)
      toast.error("Failed to update booking")
    },
  })

  // Create manual booking
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Validate table availability
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
    ['pending', 'confirmed'].includes(b.status)
  )
  
  const currentlyDining = todaysBookings.filter(booking => {
    const bookingStart = new Date(booking.booking_time)
    const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
    return booking.status === 'confirmed' && 
           isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
  })

  // Calculate statistics
  const stats = {
    pendingCount: todaysBookings.filter(b => b.status === 'pending').length,
    unassignedCount: todaysBookings.filter(b => 
      b.status === 'confirmed' && (!b.tables || b.tables.length === 0)
    ).length,
    arrivingSoonCount: todaysBookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && minutesUntil > 0 && minutesUntil <= 30
    }).length,
    currentGuests: currentlyDining.reduce((sum, b) => sum + b.party_size, 0),
  }

  const handleTableClick = (table: any) => {
    // Find bookings for this table
    const tableBookings = todaysBookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id)
    )
    
    if (tableBookings.length > 0) {
      // Check if table is currently occupied
      const currentBooking = tableBookings.find(booking => {
        const bookingStart = new Date(booking.booking_time)
        const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
        return booking.status === 'confirmed' && 
               isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
      })
      
      if (currentBooking) {
        setSelectedBooking(currentBooking)
      } else {
        // Show next booking for this table
        const nextBooking = tableBookings
          .filter(b => new Date(b.booking_time) > currentTime && b.status === 'confirmed')
          .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())[0]
        
        if (nextBooking) {
          setSelectedBooking(nextBooking)
        }
      }
    }
  }

  if (!restaurantId) {
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational Dashboard</h1>
          <p className="text-muted-foreground">
            {format(currentTime, "EEEE, MMMM d, yyyy")} • {format(currentTime, "h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Debug info - remove in production */}
      

      {/* Status Cards */}
      <OperationalStatusCards 
        bookings={todaysBookings}
        tables={tables}
        currentTime={currentTime}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tables">Table View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Overview Grid */}
          <div className="grid gap-4 md:grid-cols-[1fr_350px]">
            {/* Left column - Main content */}
            <div className="space-y-4">
              {/* Current Status */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Current Status</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {stats.currentGuests} guests dining
                      </Badge>
                      <Badge variant="outline">
                        <Table2 className="h-3 w-3 mr-1" />
                        {currentlyDining.length} tables occupied
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
                          const bookingStart = new Date(booking.booking_time)
                          const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
                          const progress = ((currentTime.getTime() - bookingStart.getTime()) / 
                                           (bookingEnd.getTime() - bookingStart.getTime())) * 100
                          
                          return (
                            <div
                              key={booking.id}
                              className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedBooking(booking)}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">
                                    {booking.user?.full_name || booking.guest_name || 'Guest'}
                                  </p>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {booking.party_size} guests
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Since {format(bookingStart, 'h:mm a')}
                                    </span>
                                    {booking.tables && booking.tables.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Table2 className="h-3 w-3" />
                                        {booking.tables.map((t: any) => `T${t.table_number}`).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(progress)}% complete
                                </Badge>
                              </div>
                              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <RecentBookings bookings={activeBookings.slice(0, 5)} />
            </div>

            {/* Right column - Quick views */}
            <div className="space-y-4">
              <QuickActions 
                onAddBooking={() => setShowManualBooking(true)}
                stats={stats}
              />
              
              <ArrivingGuestsCard 
                bookings={todaysBookings}
                currentTime={currentTime}
              />
              
              <ServiceMetrics 
                bookings={todaysBookings}
                currentTime={currentTime}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <TodaysTimeline 
            bookings={todaysBookings}
            currentTime={currentTime}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId, status) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
          />
        </TabsContent>

        <TabsContent value="tables" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_350px]">
            <TableStatusView 
              tables={tables}
              bookings={todaysBookings}
              currentTime={currentTime}
              onTableClick={handleTableClick}
            />
            
            <div className="space-y-4">
              <QuickActions 
                onAddBooking={() => setShowManualBooking(true)}
                stats={stats}
              />
              
              <ArrivingGuestsCard 
                bookings={todaysBookings}
                currentTime={currentTime}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Walk-in Booking</DialogTitle>
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
    </div>
  )
}