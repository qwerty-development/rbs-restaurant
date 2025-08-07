// components/dashboard/tablet-checkin-queue.tsx
"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format, differenceInMinutes } from "date-fns"
import { 
  UserCheck, 
  Clock, 
  Table2,
  Timer,
  UserPlus,
  Crown
} from "lucide-react"
import { toast } from "react-hot-toast"

interface TabletCheckInQueueProps {
  bookings: any[]
  tables: any[]
  currentTime: Date
  restaurantId: string
  onCheckIn: (bookingId: string, tableIds: string[]) => void
  onQuickSeat: (guestData: any, tableIds: string[]) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void
  customersData?: Record<string, any>
  onSelectBooking?: (booking: any) => void
}

export function TabletCheckInQueue({
  bookings,
  tables,
  currentTime,
  restaurantId,
  onCheckIn,
  onQuickSeat,
  onTableSwitch,
  customersData = {},
  onSelectBooking
}: TabletCheckInQueueProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [walkInData, setWalkInData] = useState({
    guestName: "",
    guestPhone: "",
    partySize: 2,
  })

  // Filter and categorize bookings
  const categorizedBookings = useMemo(() => {
    const arrivals = bookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && 
             minutesUntil >= -30 && minutesUntil <= 60
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    return {
      waitingForSeating: bookings.filter(b => b.status === 'arrived'),
      currentArrivals: arrivals.filter(b => {
        const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
        return minutesUntil >= -15 && minutesUntil <= 15
      }),
      upcomingArrivals: arrivals.filter(b => {
        const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
        return minutesUntil > 15
      }),
      vipArrivals: arrivals.filter(b => {
        const customerData = b.user?.id ? customersData[b.user.id] : null
        return customerData?.vip_status
      })
    }
  }, [bookings, currentTime, customersData])

  const availableTables = tables.filter(table => {
    const isOccupied = bookings.some(booking => {
      const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
      return physicallyPresent && booking.tables?.some((t: any) => t.id === table.id)
    })
    return table.is_active && !isOccupied
  })

  const getBookingStatus = (booking: any) => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, currentTime)
    
    if (booking.status === 'arrived') {
      return { 
        label: "Here", 
        color: "text-orange-300 bg-orange-900/50 border-orange-600", 
        urgent: true
      }
    } else if (minutesUntil < -15) {
      return { 
        label: "Late", 
        color: "text-red-300 bg-red-900/50 border-red-600", 
        urgent: true
      }
    } else if (minutesUntil <= 0) {
      return { 
        label: "Now", 
        color: "text-blue-300 bg-blue-900/50 border-blue-600", 
        urgent: true
      }
    } else if (minutesUntil <= 15) {
      return { 
        label: `${minutesUntil}m`, 
        color: "text-green-300 bg-green-900/50 border-green-600", 
        urgent: false
      }
    } else {
      return { 
        label: `${minutesUntil}m`, 
        color: "text-gray-400 bg-gray-800/50 border-gray-600", 
        urgent: false
      }
    }
  }

  const renderBookingCard = (booking: any) => {
    const status = getBookingStatus(booking)
    const hasTable = booking.tables && booking.tables.length > 0
    const customerData = booking.user?.id ? customersData[booking.user.id] : null

    return (
      <div
        key={booking.id}
        className={cn(
          "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
          status.color,
          status.urgent && "ring-2 ring-blue-400 ring-offset-1"
        )}
        onClick={() => onSelectBooking?.(booking)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">
                {booking.user?.full_name || booking.guest_name}
              </span>
              {customerData?.vip_status && (
                <Crown className="h-4 w-4 text-yellow-400" />
              )}
              <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                {booking.party_size} guests
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-300">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(booking.booking_time), "h:mm a")}</span>
              {hasTable && (
                <>
                  <Table2 className="h-3 w-3 ml-2" />
                  <span>Table {booking.tables.map((t: any) => t.table_number).join(", ")}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", status.urgent && "animate-pulse")}>
              {status.label}
            </Badge>
            {booking.status === 'arrived' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (hasTable) {
                    onCheckIn(booking.id, booking.tables.map((t: any) => t.id))
                  } else {
                    // Show table selection
                  }
                }}
                className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs"
              >
                Check In
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleWalkIn = async () => {
    if (selectedTableIds.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    const walkInBooking = {
      guest_name: walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`,
      guest_phone: walkInData.guestPhone,
      party_size: walkInData.partySize,
      table_ids: selectedTableIds,
      booking_time: currentTime.toISOString(),
      status: 'arrived',
    }

    onQuickSeat(walkInBooking, selectedTableIds)
    
    toast.success("Walk-in guest seated successfully!")
    
    // Reset form
    setWalkInData({ guestName: "", guestPhone: "", partySize: 2 })
    setSelectedTableIds([])
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Check-in Queue</h3>
            {categorizedBookings.waitingForSeating.length > 0 && (
              <Badge className="bg-orange-500 text-white text-xs">
                {categorizedBookings.waitingForSeating.length} waiting
              </Badge>
            )}
            {categorizedBookings.vipArrivals.length > 0 && (
              <Badge className="bg-yellow-500 text-black text-xs">
                <Crown className="h-3 w-3 mr-1" />
                {categorizedBookings.vipArrivals.length} VIP
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Table2 className="h-3 w-3" />
            <span>{availableTables.length} available</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="arrivals" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 flex w-auto bg-gray-800 border border-gray-600">
          <TabsTrigger value="arrivals" className="text-xs text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Arrivals
            {(categorizedBookings.currentArrivals.length + 
              categorizedBookings.upcomingArrivals.length + 
              categorizedBookings.waitingForSeating.length) > 0 && (
              <Badge className="ml-1 px-1 py-0 text-xs bg-blue-500 text-white">
                {categorizedBookings.currentArrivals.length + 
                 categorizedBookings.upcomingArrivals.length + 
                 categorizedBookings.waitingForSeating.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="walkin" className="text-xs text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Walk-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arrivals" className="flex-1 px-3 overflow-y-auto bg-gray-900">
          <div className="space-y-3 py-2">
            {/* Waiting for seating - highest priority */}
            {categorizedBookings.waitingForSeating.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-orange-400 border-b border-orange-500 pb-1">
                  Waiting for Seating
                </h4>
                <div className="space-y-2">
                  {categorizedBookings.waitingForSeating.map(renderBookingCard)}
                </div>
              </div>
            )}

            {/* VIP Arrivals */}
            {categorizedBookings.vipArrivals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-yellow-400 border-b border-yellow-500 pb-1">
                  VIP Guests
                </h4>
                <div className="space-y-2">
                  {categorizedBookings.vipArrivals.map(renderBookingCard)}
                </div>
              </div>
            )}

            {/* Current & Upcoming Arrivals */}
            {[...categorizedBookings.currentArrivals, ...categorizedBookings.upcomingArrivals].length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-300 border-b border-gray-600 pb-1">
                  Arrivals
                </h4>
                <div className="space-y-2">
                  {[...categorizedBookings.currentArrivals, ...categorizedBookings.upcomingArrivals]
                    .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                    .map(renderBookingCard)
                  }
                </div>
              </div>
            )}

            {/* Empty state */}
            {(categorizedBookings.currentArrivals.length + 
              categorizedBookings.upcomingArrivals.length +
              categorizedBookings.waitingForSeating.length) === 0 && (
              <div className="text-center py-8 text-gray-400">
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                <p className="text-sm">No arrivals expected</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="walkin" className="flex-1 px-3 overflow-y-auto bg-gray-900">
          <div className="space-y-3 py-2">
            {/* Walk-in form */}
            <div className="bg-gray-800 rounded-lg p-3 space-y-3 border border-gray-700">
              <h4 className="text-sm font-medium text-white">Quick Walk-in</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="guestName" className="text-xs text-gray-300">Guest Name</Label>
                  <Input
                    id="guestName"
                    value={walkInData.guestName}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                    className="h-8 text-sm bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                    placeholder="Guest name..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="partySize" className="text-xs text-gray-300">Party Size</Label>
                  <Input
                    id="partySize"
                    type="number"
                    value={walkInData.partySize}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                    className="h-8 text-sm bg-gray-700 border-gray-600 text-white"
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              {/* Table selection */}
              <div>
                <Label className="text-xs text-gray-300">Select Tables</Label>
                <div className="flex gap-2 overflow-x-auto py-2">
                  {availableTables.slice(0, 10).map(table => (
                    <Button
                      key={table.id}
                      variant={selectedTableIds.includes(table.id) ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-shrink-0 h-12 w-16 flex flex-col gap-1",
                        selectedTableIds.includes(table.id) 
                          ? "bg-blue-600 hover:bg-blue-700 text-white" 
                          : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                      )}
                      onClick={() => {
                        setSelectedTableIds(prev => 
                          prev.includes(table.id) 
                            ? prev.filter(id => id !== table.id)
                            : [...prev, table.id]
                        )
                      }}
                    >
                      <span className="text-xs font-bold">T{table.table_number}</span>
                      <span className="text-xs">{table.max_capacity}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleWalkIn}
                disabled={selectedTableIds.length === 0}
                className="w-full h-10 bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Seat Walk-in Guest
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
