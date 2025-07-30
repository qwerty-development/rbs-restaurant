// app/(dashboard)/bookings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfDay, endOfDay } from "date-fns"
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
import { BookingList } from "@/components/bookings/booking-list"
import { BookingDetails } from "@/components/bookings/booking-details"
import { ManualBookingForm } from "@/components/bookings/manual-booking-form"
import { toast } from "react-hot-toast"
import { Search, Filter, Calendar as CalendarIcon, Download, Plus } from "lucide-react"
import type { Booking } from "@/types"

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [showManualBooking, setShowManualBooking] = useState(false)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

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

  // Fetch bookings with proper joins
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", restaurantId, selectedDate, statusFilter],
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

      // Date filter
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

      // Transform the data to match expected format
      return data?.map((booking:any) => ({
        ...booking,
        user: booking.profiles || null,
        tables: booking.booking_tables?.map((bt: { table: any }) => bt.table) || []
      })) as Booking[]
    },
    enabled: !!restaurantId,
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

  // Create manual booking
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      // Get the current staff user to use as the booking creator for manual bookings
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create booking with the staff user as the creator, but guest info for the actual guest
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: user.id, // Use staff user ID to satisfy NOT NULL constraint
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

        await supabase
          .from("booking_tables")
          .insert(tableAssignments)
      }

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking created successfully")
      setShowManualBooking(false)
    },
    onError: (error) => {
      console.error("Create booking error:", error)
      toast.error("Failed to create booking")
    },
  })

  // Filter bookings based on search
  const filteredBookings = bookings?.filter((booking) => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    const userName = booking.user?.full_name?.toLowerCase() || ""
    const guestName = booking.guest_name?.toLowerCase() || ""
    const confirmationCode = booking.confirmation_code?.toLowerCase() || ""
    const phone = booking.guest_phone?.toLowerCase() || ""
    const email = booking.guest_email?.toLowerCase() || ""
    
    return (
      userName.includes(searchLower) ||
      guestName.includes(searchLower) ||
      confirmationCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      email.includes(searchLower)
    )
  })

  // Get booking counts by status
  const bookingCounts = {
    all: bookings?.length || 0,
    pending: bookings?.filter(b => b.status === "pending").length || 0,
    confirmed: bookings?.filter(b => b.status === "confirmed").length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => b.status === "cancelled_by_user" || b.status === "declined_by_restaurant").length || 0,
    no_show: bookings?.filter(b => b.status === "no_show").length || 0,
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">
            Manage your restaurant bookings and reservations
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
                    placeholder="Search by name, confirmation code, phone, or email..."
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
                      All Bookings ({bookingCounts.all})
                    </SelectItem>
                    <SelectItem value="pending">
                      Pending ({bookingCounts.pending})
                    </SelectItem>
                    <SelectItem value="confirmed">
                      Confirmed ({bookingCounts.confirmed})
                    </SelectItem>
                    <SelectItem value="completed">
                      Completed ({bookingCounts.completed})
                    </SelectItem>
                    <SelectItem value="cancelled_by_user">
                      Cancelled ({bookingCounts.cancelled})
                    </SelectItem>
                    <SelectItem value="no_show">
                      No Show ({bookingCounts.no_show})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Booking List */}
          <BookingList
            bookings={filteredBookings || []}
            isLoading={isLoading}
            onSelectBooking={setSelectedBooking}
            onUpdateStatus={(bookingId:any, status:any) => 
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
                  onUpdateStatus={(bookingId:any, status:any) => 
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
          onUpdate={(updates: any) => {
            updateBookingMutation.mutate({ 
              bookingId: selectedBooking.id, 
              updates 
            })
          }}
        />
      )}

      {/* Manual Booking Modal */}
      <Dialog open={showManualBooking} onOpenChange={setShowManualBooking}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Manual Booking</DialogTitle>
            <DialogDescription>
              Create a new booking manually for walk-ins or phone reservations
            </DialogDescription>
          </DialogHeader>
          <ManualBookingForm
            restaurantId={restaurantId}
            onSubmit={(data: any) => createManualBookingMutation.mutate(data)}
            onCancel={() => setShowManualBooking(false)}
            isLoading={createManualBookingMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}