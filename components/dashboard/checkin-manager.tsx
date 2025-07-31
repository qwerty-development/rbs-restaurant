// components/dashboard/checkin-manager.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format, differenceInMinutes } from "date-fns"
import { 
  UserCheck, 
  Search, 
  Clock, 
  Users, 
  Table2,
  Phone,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  UserPlus,
  Calendar,
  Timer,
  ArrowRight
} from "lucide-react"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { toast } from "react-hot-toast"

interface CheckInManagerProps {
  bookings: any[]
  tables: any[]
  restaurantId: string
  userId: string
  currentTime: Date
  onCheckIn: (bookingId: string, tableIds: string[]) => void
  onStatusUpdate: (bookingId: string, status: DiningStatus) => void
  onQuickSeat: (guestData: any, tableIds: string[]) => void
}

export function CheckInManager({
  bookings,
  tables,
  restaurantId,
  userId,
  currentTime,
  onCheckIn,
  onStatusUpdate,
  onQuickSeat
}: CheckInManagerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [walkInData, setWalkInData] = useState({
    guestName: "",
    guestPhone: "",
    partySize: 2
  })
  
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()

  // Filter bookings for check-in (confirmed bookings arriving soon or late)
  const checkInBookings = bookings
    .filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return (
        booking.status === 'confirmed' && 
        minutesUntil >= -30 && // 30 minutes late tolerance
        minutesUntil <= 60 // Show up to 60 minutes ahead
      )
    })
    .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

  // Filter bookings based on search
  const filteredBookings = checkInBookings.filter(booking => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const guestName = (booking.user?.full_name || booking.guest_name || '').toLowerCase()
    const phone = (booking.user?.phone_number || booking.guest_phone || '').toLowerCase()
    const code = (booking.confirmation_code || '').toLowerCase()
    
    return guestName.includes(query) || phone.includes(query) || code.includes(query)
  })

  // Get available tables
  const getAvailableTables = () => {
    return tables.filter(table => {
      // Check if table is currently occupied by any active booking
      const tableBookings = bookings.filter(booking => 
        booking.tables?.some((t: any) => t.id === table.id)
      )
      
      const isCurrentlyOccupied = tableBookings.some(booking => {
        // Define all statuses that indicate table occupancy
        const occupiedStatuses = [
          'arrived', 'seated', 'ordered', 'appetizers', 
          'main_course', 'dessert', 'payment'
        ]
        
        // If booking is in an active occupied status, table is occupied
        if (occupiedStatuses.includes(booking.status)) {
          return true
        }
        
        // For confirmed bookings, check if they're within their time window
        if (booking.status === 'confirmed') {
          const bookingTime = new Date(booking.booking_time)
          const endTime = new Date(bookingTime.getTime() + (booking.turn_time_minutes || 120) * 60000)
          const now = currentTime
          
          // Table is occupied if booking time is within 15 minutes or has passed but hasn't exceeded turn time
          const minutesUntil = differenceInMinutes(bookingTime, now)
          return minutesUntil <= 15 && now <= endTime
        }
        
        return false
      })
      
      return !isCurrentlyOccupied && table.is_active
    })
  }

  const availableTables = getAvailableTables()

  const handleCheckIn = async (booking: any) => {
    if (selectedTableIds.length === 0 && (!booking.tables || booking.tables.length === 0)) {
      toast.error("Please select at least one table")
      return
    }

    const tableIds = selectedTableIds.length > 0 ? selectedTableIds : booking.tables.map((t: any) => t.id)
    
    try {
      await statusService.checkInBooking(booking.id, tableIds, userId)
      onCheckIn(booking.id, tableIds)
      toast.success(`Checked in ${booking.user?.full_name || booking.guest_name}`)
      setSelectedBookingId(null)
      setSelectedTableIds([])
    } catch (error) {
      toast.error("Failed to check in guest")
    }
  }

  const handleWalkIn = async () => {
    if (!walkInData.guestName) {
      toast.error("Please enter guest name")
      return
    }

    if (selectedTableIds.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    try {
      const walkInBooking = {
        guest_name: walkInData.guestName,
        guest_phone: walkInData.guestPhone,
        party_size: walkInData.partySize,
        table_ids: selectedTableIds,
        booking_time: currentTime.toISOString(),
        turn_time_minutes: 120,
        status: 'arrived'
      }

      onQuickSeat(walkInBooking, selectedTableIds)
      toast.success("Walk-in guest seated successfully")
      
      // Reset form
      setWalkInData({ guestName: "", guestPhone: "", partySize: 2 })
      setSelectedTableIds([])
    } catch (error) {
      toast.error("Failed to seat walk-in guest")
    }
  }

  const getBookingStatus = (booking: any) => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, currentTime)
    
    if (minutesUntil < -15) {
      return { label: "Late", color: "text-red-600", icon: AlertCircle }
    } else if (minutesUntil < 0) {
      return { label: "Arrived", color: "text-blue-600", icon: UserCheck }
    } else if (minutesUntil <= 15) {
      return { label: "Arriving Soon", color: "text-green-600", icon: Timer }
    } else {
      return { label: `In ${minutesUntil}m`, color: "text-gray-600", icon: Clock }
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Check-in & Seating Management</CardTitle>
        <CardDescription>
          Manage arrivals, check-ins, and walk-in guests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="checkin" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checkin">Check-in Queue</TabsTrigger>
            <TabsTrigger value="walkin">Walk-in Seating</TabsTrigger>
          </TabsList>

          <TabsContent value="checkin" className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or confirmation code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Check-in queue */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No guests to check in</p>
                  </div>
                ) : (
                  filteredBookings.map((booking) => {
                    const status = getBookingStatus(booking)
                    const StatusIcon = status.icon
                    const isSelected = selectedBookingId === booking.id
                    const hasTable = booking.tables && booking.tables.length > 0

                    return (
                      <div
                        key={booking.id}
                        className={cn(
                          "p-4 rounded-lg border-2 cursor-pointer transition-all",
                          isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setSelectedBookingId(booking.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Guest info */}
                            <div className="flex items-center gap-3 mb-2">
                              <StatusIcon className={cn("h-5 w-5", status.color)} />
                              <h4 className="font-semibold text-lg">
                                {booking.user?.full_name || booking.guest_name || 'Guest'}
                              </h4>
                              <Badge variant="outline" className={status.color}>
                                {status.label}
                              </Badge>
                            </div>

                            {/* Booking details */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(booking.booking_time), 'h:mm a')}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {booking.party_size} guests
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {booking.user?.phone_number || booking.guest_phone || 'No phone'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Table2 className="h-3 w-3" />
                                  {hasTable ? (
                                    <span className="text-green-600 font-medium">
                                      T{booking.tables.map((t: any) => t.table_number).join(", ")}
                                    </span>
                                  ) : (
                                    <span className="text-red-600 font-medium">No table</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Table selection for bookings without tables */}
                            {isSelected && !hasTable && (
                              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                <Label className="text-sm font-medium mb-2 block">
                                  Select Table(s)
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                  {availableTables.map(table => (
                                    <Button
                                      key={table.id}
                                      size="sm"
                                      variant={selectedTableIds.includes(table.id) ? "default" : "outline"}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedTableIds(prev => 
                                          prev.includes(table.id)
                                            ? prev.filter(id => id !== table.id)
                                            : [...prev, table.id]
                                        )
                                      }}
                                    >
                                      T{table.table_number} ({table.capacity})
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Check-in button */}
                          {isSelected && (
                            <Button
                              className="ml-4"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCheckIn(booking)
                              }}
                              disabled={!hasTable && selectedTableIds.length === 0}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Check In
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="walkin" className="space-y-4">
            {/* Walk-in form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guest-name">Guest Name *</Label>
                  <Input
                    id="guest-name"
                    value={walkInData.guestName}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder="Enter guest name"
                  />
                </div>
                <div>
                  <Label htmlFor="guest-phone">Phone Number</Label>
                  <Input
                    id="guest-phone"
                    value={walkInData.guestPhone}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestPhone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="party-size">Party Size</Label>
                <Input
                  id="party-size"
                  type="number"
                  min="1"
                  max="20"
                  value={walkInData.partySize}
                  onChange={(e) => setWalkInData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                />
              </div>

              {/* Table selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Select Table(s) *
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {availableTables.map(table => {
                    const isSelected = selectedTableIds.includes(table.id)
                    const fitsParty = table.max_capacity >= walkInData.partySize && 
                                     table.min_capacity <= walkInData.partySize

                    return (
                      <div
                        key={table.id}
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all text-center",
                          isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
                          !fitsParty && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (fitsParty) {
                            setSelectedTableIds(prev => 
                              prev.includes(table.id)
                                ? prev.filter(id => id !== table.id)
                                : [...prev, table.id]
                            )
                          }
                        }}
                      >
                        <Table2 className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-semibold">Table {table.table_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Capacity: {table.min_capacity}-{table.max_capacity}
                        </p>
                        <Badge variant={isSelected ? "default" : "outline"} className="mt-2 text-xs">
                          {table.table_type}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Seat button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleWalkIn}
                disabled={!walkInData.guestName || selectedTableIds.length === 0}
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Seat Walk-in Guest
              </Button>
            </div>

            {/* Available tables summary */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {availableTables.length} tables available • 
                Total capacity: {availableTables.reduce((sum, t) => sum + t.max_capacity, 0)} guests
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}