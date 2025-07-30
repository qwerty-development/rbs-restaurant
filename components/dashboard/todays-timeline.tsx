// components/dashboard/todays-timeline.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { 
  Clock, 
  Users, 
  Table2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight
} from "lucide-react"
import { format, addMinutes, isWithinInterval, startOfDay, addHours } from "date-fns"
import { cn } from "@/lib/utils"

interface TodaysTimelineProps {
  bookings: any[]
  currentTime: Date
  onSelectBooking: (booking: any) => void
  onUpdateStatus: (bookingId: string, status: string) => void
}

export function TodaysTimeline({ 
  bookings, 
  currentTime, 
  onSelectBooking,
  onUpdateStatus 
}: TodaysTimelineProps) {
  // Sort bookings by time
  const sortedBookings = [...bookings].sort((a, b) => 
    new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
  )

  // Group bookings by hour
  const bookingsByHour: Record<number, any[]> = {}
  sortedBookings.forEach(booking => {
    const hour = new Date(booking.booking_time).getHours()
    if (!bookingsByHour[hour]) bookingsByHour[hour] = []
    bookingsByHour[hour].push(booking)
  })

  // Generate hours from 11 AM to 11 PM
  const hours = Array.from({ length: 13 }, (_, i) => i + 11)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'pending':
        return <AlertCircle className="h-3 w-3 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-blue-600" />
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
      case 'no_show':
        return <XCircle className="h-3 w-3 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'border-green-200 bg-green-50'
      case 'pending':
        return 'border-yellow-200 bg-yellow-50'
      case 'completed':
        return 'border-blue-200 bg-blue-50'
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
      case 'no_show':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const isCurrentlyDining = (booking: any) => {
    const bookingStart = new Date(booking.booking_time)
    const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
    return isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
  }

  const isPast = (booking: any) => {
    const bookingEnd = addMinutes(new Date(booking.booking_time), booking.turn_time_minutes || 120)
    return bookingEnd < currentTime
  }

  // Check if we have any bookings
  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Timeline</CardTitle>
          <CardDescription>
            {format(currentTime, "EEEE, MMMM d")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No bookings scheduled today</p>
            <p className="text-sm text-muted-foreground mt-1">Add bookings to see them appear on the timeline</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Today's Timeline</CardTitle>
            <CardDescription>
              {format(currentTime, "EEEE, MMMM d")} • {sortedBookings.length} bookings
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
              Dining Now
            </Badge>
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
              Upcoming
            </Badge>
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 rounded-full bg-gray-400 mr-1" />
              Past
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="relative">
            {/* Current time indicator */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" 
                 style={{ 
                   left: `${((currentTime.getHours() - 11 + currentTime.getMinutes() / 60) / 13) * 100}%` 
                 }}
            >
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs font-medium text-red-600 bg-white px-1">
                {format(currentTime, 'h:mm a')}
              </div>
            </div>

            {/* Hour headers */}
            <div className="flex border-b mb-4 pb-2">
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-sm font-medium text-muted-foreground">
                  {format(startOfDay(currentTime).setHours(hour), 'h a')}
                </div>
              ))}
            </div>

            {/* Timeline slots */}
            <div className="space-y-2 min-h-[400px]">
              {hours.map(hour => {
                const hourBookings = bookingsByHour[hour] || []
                
                return (
                  <div key={hour} className="flex min-h-[60px]">
                    <div className="w-20 text-sm text-muted-foreground pt-1">
                      {format(startOfDay(currentTime).setHours(hour), 'h a')}
                    </div>
                    <div className="flex-1 relative border-l pl-4">
                      {hourBookings.length === 0 ? (
                        <div className="h-full flex items-center">
                          <div className="text-xs text-muted-foreground">No bookings</div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {hourBookings.map((booking) => {
                            const isDining = isCurrentlyDining(booking)
                            const hasPassed = isPast(booking)
                            const bookingTime = new Date(booking.booking_time)
                            
                            return (
                              <div
                                key={booking.id}
                                className={cn(
                                  "p-2 rounded border cursor-pointer transition-all hover:shadow-md",
                                  getStatusColor(booking.status),
                                  isDining && "ring-2 ring-green-500",
                                  hasPassed && "opacity-50"
                                )}
                                onClick={() => onSelectBooking(booking)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                      {getStatusIcon(booking.status)}
                                      <p className="text-xs font-medium truncate">
                                        {booking.user?.full_name || booking.guest_name || 'Guest'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="h-3 w-3" />
                                        {format(bookingTime, 'h:mm a')}
                                      </span>
                                      <span className="flex items-center gap-0.5">
                                        <Users className="h-3 w-3" />
                                        {booking.party_size}
                                      </span>
                                      {booking.tables && booking.tables.length > 0 ? (
                                        <span className="flex items-center gap-0.5">
                                          <Table2 className="h-3 w-3" />
                                          {booking.tables.map((t: any) => t.table_number).join(", ")}
                                        </span>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs h-4 px-1">
                                          No table
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {booking.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onUpdateStatus(booking.id, 'confirmed')
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}