// app/(dashboard)/bookings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay, addMinutes } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Clock
} from "lucide-react"
import type { Booking } from "@/types"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [showManualBooking, setShowManualBooking] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>("all") // all, lunch, dinner
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()

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
    queryKey: ["bookings", restaurantId, selectedDate, statusFilter, timeFilter],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number,
            email
          ),
          booking_tables(
            table:restaurant_tables(*)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("booking_time", { ascending: true })

      // Date filter for calendar view
      if (viewMode === "calendar" && selectedDate) {
        const dayStart = startOfDay(selectedDate)
        const dayEnd = endOfDay(selectedDate)
        query = query
          .gte("booking_time", dayStart.toISOString())
          .lte("booking_time", dayEnd.toISOString())
      }

      // Status filter
      if (statusFilter !== "all") {
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

  // Create manual booking with table validation
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
    const email = booking.guest_email?.toLowerCase() || booking.user?.email?.toLowerCase() || ""
    const tableNumbers = booking.tables?.map(t => t.table_number.toLowerCase()).join(" ") || ""
    
    return (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower) ||
      tableNumbers.includes(searchLower)
    )
  })

  // Get booking counts and statistics
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
  }

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">
            Manage your restaurant bookings and table assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowManualBooking(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Booking
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Today's Bookings"
          value={bookingStats.confirmed}
          description={`${bookingStats.pending} pending`}
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
          title="Peak Hour"
          value={tableStats?.peakHour || "N/A"}
          description="Busiest time today"
          icon={Clock}
        />
        <StatCard
          title="Needs Assignment"
          value={bookingStats.withoutTables}
          description="Confirmed without tables"
          icon={AlertCircle}
        />
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
        <TabsList className="grid w-[200px] grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, phone, email, or table..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Bookings ({bookingStats.all})
                    </SelectItem>
                    <SelectItem value="pending">
                      Pending ({bookingStats.pending})
                    </SelectItem>
                    <SelectItem value="confirmed">
                      Confirmed ({bookingStats.confirmed})
                    </SelectItem>
                    <SelectItem value="completed">
                      Completed ({bookingStats.completed})
                    </SelectItem>
                    <SelectItem value="cancelled_by_user">
                      Cancelled ({bookingStats.cancelled})
                    </SelectItem>
                    <SelectItem value="no_show">
                      No Show ({bookingStats.no_show})
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    <SelectItem value="lunch">Lunch (11-3)</SelectItem>
                    <SelectItem value="dinner">Dinner (5-11)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quick alerts */}
              {bookingStats.withoutTables > 0 && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {bookingStats.withoutTables} confirmed booking{bookingStats.withoutTables > 1 ? 's' : ''} 
                    {bookingStats.withoutTables > 1 ? 'need' : 'needs'} table assignment
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Booking List */}
          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId, status) => 
              updateBookingMutation.mutate({ bookingId, updates: { status } })
            }
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[300px_1fr]">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle>Select Date</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            {/* Day's Bookings */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Bookings for {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
                <CardDescription>
                  {filteredBookings?.length || 0} bookings scheduled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BookingList
                  bookings={filteredBookings || []}
                  isLoading={isLoading}
                  onSelectBooking={setSelectedBooking}
                  onUpdateStatus={(bookingId, status) => 
                    updateBookingMutation.mutate({ bookingId, updates: { status } })
                  }
                  compact
                />
              </CardContent>
            </Card>
          </div>
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

      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Add Manual Booking</DialogTitle>
              <DialogDescription>
                Create a new booking manually for walk-ins or phone reservations
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
    </div>
  )
}